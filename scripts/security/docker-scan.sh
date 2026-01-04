#!/bin/bash

# Docker Image Security Scanner
# Scans Docker images referenced in docker-compose.yml using Trivy
#
# Exit codes:
#   0 - Pass (no blocking issues)
#   1 - Block (blocking issues found - critical vulnerabilities)
#   2 - Warning (non-blocking issues found - high/medium/low vulnerabilities)
#
# Environment variables:
#   SKIP_SECURITY_SCAN - Set to 'true' to skip scanning
#   SEVERITY_THRESHOLD - Minimum severity to block (default: critical for Docker)
#   DOCKER_SCAN_CACHE_TTL - Cache TTL in seconds (default: 3600)
#   DEBUG - Set to 'true' for verbose output

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source utility functions
source "$SCRIPT_DIR/utils.sh"

# =============================================================================
# Docker Scan Configuration
# =============================================================================

# Default cache TTL for Docker scans (1 hour)
readonly DOCKER_CACHE_TTL="${DOCKER_SCAN_CACHE_TTL:-3600}"

# Default severity threshold for Docker (critical only)
readonly DOCKER_DEFAULT_THRESHOLD="critical"

# =============================================================================
# Docker Compose Parsing Functions
# =============================================================================

# Extract image references from docker-compose.yml
# Arguments:
#   $1 - Path to docker-compose.yml (optional, defaults to docker-compose.yml)
# Output:
#   List of image references, one per line
parse_docker_compose_images() {
    local compose_file="${1:-docker-compose.yml}"
    
    if [[ ! -f "$compose_file" ]]; then
        log_debug "Docker compose file not found: $compose_file"
        return 0
    fi
    
    # Extract image lines from docker-compose.yml
    # Handles formats like:
    #   image: postgres:15-alpine
    #   image: "nginx:latest"
    #   image: 'redis:7'
    grep -E '^\s+image:\s*' "$compose_file" 2>/dev/null | \
        sed -E 's/^[[:space:]]*image:[[:space:]]*//; s/^["'"'"']//; s/["'"'"']$//' | \
        tr -d ' ' | \
        grep -v '^$' || true
}

# Normalize image reference to include tag
# Arguments:
#   $1 - Image reference (may or may not include tag)
# Output:
#   Normalized image reference with tag
normalize_image_ref() {
    local image="$1"
    
    # If no tag specified, append :latest
    if [[ "$image" != *":"* ]]; then
        echo "${image}:latest"
    else
        echo "$image"
    fi
}

# Generate cache key for an image
# Arguments:
#   $1 - Image reference
# Output:
#   Cache key string
get_image_cache_key() {
    local image="$1"
    echo "docker_scan_$(echo "$image" | sed 's/[^a-zA-Z0-9._-]/_/g')"
}

# =============================================================================
# Trivy Integration Functions
# =============================================================================

# Check if Trivy is installed
# Returns:
#   0 if installed, 1 if not
trivy_installed() {
    command_exists "trivy"
}

# Run Trivy scan on a Docker image
# Arguments:
#   $1 - Image reference
# Output:
#   JSON scan results
# Returns:
#   Exit code from trivy
run_trivy_scan() {
    local image="$1"
    
    log_debug "Running Trivy scan on: $image"
    
    # Run trivy with JSON output
    # --severity filters which vulnerabilities to report
    # --exit-code 0 means always return 0 (we handle exit codes ourselves)
    trivy image \
        --format json \
        --severity CRITICAL,HIGH,MEDIUM,LOW \
        --exit-code 0 \
        --quiet \
        "$image" 2>/dev/null
}

# Parse Trivy JSON output and extract vulnerability counts
# Arguments:
#   $1 - JSON output from Trivy
# Output:
#   Space-separated counts: critical high medium low
parse_trivy_json() {
    local json_output="$1"
    
    # Handle empty or invalid JSON
    if [[ -z "$json_output" ]] || ! echo "$json_output" | jq -e . &>/dev/null; then
        echo "0 0 0 0"
        return
    fi
    
    # Extract vulnerability counts from Trivy JSON
    # Trivy returns Results array with Vulnerabilities in each result
    local critical high medium low
    
    critical=$(echo "$json_output" | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' 2>/dev/null || echo "0")
    high=$(echo "$json_output" | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH")] | length' 2>/dev/null || echo "0")
    medium=$(echo "$json_output" | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "MEDIUM")] | length' 2>/dev/null || echo "0")
    low=$(echo "$json_output" | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "LOW")] | length' 2>/dev/null || echo "0")
    
    echo "$critical $high $medium $low"
}

# Extract vulnerability details from Trivy JSON
# Arguments:
#   $1 - JSON output from Trivy
# Output:
#   Formatted vulnerability details
extract_trivy_vulnerability_details() {
    local json_output="$1"
    
    if [[ -z "$json_output" ]] || ! echo "$json_output" | jq -e . &>/dev/null; then
        return
    fi
    
    # Extract and format vulnerability details
    echo "$json_output" | jq -r '
        .Results[]?.Vulnerabilities[]? | 
        "\(.Severity): \(.PkgName)@\(.InstalledVersion) - \(.VulnerabilityID) - \(.Title // "No description")"
    ' 2>/dev/null | head -20 || true
}

# =============================================================================
# Caching Functions
# =============================================================================

# Check if cached scan result exists and is valid
# Arguments:
#   $1 - Image reference
# Returns:
#   0 if valid cache exists, 1 otherwise
has_valid_cache() {
    local image="$1"
    local cache_key
    cache_key=$(get_image_cache_key "$image")
    
    cache_valid "$cache_key" "$DOCKER_CACHE_TTL"
}

# Get cached scan result
# Arguments:
#   $1 - Image reference
# Output:
#   Cached JSON result
get_cached_result() {
    local image="$1"
    local cache_key
    cache_key=$(get_image_cache_key "$image")
    
    read_cache "$cache_key"
}

# Store scan result in cache
# Arguments:
#   $1 - Image reference
#   $2 - JSON scan result
store_cached_result() {
    local image="$1"
    local result="$2"
    local cache_key
    cache_key=$(get_image_cache_key "$image")
    
    write_cache "$cache_key" "$result"
}

# =============================================================================
# Severity-Based Blocking Logic
# =============================================================================

# Determine exit code based on vulnerability counts and threshold
# Arguments:
#   $1 - Critical count
#   $2 - High count
#   $3 - Medium count
#   $4 - Low count
#   $5 - Severity threshold (optional, defaults to 'critical')
# Returns:
#   0 = pass, 1 = block, 2 = warn
determine_docker_exit_code() {
    local critical="${1:-0}"
    local high="${2:-0}"
    local medium="${3:-0}"
    local low="${4:-0}"
    local threshold="${5:-$DOCKER_DEFAULT_THRESHOLD}"
    
    # Convert threshold to lowercase
    threshold=$(echo "$threshold" | tr '[:upper:]' '[:lower:]')
    
    # Map 'moderate' to 'medium' for consistency
    if [[ "$threshold" == "moderate" ]]; then
        threshold="medium"
    fi
    
    case "$threshold" in
        critical)
            # Block only on critical
            if [[ $critical -gt 0 ]]; then
                echo "$EXIT_BLOCK"
            elif [[ $high -gt 0 || $medium -gt 0 || $low -gt 0 ]]; then
                echo "$EXIT_WARN"
            else
                echo "$EXIT_PASS"
            fi
            ;;
        high)
            # Block on high or critical
            if [[ $critical -gt 0 || $high -gt 0 ]]; then
                echo "$EXIT_BLOCK"
            elif [[ $medium -gt 0 || $low -gt 0 ]]; then
                echo "$EXIT_WARN"
            else
                echo "$EXIT_PASS"
            fi
            ;;
        medium)
            # Block on medium, high, or critical
            if [[ $critical -gt 0 || $high -gt 0 || $medium -gt 0 ]]; then
                echo "$EXIT_BLOCK"
            elif [[ $low -gt 0 ]]; then
                echo "$EXIT_WARN"
            else
                echo "$EXIT_PASS"
            fi
            ;;
        low)
            # Block on any vulnerability
            if [[ $critical -gt 0 || $high -gt 0 || $medium -gt 0 || $low -gt 0 ]]; then
                echo "$EXIT_BLOCK"
            else
                echo "$EXIT_PASS"
            fi
            ;;
        *)
            # Default to critical threshold
            if [[ $critical -gt 0 ]]; then
                echo "$EXIT_BLOCK"
            elif [[ $high -gt 0 || $medium -gt 0 || $low -gt 0 ]]; then
                echo "$EXIT_WARN"
            else
                echo "$EXIT_PASS"
            fi
            ;;
    esac
}

# =============================================================================
# Main Scanning Function
# =============================================================================

# Scan a single Docker image
# Arguments:
#   $1 - Image reference
# Output:
#   Scan results
# Returns:
#   Exit code based on vulnerabilities
scan_docker_image() {
    local image="$1"
    local normalized_image
    local scan_result
    local from_cache=false
    
    normalized_image=$(normalize_image_ref "$image")
    
    # Check cache first
    if has_valid_cache "$normalized_image"; then
        log_debug "Using cached result for: $normalized_image"
        scan_result=$(get_cached_result "$normalized_image")
        from_cache=true
    else
        # Run fresh scan
        scan_result=$(run_trivy_scan "$normalized_image") || {
            log_warning "Failed to scan image: $normalized_image"
            echo ""
            return 0
        }
        
        # Store in cache
        store_cached_result "$normalized_image" "$scan_result"
    fi
    
    echo "$scan_result"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    local compose_file="${1:-docker-compose.yml}"
    
    # Initialize security scan (checks for skip flag)
    init_security_scan "docker-scan"
    
    # Check for required commands
    if ! require_command "jq" "Install jq from https://stedolan.github.io/jq/"; then
        exit "$EXIT_BLOCK"
    fi
    
    # Check for Trivy - skip gracefully if not installed
    if ! trivy_installed; then
        log_warning "Trivy not installed - skipping Docker image scanning"
        log_info "Install Trivy from https://aquasecurity.github.io/trivy/"
        exit "$EXIT_PASS"
    fi
    
    print_header "Docker Image Security Scan"
    
    # Parse docker-compose.yml for images
    local images
    images=$(parse_docker_compose_images "$compose_file")
    
    if [[ -z "$images" ]]; then
        log_info "No Docker images found in $compose_file"
        exit "$EXIT_PASS"
    fi
    
    local image_count=0
    local total_critical=0
    local total_high=0
    local total_medium=0
    local total_low=0
    local all_details=""
    local worst_exit_code=$EXIT_PASS
    
    # Scan each image
    while IFS= read -r image; do
        [[ -z "$image" ]] && continue
        
        image_count=$((image_count + 1))
        local normalized_image
        normalized_image=$(normalize_image_ref "$image")
        
        log_info "Scanning: $normalized_image"
        
        # Run scan
        local scan_result
        scan_result=$(scan_docker_image "$image")
        
        if [[ -z "$scan_result" ]]; then
            log_warning "Could not scan: $normalized_image"
            continue
        fi
        
        # Parse results
        local counts
        counts=$(parse_trivy_json "$scan_result")
        read -r critical high medium low <<< "$counts"
        
        # Accumulate totals
        total_critical=$((total_critical + critical))
        total_high=$((total_high + high))
        total_medium=$((total_medium + medium))
        total_low=$((total_low + low))
        
        # Collect vulnerability details
        local details
        details=$(extract_trivy_vulnerability_details "$scan_result")
        if [[ -n "$details" ]]; then
            all_details+="
── $normalized_image ──
$details"
        fi
        
        # Log image results
        local image_total=$((critical + high + medium + low))
        if [[ $image_total -gt 0 ]]; then
            log_warning "$normalized_image: $image_total vulnerabilities (critical: $critical, high: $high, medium: $medium, low: $low)"
        else
            log_success "$normalized_image: No vulnerabilities found"
        fi
        
    done <<< "$images"
    
    # Print summary
    print_section "Summary"
    echo "  Images scanned: $image_count"
    local total=$((total_critical + total_high + total_medium + total_low))
    echo "  Total vulnerabilities: $total"
    
    if [[ $total -gt 0 ]]; then
        print_severity "critical" "$total_critical"
        print_severity "high" "$total_high"
        print_severity "medium" "$total_medium"
        print_severity "low" "$total_low"
        
        # Print details if any
        if [[ -n "$all_details" ]]; then
            print_section "Vulnerability Details (top 20 per image)"
            echo "$all_details"
        fi
        
        # Print remediation guidance
        print_section "Remediation"
        echo "  Update base images to latest patched versions"
        echo "  Run 'trivy image <image>' for detailed vulnerability info"
    fi
    
    # Determine final exit code
    local threshold="${SEVERITY_THRESHOLD:-$DOCKER_DEFAULT_THRESHOLD}"
    local exit_code
    exit_code=$(determine_docker_exit_code "$total_critical" "$total_high" "$total_medium" "$total_low" "$threshold")
    
    echo ""
    if [[ $exit_code -eq $EXIT_PASS ]]; then
        log_success "Docker scan passed"
    elif [[ $exit_code -eq $EXIT_WARN ]]; then
        log_warning "Docker scan completed with warnings (below $threshold threshold)"
    else
        log_error "Docker scan failed (vulnerabilities at or above $threshold severity)"
    fi
    
    # Output JSON result for aggregation
    create_result "docker" \
        "$([ $exit_code -eq 0 ] && echo 'pass' || ([ $exit_code -eq 2 ] && echo 'warn' || echo 'fail'))" \
        "$total_critical" "$total_high" "$total_medium" "$total_low" > /dev/null
    
    exit "$exit_code"
}

# Run main if script is executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
