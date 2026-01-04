#!/bin/bash

# Security Scan Report Aggregator
# Aggregates results from all security scanners into a unified report
#
# Exit codes:
#   0 - Pass (no blocking issues from any scanner)
#   1 - Block (at least one scanner reported blocking issues)
#   2 - Warning (at least one scanner reported warnings, no blocks)
#
# Environment variables:
#   SKIP_SECURITY_SCAN - Set to 'true' to skip scanning
#   DEBUG - Set to 'true' for verbose output
#
# Usage:
#   aggregate-report.sh [npm_result_file] [docker_result_file] [lockfile_result_file]
#   
#   Or pipe JSON results:
#   echo '{"scanner":"npm","status":"pass",...}' | aggregate-report.sh --stdin

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source utility functions
source "$SCRIPT_DIR/utils.sh"

# =============================================================================
# Result Data Structure
# =============================================================================

# Results are stored as JSON objects with the following structure:
# {
#   "scanner": "npm|docker|lockfile",
#   "timestamp": "ISO8601 timestamp",
#   "status": "pass|warn|fail",
#   "summary": {
#     "total": number,
#     "critical": number,
#     "high": number,
#     "moderate": number,
#     "low": number
#   },
#   "vulnerabilities": [...]  // Optional detailed list
# }

# =============================================================================
# Aggregation Functions
# =============================================================================

# Parse a result JSON and extract key fields
# Arguments:
#   $1 - JSON result string
# Output:
#   Space-separated: scanner status critical high moderate low
parse_result_json() {
    local json="$1"
    
    if [[ -z "$json" ]] || ! echo "$json" | jq -e . &>/dev/null; then
        echo "unknown unknown 0 0 0 0"
        return
    fi
    
    local scanner status critical high moderate low
    scanner=$(echo "$json" | jq -r '.scanner // "unknown"')
    status=$(echo "$json" | jq -r '.status // "unknown"')
    critical=$(echo "$json" | jq -r '.summary.critical // 0')
    high=$(echo "$json" | jq -r '.summary.high // 0')
    moderate=$(echo "$json" | jq -r '.summary.moderate // 0')
    low=$(echo "$json" | jq -r '.summary.low // 0')
    
    echo "$scanner $status $critical $high $moderate $low"
}

# Calculate totals from multiple results
# Arguments:
#   $@ - Array of "critical high moderate low" strings
# Output:
#   Space-separated totals: critical high moderate low total
calculate_totals() {
    local total_critical=0
    local total_high=0
    local total_moderate=0
    local total_low=0
    
    for counts in "$@"; do
        read -r critical high moderate low <<< "$counts"
        total_critical=$((total_critical + critical))
        total_high=$((total_high + high))
        total_moderate=$((total_moderate + moderate))
        total_low=$((total_low + low))
    done
    
    local grand_total=$((total_critical + total_high + total_moderate + total_low))
    echo "$total_critical $total_high $total_moderate $total_low $grand_total"
}

# Determine overall status from individual scanner statuses
# Arguments:
#   $@ - Array of status strings (pass, warn, fail)
# Output:
#   Overall status: pass, warn, or fail
determine_overall_status() {
    local has_fail=false
    local has_warn=false
    
    for status in "$@"; do
        case "$status" in
            fail|block)
                has_fail=true
                ;;
            warn|warning)
                has_warn=true
                ;;
        esac
    done
    
    if [[ "$has_fail" == "true" ]]; then
        echo "fail"
    elif [[ "$has_warn" == "true" ]]; then
        echo "warn"
    else
        echo "pass"
    fi
}

# Convert status to exit code
# Arguments:
#   $1 - Status string (pass, warn, fail)
# Output:
#   Exit code (0, 1, or 2)
status_to_exit_code() {
    local status="$1"
    
    case "$status" in
        pass)
            echo "$EXIT_PASS"
            ;;
        warn|warning)
            echo "$EXIT_WARN"
            ;;
        fail|block)
            echo "$EXIT_BLOCK"
            ;;
        *)
            echo "$EXIT_PASS"
            ;;
    esac
}

# =============================================================================
# Report Formatting Functions
# =============================================================================

# Format the unified summary header
# Arguments:
#   $1 - Total vulnerability count
#   $2 - Number of scanners run
format_summary_header() {
    local total="$1"
    local scanner_count="$2"
    
    print_header "SECURITY SCAN SUMMARY" 50
    echo ""
    echo "  Scanners executed: $scanner_count"
    echo "  Total vulnerabilities: $total"
}

# Format severity breakdown
# Arguments:
#   $1 - Critical count
#   $2 - High count
#   $3 - Moderate count
#   $4 - Low count
format_severity_breakdown() {
    local critical="$1"
    local high="$2"
    local moderate="$3"
    local low="$4"
    
    print_section "Severity Breakdown"
    print_severity "critical" "$critical"
    print_severity "high" "$high"
    print_severity "moderate" "$moderate"
    print_severity "low" "$low"
}

# Format individual scanner results
# Arguments:
#   $1 - Scanner name
#   $2 - Status
#   $3 - Critical count
#   $4 - High count
#   $5 - Moderate count
#   $6 - Low count
format_scanner_result() {
    local scanner="$1"
    local status="$2"
    local critical="$3"
    local high="$4"
    local moderate="$5"
    local low="$6"
    local total=$((critical + high + moderate + low))
    
    local status_icon
    case "$status" in
        pass)
            status_icon="${COLOR_GREEN}✓${COLOR_RESET}"
            ;;
        warn|warning)
            status_icon="${COLOR_YELLOW}⚠${COLOR_RESET}"
            ;;
        fail|block)
            status_icon="${COLOR_RED}✗${COLOR_RESET}"
            ;;
        *)
            status_icon="?"
            ;;
    esac
    
    echo -e "  $status_icon ${COLOR_BOLD}$scanner${COLOR_RESET}: $total vulnerabilities (C:$critical H:$high M:$moderate L:$low)"
}

# Format the final status message
# Arguments:
#   $1 - Overall status (pass, warn, fail)
format_final_status() {
    local status="$1"
    
    echo ""
    case "$status" in
        pass)
            log_success "All security scans passed"
            ;;
        warn)
            log_warning "Security scans completed with warnings"
            ;;
        fail)
            log_error "Security scans failed - blocking issues found"
            ;;
    esac
}

# =============================================================================
# Vulnerability Detail Formatting Functions
# =============================================================================

# Extract vulnerability details from a result JSON
# Arguments:
#   $1 - JSON result string
# Output:
#   Formatted vulnerability details
extract_vulnerabilities() {
    local json="$1"
    
    if [[ -z "$json" ]] || ! echo "$json" | jq -e . &>/dev/null; then
        return
    fi
    
    # Extract vulnerabilities array if present
    echo "$json" | jq -r '
        .vulnerabilities // [] | .[] |
        "  \(.severity | ascii_upcase): \(.package)@\(.version) - \(.id // "N/A") - \(.description // "No description")"
    ' 2>/dev/null || true
}

# Format a single vulnerability entry
# Arguments:
#   $1 - Severity (critical, high, moderate, low)
#   $2 - Package name
#   $3 - Version
#   $4 - CVE ID (optional)
#   $5 - Description (optional)
#   $6 - Fixed version (optional)
format_vulnerability_entry() {
    local severity="$1"
    local package="$2"
    local version="$3"
    local cve_id="${4:-N/A}"
    local description="${5:-No description}"
    local fixed_in="${6:-}"
    
    local color
    case "${severity,,}" in
        critical) color="$COLOR_RED" ;;
        high)     color="$COLOR_MAGENTA" ;;
        moderate|medium) color="$COLOR_YELLOW" ;;
        low)      color="$COLOR_CYAN" ;;
        *)        color="$COLOR_WHITE" ;;
    esac
    
    echo -e "  ${color}${severity^^}${COLOR_RESET}: ${package}@${version}"
    if [[ "$cve_id" != "N/A" && -n "$cve_id" ]]; then
        echo "    CVE: $cve_id"
    fi
    if [[ -n "$description" && "$description" != "No description" ]]; then
        # Truncate long descriptions
        local truncated_desc="${description:0:80}"
        if [[ ${#description} -gt 80 ]]; then
            truncated_desc="${truncated_desc}..."
        fi
        echo "    Description: $truncated_desc"
    fi
    if [[ -n "$fixed_in" ]]; then
        echo "    Fixed in: $fixed_in"
    fi
}

# Format vulnerability details section
# Arguments:
#   $@ - Array of JSON result strings
format_vulnerability_details() {
    local results=("$@")
    local has_vulnerabilities=false
    
    for result in "${results[@]}"; do
        local vulns
        vulns=$(echo "$result" | jq -r '.vulnerabilities // []' 2>/dev/null)
        
        if [[ "$vulns" != "[]" && -n "$vulns" ]]; then
            has_vulnerabilities=true
            break
        fi
    done
    
    if [[ "$has_vulnerabilities" != "true" ]]; then
        return
    fi
    
    print_section "Vulnerability Details"
    
    for result in "${results[@]}"; do
        local scanner
        scanner=$(echo "$result" | jq -r '.scanner // "unknown"' 2>/dev/null)
        
        local vulns
        vulns=$(echo "$result" | jq -c '.vulnerabilities // []' 2>/dev/null)
        
        if [[ "$vulns" == "[]" || -z "$vulns" ]]; then
            continue
        fi
        
        echo ""
        echo -e "  ${COLOR_BOLD}── $scanner ──${COLOR_RESET}"
        
        # Parse and format each vulnerability
        echo "$result" | jq -r '
            .vulnerabilities // [] | .[:10][] |
            "\(.severity // "unknown")|\(.package // "unknown")|\(.version // "unknown")|\(.id // "")|\(.description // "")|\(.fixedIn // "")"
        ' 2>/dev/null | while IFS='|' read -r severity package version cve_id description fixed_in; do
            format_vulnerability_entry "$severity" "$package" "$version" "$cve_id" "$description" "$fixed_in"
        done
        
        # Check if there are more vulnerabilities
        local vuln_count
        vuln_count=$(echo "$result" | jq '.vulnerabilities // [] | length' 2>/dev/null || echo "0")
        if [[ $vuln_count -gt 10 ]]; then
            echo "    ... and $((vuln_count - 10)) more vulnerabilities"
        fi
    done
}

# Format remediation guidance section
# Arguments:
#   $@ - Array of JSON result strings
format_remediation_guidance() {
    local results=("$@")
    local has_npm=false
    local has_docker=false
    local has_lockfile=false
    local npm_packages=()
    local docker_images=()
    
    for result in "${results[@]}"; do
        local scanner status
        scanner=$(echo "$result" | jq -r '.scanner // "unknown"' 2>/dev/null)
        status=$(echo "$result" | jq -r '.status // "pass"' 2>/dev/null)
        
        if [[ "$status" == "pass" ]]; then
            continue
        fi
        
        case "$scanner" in
            npm)
                has_npm=true
                # Extract affected packages for npm
                local pkgs
                pkgs=$(echo "$result" | jq -r '.vulnerabilities // [] | .[].package // empty' 2>/dev/null | sort -u)
                if [[ -n "$pkgs" ]]; then
                    while IFS= read -r pkg; do
                        npm_packages+=("$pkg")
                    done <<< "$pkgs"
                fi
                ;;
            docker)
                has_docker=true
                ;;
            lockfile)
                has_lockfile=true
                ;;
        esac
    done
    
    # Only show remediation if there are issues
    if [[ "$has_npm" != "true" && "$has_docker" != "true" && "$has_lockfile" != "true" ]]; then
        return
    fi
    
    print_section "Remediation Guidance"
    
    if [[ "$has_npm" == "true" ]]; then
        echo ""
        echo -e "  ${COLOR_BOLD}NPM Dependencies:${COLOR_RESET}"
        echo "    • Run 'npm audit fix' to automatically fix vulnerabilities"
        echo "    • Run 'npm audit fix --force' for breaking changes (use with caution)"
        if [[ ${#npm_packages[@]} -gt 0 ]]; then
            echo "    • Affected packages:"
            for pkg in "${npm_packages[@]:0:5}"; do
                local fixed_version
                fixed_version=$(get_npm_fix_version "$pkg" 2>/dev/null || echo "")
                if [[ -n "$fixed_version" ]]; then
                    echo "      - npm update $pkg  # Update to $fixed_version"
                else
                    echo "      - npm update $pkg"
                fi
            done
            if [[ ${#npm_packages[@]} -gt 5 ]]; then
                echo "      ... and $((${#npm_packages[@]} - 5)) more packages"
            fi
        fi
    fi
    
    if [[ "$has_docker" == "true" ]]; then
        echo ""
        echo -e "  ${COLOR_BOLD}Docker Images:${COLOR_RESET}"
        echo "    • Update base images to latest patched versions"
        echo "    • Run 'trivy image <image>' for detailed vulnerability info"
        echo "    • Consider using distroless or minimal base images"
    fi
    
    if [[ "$has_lockfile" == "true" ]]; then
        echo ""
        echo -e "  ${COLOR_BOLD}Lockfile Issues:${COLOR_RESET}"
        echo "    • Run 'npm install' to regenerate package-lock.json"
        echo "    • Ensure package.json and package-lock.json are in sync"
        echo "    • Commit the updated lockfile"
    fi
}

# Get the fix version for an npm package (helper function)
# Arguments:
#   $1 - Package name
# Output:
#   Fixed version or empty string
get_npm_fix_version() {
    local package="$1"
    # This is a placeholder - in real usage, this would query npm registry
    # For now, return empty to indicate no specific version known
    echo ""
}

# =============================================================================
# Result Collection Functions
# =============================================================================

# Read result from a file
# Arguments:
#   $1 - File path
# Output:
#   JSON content or empty string
read_result_file() {
    local file="$1"
    
    if [[ -f "$file" ]]; then
        cat "$file"
    else
        echo ""
    fi
}

# Collect results from stdin (one JSON per line)
# Output:
#   Array of JSON strings
collect_stdin_results() {
    local results=()
    
    while IFS= read -r line; do
        if [[ -n "$line" ]] && echo "$line" | jq -e . &>/dev/null; then
            results+=("$line")
        fi
    done
    
    printf '%s\n' "${results[@]}"
}

# =============================================================================
# Aggregated Report Generation
# =============================================================================

# Generate the aggregated report
# Arguments:
#   $@ - Array of JSON result strings
# Output:
#   Formatted report to stdout
# Returns:
#   Exit code based on overall status
generate_aggregated_report() {
    local results=("$@")
    local scanner_count=${#results[@]}
    
    if [[ $scanner_count -eq 0 ]]; then
        log_warning "No scanner results to aggregate"
        return "$EXIT_PASS"
    fi
    
    # Parse all results
    local parsed_results=()
    local statuses=()
    local counts=()
    
    for result in "${results[@]}"; do
        local parsed
        parsed=$(parse_result_json "$result")
        parsed_results+=("$parsed")
        
        read -r scanner status critical high moderate low <<< "$parsed"
        statuses+=("$status")
        counts+=("$critical $high $moderate $low")
    done
    
    # Calculate totals
    local totals
    totals=$(calculate_totals "${counts[@]}")
    read -r total_critical total_high total_moderate total_low grand_total <<< "$totals"
    
    # Determine overall status
    local overall_status
    overall_status=$(determine_overall_status "${statuses[@]}")
    
    # Format and output report
    format_summary_header "$grand_total" "$scanner_count"
    
    if [[ $grand_total -gt 0 ]]; then
        format_severity_breakdown "$total_critical" "$total_high" "$total_moderate" "$total_low"
    fi
    
    print_section "Scanner Results"
    for parsed in "${parsed_results[@]}"; do
        read -r scanner status critical high moderate low <<< "$parsed"
        format_scanner_result "$scanner" "$status" "$critical" "$high" "$moderate" "$low"
    done
    
    # Format vulnerability details (affected packages with versions, CVE IDs)
    format_vulnerability_details "${results[@]}"
    
    # Format remediation guidance
    format_remediation_guidance "${results[@]}"
    
    format_final_status "$overall_status"
    
    # Return appropriate exit code
    local exit_code
    exit_code=$(status_to_exit_code "$overall_status")
    return "$exit_code"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    # Initialize security scan (checks for skip flag)
    init_security_scan "aggregate-report"
    
    # Check for required commands
    if ! require_command "jq" "Install jq from https://stedolan.github.io/jq/"; then
        exit "$EXIT_BLOCK"
    fi
    
    local results=()
    
    # Check for --stdin flag
    if [[ "${1:-}" == "--stdin" ]]; then
        # Read results from stdin
        while IFS= read -r line; do
            if [[ -n "$line" ]] && echo "$line" | jq -e . &>/dev/null; then
                results+=("$line")
            fi
        done
    else
        # Read results from files passed as arguments
        for file in "$@"; do
            local content
            content=$(read_result_file "$file")
            if [[ -n "$content" ]]; then
                results+=("$content")
            fi
        done
    fi
    
    # Generate aggregated report
    generate_aggregated_report "${results[@]}"
    exit $?
}

# Run main if script is executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
