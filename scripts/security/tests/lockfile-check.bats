#!/usr/bin/env bats
# Feature: security-vulnerability-scanning, Property 3: Lockfile Consistency Blocking
# Property tests for lockfile-check.sh
# **Validates: Requirements 3.2, 3.3, 3.4**

# Load bats helpers from scripts/node_modules
load '../../node_modules/bats-support/load'
load '../../node_modules/bats-assert/load'

# Load the lockfile-check script (source functions without running main)
setup() {
    # Reset environment variables first
    unset SKIP_SECURITY_SCAN
    unset DEBUG
    
    # Reset source guard to allow re-sourcing in each test
    unset _SECURITY_UTILS_SOURCED
    
    # Source lockfile-check.sh which will source utils.sh
    source "$BATS_TEST_DIRNAME/../lockfile-check.sh"
}

# =============================================================================
# Helper Functions for Property Testing
# =============================================================================

# Create a minimal valid package.json
# Arguments:
#   $1 - Package name
#   $2 - Optional dependencies JSON object
generate_package_json() {
    local name="${1:-test-package}"
    local deps="${2:-{}}"
    
    cat <<EOF
{
  "name": "$name",
  "version": "1.0.0",
  "dependencies": $deps
}
EOF
}

# Create a minimal valid package-lock.json
# Arguments:
#   $1 - Package name
#   $2 - Optional dependencies JSON object (should match package.json)
generate_package_lock_json() {
    local name="${1:-test-package}"
    local deps="${2:-{}}"
    
    cat <<EOF
{
  "name": "$name",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "$name",
      "version": "1.0.0",
      "dependencies": $deps
    }
  }
}
EOF
}

# Create a workspace directory with package.json
# Arguments:
#   $1 - Base temp directory
#   $2 - Workspace name
#   $3 - Whether to include lockfile (true/false)
#   $4 - Whether lockfile should be consistent (true/false, only if $3 is true)
create_test_workspace() {
    local base_dir="$1"
    local workspace_name="$2"
    local include_lockfile="${3:-true}"
    local consistent="${4:-true}"
    
    local workspace_dir="$base_dir/$workspace_name"
    mkdir -p "$workspace_dir"
    
    # Create package.json
    generate_package_json "$workspace_name" > "$workspace_dir/package.json"
    
    # Create lockfile if requested
    if [[ "$include_lockfile" == "true" ]]; then
        if [[ "$consistent" == "true" ]]; then
            generate_package_lock_json "$workspace_name" > "$workspace_dir/package-lock.json"
        else
            # Create an inconsistent lockfile (different name)
            generate_package_lock_json "different-name" > "$workspace_dir/package-lock.json"
        fi
    fi
    
    echo "$workspace_dir"
}

# =============================================================================
# Property 3: Lockfile Consistency Blocking
# For any workspace with a package.json file, the pre-push hook SHALL block
# the push if and only if the package-lock.json is missing or inconsistent
# with package.json.
# **Validates: Requirements 3.2, 3.3, 3.4**
# =============================================================================

@test "Property 3: lockfile_exists returns true when lockfile present" {
    for i in $(seq 1 5); do
        local temp_dir
        temp_dir=$(mktemp -d)
        
        # Create workspace with lockfile
        local workspace_dir
        workspace_dir=$(create_test_workspace "$temp_dir" "test-pkg-$i" "true" "true")
        
        run lockfile_exists "$workspace_dir"
        assert_success
        
        rm -rf "$temp_dir"
    done
}

@test "Property 3: lockfile_exists returns false when lockfile missing" {
    for i in $(seq 1 5); do
        local temp_dir
        temp_dir=$(mktemp -d)
        
        # Create workspace without lockfile
        local workspace_dir
        workspace_dir=$(create_test_workspace "$temp_dir" "test-pkg-$i" "false")
        
        run lockfile_exists "$workspace_dir"
        assert_failure
        
        rm -rf "$temp_dir"
    done
}

@test "Property 3: verify_workspace_lockfile returns 'missing' for missing lockfile" {
    for i in $(seq 1 3); do
        local temp_dir
        temp_dir=$(mktemp -d)
        
        # Create workspace without lockfile
        local workspace_dir
        workspace_dir=$(create_test_workspace "$temp_dir" "test-pkg-$i" "false")
        
        run verify_workspace_lockfile "$workspace_dir"
        assert_failure
        assert_output "missing"
        
        rm -rf "$temp_dir"
    done
}

@test "Property 3: verify_workspace_lockfile returns 'valid' for valid lockfile" {
    for i in $(seq 1 3); do
        local temp_dir
        temp_dir=$(mktemp -d)
        
        # Create workspace with valid lockfile
        local workspace_dir
        workspace_dir=$(create_test_workspace "$temp_dir" "test-pkg-$i" "true" "true")
        
        run verify_workspace_lockfile "$workspace_dir"
        assert_success
        assert_output "valid"
        
        rm -rf "$temp_dir"
    done
}

# =============================================================================
# Workspace Discovery Tests
# =============================================================================

@test "Property 3: find_package_json_dirs finds all package.json directories" {
    local temp_dir
    temp_dir=$(mktemp -d)
    
    # Create multiple workspaces
    local workspace_count=$((RANDOM % 4 + 2))
    
    for i in $(seq 1 "$workspace_count"); do
        mkdir -p "$temp_dir/workspace$i"
        echo '{"name": "ws'$i'"}' > "$temp_dir/workspace$i/package.json"
    done
    
    # Also create a node_modules directory that should be excluded
    mkdir -p "$temp_dir/node_modules/some-pkg"
    echo '{"name": "excluded"}' > "$temp_dir/node_modules/some-pkg/package.json"
    
    run find_package_json_dirs "$temp_dir"
    
    # Should find all workspaces
    local found_count
    found_count=$(echo "$output" | grep -v '^$' | wc -l | tr -d ' ')
    assert_equal "$found_count" "$workspace_count"
    
    # Should NOT include node_modules
    refute_output --partial "node_modules"
    
    rm -rf "$temp_dir"
}

@test "Property 3: find_package_json_dirs excludes node_modules at any depth" {
    local temp_dir
    temp_dir=$(mktemp -d)
    
    # Create valid workspace
    mkdir -p "$temp_dir/src"
    echo '{"name": "src"}' > "$temp_dir/src/package.json"
    
    # Create nested node_modules
    mkdir -p "$temp_dir/src/node_modules/pkg1"
    echo '{"name": "pkg1"}' > "$temp_dir/src/node_modules/pkg1/package.json"
    
    mkdir -p "$temp_dir/node_modules/pkg2/node_modules/pkg3"
    echo '{"name": "pkg2"}' > "$temp_dir/node_modules/pkg2/package.json"
    echo '{"name": "pkg3"}' > "$temp_dir/node_modules/pkg2/node_modules/pkg3/package.json"
    
    run find_package_json_dirs "$temp_dir"
    
    # Should only find src
    assert_output --partial "src"
    refute_output --partial "node_modules"
    
    rm -rf "$temp_dir"
}

# =============================================================================
# Remediation Instructions Tests
# =============================================================================

@test "Property 3: get_remediation_instructions provides correct guidance for missing lockfile" {
    local test_dir="/path/to/workspace"
    
    run get_remediation_instructions "missing" "$test_dir"
    
    assert_output --partial "npm install"
    assert_output --partial "$test_dir"
}

@test "Property 3: get_remediation_instructions provides correct guidance for inconsistent lockfile" {
    local test_dir="/path/to/workspace"
    
    run get_remediation_instructions "inconsistent" "$test_dir"
    
    assert_output --partial "npm install"
    assert_output --partial "$test_dir"
}

# =============================================================================
# Integration Property Tests
# =============================================================================

@test "Property 3: Multiple workspaces - all valid should pass" {
    local temp_dir
    temp_dir=$(mktemp -d)
    
    # Create multiple valid workspaces
    for i in $(seq 1 3); do
        create_test_workspace "$temp_dir" "valid-ws-$i" "true" "true" > /dev/null
    done
    
    # Find all workspaces
    local dirs
    dirs=$(find_package_json_dirs "$temp_dir")
    
    local all_valid=true
    while IFS= read -r dir; do
        [[ -z "$dir" ]] && continue
        
        local result
        result=$(verify_workspace_lockfile "$dir") || {
            all_valid=false
            break
        }
        
        if [[ "$result" != "valid" ]]; then
            all_valid=false
            break
        fi
    done <<< "$dirs"
    
    assert_equal "$all_valid" "true"
    
    rm -rf "$temp_dir"
}

@test "Property 3: Multiple workspaces - one missing should fail" {
    local temp_dir
    temp_dir=$(mktemp -d)
    
    # Create valid workspaces
    create_test_workspace "$temp_dir" "valid-ws-1" "true" "true" > /dev/null
    create_test_workspace "$temp_dir" "valid-ws-2" "true" "true" > /dev/null
    
    # Create one workspace without lockfile
    create_test_workspace "$temp_dir" "missing-ws" "false" > /dev/null
    
    # Find all workspaces
    local dirs
    dirs=$(find_package_json_dirs "$temp_dir")
    
    local has_failure=false
    while IFS= read -r dir; do
        [[ -z "$dir" ]] && continue
        
        local result
        result=$(verify_workspace_lockfile "$dir") || {
            has_failure=true
        }
    done <<< "$dirs"
    
    assert_equal "$has_failure" "true"
    
    rm -rf "$temp_dir"
}

@test "Property 3: Empty directory returns no workspaces" {
    local temp_dir
    temp_dir=$(mktemp -d)
    
    run find_package_json_dirs "$temp_dir"
    
    # Output should be empty
    assert_output ""
    
    rm -rf "$temp_dir"
}

# =============================================================================
# Exit Code Tests
# =============================================================================

@test "Property 3: EXIT_PASS is 0" {
    assert_equal "$EXIT_PASS" "0"
}

@test "Property 3: EXIT_BLOCK is 1" {
    assert_equal "$EXIT_BLOCK" "1"
}

# =============================================================================
# Random Workspace Count Tests
# =============================================================================

@test "Property 3: Random workspace count - all with lockfiles should pass" {
    for iteration in $(seq 1 3); do
        local temp_dir
        temp_dir=$(mktemp -d)
        
        # Random number of workspaces (1-5)
        local workspace_count=$((RANDOM % 5 + 1))
        
        # Create all workspaces with valid lockfiles
        for i in $(seq 1 "$workspace_count"); do
            create_test_workspace "$temp_dir" "ws-$i" "true" "true" > /dev/null
        done
        
        # Verify all workspaces
        local dirs
        dirs=$(find_package_json_dirs "$temp_dir")
        
        local found_count=0
        local valid_count=0
        
        while IFS= read -r dir; do
            [[ -z "$dir" ]] && continue
            found_count=$((found_count + 1))
            
            local result
            result=$(verify_workspace_lockfile "$dir") || true
            
            if [[ "$result" == "valid" ]]; then
                valid_count=$((valid_count + 1))
            fi
        done <<< "$dirs"
        
        # All should be valid
        assert_equal "$found_count" "$workspace_count"
        assert_equal "$valid_count" "$workspace_count"
        
        rm -rf "$temp_dir"
    done
}

@test "Property 3: Random workspace count - missing lockfiles should be detected" {
    for iteration in $(seq 1 3); do
        local temp_dir
        temp_dir=$(mktemp -d)
        
        # Random number of workspaces (2-5)
        local workspace_count=$((RANDOM % 4 + 2))
        
        # Random number of missing lockfiles (1 to workspace_count-1)
        local missing_count=$((RANDOM % (workspace_count - 1) + 1))
        
        # Create workspaces
        for i in $(seq 1 "$workspace_count"); do
            if [[ $i -le $missing_count ]]; then
                # Create without lockfile
                create_test_workspace "$temp_dir" "ws-$i" "false" > /dev/null
            else
                # Create with lockfile
                create_test_workspace "$temp_dir" "ws-$i" "true" "true" > /dev/null
            fi
        done
        
        # Count missing lockfiles
        local dirs
        dirs=$(find_package_json_dirs "$temp_dir")
        
        local detected_missing=0
        
        while IFS= read -r dir; do
            [[ -z "$dir" ]] && continue
            
            local result
            result=$(verify_workspace_lockfile "$dir") || true
            
            if [[ "$result" == "missing" ]]; then
                detected_missing=$((detected_missing + 1))
            fi
        done <<< "$dirs"
        
        # Should detect all missing lockfiles
        assert_equal "$detected_missing" "$missing_count"
        
        rm -rf "$temp_dir"
    done
}
