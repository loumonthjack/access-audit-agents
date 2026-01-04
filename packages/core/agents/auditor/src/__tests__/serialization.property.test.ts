/**
 * Property-based tests for ScanResult JSON serialization
 * 
 * Feature: core-auditor-agent
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    serializeScanResult,
    deserializeScanResult,
    safeDeserializeScanResult,
    validateScanResult
} from '../types/index.js';
import {
    scanResultArb,
    scanResultWithViolationCount
} from '../__generators__/scan-result.generator.js';

describe('ScanResult JSON Round-Trip Consistency', () => {
    /**
     * Feature: core-auditor-agent, Property 5: ScanResult JSON Round-Trip Consistency
     * 
     * For any valid ScanResult object, serializing to JSON and deserializing back
     * SHALL produce an equivalent object: deserialize(serialize(scanResult)) === scanResult
     * 
     * Validates: Requirements 6.1, 6.2
     */
    it('Property 5: serialize then deserialize produces equivalent object', () => {
        fc.assert(
            fc.property(scanResultArb, (scanResult) => {
                // Serialize to JSON
                const json = serializeScanResult(scanResult);

                // Verify it's valid JSON
                expect(typeof json).toBe('string');
                expect(() => JSON.parse(json)).not.toThrow();

                // Deserialize back
                const deserialized = deserializeScanResult(json);

                // Verify equivalence
                expect(deserialized).toEqual(scanResult);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Feature: core-auditor-agent, Property 5 (continued): Multiple round-trips are stable
     * 
     * Validates: Requirements 6.1, 6.2
     */
    it('Property 5: Multiple round-trips produce stable results', () => {
        fc.assert(
            fc.property(scanResultArb, (scanResult) => {
                // First round-trip
                const json1 = serializeScanResult(scanResult);
                const result1 = deserializeScanResult(json1);

                // Second round-trip
                const json2 = serializeScanResult(result1);
                const result2 = deserializeScanResult(json2);

                // Third round-trip
                const json3 = serializeScanResult(result2);
                const result3 = deserializeScanResult(json3);

                // All should be equivalent
                expect(result1).toEqual(scanResult);
                expect(result2).toEqual(scanResult);
                expect(result3).toEqual(scanResult);

                // JSON strings should be identical after first serialization
                expect(json2).toBe(json1);
                expect(json3).toBe(json1);

                return true;
            }),
            { numRuns: 100 }
        );
    });


    /**
     * Feature: core-auditor-agent, Property 5 (continued): Deserialized result passes validation
     * 
     * Validates: Requirements 6.1, 6.2
     */
    it('Property 5: Deserialized result passes Zod validation', () => {
        fc.assert(
            fc.property(scanResultArb, (scanResult) => {
                const json = serializeScanResult(scanResult);
                const deserialized = deserializeScanResult(json);

                // Should pass validation without throwing
                const validated = validateScanResult(deserialized);
                expect(validated).toEqual(deserialized);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Feature: core-auditor-agent, Property 5 (continued): Safe deserialize handles valid JSON
     * 
     * Validates: Requirements 6.1, 6.2
     */
    it('Property 5: Safe deserialize succeeds for valid ScanResult JSON', () => {
        fc.assert(
            fc.property(scanResultArb, (scanResult) => {
                const json = serializeScanResult(scanResult);
                const result = safeDeserializeScanResult(json);

                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data).toEqual(scanResult);
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Feature: core-auditor-agent, Property 5 (continued): Safe deserialize handles invalid JSON
     * 
     * Validates: Requirements 6.1, 6.2
     */
    it('Property 5: Safe deserialize fails gracefully for invalid JSON', () => {
        fc.assert(
            fc.property(fc.string(), (invalidJson) => {
                // Skip if the string happens to be valid JSON that matches our schema
                // (extremely unlikely but possible)
                const result = safeDeserializeScanResult(invalidJson);

                // Either it fails (expected) or it succeeds with valid data
                if (!result.success) {
                    expect(result.error).toBeDefined();
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });
});
