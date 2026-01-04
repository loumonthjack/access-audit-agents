#!/bin/bash

# Security Scanning Utility Functions
# Base utility functions shared across all security scanning scripts
#
# This script provides common functionality for:
#   - Colored output formatting
#   - Severity level handling
#   - Exit code management
#   - Environment variable processing
#   - Logging utilities
#
# Exit codes:
#   0 - Pass (no blocking issues)
#   1 - Block (blocking issues found)
#   2 - Warning (non-blocking issues found)

# Source guard to prevent double-sourcing
if [[ -n "${_SECURITY_UTILS_SOURCED:-}" ]]; then
    return 0 2>/dev/null || exit 0
fi
_SECURITY_UTILS_SOURCED=1

# =============================================================================
# Color Definitions
# =============================================================================

# Check if terminal supports colors
if [[ -t 1 ]] && [[ -n "$TERM" ]] && [[ "$TERM" != "dumb" ]]; then
    COLOR_RED='\033[0;31m'
    COLOR_GREEN='\033[0;32m'
    COLOR_YELLOW='\033[0;33m'
    COLOR_BLUE='\033[0;34m'
    COLOR_MAGENTA='\033[0;35m'
    COLOR_CYAN='\033[0;36m'
    COLOR_WHITE='\033[0;37m'
    COLOR_BOLD='\033[1m'
    COLOR_RESET='\033[0m'
else
    COLOR_RED=''
    COLOR_GREEN=''
    COLOR_YELLOW=''
    COLOR_BLUE=''
    COLOR_MAGENTA=''
    COLOR_CYAN=''
    COLOR_WHITE=''
    COLOR_BOLD=''
    COLOR_RESET=''
fi

# =============================================================================
# Exit Codes
# =============================================================================

readonly EXIT_PASS=0
readonly EXIT_BLOCK=1
readonly EXIT_WARN=2

# =============================================================================
# Severity Levels
# =============================================================================

readonly SEVERITY_CRITICAL="critical"
readonly SEVERITY_HIGH="high"
readonly SEVERITY_MODERATE="moderate"
readonly SEVERITY_LOW="low"

# Severity level numeric values for comparison
severity_to_number() {
    local severity="$1"
    # Convert to lowercase using tr for compatibility with older bash
    local lower_severity
    lower_severity=$(echo "$severity" | tr '[:upper:]' '[:lower:]')
    
    case "$lower_severity" in
        critical) echo 4 ;;
        high)     echo 3 ;;
        moderate) echo 2 ;;
        low)      echo 1 ;;
        *)        echo 0 ;;
    esac
}

# Compare two severity levels
# Returns 0 if first >= second, 1 otherwise
severity_gte() {
    local first="$1"
    local second="$2"
    local first_num second_num
    
    first_num=$(severity_to_number "$first")
    second_num=$(severity_to_number "$second")
    
    [[ $first_num -ge $second_num ]]
}

# =============================================================================
# Logging Functions
# =============================================================================

log_info() {
    echo -e "${COLOR_BLUE}ℹ${COLOR_RESET} $*"
}

log_success() {
    echo -e "${COLOR_GREEN}✓${COLOR_RESET} $*"
}

log_warning() {
    echo -e "${COLOR_YELLOW}⚠${COLOR_RESET} $*" >&2
}

log_error() {
    echo -e "${COLOR_RED}✗${COLOR_RESET} $*" >&2
}

log_debug() {
    if [[ "${DEBUG:-}" == "true" || "${DEBUG:-}" == "1" ]]; then
        echo -e "${COLOR_CYAN}[DEBUG]${COLOR_RESET} $*" >&2
    fi
}

# =============================================================================
# Output Formatting
# =============================================================================

print_header() {
    local title="$1"
    local width="${2:-50}"
    local line
    line=$(printf '═%.0s' $(seq 1 "$width"))
    
    echo ""
    echo -e "${COLOR_BOLD}${line}${COLOR_RESET}"
    echo -e "${COLOR_BOLD}  $title${COLOR_RESET}"
    echo -e "${COLOR_BOLD}${line}${COLOR_RESET}"
}

print_section() {
    local title="$1"
    echo ""
    echo -e "${COLOR_BOLD}── $title ──${COLOR_RESET}"
}

print_severity() {
    local severity="$1"
    local count="$2"
    local color
    local lower_severity
    lower_severity=$(echo "$severity" | tr '[:upper:]' '[:lower:]')
    
    case "$lower_severity" in
        critical) color="$COLOR_RED" ;;
        high)     color="$COLOR_MAGENTA" ;;
        moderate) color="$COLOR_YELLOW" ;;
        low)      color="$COLOR_CYAN" ;;
        *)        color="$COLOR_WHITE" ;;
    esac
    
    # Capitalize first letter
    local capitalized
    capitalized="$(echo "${severity:0:1}" | tr '[:lower:]' '[:upper:]')${severity:1}"
    
    echo -e "  ${color}${capitalized}:${COLOR_RESET} $count"
}

# =============================================================================
# Environment Variable Handling
# =============================================================================

# Check if security scan should be skipped
should_skip_scan() {
    local skip_var="${SKIP_SECURITY_SCAN:-}"
    # Convert to lowercase using tr for compatibility with older bash
    local lower_skip
    lower_skip=$(echo "$skip_var" | tr '[:upper:]' '[:lower:]')
    
    case "$lower_skip" in
        true|1|yes|on)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Get severity threshold from environment or default
get_severity_threshold() {
    local threshold="${SEVERITY_THRESHOLD:-high}"
    # Convert to lowercase using tr for compatibility with older bash
    local lower_threshold
    lower_threshold=$(echo "$threshold" | tr '[:upper:]' '[:lower:]')
    
    # Validate threshold value
    case "$lower_threshold" in
        critical|high|moderate|low)
            echo "$lower_threshold"
            ;;
        *)
            log_warning "Invalid SEVERITY_THRESHOLD '$threshold', defaulting to 'high'"
            echo "high"
            ;;
    esac
}

# =============================================================================
# Workspace Discovery
# =============================================================================

# Find all workspaces with package.json files
find_npm_workspaces() {
    local root_dir="${1:-.}"
    
    # Use npm query if available (npm 8.5+)
    if npm query .workspace &>/dev/null; then
        npm query .workspace 2>/dev/null | jq -r '.[].location' 2>/dev/null
    else
        # Fallback: find package.json files excluding node_modules
        find "$root_dir" -name "package.json" \
            -not -path "*/node_modules/*" \
            -not -path "*/.git/*" \
            -exec dirname {} \; 2>/dev/null | sort -u
    fi
}

# =============================================================================
# Command Availability Checks
# =============================================================================

# Check if a command is available
command_exists() {
    command -v "$1" &>/dev/null
}

# Check required commands and exit if missing
require_command() {
    local cmd="$1"
    local install_hint="${2:-}"
    
    if ! command_exists "$cmd"; then
        log_error "Required command '$cmd' not found"
        if [[ -n "$install_hint" ]]; then
            log_info "Install hint: $install_hint"
        fi
        return 1
    fi
    return 0
}

# =============================================================================
# JSON Parsing Helpers
# =============================================================================

# Safely parse JSON with jq, returning empty on error
safe_jq() {
    local filter="$1"
    local default="${2:-}"
    
    jq -r "$filter" 2>/dev/null || echo "$default"
}

# =============================================================================
# Cache Management
# =============================================================================

readonly CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/security-scan"
readonly DEFAULT_CACHE_TTL=3600  # 1 hour in seconds

# Initialize cache directory
init_cache() {
    mkdir -p "$CACHE_DIR"
}

# Get cache file path for a given key
get_cache_path() {
    local key="$1"
    local safe_key
    safe_key=$(echo "$key" | sed 's/[^a-zA-Z0-9._-]/_/g')
    echo "$CACHE_DIR/$safe_key"
}

# Check if cache is valid (exists and not expired)
cache_valid() {
    local key="$1"
    local ttl="${2:-$DEFAULT_CACHE_TTL}"
    local cache_file
    cache_file=$(get_cache_path "$key")
    
    if [[ ! -f "$cache_file" ]]; then
        return 1
    fi
    
    local file_age
    file_age=$(($(date +%s) - $(stat -f %m "$cache_file" 2>/dev/null || stat -c %Y "$cache_file" 2>/dev/null)))
    
    [[ $file_age -lt $ttl ]]
}

# Read from cache
read_cache() {
    local key="$1"
    local cache_file
    cache_file=$(get_cache_path "$key")
    
    if [[ -f "$cache_file" ]]; then
        cat "$cache_file"
    fi
}

# Write to cache
write_cache() {
    local key="$1"
    local content="$2"
    local cache_file
    
    init_cache
    cache_file=$(get_cache_path "$key")
    echo "$content" > "$cache_file"
}

# Clear cache for a specific key or all
clear_cache() {
    local key="${1:-}"
    
    if [[ -n "$key" ]]; then
        local cache_file
        cache_file=$(get_cache_path "$key")
        rm -f "$cache_file"
    else
        rm -rf "$CACHE_DIR"
    fi
}

# =============================================================================
# Result Aggregation
# =============================================================================

# Create a result object (as JSON string)
create_result() {
    local scanner="$1"
    local status="$2"
    local critical="${3:-0}"
    local high="${4:-0}"
    local moderate="${5:-0}"
    local low="${6:-0}"
    local total=$((critical + high + moderate + low))
    
    cat <<EOF
{
  "scanner": "$scanner",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "$status",
  "summary": {
    "total": $total,
    "critical": $critical,
    "high": $high,
    "moderate": $moderate,
    "low": $low
  }
}
EOF
}

# =============================================================================
# Script Initialization
# =============================================================================

# Common initialization for all security scripts
init_security_scan() {
    local script_name="$1"
    
    # Check for skip flag
    if should_skip_scan; then
        log_warning "Security scan skipped (SKIP_SECURITY_SCAN is set)"
        exit "$EXIT_PASS"
    fi
    
    log_debug "Starting $script_name"
    log_debug "Severity threshold: $(get_severity_threshold)"
}
