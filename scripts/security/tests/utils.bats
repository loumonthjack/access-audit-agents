#!/usr/bin/env bats
# Feature: security-vulnerability-scanning
# Tests for utility functions in utils.sh

# Load bats helpers from scripts/node_modules
load '../../node_modules/bats-support/load'
load '../../node_modules/bats-assert/load'

# Load the utils script
setup() {
    # Source the utils script
    source "$BATS_TEST_DIRNAME/../utils.sh"
    
    # Reset environment variables
    unset SKIP_SECURITY_SCAN
    unset SEVERITY_THRESHOLD
    unset DEBUG
}

# =============================================================================
# Exit Code Tests
# =============================================================================

@test "EXIT_PASS equals 0" {
    assert_equal "$EXIT_PASS" "0"
}

@test "EXIT_BLOCK equals 1" {
    assert_equal "$EXIT_BLOCK" "1"
}

@test "EXIT_WARN equals 2" {
    assert_equal "$EXIT_WARN" "2"
}

# =============================================================================
# Severity Level Tests
# =============================================================================

@test "severity_to_number returns 4 for critical" {
    run severity_to_number "critical"
    assert_output "4"
}

@test "severity_to_number returns 3 for high" {
    run severity_to_number "high"
    assert_output "3"
}

@test "severity_to_number returns 2 for moderate" {
    run severity_to_number "moderate"
    assert_output "2"
}

@test "severity_to_number returns 1 for low" {
    run severity_to_number "low"
    assert_output "1"
}

@test "severity_to_number returns 0 for unknown" {
    run severity_to_number "unknown"
    assert_output "0"
}

@test "severity_to_number is case insensitive" {
    run severity_to_number "CRITICAL"
    assert_output "4"
    
    run severity_to_number "High"
    assert_output "3"
}

@test "severity_gte returns true when first >= second" {
    severity_gte "critical" "high"
    severity_gte "high" "high"
    severity_gte "high" "moderate"
}

@test "severity_gte returns false when first < second" {
    ! severity_gte "low" "high"
    ! severity_gte "moderate" "critical"
}

# =============================================================================
# Skip Scan Tests
# =============================================================================

@test "should_skip_scan returns false when SKIP_SECURITY_SCAN is unset" {
    unset SKIP_SECURITY_SCAN
    ! should_skip_scan
}

@test "should_skip_scan returns true when SKIP_SECURITY_SCAN is 'true'" {
    SKIP_SECURITY_SCAN="true"
    should_skip_scan
}

@test "should_skip_scan returns true when SKIP_SECURITY_SCAN is '1'" {
    SKIP_SECURITY_SCAN="1"
    should_skip_scan
}

@test "should_skip_scan returns true when SKIP_SECURITY_SCAN is 'yes'" {
    SKIP_SECURITY_SCAN="yes"
    should_skip_scan
}

@test "should_skip_scan returns true when SKIP_SECURITY_SCAN is 'on'" {
    SKIP_SECURITY_SCAN="on"
    should_skip_scan
}

@test "should_skip_scan returns false when SKIP_SECURITY_SCAN is 'false'" {
    SKIP_SECURITY_SCAN="false"
    ! should_skip_scan
}

@test "should_skip_scan is case insensitive" {
    SKIP_SECURITY_SCAN="TRUE"
    should_skip_scan
    
    SKIP_SECURITY_SCAN="Yes"
    should_skip_scan
}

# =============================================================================
# Severity Threshold Tests
# =============================================================================

@test "get_severity_threshold returns 'high' by default" {
    unset SEVERITY_THRESHOLD
    run get_severity_threshold
    assert_output "high"
}

@test "get_severity_threshold returns configured value" {
    SEVERITY_THRESHOLD="critical"
    run get_severity_threshold
    assert_output "critical"
}

@test "get_severity_threshold validates input" {
    SEVERITY_THRESHOLD="invalid"
    run get_severity_threshold
    # The output should contain "high" (the default) - warning goes to stderr
    assert_line "high"
}

@test "get_severity_threshold is case insensitive" {
    SEVERITY_THRESHOLD="CRITICAL"
    run get_severity_threshold
    assert_output "critical"
}

# =============================================================================
# Command Exists Tests
# =============================================================================

@test "command_exists returns true for existing command" {
    command_exists "bash"
}

@test "command_exists returns false for non-existing command" {
    ! command_exists "nonexistent_command_12345"
}

# =============================================================================
# Create Result Tests
# =============================================================================

@test "create_result generates valid JSON" {
    run create_result "npm" "pass" 0 0 0 0
    
    # Verify it's valid JSON
    echo "$output" | jq . > /dev/null
    assert_success
}

@test "create_result includes correct scanner name" {
    run create_result "npm" "pass" 0 0 0 0
    
    local scanner
    scanner=$(echo "$output" | jq -r '.scanner')
    assert_equal "$scanner" "npm"
}

@test "create_result calculates total correctly" {
    run create_result "npm" "fail" 1 2 3 4
    
    local total
    total=$(echo "$output" | jq -r '.summary.total')
    assert_equal "$total" "10"
}

@test "create_result includes severity breakdown" {
    run create_result "docker" "warn" 1 2 3 4
    
    local critical high moderate low
    critical=$(echo "$output" | jq -r '.summary.critical')
    high=$(echo "$output" | jq -r '.summary.high')
    moderate=$(echo "$output" | jq -r '.summary.moderate')
    low=$(echo "$output" | jq -r '.summary.low')
    
    assert_equal "$critical" "1"
    assert_equal "$high" "2"
    assert_equal "$moderate" "3"
    assert_equal "$low" "4"
}

# =============================================================================
# Cache Tests
# =============================================================================

@test "get_cache_path sanitizes key" {
    run get_cache_path "image:tag/latest"
    assert_output --partial "image_tag_latest"
}

@test "write_cache and read_cache work together" {
    local test_key="test_key_$$"
    local test_content="test content"
    
    write_cache "$test_key" "$test_content"
    run read_cache "$test_key"
    assert_output "$test_content"
    
    # Cleanup
    clear_cache "$test_key"
}

@test "clear_cache removes specific key" {
    local test_key="test_clear_$$"
    
    write_cache "$test_key" "content"
    clear_cache "$test_key"
    
    run read_cache "$test_key"
    assert_output ""
}


# =============================================================================
# Property 7: Skip Behavior
# For any execution where SKIP_SECURITY_SCAN environment variable is set to a
# truthy value, no security scans SHALL execute AND a warning message SHALL be
# logged to stderr.
# **Validates: Requirements 5.1, 5.2**
# =============================================================================

# Helper function to generate random truthy values
generate_truthy_value() {
    local truthy_values=("true" "TRUE" "True" "1" "yes" "YES" "Yes" "on" "ON" "On")
    local index=$((RANDOM % ${#truthy_values[@]}))
    echo "${truthy_values[$index]}"
}

# Helper function to generate random falsy values
generate_falsy_value() {
    local falsy_values=("false" "FALSE" "False" "0" "no" "NO" "No" "off" "OFF" "Off" "" "random")
    local index=$((RANDOM % ${#falsy_values[@]}))
    echo "${falsy_values[$index]}"
}

@test "Property 7: should_skip_scan returns true for all truthy values" {
    local truthy_values=("true" "TRUE" "True" "1" "yes" "YES" "Yes" "on" "ON" "On")
    
    for value in "${truthy_values[@]}"; do
        SKIP_SECURITY_SCAN="$value"
        should_skip_scan
    done
}

@test "Property 7: should_skip_scan returns false for all falsy values" {
    local falsy_values=("false" "FALSE" "0" "no" "NO" "off" "OFF" "random" "invalid")
    
    for value in "${falsy_values[@]}"; do
        SKIP_SECURITY_SCAN="$value"
        ! should_skip_scan
    done
}

@test "Property 7: should_skip_scan returns false when unset" {
    unset SKIP_SECURITY_SCAN
    ! should_skip_scan
}

@test "Property 7: init_security_scan exits with EXIT_PASS when skip is set" {
    # Test with multiple random truthy values
    for i in $(seq 1 10); do
        local truthy_value
        truthy_value=$(generate_truthy_value)
        
        SKIP_SECURITY_SCAN="$truthy_value"
        
        # Run init_security_scan in a subshell to capture exit
        run bash -c "
            source '$BATS_TEST_DIRNAME/../utils.sh'
            SKIP_SECURITY_SCAN='$truthy_value'
            init_security_scan 'test-scanner'
        "
        
        assert_success  # EXIT_PASS = 0
    done
}

@test "Property 7: init_security_scan logs warning to stderr when skipping" {
    # Test with multiple random truthy values
    for i in $(seq 1 10); do
        local truthy_value
        truthy_value=$(generate_truthy_value)
        
        # Run init_security_scan and capture stderr
        run bash -c "
            source '$BATS_TEST_DIRNAME/../utils.sh'
            SKIP_SECURITY_SCAN='$truthy_value'
            init_security_scan 'test-scanner' 2>&1
        "
        
        # Should contain warning message about skipping
        assert_output --partial "Security scan skipped"
        assert_output --partial "SKIP_SECURITY_SCAN"
    done
}

@test "Property 7: init_security_scan does not exit when skip is not set" {
    unset SKIP_SECURITY_SCAN
    
    # Run init_security_scan - it should not exit
    run bash -c "
        source '$BATS_TEST_DIRNAME/../utils.sh'
        unset SKIP_SECURITY_SCAN
        init_security_scan 'test-scanner'
        echo 'continued execution'
    "
    
    # Should continue execution (output contains our echo)
    assert_output --partial "continued execution"
}

@test "Property 7: npm-audit.sh exits early when SKIP_SECURITY_SCAN is set" {
    for i in $(seq 1 5); do
        local truthy_value
        truthy_value=$(generate_truthy_value)
        
        SKIP_SECURITY_SCAN="$truthy_value"
        
        run bash -c "
            export SKIP_SECURITY_SCAN='$truthy_value'
            '$BATS_TEST_DIRNAME/../npm-audit.sh' 2>&1
        "
        
        assert_success  # Should exit with 0
        assert_output --partial "Security scan skipped"
    done
}

@test "Property 7: docker-scan.sh exits early when SKIP_SECURITY_SCAN is set" {
    for i in $(seq 1 5); do
        local truthy_value
        truthy_value=$(generate_truthy_value)
        
        run bash -c "
            export SKIP_SECURITY_SCAN='$truthy_value'
            '$BATS_TEST_DIRNAME/../docker-scan.sh' 2>&1
        "
        
        assert_success  # Should exit with 0
        assert_output --partial "Security scan skipped"
    done
}

@test "Property 7: lockfile-check.sh exits early when SKIP_SECURITY_SCAN is set" {
    for i in $(seq 1 5); do
        local truthy_value
        truthy_value=$(generate_truthy_value)
        
        run bash -c "
            export SKIP_SECURITY_SCAN='$truthy_value'
            '$BATS_TEST_DIRNAME/../lockfile-check.sh' 2>&1
        "
        
        assert_success  # Should exit with 0
        assert_output --partial "Security scan skipped"
    done
}

@test "Property 7: aggregate-report.sh exits early when SKIP_SECURITY_SCAN is set" {
    for i in $(seq 1 5); do
        local truthy_value
        truthy_value=$(generate_truthy_value)
        
        run bash -c "
            export SKIP_SECURITY_SCAN='$truthy_value'
            '$BATS_TEST_DIRNAME/../aggregate-report.sh' 2>&1
        "
        
        assert_success  # Should exit with 0
        assert_output --partial "Security scan skipped"
    done
}


# =============================================================================
# Property 8: Threshold Configuration
# For any severity threshold configuration in lefthook.yml, the blocking behavior
# SHALL respect that threshold (e.g., if threshold is "critical", only critical
# vulnerabilities block).
# **Validates: Requirements 5.3**
# =============================================================================

@test "Property 8: get_severity_threshold returns valid threshold values" {
    local valid_thresholds=("critical" "high" "moderate" "low")
    
    for threshold in "${valid_thresholds[@]}"; do
        SEVERITY_THRESHOLD="$threshold"
        run get_severity_threshold
        assert_output "$threshold"
    done
}

@test "Property 8: get_severity_threshold is case insensitive" {
    local test_cases=("CRITICAL:critical" "HIGH:high" "MODERATE:moderate" "LOW:low" "Critical:critical" "High:high")
    
    for test_case in "${test_cases[@]}"; do
        local input="${test_case%%:*}"
        local expected="${test_case##*:}"
        
        SEVERITY_THRESHOLD="$input"
        run get_severity_threshold
        assert_output "$expected"
    done
}

@test "Property 8: get_severity_threshold defaults to 'high' for invalid values" {
    local invalid_values=("invalid" "none" "all" "medium" "info" "123" "")
    
    for value in "${invalid_values[@]}"; do
        SEVERITY_THRESHOLD="$value"
        run get_severity_threshold
        # Should default to "high" - the output line should be "high"
        assert_line "high"
    done
}

@test "Property 8: get_severity_threshold defaults to 'high' when unset" {
    unset SEVERITY_THRESHOLD
    run get_severity_threshold
    assert_output "high"
}

@test "Property 8: Threshold 'critical' - only critical blocks" {
    # Source npm-audit.sh in a subshell to get determine_exit_code function
    # Critical should block
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='critical'
        determine_exit_code 1 0 0 0
    "
    assert_output "1"  # EXIT_BLOCK
    
    # High should warn
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='critical'
        determine_exit_code 0 5 0 0
    "
    assert_output "2"  # EXIT_WARN
    
    # Moderate should warn
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='critical'
        determine_exit_code 0 0 5 0
    "
    assert_output "2"  # EXIT_WARN
    
    # Low should warn
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='critical'
        determine_exit_code 0 0 0 5
    "
    assert_output "2"  # EXIT_WARN
    
    # None should pass
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='critical'
        determine_exit_code 0 0 0 0
    "
    assert_output "0"  # EXIT_PASS
}

@test "Property 8: Threshold 'high' - high and critical block" {
    # Critical should block
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='high'
        determine_exit_code 1 0 0 0
    "
    assert_output "1"  # EXIT_BLOCK
    
    # High should block
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='high'
        determine_exit_code 0 5 0 0
    "
    assert_output "1"  # EXIT_BLOCK
    
    # Moderate should warn
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='high'
        determine_exit_code 0 0 5 0
    "
    assert_output "2"  # EXIT_WARN
    
    # Low should warn
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='high'
        determine_exit_code 0 0 0 5
    "
    assert_output "2"  # EXIT_WARN
    
    # None should pass
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='high'
        determine_exit_code 0 0 0 0
    "
    assert_output "0"  # EXIT_PASS
}

@test "Property 8: Threshold 'moderate' - moderate, high, and critical block" {
    # Critical should block
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='moderate'
        determine_exit_code 1 0 0 0
    "
    assert_output "1"  # EXIT_BLOCK
    
    # High should block
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='moderate'
        determine_exit_code 0 5 0 0
    "
    assert_output "1"  # EXIT_BLOCK
    
    # Moderate should block
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='moderate'
        determine_exit_code 0 0 5 0
    "
    assert_output "1"  # EXIT_BLOCK
    
    # Low should warn
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='moderate'
        determine_exit_code 0 0 0 5
    "
    assert_output "2"  # EXIT_WARN
    
    # None should pass
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='moderate'
        determine_exit_code 0 0 0 0
    "
    assert_output "0"  # EXIT_PASS
}

@test "Property 8: Threshold 'low' - any vulnerability blocks" {
    # Critical should block
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='low'
        determine_exit_code 1 0 0 0
    "
    assert_output "1"  # EXIT_BLOCK
    
    # High should block
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='low'
        determine_exit_code 0 5 0 0
    "
    assert_output "1"  # EXIT_BLOCK
    
    # Moderate should block
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='low'
        determine_exit_code 0 0 5 0
    "
    assert_output "1"  # EXIT_BLOCK
    
    # Low should block
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='low'
        determine_exit_code 0 0 0 5
    "
    assert_output "1"  # EXIT_BLOCK
    
    # None should pass
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='low'
        determine_exit_code 0 0 0 0
    "
    assert_output "0"  # EXIT_PASS
}

@test "Property 8: Random vulnerability counts respect threshold" {
    for i in $(seq 1 20); do
        local critical=$((RANDOM % 5))
        local high=$((RANDOM % 5))
        local moderate=$((RANDOM % 5))
        local low=$((RANDOM % 5))
        
        # Test with critical threshold
        run bash -c "
            source '$BATS_TEST_DIRNAME/../npm-audit.sh'
            SEVERITY_THRESHOLD='critical'
            determine_exit_code $critical $high $moderate $low
        "
        
        if [[ $critical -gt 0 ]]; then
            assert_output "1"  # EXIT_BLOCK
        elif [[ $high -gt 0 || $moderate -gt 0 || $low -gt 0 ]]; then
            assert_output "2"  # EXIT_WARN
        else
            assert_output "0"  # EXIT_PASS
        fi
        
        # Test with high threshold
        run bash -c "
            source '$BATS_TEST_DIRNAME/../npm-audit.sh'
            SEVERITY_THRESHOLD='high'
            determine_exit_code $critical $high $moderate $low
        "
        
        if [[ $critical -gt 0 || $high -gt 0 ]]; then
            assert_output "1"  # EXIT_BLOCK
        elif [[ $moderate -gt 0 || $low -gt 0 ]]; then
            assert_output "2"  # EXIT_WARN
        else
            assert_output "0"  # EXIT_PASS
        fi
        
        # Test with moderate threshold
        run bash -c "
            source '$BATS_TEST_DIRNAME/../npm-audit.sh'
            SEVERITY_THRESHOLD='moderate'
            determine_exit_code $critical $high $moderate $low
        "
        
        if [[ $critical -gt 0 || $high -gt 0 || $moderate -gt 0 ]]; then
            assert_output "1"  # EXIT_BLOCK
        elif [[ $low -gt 0 ]]; then
            assert_output "2"  # EXIT_WARN
        else
            assert_output "0"  # EXIT_PASS
        fi
        
        # Test with low threshold
        run bash -c "
            source '$BATS_TEST_DIRNAME/../npm-audit.sh'
            SEVERITY_THRESHOLD='low'
            determine_exit_code $critical $high $moderate $low
        "
        
        if [[ $critical -gt 0 || $high -gt 0 || $moderate -gt 0 || $low -gt 0 ]]; then
            assert_output "1"  # EXIT_BLOCK
        else
            assert_output "0"  # EXIT_PASS
        fi
    done
}

@test "Property 8: Docker scanner respects threshold configuration" {
    # Test critical threshold (Docker default) - only critical blocks
    run bash -c "
        source '$BATS_TEST_DIRNAME/../docker-scan.sh'
        determine_docker_exit_code 1 0 0 0 'critical'
    "
    assert_output "1"  # EXIT_BLOCK
    
    run bash -c "
        source '$BATS_TEST_DIRNAME/../docker-scan.sh'
        determine_docker_exit_code 0 5 0 0 'critical'
    "
    assert_output "2"  # EXIT_WARN
    
    # Test high threshold - high and critical block
    run bash -c "
        source '$BATS_TEST_DIRNAME/../docker-scan.sh'
        determine_docker_exit_code 0 5 0 0 'high'
    "
    assert_output "1"  # EXIT_BLOCK
    
    run bash -c "
        source '$BATS_TEST_DIRNAME/../docker-scan.sh'
        determine_docker_exit_code 0 0 5 0 'high'
    "
    assert_output "2"  # EXIT_WARN
}

@test "Property 8: Threshold passed as argument overrides env var" {
    # Set env var to high but pass critical as argument - should only block on critical
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='high'
        determine_exit_code 0 5 0 0 'critical'
    "
    assert_output "2"  # EXIT_WARN - High doesn't block with critical threshold
    
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='high'
        determine_exit_code 1 0 0 0 'critical'
    "
    assert_output "1"  # EXIT_BLOCK - Critical blocks
}

@test "Property 8: Invalid threshold falls back to default behavior" {
    # Set invalid threshold - should behave like "high" (the default)
    # Note: The warning message goes to stderr, but determine_exit_code still outputs the exit code
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='invalid'
        determine_exit_code 0 5 0 0 2>/dev/null
    "
    assert_output "1"  # EXIT_BLOCK - High blocks with default threshold
    
    run bash -c "
        source '$BATS_TEST_DIRNAME/../npm-audit.sh'
        SEVERITY_THRESHOLD='invalid'
        determine_exit_code 0 0 5 0 2>/dev/null
    "
    assert_output "2"  # EXIT_WARN - Moderate warns with default threshold
}
