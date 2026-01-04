#!/usr/bin/env bats
# Feature: security-vulnerability-scanning, Property 2: Docker Severity-Based Blocking
# Property tests for docker-scan.sh
# **Validates: Requirements 2.2, 2.3**

# Load bats helpers from scripts/node_modules
load '../../node_modules/bats-support/load'
load '../../node_modules/bats-assert/load'

# Load the docker-scan script (source functions without running main)
setup() {
    # Reset environment variables first
    unset SKIP_SECURITY_SCAN
    unset SEVERITY_THRESHOLD
    unset DOCKER_SCAN_CACHE_TTL
    unset DEBUG
    
    # Reset source guard to allow re-sourcing in each test
    unset _SECURITY_UTILS_SOURCED
    
    # Source docker-scan.sh which will source utils.sh
    source "$BATS_TEST_DIRNAME/../docker-scan.sh"
}

# =============================================================================
# Helper Functions for Property Testing
# =============================================================================

# Generate Trivy JSON output with specific vulnerability counts
# Arguments: critical high medium low
generate_trivy_json() {
    local critical="${1:-0}"
    local high="${2:-0}"
    local medium="${3:-0}"
    local low="${4:-0}"
    
    local vulnerabilities=""
    local first=true
    
    # Generate critical vulnerabilities
    for ((i=1; i<=critical; i++)); do
        if [[ "$first" != "true" ]]; then
            vulnerabilities+=","
        fi
        vulnerabilities+="{\"VulnerabilityID\":\"CVE-2024-CRIT$i\",\"PkgName\":\"pkg-crit-$i\",\"InstalledVersion\":\"1.0.0\",\"Severity\":\"CRITICAL\",\"Title\":\"Critical vulnerability $i\"}"
        first=false
    done
    
    # Generate high vulnerabilities
    for ((i=1; i<=high; i++)); do
        if [[ "$first" != "true" ]]; then
            vulnerabilities+=","
        fi
        vulnerabilities+="{\"VulnerabilityID\":\"CVE-2024-HIGH$i\",\"PkgName\":\"pkg-high-$i\",\"InstalledVersion\":\"1.0.0\",\"Severity\":\"HIGH\",\"Title\":\"High vulnerability $i\"}"
        first=false
    done
    
    # Generate medium vulnerabilities
    for ((i=1; i<=medium; i++)); do
        if [[ "$first" != "true" ]]; then
            vulnerabilities+=","
        fi
        vulnerabilities+="{\"VulnerabilityID\":\"CVE-2024-MED$i\",\"PkgName\":\"pkg-med-$i\",\"InstalledVersion\":\"1.0.0\",\"Severity\":\"MEDIUM\",\"Title\":\"Medium vulnerability $i\"}"
        first=false
    done
    
    # Generate low vulnerabilities
    for ((i=1; i<=low; i++)); do
        if [[ "$first" != "true" ]]; then
            vulnerabilities+=","
        fi
        vulnerabilities+="{\"VulnerabilityID\":\"CVE-2024-LOW$i\",\"PkgName\":\"pkg-low-$i\",\"InstalledVersion\":\"1.0.0\",\"Severity\":\"LOW\",\"Title\":\"Low vulnerability $i\"}"
        first=false
    done
    
    cat <<EOF
{
  "SchemaVersion": 2,
  "ArtifactName": "test-image:latest",
  "ArtifactType": "container_image",
  "Results": [
    {
      "Target": "test-image:latest",
      "Class": "os-pkgs",
      "Type": "alpine",
      "Vulnerabilities": [$vulnerabilities]
    }
  ]
}
EOF
}

# =============================================================================
# Property 2: Docker Severity-Based Blocking
# For any Docker image vulnerability scan result, the pre-push hook SHALL block
# the push (exit code 1) if and only if the scan detects at least one critical
# vulnerability.
# **Validates: Requirements 2.2, 2.3**
# =============================================================================

@test "Property 2: Block when critical > 0 (threshold=critical)" {
    for i in $(seq 1 20); do
        local critical=$((RANDOM % 10 + 1))
        local high=$((RANDOM % 10))
        local medium=$((RANDOM % 10))
        local low=$((RANDOM % 10))
        
        run determine_docker_exit_code "$critical" "$high" "$medium" "$low" "critical"
        
        assert_output "$EXIT_BLOCK"
    done
}

@test "Property 2: Warn when only high/medium/low (threshold=critical)" {
    for i in $(seq 1 20); do
        local critical=0
        local high=$((RANDOM % 10))
        local medium=$((RANDOM % 10))
        local low=$((RANDOM % 10))
        
        # Ensure at least one non-critical vulnerability
        if [[ $high -eq 0 && $medium -eq 0 && $low -eq 0 ]]; then
            high=1
        fi
        
        run determine_docker_exit_code "$critical" "$high" "$medium" "$low" "critical"
        
        assert_output "$EXIT_WARN"
    done
}

@test "Property 2: Pass when no vulnerabilities (threshold=critical)" {
    run determine_docker_exit_code 0 0 0 0 "critical"
    assert_output "$EXIT_PASS"
}

@test "Property 2: Block on high when threshold=high" {
    for i in $(seq 1 20); do
        local critical=0
        local high=$((RANDOM % 10 + 1))
        local medium=$((RANDOM % 10))
        local low=$((RANDOM % 10))
        
        run determine_docker_exit_code "$critical" "$high" "$medium" "$low" "high"
        
        assert_output "$EXIT_BLOCK"
    done
}

@test "Property 2: Block on critical when threshold=high" {
    for i in $(seq 1 20); do
        local critical=$((RANDOM % 10 + 1))
        local high=$((RANDOM % 10))
        local medium=$((RANDOM % 10))
        local low=$((RANDOM % 10))
        
        run determine_docker_exit_code "$critical" "$high" "$medium" "$low" "high"
        
        assert_output "$EXIT_BLOCK"
    done
}

@test "Property 2: Warn on medium/low when threshold=high" {
    for i in $(seq 1 20); do
        local critical=0
        local high=0
        local medium=$((RANDOM % 10))
        local low=$((RANDOM % 10))
        
        # Ensure at least one medium/low vulnerability
        if [[ $medium -eq 0 && $low -eq 0 ]]; then
            medium=1
        fi
        
        run determine_docker_exit_code "$critical" "$high" "$medium" "$low" "high"
        
        assert_output "$EXIT_WARN"
    done
}

@test "Property 2: Block on medium when threshold=medium" {
    for i in $(seq 1 20); do
        local critical=0
        local high=0
        local medium=$((RANDOM % 10 + 1))
        local low=$((RANDOM % 10))
        
        run determine_docker_exit_code "$critical" "$high" "$medium" "$low" "medium"
        
        assert_output "$EXIT_BLOCK"
    done
}

@test "Property 2: Block on any when threshold=low" {
    for i in $(seq 1 20); do
        local critical=0
        local high=0
        local medium=0
        local low=$((RANDOM % 10 + 1))
        
        run determine_docker_exit_code "$critical" "$high" "$medium" "$low" "low"
        
        assert_output "$EXIT_BLOCK"
    done
}

# =============================================================================
# JSON Parsing Tests
# =============================================================================

@test "parse_trivy_json extracts correct counts" {
    for i in $(seq 1 20); do
        local critical=$((RANDOM % 5))
        local high=$((RANDOM % 5))
        local medium=$((RANDOM % 5))
        local low=$((RANDOM % 5))
        
        local json
        json=$(generate_trivy_json "$critical" "$high" "$medium" "$low")
        
        run parse_trivy_json "$json"
        assert_output "$critical $high $medium $low"
    done
}

@test "parse_trivy_json handles empty input" {
    run parse_trivy_json ""
    assert_output "0 0 0 0"
}

@test "parse_trivy_json handles invalid JSON" {
    run parse_trivy_json "not valid json"
    assert_output "0 0 0 0"
}

@test "parse_trivy_json handles empty Results array" {
    local json='{"SchemaVersion":2,"Results":[]}'
    run parse_trivy_json "$json"
    assert_output "0 0 0 0"
}

# =============================================================================
# Docker Compose Parsing Tests
# =============================================================================

@test "parse_docker_compose_images extracts images correctly" {
    local temp_file
    temp_file=$(mktemp)
    
    cat > "$temp_file" <<EOF
services:
  db:
    image: postgres:15-alpine
  web:
    image: nginx:latest
  cache:
    image: redis:7
EOF
    
    run parse_docker_compose_images "$temp_file"
    
    assert_line "postgres:15-alpine"
    assert_line "nginx:latest"
    assert_line "redis:7"
    
    rm -f "$temp_file"
}

@test "parse_docker_compose_images handles quoted images" {
    local temp_file
    temp_file=$(mktemp)
    
    cat > "$temp_file" <<EOF
services:
  db:
    image: "postgres:15"
  web:
    image: 'nginx:alpine'
EOF
    
    run parse_docker_compose_images "$temp_file"
    
    assert_line "postgres:15"
    assert_line "nginx:alpine"
    
    rm -f "$temp_file"
}

@test "parse_docker_compose_images returns empty for missing file" {
    run parse_docker_compose_images "/nonexistent/file.yml"
    assert_output ""
}

# =============================================================================
# Image Normalization Tests
# =============================================================================

@test "normalize_image_ref adds :latest when no tag" {
    run normalize_image_ref "nginx"
    assert_output "nginx:latest"
}

@test "normalize_image_ref preserves existing tag" {
    run normalize_image_ref "postgres:15-alpine"
    assert_output "postgres:15-alpine"
}

@test "normalize_image_ref handles registry prefix" {
    run normalize_image_ref "ghcr.io/owner/repo"
    assert_output "ghcr.io/owner/repo:latest"
}

@test "normalize_image_ref handles registry with tag" {
    run normalize_image_ref "ghcr.io/owner/repo:v1.0"
    assert_output "ghcr.io/owner/repo:v1.0"
}

# =============================================================================
# Integration Property Tests
# =============================================================================

@test "Property 2: Full JSON parsing and blocking integration" {
    for i in $(seq 1 20); do
        local critical=$((RANDOM % 3))
        local high=$((RANDOM % 3))
        local medium=$((RANDOM % 3))
        local low=$((RANDOM % 3))
        
        local json
        json=$(generate_trivy_json "$critical" "$high" "$medium" "$low")
        
        local counts
        counts=$(parse_trivy_json "$json")
        read -r parsed_critical parsed_high parsed_medium parsed_low <<< "$counts"
        
        run determine_docker_exit_code "$parsed_critical" "$parsed_high" "$parsed_medium" "$parsed_low" "critical"
        
        if [[ $critical -gt 0 ]]; then
            assert_output "$EXIT_BLOCK"
        elif [[ $high -gt 0 || $medium -gt 0 || $low -gt 0 ]]; then
            assert_output "$EXIT_WARN"
        else
            assert_output "$EXIT_PASS"
        fi
    done
}

@test "Property 2: Default threshold is critical" {
    # With critical vulnerabilities, should block
    run determine_docker_exit_code 1 0 0 0
    assert_output "$EXIT_BLOCK"
    
    # With only high vulnerabilities, should warn (not block)
    run determine_docker_exit_code 0 5 0 0
    assert_output "$EXIT_WARN"
}


# =============================================================================
# Property 9: Docker Image Caching
# For any Docker image that has been scanned within the cache TTL period,
# subsequent scans of the same image:tag SHALL use cached results instead of
# re-scanning.
# **Validates: Requirements 2.5**
# =============================================================================

@test "Property 9: get_image_cache_key generates consistent keys" {
    for i in $(seq 1 20); do
        local image="test-image-$RANDOM:v$RANDOM"
        
        local key1
        local key2
        key1=$(get_image_cache_key "$image")
        key2=$(get_image_cache_key "$image")
        
        assert_equal "$key1" "$key2"
    done
}

@test "Property 9: get_image_cache_key generates unique keys for different images" {
    local key1
    local key2
    
    key1=$(get_image_cache_key "nginx:latest")
    key2=$(get_image_cache_key "postgres:15")
    
    # Keys should be different
    [[ "$key1" != "$key2" ]]
}

@test "Property 9: Cache key sanitizes special characters" {
    local key
    key=$(get_image_cache_key "ghcr.io/owner/repo:v1.0")
    
    # Key should not contain special characters like / or :
    refute [[ "$key" == *"/"* ]]
    refute [[ "$key" == *":"* ]]
}

@test "Property 9: has_valid_cache returns false for non-existent cache" {
    local random_image="nonexistent-image-$RANDOM:latest"
    
    # Clear any existing cache
    local cache_key
    cache_key=$(get_image_cache_key "$random_image")
    clear_cache "$cache_key"
    
    run has_valid_cache "$random_image"
    assert_failure
}

@test "Property 9: Cache stores and retrieves results correctly" {
    for i in $(seq 1 10); do
        local image="test-cache-$RANDOM:v$i"
        local test_result="{\"test\":\"result-$RANDOM\"}"
        
        # Store result
        store_cached_result "$image" "$test_result"
        
        # Retrieve result
        local retrieved
        retrieved=$(get_cached_result "$image")
        
        assert_equal "$retrieved" "$test_result"
        
        # Cleanup
        local cache_key
        cache_key=$(get_image_cache_key "$image")
        clear_cache "$cache_key"
    done
}

@test "Property 9: has_valid_cache returns true for fresh cache" {
    local image="test-fresh-cache-$RANDOM:latest"
    local test_result='{"test":"fresh"}'
    
    # Store result
    store_cached_result "$image" "$test_result"
    
    # Check cache validity (should be valid with default TTL)
    run has_valid_cache "$image"
    assert_success
    
    # Cleanup
    local cache_key
    cache_key=$(get_image_cache_key "$image")
    clear_cache "$cache_key"
}

@test "Property 9: Cache respects TTL (expired cache is invalid)" {
    local image="test-expired-cache-$RANDOM:latest"
    local test_result='{"test":"expired"}'
    
    # Store result
    store_cached_result "$image" "$test_result"
    
    # Get cache file path
    local cache_key
    cache_key=$(get_image_cache_key "$image")
    local cache_file
    cache_file=$(get_cache_path "$cache_key")
    
    # Modify file timestamp to be older than TTL (2 hours ago)
    touch -t $(date -v-2H +%Y%m%d%H%M.%S 2>/dev/null || date -d "2 hours ago" +%Y%m%d%H%M.%S) "$cache_file"
    
    # Check cache validity with 1 hour TTL - should be invalid
    run has_valid_cache "$image"
    assert_failure
    
    # Cleanup
    clear_cache "$cache_key"
}

@test "Property 9: Different images have independent caches" {
    local image1="test-independent-1-$RANDOM:latest"
    local image2="test-independent-2-$RANDOM:latest"
    local result1='{"image":"one"}'
    local result2='{"image":"two"}'
    
    # Store results for both images
    store_cached_result "$image1" "$result1"
    store_cached_result "$image2" "$result2"
    
    # Retrieve and verify independence
    local retrieved1
    local retrieved2
    retrieved1=$(get_cached_result "$image1")
    retrieved2=$(get_cached_result "$image2")
    
    assert_equal "$retrieved1" "$result1"
    assert_equal "$retrieved2" "$result2"
    # Results should be different
    [[ "$retrieved1" != "$retrieved2" ]]
    
    # Cleanup
    local cache_key1
    local cache_key2
    cache_key1=$(get_image_cache_key "$image1")
    cache_key2=$(get_image_cache_key "$image2")
    clear_cache "$cache_key1"
    clear_cache "$cache_key2"
}

@test "Property 9: Cache overwrites previous results" {
    local image="test-overwrite-$RANDOM:latest"
    local result1='{"version":"1"}'
    local result2='{"version":"2"}'
    
    # Store first result
    store_cached_result "$image" "$result1"
    
    # Overwrite with second result
    store_cached_result "$image" "$result2"
    
    # Retrieve and verify overwrite
    local retrieved
    retrieved=$(get_cached_result "$image")
    
    assert_equal "$retrieved" "$result2"
    
    # Cleanup
    local cache_key
    cache_key=$(get_image_cache_key "$image")
    clear_cache "$cache_key"
}

@test "Property 9: Normalized image refs use same cache" {
    local base_image="test-normalize-$RANDOM"
    local image_with_tag="${base_image}:latest"
    local test_result='{"normalized":"test"}'
    
    # Normalize both
    local normalized1
    local normalized2
    normalized1=$(normalize_image_ref "$base_image")
    normalized2=$(normalize_image_ref "$image_with_tag")
    
    # Both should normalize to same value
    assert_equal "$normalized1" "$normalized2"
    
    # Store using normalized ref
    store_cached_result "$normalized1" "$test_result"
    
    # Retrieve using other normalized ref
    local retrieved
    retrieved=$(get_cached_result "$normalized2")
    
    assert_equal "$retrieved" "$test_result"
    
    # Cleanup
    local cache_key
    cache_key=$(get_image_cache_key "$normalized1")
    clear_cache "$cache_key"
}
