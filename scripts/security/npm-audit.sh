#!/bin/bash

# NPM Audit Security Scanner
# Scans all workspace packages for npm dependency vulnerabilities
#
# Exit codes:
#   0 - Pass (no blocking issues)
#   1 - Block (blocking issues found - high/critical vulnerabilities)
#   2 - Warning (non-blocking issues found - moderate/low vulnerabilities)
#
# Environment variables:
#   SKIP_SECURITY_SCAN - Set to 'true' to skip scanning
#   SEVERITY_THRESHOLD - Minimum severity to block (default: high)
#   DEBUG - Set to 'true' for verbose output

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source utility functions
source "$SCRIPT_DIR/utils.sh"

# =============================================================================
# NPM Audit Functions
# =============================================================================

# Parse npm audit JSON output and extract vulnerability counts
# Arguments:
#   $1 - JSON output from npm audit
# Output:
#   Space-separated counts: critical high moderate low
parse_npm_audit_json() {
    local json_output="$1"
    
    # Handle empty or invalid JSON
    if [[ -z "$json_output" ]] || ! echo "$json_output" | jq -e . &>/dev/null; then
        echo "0 0 0 0"
        return
    fi
    
    # Extract vulnerability counts from npm audit JSON
    # npm audit --json returns vulnerabilities in metadata.vulnerabilities
    local critical high moderate low
    
    critical=$(echo "$json_output" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
    high=$(echo "$json_output" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
    moderate=$(echo "$json_output" | jq -r '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo "0")
    low=$(echo "$json_output" | jq -r '.metadata.vulnerabilities.low // 0' 2>/dev/null || echo "0")
    
    echo "$critical $high $moderate $low"
}

# Extract vulnerability details from npm audit JSON
# Arguments:
#   $1 - JSON output from npm audit
# Output:
#   Formatted vulnerability details
extract_vulnerability_details() {
    local json_output="$1"
    
    if [[ -z "$json_output" ]] || ! echo "$json_output" | jq -e . &>/dev/null; then
        return
    fi
    
    # Extract vulnerabilities array
    echo "$json_output" | jq -r '
        .vulnerabilities // {} | to_entries[] | 
        "\(.value.severity | ascii_upcase): \(.key)@\(.value.range // "unknown") - \(.value.via[0].title // .value.via[0] // "No description")"
    ' 2>/dev/null || true
}

# Run npm audit for a single workspace
# Arguments:
#   $1 - Workspace directory path
# Returns:
#   Exit code based on vulnerabilities found
run_npm_audit_for_workspace() {
    local workspace="$1"
    local audit_output
    local exit_code=0
    
    log_debug "Running npm audit in: $workspace"
    
    # Run npm audit and capture output
    # npm audit returns non-zero exit code when vulnerabilities are found
    audit_output=$(npm audit --json --prefix "$workspace" 2>/dev/null) || true
    
    echo "$audit_output"
}

# Discover all npm workspaces in the project
# Output:
#   List of workspace directories, one per line
discover_workspaces() {
    local root_dir="${1:-.}"
    
    # First try npm query for workspace discovery (npm 8.5+)
    if npm query .workspace &>/dev/null 2>&1; then
        local workspaces
        workspaces=$(npm query .workspace 2>/dev/null | jq -r '.[].location' 2>/dev/null)
        
        if [[ -n "$workspaces" ]]; then
            echo "$workspaces"
            return
        fi
    fi
    
    # Fallback: find package.json files excluding node_modules
    find "$root_dir" -name "package.json" \
        -not -path "*/node_modules/*" \
        -not -path "*/.git/*" \
        -exec dirname {} \; 2>/dev/null | sort -u
}

# Determine exit code based on vulnerability counts and threshold
# Arguments:
#   $1 - Critical count
#   $2 - High count
#   $3 - Moderate count
#   $4 - Low count
#   $5 - Severity threshold (optional, defaults to env var or 'high')
# Returns:
#   0 = pass, 1 = block, 2 = warn
determine_exit_code() {
    local critical="${1:-0}"
    local high="${2:-0}"
    local moderate="${3:-0}"
    local low="${4:-0}"
    local threshold="${5:-$(get_severity_threshold)}"
    
    # Convert threshold to lowercase
    threshold=$(echo "$threshold" | tr '[:upper:]' '[:lower:]')
    
    case "$threshold" in
        critical)
            # Block only on critical
            if [[ $critical -gt 0 ]]; then
                echo "$EXIT_BLOCK"
            elif [[ $high -gt 0 || $moderate -gt 0 || $low -gt 0 ]]; then
                echo "$EXIT_WARN"
            else
                echo "$EXIT_PASS"
            fi
            ;;
        high)
            # Block on high or critical
            if [[ $critical -gt 0 || $high -gt 0 ]]; then
                echo "$EXIT_BLOCK"
            elif [[ $moderate -gt 0 || $low -gt 0 ]]; then
                echo "$EXIT_WARN"
            else
                echo "$EXIT_PASS"
            fi
            ;;
        moderate)
            # Block on moderate, high, or critical
            if [[ $critical -gt 0 || $high -gt 0 || $moderate -gt 0 ]]; then
                echo "$EXIT_BLOCK"
            elif [[ $low -gt 0 ]]; then
                echo "$EXIT_WARN"
            else
                echo "$EXIT_PASS"
            fi
            ;;
        low)
            # Block on any vulnerability
            if [[ $critical -gt 0 || $high -gt 0 || $moderate -gt 0 || $low -gt 0 ]]; then
                echo "$EXIT_BLOCK"
            else
                echo "$EXIT_PASS"
            fi
            ;;
        *)
            # Default to high threshold
            if [[ $critical -gt 0 || $high -gt 0 ]]; then
                echo "$EXIT_BLOCK"
            elif [[ $moderate -gt 0 || $low -gt 0 ]]; then
                echo "$EXIT_WARN"
            else
                echo "$EXIT_PASS"
            fi
            ;;
    esac
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    # Initialize security scan (checks for skip flag)
    init_security_scan "npm-audit"
    
    # Check for required commands
    if ! require_command "npm" "Install Node.js from https://nodejs.org"; then
        exit "$EXIT_BLOCK"
    fi
    
    if ! require_command "jq" "Install jq from https://stedolan.github.io/jq/"; then
        exit "$EXIT_BLOCK"
    fi
    
    print_header "NPM Security Audit"
    
    # Discover workspaces
    local workspaces
    workspaces=$(discover_workspaces)
    
    if [[ -z "$workspaces" ]]; then
        log_warning "No workspaces found to scan"
        exit "$EXIT_PASS"
    fi
    
    local workspace_count=0
    local total_critical=0
    local total_high=0
    local total_moderate=0
    local total_low=0
    local all_details=""
    
    # Scan each workspace
    while IFS= read -r workspace; do
        [[ -z "$workspace" ]] && continue
        
        # Skip if no package.json exists
        if [[ ! -f "$workspace/package.json" ]]; then
            log_debug "Skipping $workspace - no package.json"
            continue
        fi
        
        workspace_count=$((workspace_count + 1))
        log_info "Scanning: $workspace"
        
        # Run npm audit
        local audit_output
        audit_output=$(run_npm_audit_for_workspace "$workspace")
        
        # Parse results
        local counts
        counts=$(parse_npm_audit_json "$audit_output")
        read -r critical high moderate low <<< "$counts"
        
        # Accumulate totals
        total_critical=$((total_critical + critical))
        total_high=$((total_high + high))
        total_moderate=$((total_moderate + moderate))
        total_low=$((total_low + low))
        
        # Collect vulnerability details
        local details
        details=$(extract_vulnerability_details "$audit_output")
        if [[ -n "$details" ]]; then
            all_details+="
── $workspace ──
$details"
        fi
        
        # Log workspace results
        local workspace_total=$((critical + high + moderate + low))
        if [[ $workspace_total -gt 0 ]]; then
            log_warning "$workspace: $workspace_total vulnerabilities (critical: $critical, high: $high, moderate: $moderate, low: $low)"
        else
            log_success "$workspace: No vulnerabilities found"
        fi
        
    done <<< "$workspaces"
    
    # Print summary
    print_section "Summary"
    echo "  Workspaces scanned: $workspace_count"
    local total=$((total_critical + total_high + total_moderate + total_low))
    echo "  Total vulnerabilities: $total"
    
    if [[ $total -gt 0 ]]; then
        print_severity "critical" "$total_critical"
        print_severity "high" "$total_high"
        print_severity "moderate" "$total_moderate"
        print_severity "low" "$total_low"
        
        # Print details if any
        if [[ -n "$all_details" ]]; then
            print_section "Vulnerability Details"
            echo "$all_details"
        fi
        
        # Print remediation guidance
        print_section "Remediation"
        echo "  Run 'npm audit fix' to automatically fix vulnerabilities"
        echo "  Run 'npm audit fix --force' for breaking changes (use with caution)"
    fi
    
    # Determine final exit code
    local exit_code
    exit_code=$(determine_exit_code "$total_critical" "$total_high" "$total_moderate" "$total_low")
    
    local threshold
    threshold=$(get_severity_threshold)
    
    echo ""
    if [[ $exit_code -eq $EXIT_PASS ]]; then
        log_success "NPM audit passed"
    elif [[ $exit_code -eq $EXIT_WARN ]]; then
        log_warning "NPM audit completed with warnings (below $threshold threshold)"
    else
        log_error "NPM audit failed (vulnerabilities at or above $threshold severity)"
    fi
    
    # Output JSON result for aggregation
    create_result "npm" \
        "$([ $exit_code -eq 0 ] && echo 'pass' || ([ $exit_code -eq 2 ] && echo 'warn' || echo 'fail'))" \
        "$total_critical" "$total_high" "$total_moderate" "$total_low" > /dev/null
    
    exit "$exit_code"
}

# Run main if script is executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
