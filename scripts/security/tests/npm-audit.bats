#!/usr/bin/env bats
# Feature: security-vulnerability-scanning, Property 1: NPM Severity-Based Blocking
# Property tests for npm-audit.sh
# **Validates: Requirements 1.2, 1.3, 1.4**

# Load bats helpers from scripts/node_modules
load '../../node_modules/bats-support/load'
load '../../node_modules/bats-assert/load'

# Load the npm-audit script (source functions without running main)
setup() {
    # Reset environment variables first
    unset SKIP_SECURITY_SCAN
    unset SEVERITY_THRESHOLD
    unset DEBUG
    
    # Reset source guard to allow re-sourcing in each test
    unset _SECURITY_UTILS_SOURCED
    
    # Source npm-audit.sh which will source utils.sh
    source "$BATS_TEST_DIRNAME/../npm-audit.sh"
}

# =============================================================================
# Helper Functions for Property Testing
# =============================================================================

# Generate random vulnerability counts
# Arguments: max_value (optional, default 10)
generate_random_counts() {
    local max="${1:-10}"
    local critical=$((RANDOM % (max + 1)))
    local high=$((RANDOM % (max + 1)))
    local moderate=$((RANDOM % (max + 1)))
    local low=$((RANDOM % (max + 1)))
    echo "$critical $high $moderate $low"
}

# Generate npm audit JSON with specific vulnerability counts
# Arguments: critical high moderate low
generate_npm_audit_json() {
    local critical="${1:-0}"
    local high="${2:-0}"
    local moderate="${3:-0}"
    local low="${4:-0}"
    local total=$((critical + high + moderate + low))
    
    cat <<EOF
{
  "auditReportVersion": 2,
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": $low,
      "moderate": $moderate,
      "high": $high,
      "critical": $critical,
      "total": $total
    },
    "dependencies": {
      "prod": 100,
      "dev": 50,
      "optional": 5,
      "peer": 10,
      "peerOptional": 0,
      "total": 165
    }
  }
}
EOF
}

# =============================================================================
# Property 1: NPM Severity-Based Blocking
# For any npm audit vulnerability report, the pre-push hook SHALL block the push
# (exit code 1) if and only if the report contains at least one vulnerability
# with severity "high" or "critical".
# **Validates: Requirements 1.2, 1.3, 1.4**
# =============================================================================

@test "Property 1: Block when critical > 0 (threshold=high)" {
    for i in $(seq 1 20); do
        local critical=$((RANDOM % 10 + 1))
        local high=$((RANDOM % 10))
        local moderate=$((RANDOM % 10))
        local low=$((RANDOM % 10))
        
        SEVERITY_THRESHOLD="high"
        run determine_exit_code "$critical" "$high" "$moderate" "$low"
        
        assert_output "$EXIT_BLOCK"
    done
}

@test "Property 1: Block when high > 0 (threshold=high)" {
    for i in $(seq 1 20); do
        local critical=0
        local high=$((RANDOM % 10 + 1))
        local moderate=$((RANDOM % 10))
        local low=$((RANDOM % 10))
        
        SEVERITY_THRESHOLD="high"
        run determine_exit_code "$critical" "$high" "$moderate" "$low"
        
        assert_output "$EXIT_BLOCK"
    done
}

@test "Property 1: Warn when only moderate/low (threshold=high)" {
    for i in $(seq 1 20); do
        local critical=0
        local high=0
        local moderate=$((RANDOM % 10))
        local low=$((RANDOM % 10))
        
        if [[ $moderate -eq 0 && $low -eq 0 ]]; then
            moderate=1
        fi
        
        SEVERITY_THRESHOLD="high"
        run determine_exit_code "$critical" "$high" "$moderate" "$low"
        
        assert_output "$EXIT_WARN"
    done
}

@test "Property 1: Pass when no vulnerabilities (threshold=high)" {
    SEVERITY_THRESHOLD="high"
    run determine_exit_code 0 0 0 0
    assert_output "$EXIT_PASS"
}

@test "Property 1: Block only on critical when threshold=critical" {
    for i in $(seq 1 20); do
        local critical=$((RANDOM % 10 + 1))
        local high=$((RANDOM % 10))
        local moderate=$((RANDOM % 10))
        local low=$((RANDOM % 10))
        
        SEVERITY_THRESHOLD="critical"
        run determine_exit_code "$critical" "$high" "$moderate" "$low"
        
        assert_output "$EXIT_BLOCK"
    done
}

@test "Property 1: Warn on high when threshold=critical" {
    for i in $(seq 1 20); do
        local critical=0
        local high=$((RANDOM % 10 + 1))
        local moderate=$((RANDOM % 10))
        local low=$((RANDOM % 10))
        
        SEVERITY_THRESHOLD="critical"
        run determine_exit_code "$critical" "$high" "$moderate" "$low"
        
        assert_output "$EXIT_WARN"
    done
}

# =============================================================================
# JSON Parsing Tests
# =============================================================================

@test "parse_npm_audit_json extracts correct counts" {
    for i in $(seq 1 20); do
        local critical=$((RANDOM % 20))
        local high=$((RANDOM % 20))
        local moderate=$((RANDOM % 20))
        local low=$((RANDOM % 20))
        
        local json
        json=$(generate_npm_audit_json "$critical" "$high" "$moderate" "$low")
        
        run parse_npm_audit_json "$json"
        assert_output "$critical $high $moderate $low"
    done
}

@test "parse_npm_audit_json handles empty input" {
    run parse_npm_audit_json ""
    assert_output "0 0 0 0"
}

@test "parse_npm_audit_json handles invalid JSON" {
    run parse_npm_audit_json "not valid json"
    assert_output "0 0 0 0"
}

# =============================================================================
# Threshold Configuration Tests
# =============================================================================

@test "Property 1: Threshold 'moderate' blocks on moderate+" {
    for i in $(seq 1 20); do
        local critical=0
        local high=0
        local moderate=$((RANDOM % 10 + 1))
        local low=$((RANDOM % 10))
        
        SEVERITY_THRESHOLD="moderate"
        run determine_exit_code "$critical" "$high" "$moderate" "$low"
        
        assert_output "$EXIT_BLOCK"
    done
}

@test "Property 1: Threshold 'low' blocks on any vulnerability" {
    for i in $(seq 1 20); do
        local critical=0
        local high=0
        local moderate=0
        local low=$((RANDOM % 10 + 1))
        
        SEVERITY_THRESHOLD="low"
        run determine_exit_code "$critical" "$high" "$moderate" "$low"
        
        assert_output "$EXIT_BLOCK"
    done
}

# =============================================================================
# Integration Property Tests
# =============================================================================

@test "Property 1: Full JSON parsing and blocking integration" {
    for i in $(seq 1 20); do
        local critical=$((RANDOM % 5))
        local high=$((RANDOM % 5))
        local moderate=$((RANDOM % 5))
        local low=$((RANDOM % 5))
        
        local json
        json=$(generate_npm_audit_json "$critical" "$high" "$moderate" "$low")
        
        local counts
        counts=$(parse_npm_audit_json "$json")
        read -r parsed_critical parsed_high parsed_moderate parsed_low <<< "$counts"
        
        SEVERITY_THRESHOLD="high"
        run determine_exit_code "$parsed_critical" "$parsed_high" "$parsed_moderate" "$parsed_low"
        
        if [[ $critical -gt 0 || $high -gt 0 ]]; then
            assert_output "$EXIT_BLOCK"
        elif [[ $moderate -gt 0 || $low -gt 0 ]]; then
            assert_output "$EXIT_WARN"
        else
            assert_output "$EXIT_PASS"
        fi
    done
}


# =============================================================================
# Property 4: Workspace Coverage
# For any monorepo with N workspaces containing package.json files, the npm
# audit scanner SHALL invoke npm audit exactly N times (once per workspace).
# **Validates: Requirements 1.1**
# =============================================================================

@test "Property 4: discover_workspaces finds all package.json directories" {
    # Create a temporary directory structure with multiple workspaces
    local temp_dir
    temp_dir=$(mktemp -d)
    
    # Create workspace structure
    mkdir -p "$temp_dir/apps/web"
    mkdir -p "$temp_dir/apps/api"
    mkdir -p "$temp_dir/packages/core"
    mkdir -p "$temp_dir/node_modules/some-package"
    
    # Create package.json files
    echo '{"name": "root"}' > "$temp_dir/package.json"
    echo '{"name": "web"}' > "$temp_dir/apps/web/package.json"
    echo '{"name": "api"}' > "$temp_dir/apps/api/package.json"
    echo '{"name": "core"}' > "$temp_dir/packages/core/package.json"
    echo '{"name": "dep"}' > "$temp_dir/node_modules/some-package/package.json"
    
    # Run discover_workspaces
    run discover_workspaces "$temp_dir"
    
    # Should find 4 workspaces (excluding node_modules)
    local count
    count=$(echo "$output" | grep -c "package.json" || echo "$output" | wc -l | tr -d ' ')
    
    # Verify node_modules is excluded
    refute_output --partial "node_modules"
    
    # Verify we found the expected workspaces
    assert_output --partial "$temp_dir"
    assert_output --partial "apps/web"
    assert_output --partial "apps/api"
    assert_output --partial "packages/core"
    
    # Cleanup
    rm -rf "$temp_dir"
}

@test "Property 4: discover_workspaces excludes node_modules" {
    local temp_dir
    temp_dir=$(mktemp -d)
    
    # Create structure with nested node_modules
    mkdir -p "$temp_dir/src"
    mkdir -p "$temp_dir/node_modules/pkg1"
    mkdir -p "$temp_dir/src/node_modules/pkg2"
    
    echo '{"name": "root"}' > "$temp_dir/package.json"
    echo '{"name": "src"}' > "$temp_dir/src/package.json"
    echo '{"name": "pkg1"}' > "$temp_dir/node_modules/pkg1/package.json"
    echo '{"name": "pkg2"}' > "$temp_dir/src/node_modules/pkg2/package.json"
    
    run discover_workspaces "$temp_dir"
    
    # Should NOT contain node_modules paths
    refute_output --partial "node_modules"
    
    # Should contain valid workspaces
    assert_output --partial "$temp_dir"
    
    rm -rf "$temp_dir"
}

@test "Property 4: workspace count matches package.json count" {
    # Test with random number of workspaces (2-5)
    for i in $(seq 1 10); do
        local temp_dir
        temp_dir=$(mktemp -d)
        
        local workspace_count=$((RANDOM % 4 + 2))
        
        # Create root package.json
        echo '{"name": "root"}' > "$temp_dir/package.json"
        
        # Create N-1 additional workspaces
        for j in $(seq 1 $((workspace_count - 1))); do
            mkdir -p "$temp_dir/workspace$j"
            echo "{\"name\": \"workspace$j\"}" > "$temp_dir/workspace$j/package.json"
        done
        
        run discover_workspaces "$temp_dir"
        
        # Count lines in output
        local found_count
        found_count=$(echo "$output" | grep -v '^$' | wc -l | tr -d ' ')
        
        assert_equal "$found_count" "$workspace_count"
        
        rm -rf "$temp_dir"
    done
}
