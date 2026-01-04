#!/bin/bash

# Lockfile Consistency Verifier
# Verifies package-lock.json consistency across all workspaces
#
# Exit codes:
#   0 - Pass (all lockfiles present and consistent)
#   1 - Block (missing or inconsistent lockfiles)
#   2 - Warning (non-blocking issues found)
#
# Environment variables:
#   SKIP_SECURITY_SCAN - Set to 'true' to skip scanning
#   DEBUG - Set to 'true' for verbose output

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source utility functions
source "$SCRIPT_DIR/utils.sh"

# =============================================================================
# Lockfile Verification Functions
# =============================================================================

# Find all package.json files in workspaces (excluding node_modules)
# Arguments:
#   $1 - Root directory (optional, defaults to current directory)
# Output:
#   List of directories containing package.json, one per line
find_package_json_dirs() {
    local root_dir="${1:-.}"
    
    find "$root_dir" -name "package.json" \
        -not -path "*/node_modules/*" \
        -not -path "*/.git/*" \
        -exec dirname {} \; 2>/dev/null | sort -u
}

# Check if a lockfile exists for a given package.json directory
# Arguments:
#   $1 - Directory containing package.json
# Returns:
#   0 if lockfile exists, 1 if missing
lockfile_exists() {
    local dir="$1"
    [[ -f "$dir/package-lock.json" ]]
}

# Check lockfile consistency using npm ci --dry-run
# Arguments:
#   $1 - Directory containing package.json and package-lock.json
# Returns:
#   0 if consistent, 1 if inconsistent
# Output:
#   Error message if inconsistent
check_lockfile_consistency() {
    local dir="$1"
    local output
    local exit_code=0
    
    log_debug "Checking lockfile consistency in: $dir"
    
    # Run npm ci --dry-run to check if lockfile is in sync
    # npm ci will fail if package-lock.json is out of sync with package.json
    output=$(npm ci --dry-run --prefix "$dir" 2>&1) || exit_code=$?
    
    if [[ $exit_code -ne 0 ]]; then
        # Check for specific error patterns
        if echo "$output" | grep -qi "npm ci can only install packages when your package.json and package-lock.json"; then
            echo "Lockfile out of sync with package.json"
            return 1
        elif echo "$output" | grep -qi "npm ERR!"; then
            echo "Lockfile verification failed: $(echo "$output" | grep -i "npm ERR!" | head -1)"
            return 1
        else
            # Other npm ci errors might indicate inconsistency
            echo "Lockfile may be inconsistent: exit code $exit_code"
            return 1
        fi
    fi
    
    return 0
}

# Verify a single workspace's lockfile
# Arguments:
#   $1 - Directory containing package.json
# Returns:
#   0 = pass, 1 = missing lockfile, 2 = inconsistent lockfile
# Output:
#   Status message
verify_workspace_lockfile() {
    local dir="$1"
    
    # Check if lockfile exists
    if ! lockfile_exists "$dir"; then
        echo "missing"
        return 1
    fi
    
    # Check lockfile consistency
    local consistency_result
    consistency_result=$(check_lockfile_consistency "$dir") || {
        echo "inconsistent:$consistency_result"
        return 2
    }
    
    echo "valid"
    return 0
}

# Get remediation instructions for lockfile issues
# Arguments:
#   $1 - Issue type (missing, inconsistent)
#   $2 - Directory path
# Output:
#   Remediation instructions
get_remediation_instructions() {
    local issue_type="$1"
    local dir="$2"
    
    case "$issue_type" in
        missing)
            echo "  Run 'npm install' in $dir to generate package-lock.json"
            ;;
        inconsistent)
            echo "  Run 'npm install' in $dir to update package-lock.json"
            echo "  Or run 'npm ci' after fixing package.json"
            ;;
        *)
            echo "  Check $dir for lockfile issues"
            ;;
    esac
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    local root_dir="${1:-.}"
    
    # Initialize security scan (checks for skip flag)
    init_security_scan "lockfile-check"
    
    # Check for required commands
    if ! require_command "npm" "Install Node.js from https://nodejs.org"; then
        exit "$EXIT_BLOCK"
    fi
    
    print_header "Lockfile Consistency Check"
    
    # Find all package.json directories
    local package_dirs
    package_dirs=$(find_package_json_dirs "$root_dir")
    
    if [[ -z "$package_dirs" ]]; then
        log_info "No package.json files found to verify"
        exit "$EXIT_PASS"
    fi
    
    local workspace_count=0
    local missing_count=0
    local inconsistent_count=0
    local valid_count=0
    local missing_dirs=()
    local inconsistent_dirs=()
    local inconsistent_reasons=()
    
    # Verify each workspace
    while IFS= read -r dir; do
        [[ -z "$dir" ]] && continue
        
        # Skip if no package.json exists (shouldn't happen but be safe)
        if [[ ! -f "$dir/package.json" ]]; then
            log_debug "Skipping $dir - no package.json"
            continue
        fi
        
        workspace_count=$((workspace_count + 1))
        log_info "Checking: $dir"
        
        # Verify lockfile
        local result
        local verify_exit_code=0
        result=$(verify_workspace_lockfile "$dir") || verify_exit_code=$?
        
        case "$result" in
            valid)
                valid_count=$((valid_count + 1))
                log_success "$dir: Lockfile valid and consistent"
                ;;
            missing)
                missing_count=$((missing_count + 1))
                missing_dirs+=("$dir")
                log_error "$dir: Missing package-lock.json"
                ;;
            inconsistent:*)
                inconsistent_count=$((inconsistent_count + 1))
                inconsistent_dirs+=("$dir")
                local reason="${result#inconsistent:}"
                inconsistent_reasons+=("$reason")
                log_error "$dir: $reason"
                ;;
        esac
        
    done <<< "$package_dirs"
    
    # Print summary
    print_section "Summary"
    echo "  Workspaces checked: $workspace_count"
    echo "  Valid: $valid_count"
    echo "  Missing lockfiles: $missing_count"
    echo "  Inconsistent lockfiles: $inconsistent_count"
    
    # Determine exit code
    local exit_code=$EXIT_PASS
    
    if [[ $missing_count -gt 0 || $inconsistent_count -gt 0 ]]; then
        exit_code=$EXIT_BLOCK
        
        # Print remediation guidance
        print_section "Remediation"
        
        if [[ $missing_count -gt 0 ]]; then
            echo ""
            echo "  Missing lockfiles:"
            for dir in "${missing_dirs[@]}"; do
                get_remediation_instructions "missing" "$dir"
            done
        fi
        
        if [[ $inconsistent_count -gt 0 ]]; then
            echo ""
            echo "  Inconsistent lockfiles:"
            for i in "${!inconsistent_dirs[@]}"; do
                local dir="${inconsistent_dirs[$i]}"
                get_remediation_instructions "inconsistent" "$dir"
            done
        fi
    fi
    
    echo ""
    if [[ $exit_code -eq $EXIT_PASS ]]; then
        log_success "Lockfile check passed"
    else
        log_error "Lockfile check failed"
    fi
    
    # Output JSON result for aggregation
    create_result "lockfile" \
        "$([ $exit_code -eq 0 ] && echo 'pass' || echo 'fail')" \
        "$missing_count" "$inconsistent_count" 0 0 > /dev/null
    
    exit "$exit_code"
}

# Run main if script is executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
