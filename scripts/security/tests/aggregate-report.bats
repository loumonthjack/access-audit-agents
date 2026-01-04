#!/usr/bin/env bats
# Feature: security-vulnerability-scanning, Property 5: Report Completeness
# Property tests for aggregate-report.sh
# **Validates: Requirements 4.1**

# Load bats helpers from scripts/node_modules
load '../../node_modules/bats-support/load'
load '../../node_modules/bats-assert/load'

# Load the aggregate-report script (source functions without running main)
setup() {
    # Reset environment variables first
    unset SKIP_SECURITY_SCAN
    unset DEBUG
    
    # Reset source guard to allow re-sourcing in each test
    unset _SECURITY_UTILS_SOURCED
    
    # Source aggregate-report.sh which will source utils.sh
    source "$BATS_TEST_DIRNAME/../aggregate-report.sh"
}

# =============================================================================
# Helper Functions for Property Testing
# =============================================================================

# Generate a random scanner result JSON with vulnerabilities
# Arguments:
#   $1 - Scanner name (npm, docker, lockfile)
#   $2 - Status (pass, warn, fail)
#   $3 - Critical count
#   $4 - High count
#   $5 - Moderate count
#   $6 - Low count
#   $7 - Include vulnerabilities array (true/false)
generate_scanner_result() {
    local scanner="${1:-npm}"
    local status="${2:-pass}"
    local critical="${3:-0}"
    local high="${4:-0}"
    local moderate="${5:-0}"
    local low="${6:-0}"
    local include_vulns="${7:-false}"
    local total=$((critical + high + moderate + low))
    
    local vulns_array="[]"
    if [[ "$include_vulns" == "true" && $total -gt 0 ]]; then
        vulns_array=$(generate_vulnerabilities_array "$critical" "$high" "$moderate" "$low")
    fi
    
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
  },
  "vulnerabilities": $vulns_array
}
EOF
}

# Generate vulnerabilities array with specified counts
# Arguments:
#   $1 - Critical count
#   $2 - High count
#   $3 - Moderate count
#   $4 - Low count
generate_vulnerabilities_array() {
    local critical="${1:-0}"
    local high="${2:-0}"
    local moderate="${3:-0}"
    local low="${4:-0}"
    
    local vulns=""
    local first=true
    
    # Generate critical vulnerabilities
    for ((i=1; i<=critical; i++)); do
        if [[ "$first" != "true" ]]; then
            vulns+=","
        fi
        vulns+="{\"severity\":\"critical\",\"package\":\"pkg-crit-$i\",\"version\":\"1.0.$i\",\"id\":\"CVE-2024-CRIT$i\",\"description\":\"Critical vulnerability $i\",\"fixedIn\":\"2.0.0\"}"
        first=false
    done
    
    # Generate high vulnerabilities
    for ((i=1; i<=high; i++)); do
        if [[ "$first" != "true" ]]; then
            vulns+=","
        fi
        vulns+="{\"severity\":\"high\",\"package\":\"pkg-high-$i\",\"version\":\"1.0.$i\",\"id\":\"CVE-2024-HIGH$i\",\"description\":\"High vulnerability $i\",\"fixedIn\":\"2.0.0\"}"
        first=false
    done
    
    # Generate moderate vulnerabilities
    for ((i=1; i<=moderate; i++)); do
        if [[ "$first" != "true" ]]; then
            vulns+=","
        fi
        vulns+="{\"severity\":\"moderate\",\"package\":\"pkg-mod-$i\",\"version\":\"1.0.$i\",\"id\":\"CVE-2024-MOD$i\",\"description\":\"Moderate vulnerability $i\"}"
        first=false
    done
    
    # Generate low vulnerabilities
    for ((i=1; i<=low; i++)); do
        if [[ "$first" != "true" ]]; then
            vulns+=","
        fi
        vulns+="{\"severity\":\"low\",\"package\":\"pkg-low-$i\",\"version\":\"1.0.$i\",\"id\":\"CVE-2024-LOW$i\",\"description\":\"Low vulnerability $i\"}"
        first=false
    done
    
    echo "[$vulns]"
}

# =============================================================================
# Property 5: Report Completeness
# For any vulnerability report with at least one vulnerability, the output SHALL
# contain: total vulnerability count, severity breakdown (critical, high, moderate,
# low counts), and list of affected package names.
# **Validates: Requirements 4.1**
# =============================================================================

@test "Property 5: Report contains total vulnerability count" {
    for i in $(seq 1 5); do
        local critical=$((RANDOM % 5))
        local high=$((RANDOM % 5))
        local moderate=$((RANDOM % 5))
        local low=$((RANDOM % 5))
        local total=$((critical + high + moderate + low))
        
        # Ensure at least one vulnerability
        if [[ $total -eq 0 ]]; then
            critical=1
            total=1
        fi
        
        local result
        result=$(generate_scanner_result "npm" "fail" "$critical" "$high" "$moderate" "$low" "true")
        
        run generate_aggregated_report "$result"
        
        # Output should contain total count
        assert_output --partial "Total vulnerabilities: $total"
    done
}

@test "Property 5: Report contains severity breakdown when vulnerabilities exist" {
    for i in $(seq 1 5); do
        local critical=$((RANDOM % 5))
        local high=$((RANDOM % 5))
        local moderate=$((RANDOM % 5))
        local low=$((RANDOM % 5))
        local total=$((critical + high + moderate + low))
        
        # Ensure at least one vulnerability
        if [[ $total -eq 0 ]]; then
            high=1
        fi
        
        local result
        result=$(generate_scanner_result "npm" "fail" "$critical" "$high" "$moderate" "$low" "true")
        
        run generate_aggregated_report "$result"
        
        # Output should contain severity breakdown section
        assert_output --partial "Severity Breakdown"
        assert_output --partial "Critical:"
        assert_output --partial "High:"
        assert_output --partial "Moderate:"
        assert_output --partial "Low:"
    done
}

@test "Property 5: Report contains correct severity counts" {
    for i in $(seq 1 5); do
        local critical=$((RANDOM % 5 + 1))
        local high=$((RANDOM % 5 + 1))
        local moderate=$((RANDOM % 5 + 1))
        local low=$((RANDOM % 5 + 1))
        
        local result
        result=$(generate_scanner_result "npm" "fail" "$critical" "$high" "$moderate" "$low" "true")
        
        run generate_aggregated_report "$result"
        
        # Verify counts are present in output
        assert_output --partial "Critical:"
        assert_output --partial "$critical"
        assert_output --partial "High:"
        assert_output --partial "$high"
    done
}

@test "Property 5: Report contains affected package names when vulnerabilities exist" {
    for i in $(seq 1 5); do
        local critical=$((RANDOM % 3 + 1))
        local high=$((RANDOM % 3))
        
        local result
        result=$(generate_scanner_result "npm" "fail" "$critical" "$high" 0 0 "true")
        
        run generate_aggregated_report "$result"
        
        # Output should contain package names from vulnerabilities
        assert_output --partial "pkg-crit-1"
    done
}

@test "Property 5: Report shows scanner results section" {
    for i in $(seq 1 5); do
        local critical=$((RANDOM % 5))
        local high=$((RANDOM % 5))
        local total=$((critical + high))
        
        if [[ $total -eq 0 ]]; then
            critical=1
        fi
        
        local result
        result=$(generate_scanner_result "npm" "fail" "$critical" "$high" 0 0 "true")
        
        run generate_aggregated_report "$result"
        
        # Output should contain scanner results section
        assert_output --partial "Scanner Results"
        assert_output --partial "npm"
    done
}

@test "Property 5: Report aggregates multiple scanner results correctly" {
    for i in $(seq 1 5); do
        local npm_critical=$((RANDOM % 3))
        local npm_high=$((RANDOM % 3))
        local docker_critical=$((RANDOM % 3))
        local docker_high=$((RANDOM % 3))
        
        local total_critical=$((npm_critical + docker_critical))
        local total_high=$((npm_high + docker_high))
        local grand_total=$((total_critical + total_high))
        
        # Ensure at least one vulnerability
        if [[ $grand_total -eq 0 ]]; then
            npm_critical=1
            total_critical=1
            grand_total=1
        fi
        
        local npm_result
        npm_result=$(generate_scanner_result "npm" "fail" "$npm_critical" "$npm_high" 0 0 "true")
        
        local docker_result
        docker_result=$(generate_scanner_result "docker" "fail" "$docker_critical" "$docker_high" 0 0 "true")
        
        run generate_aggregated_report "$npm_result" "$docker_result"
        
        # Output should contain aggregated totals
        assert_output --partial "Total vulnerabilities: $grand_total"
        assert_output --partial "Scanners executed: 2"
    done
}

@test "Property 5: No severity breakdown when no vulnerabilities" {
    local result
    result=$(generate_scanner_result "npm" "pass" 0 0 0 0 "false")
    
    run generate_aggregated_report "$result"
    
    # Output should NOT contain severity breakdown when no vulnerabilities
    assert_output --partial "Total vulnerabilities: 0"
    refute_output --partial "Severity Breakdown"
}

# =============================================================================
# JSON Parsing Tests
# =============================================================================

@test "parse_result_json extracts correct fields" {
    for i in $(seq 1 5); do
        local critical=$((RANDOM % 10))
        local high=$((RANDOM % 10))
        local moderate=$((RANDOM % 10))
        local low=$((RANDOM % 10))
        
        local result
        result=$(generate_scanner_result "npm" "fail" "$critical" "$high" "$moderate" "$low" "false")
        
        run parse_result_json "$result"
        assert_output "npm fail $critical $high $moderate $low"
    done
}

@test "parse_result_json handles empty input" {
    run parse_result_json ""
    assert_output "unknown unknown 0 0 0 0"
}

@test "parse_result_json handles invalid JSON" {
    run parse_result_json "not valid json"
    assert_output "unknown unknown 0 0 0 0"
}

# =============================================================================
# Total Calculation Tests
# =============================================================================

@test "calculate_totals sums correctly" {
    for i in $(seq 1 5); do
        local c1=$((RANDOM % 5))
        local h1=$((RANDOM % 5))
        local m1=$((RANDOM % 5))
        local l1=$((RANDOM % 5))
        
        local c2=$((RANDOM % 5))
        local h2=$((RANDOM % 5))
        local m2=$((RANDOM % 5))
        local l2=$((RANDOM % 5))
        
        local expected_c=$((c1 + c2))
        local expected_h=$((h1 + h2))
        local expected_m=$((m1 + m2))
        local expected_l=$((l1 + l2))
        local expected_total=$((expected_c + expected_h + expected_m + expected_l))
        
        run calculate_totals "$c1 $h1 $m1 $l1" "$c2 $h2 $m2 $l2"
        assert_output "$expected_c $expected_h $expected_m $expected_l $expected_total"
    done
}

# =============================================================================
# Status Determination Tests
# =============================================================================

@test "determine_overall_status returns fail if any scanner fails" {
    run determine_overall_status "pass" "fail" "pass"
    assert_output "fail"
    
    run determine_overall_status "fail" "pass" "warn"
    assert_output "fail"
}

@test "determine_overall_status returns warn if any scanner warns (no fails)" {
    run determine_overall_status "pass" "warn" "pass"
    assert_output "warn"
    
    run determine_overall_status "warn" "pass" "pass"
    assert_output "warn"
}

@test "determine_overall_status returns pass if all scanners pass" {
    run determine_overall_status "pass" "pass" "pass"
    assert_output "pass"
}

# =============================================================================
# Exit Code Tests
# =============================================================================

@test "status_to_exit_code returns correct codes" {
    run status_to_exit_code "pass"
    assert_output "$EXIT_PASS"
    
    run status_to_exit_code "warn"
    assert_output "$EXIT_WARN"
    
    run status_to_exit_code "fail"
    assert_output "$EXIT_BLOCK"
}

# =============================================================================
# Integration Tests
# =============================================================================

@test "Property 5: Full integration - report completeness with multiple scanners" {
    for i in $(seq 1 3); do
        local npm_c=$((RANDOM % 3 + 1))
        local npm_h=$((RANDOM % 3))
        local docker_c=$((RANDOM % 3))
        local docker_h=$((RANDOM % 3 + 1))
        
        local npm_result
        npm_result=$(generate_scanner_result "npm" "fail" "$npm_c" "$npm_h" 0 0 "true")
        
        local docker_result
        docker_result=$(generate_scanner_result "docker" "fail" "$docker_c" "$docker_h" 0 0 "true")
        
        local lockfile_result
        lockfile_result=$(generate_scanner_result "lockfile" "pass" 0 0 0 0 "false")
        
        run generate_aggregated_report "$npm_result" "$docker_result" "$lockfile_result"
        
        # Verify all required elements are present
        assert_output --partial "SECURITY SCAN SUMMARY"
        assert_output --partial "Scanners executed: 3"
        assert_output --partial "Total vulnerabilities:"
        assert_output --partial "Severity Breakdown"
        assert_output --partial "Scanner Results"
        assert_output --partial "npm"
        assert_output --partial "docker"
        assert_output --partial "lockfile"
    done
}


# =============================================================================
# Property 6: Remediation Guidance
# For any vulnerability that has a known fix version, the output SHALL include
# remediation guidance with the suggested npm command to update the package.
# **Validates: Requirements 4.2**
# =============================================================================

@test "Property 6: Report includes remediation section for npm vulnerabilities" {
    for i in $(seq 1 3); do
        local critical=$((RANDOM % 3 + 1))
        
        local result
        result=$(generate_scanner_result "npm" "fail" "$critical" 0 0 0 "true")
        
        run generate_aggregated_report "$result"
        
        # Output should contain remediation guidance for npm
        assert_output --partial "Remediation Guidance"
        assert_output --partial "npm audit fix"
    done
}

@test "Property 6: Report includes remediation section for docker vulnerabilities" {
    for i in $(seq 1 3); do
        local critical=$((RANDOM % 3 + 1))
        
        local result
        result=$(generate_scanner_result "docker" "fail" "$critical" 0 0 0 "true")
        
        run generate_aggregated_report "$result"
        
        # Output should contain remediation guidance for docker
        assert_output --partial "Remediation Guidance"
        assert_output --partial "Docker Images"
    done
}

@test "Property 6: Report includes remediation section for lockfile issues" {
    local result
    result=$(generate_scanner_result "lockfile" "fail" 1 0 0 0 "false")
    
    run generate_aggregated_report "$result"
    
    # Output should contain remediation guidance for lockfile
    assert_output --partial "Remediation Guidance"
    assert_output --partial "Lockfile"
}

@test "Property 6: No remediation section when all scanners pass" {
    local npm_result
    npm_result=$(generate_scanner_result "npm" "pass" 0 0 0 0 "false")
    
    local docker_result
    docker_result=$(generate_scanner_result "docker" "pass" 0 0 0 0 "false")
    
    run generate_aggregated_report "$npm_result" "$docker_result"
    
    # Output should NOT contain remediation guidance when all pass
    refute_output --partial "Remediation Guidance"
}

@test "Property 6: Remediation includes npm update commands" {
    for i in $(seq 1 3); do
        local critical=$((RANDOM % 2 + 1))
        
        local result
        result=$(generate_scanner_result "npm" "fail" "$critical" 0 0 0 "true")
        
        run generate_aggregated_report "$result"
        
        # Output should contain npm update guidance
        assert_output --partial "npm audit fix"
        assert_output --partial "npm audit fix --force"
    done
}

@test "Property 6: Remediation includes docker update guidance" {
    for i in $(seq 1 3); do
        local high=$((RANDOM % 2 + 1))
        
        local result
        result=$(generate_scanner_result "docker" "warn" 0 "$high" 0 0 "true")
        
        run generate_aggregated_report "$result"
        
        # Output should contain docker update guidance
        assert_output --partial "Remediation Guidance"
        assert_output --partial "trivy image"
    done
}

@test "Property 6: Multiple scanner failures show combined remediation" {
    for i in $(seq 1 3); do
        local npm_result
        npm_result=$(generate_scanner_result "npm" "fail" 1 0 0 0 "true")
        
        local docker_result
        docker_result=$(generate_scanner_result "docker" "fail" 1 0 0 0 "true")
        
        run generate_aggregated_report "$npm_result" "$docker_result"
        
        # Output should contain remediation for both
        assert_output --partial "NPM Dependencies"
        assert_output --partial "Docker Images"
    done
}
