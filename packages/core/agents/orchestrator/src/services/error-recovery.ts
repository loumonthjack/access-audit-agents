/**
 * Error Recovery Service
 * 
 * Implements error recovery strategies for the orchestration workflow:
 * - Selector error recovery with fuzzy matching (Requirement 7.1)
 * - Verification failure handling (Requirement 7.2)
 * - Rollback on new violations (Requirement 7.3)
 * - Human handoff when all strategies fail (Requirement 7.4)
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import type { Page } from 'playwright';
import type { FixInstruction, InjectorError } from '../types/index.js';
import { RollbackManager } from './rollback-manager.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Page structure from the Auditor's GetPageStructure action
 */
export interface PageStructure {
    interactiveElements: ElementSummary[];
    landmarks: ElementSummary[];
    headings: ElementSummary[];
}

/**
 * Element summary from page structure
 */
export interface ElementSummary {
    selector: string;
    tagName: string;
    role?: string;
    text?: string;
}

/**
 * Result of selector recovery attempt
 */
export interface SelectorRecoveryResult {
    success: boolean;
    originalSelector: string;
    correctedSelector?: string;
    matchedElement?: ElementSummary;
    confidence: number; // 0-1 score
    reason?: string;
}

/**
 * Result of verification failure analysis
 */
export interface VerificationFailureAnalysis {
    failureType: 'vague_text' | 'redundant_text' | 'new_violation' | 'other';
    reason: string;
    suggestedAction: 'improve_text' | 'rollback' | 'retry' | 'handoff';
    improvedText?: string;
}

/**
 * Recovery action result
 */
export interface RecoveryResult {
    success: boolean;
    action: 'selector_corrected' | 'text_improved' | 'rolled_back' | 'handoff';
    details: string;
    correctedInstruction?: FixInstruction;
}

// ============================================================================
// Fuzzy Matching Utilities
// ============================================================================

/**
 * Calculates Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));

    for (let i = 0; i <= b.length; i++) {
        matrix[i]![0] = i;
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0]![j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i]![j] = matrix[i - 1]![j - 1]!;
            } else {
                matrix[i]![j] = Math.min(
                    matrix[i - 1]![j - 1]! + 1, // substitution
                    matrix[i]![j - 1]! + 1,     // insertion
                    matrix[i - 1]![j]! + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length]![a.length]!;
}

/**
 * Calculates similarity score between two strings (0-1)
 */
export function stringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
    const maxLength = Math.max(a.length, b.length);
    return 1 - distance / maxLength;
}

/**
 * Extracts tag name from a selector
 */
export function extractTagFromSelector(selector: string): string | null {
    // Match tag name at the start of selector
    const match = selector.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
    return match?.[1]?.toLowerCase() ?? null;
}

/**
 * Extracts ID from a selector
 */
export function extractIdFromSelector(selector: string): string | null {
    const match = selector.match(/#([a-zA-Z_][a-zA-Z0-9_-]*)/);
    return match?.[1] ?? null;
}

/**
 * Extracts class names from a selector
 */
export function extractClassesFromSelector(selector: string): string[] {
    const matches = selector.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g);
    return matches ? matches.map(m => m.substring(1)) : [];
}

/**
 * Extracts attribute values from a selector
 */
export function extractAttributesFromSelector(selector: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const regex = /\[([a-zA-Z_][a-zA-Z0-9_-]*)(?:="([^"]*)")?\]/g;
    let match;
    while ((match = regex.exec(selector)) !== null) {
        const key = match[1];
        if (key) {
            attrs[key] = match[2] ?? '';
        }
    }
    return attrs;
}

// ============================================================================
// Error Recovery Service
// ============================================================================

export class ErrorRecoveryService {
    private rollbackManager: RollbackManager;
    private pageStructureCache: PageStructure | null = null;

    constructor(rollbackManager?: RollbackManager) {
        this.rollbackManager = rollbackManager ?? new RollbackManager();
    }

    /**
     * Sets the cached page structure (from GetPageStructure call)
     */
    setPageStructure(structure: PageStructure): void {
        this.pageStructureCache = structure;
    }

    /**
     * Gets the cached page structure
     */
    getPageStructure(): PageStructure | null {
        return this.pageStructureCache;
    }

    /**
     * Clears the page structure cache
     */
    clearPageStructureCache(): void {
        this.pageStructureCache = null;
    }

    // ========================================================================
    // Selector Error Recovery (Requirement 7.1)
    // ========================================================================

    /**
     * Attempts to recover from a SELECTOR_NOT_FOUND error by fuzzy matching
     * Requirements: 7.1
     * 
     * @param originalSelector - The selector that failed
     * @param pageStructure - The page structure from GetPageStructure
     * @returns Recovery result with corrected selector if found
     */
    recoverFromSelectorError(
        originalSelector: string,
        pageStructure: PageStructure
    ): SelectorRecoveryResult {
        // Combine all elements from page structure
        const allElements = [
            ...pageStructure.interactiveElements,
            ...pageStructure.landmarks,
            ...pageStructure.headings
        ];

        if (allElements.length === 0) {
            return {
                success: false,
                originalSelector,
                confidence: 0,
                reason: 'No elements found in page structure'
            };
        }

        // Extract components from original selector
        const originalTag = extractTagFromSelector(originalSelector);
        const originalId = extractIdFromSelector(originalSelector);
        // Note: originalClasses extracted but not currently used in scoring
        // Could be used for future class-based matching
        void extractClassesFromSelector(originalSelector);
        const originalAttrs = extractAttributesFromSelector(originalSelector);

        // Score each element
        const scoredElements = allElements.map(element => {
            let score = 0;
            const matchReasons: string[] = [];

            // Tag name match (high weight)
            if (originalTag && element.tagName.toLowerCase() === originalTag) {
                score += 0.3;
                matchReasons.push('tag match');
            }

            // ID match in selector (very high weight)
            if (originalId && element.selector.includes(`#${originalId}`)) {
                score += 0.4;
                matchReasons.push('id match');
            }

            // Selector similarity
            const selectorSimilarity = stringSimilarity(originalSelector, element.selector);
            score += selectorSimilarity * 0.2;
            if (selectorSimilarity > 0.5) {
                matchReasons.push(`selector similarity: ${(selectorSimilarity * 100).toFixed(0)}%`);
            }

            // Text content match (if available)
            if (element.text && originalAttrs['aria-label']) {
                const textSimilarity = stringSimilarity(originalAttrs['aria-label'], element.text);
                score += textSimilarity * 0.1;
                if (textSimilarity > 0.5) {
                    matchReasons.push(`text similarity: ${(textSimilarity * 100).toFixed(0)}%`);
                }
            }

            // Role match
            if (element.role && originalAttrs['role'] === element.role) {
                score += 0.1;
                matchReasons.push('role match');
            }

            return {
                element,
                score,
                matchReasons
            };
        });

        // Sort by score descending
        scoredElements.sort((a, b) => b.score - a.score);

        const bestMatch = scoredElements[0];

        // Require minimum confidence threshold
        const CONFIDENCE_THRESHOLD = 0.3;
        if (!bestMatch || bestMatch.score < CONFIDENCE_THRESHOLD) {
            return {
                success: false,
                originalSelector,
                confidence: bestMatch?.score ?? 0,
                reason: bestMatch
                    ? `Best match score (${(bestMatch.score * 100).toFixed(0)}%) below threshold (${CONFIDENCE_THRESHOLD * 100}%)`
                    : 'No matches found'
            };
        }

        return {
            success: true,
            originalSelector,
            correctedSelector: bestMatch.element.selector,
            matchedElement: bestMatch.element,
            confidence: bestMatch.score,
            reason: `Matched by: ${bestMatch.matchReasons.join(', ')}`
        };
    }

    /**
     * Creates a corrected fix instruction with the new selector
     */
    createCorrectedInstruction(
        original: FixInstruction,
        correctedSelector: string
    ): FixInstruction {
        // Deep clone and update selector
        const corrected: FixInstruction = {
            ...original,
            selector: correctedSelector,
            params: { ...original.params, selector: correctedSelector }
        };

        return corrected;
    }

    // ========================================================================
    // Verification Failure Handling (Requirement 7.2)
    // ========================================================================

    /**
     * Analyzes a verification failure to determine the appropriate recovery action
     * Requirements: 7.2
     * 
     * @param failureReason - The reason for verification failure
     * @param originalText - The original text that was applied
     * @returns Analysis with suggested action
     */
    analyzeVerificationFailure(
        failureReason: string,
        originalText?: string
    ): VerificationFailureAnalysis {
        const reasonLower = failureReason.toLowerCase();

        // Check for vague text issues
        if (reasonLower.includes('vague') || reasonLower.includes('generic') ||
            reasonLower.includes('non-descriptive') || reasonLower.includes('unclear')) {
            return {
                failureType: 'vague_text',
                reason: failureReason,
                suggestedAction: 'improve_text',
                improvedText: this.generateImprovedText(originalText, 'vague')
            };
        }

        // Check for redundant text issues
        if (reasonLower.includes('redundant') || reasonLower.includes('duplicate') ||
            reasonLower.includes('repetitive') || reasonLower.includes('same as')) {
            return {
                failureType: 'redundant_text',
                reason: failureReason,
                suggestedAction: 'improve_text',
                improvedText: this.generateImprovedText(originalText, 'redundant')
            };
        }

        // Check for new violation introduced
        if (reasonLower.includes('new violation') || reasonLower.includes('introduced') ||
            reasonLower.includes('caused') || reasonLower.includes('broke')) {
            return {
                failureType: 'new_violation',
                reason: failureReason,
                suggestedAction: 'rollback'
            };
        }

        // Default to retry for other failures
        return {
            failureType: 'other',
            reason: failureReason,
            suggestedAction: 'retry'
        };
    }

    /**
     * Generates improved text based on the failure type
     * Requirements: 7.2
     */
    private generateImprovedText(originalText: string | undefined, failureType: 'vague' | 'redundant'): string {
        if (!originalText) {
            return 'Descriptive text for this element';
        }

        if (failureType === 'vague') {
            // Add more context to vague text
            const vaguePhrases = ['click here', 'read more', 'learn more', 'more', 'here', 'link', 'button'];
            const isVague = vaguePhrases.some(phrase =>
                originalText.toLowerCase().includes(phrase)
            );

            if (isVague) {
                return `${originalText} - provides additional context and functionality`;
            }

            return `${originalText} (detailed description)`;
        }

        if (failureType === 'redundant') {
            // Try to make text unique
            return `${originalText} - unique identifier`;
        }

        return originalText;
    }

    /**
     * Creates an improved fix instruction for text-related failures
     * Requirements: 7.2
     */
    createImprovedTextInstruction(
        original: FixInstruction,
        improvedText: string
    ): FixInstruction {
        if (original.type === 'content') {
            return {
                ...original,
                params: {
                    ...original.params,
                    innerText: improvedText
                }
            };
        }

        if (original.type === 'attribute') {
            const attrParams = original.params as { attribute: string; value: string; selector: string; reasoning: string };
            if (attrParams.attribute === 'alt' || attrParams.attribute === 'aria-label' || attrParams.attribute === 'title') {
                return {
                    ...original,
                    params: {
                        ...attrParams,
                        value: improvedText
                    }
                };
            }
        }

        return original;
    }

    // ========================================================================
    // Rollback on New Violation (Requirement 7.3)
    // ========================================================================

    /**
     * Triggers a rollback when a fix caused a new violation
     * Requirements: 7.3
     * 
     * @param page - Playwright page
     * @param snapshotId - The snapshot ID to rollback to
     * @returns Whether rollback was successful
     */
    async triggerRollback(page: Page, snapshotId: string): Promise<boolean> {
        try {
            await this.rollbackManager.rollback(page, snapshotId);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Gets the rollback manager
     */
    getRollbackManager(): RollbackManager {
        return this.rollbackManager;
    }

    // ========================================================================
    // Combined Recovery Flow
    // ========================================================================

    /**
     * Attempts to recover from an injector error
     * Requirements: 7.1, 7.4
     * 
     * @param error - The injector error
     * @param instruction - The original fix instruction
     * @param pageStructure - Page structure for fuzzy matching (optional, uses cache if not provided)
     * @returns Recovery result
     */
    recoverFromInjectorError(
        error: InjectorError,
        instruction: FixInstruction,
        pageStructure?: PageStructure
    ): RecoveryResult {
        const structure = pageStructure ?? this.pageStructureCache;

        if (error.code === 'SELECTOR_NOT_FOUND') {
            if (!structure) {
                return {
                    success: false,
                    action: 'handoff',
                    details: 'SELECTOR_NOT_FOUND error but no page structure available for fuzzy matching'
                };
            }

            const recovery = this.recoverFromSelectorError(instruction.selector, structure);

            if (recovery.success && recovery.correctedSelector) {
                const correctedInstruction = this.createCorrectedInstruction(
                    instruction,
                    recovery.correctedSelector
                );

                return {
                    success: true,
                    action: 'selector_corrected',
                    details: `Selector corrected from "${instruction.selector}" to "${recovery.correctedSelector}" (confidence: ${(recovery.confidence * 100).toFixed(0)}%)`,
                    correctedInstruction
                };
            }

            return {
                success: false,
                action: 'handoff',
                details: `Could not find matching element: ${recovery.reason}`
            };
        }

        if (error.code === 'CONTENT_CHANGED') {
            return {
                success: false,
                action: 'handoff',
                details: 'Content changed since audit - re-audit required'
            };
        }

        if (error.code === 'DESTRUCTIVE_CHANGE') {
            return {
                success: false,
                action: 'handoff',
                details: 'Fix would cause destructive change - human review required'
            };
        }

        return {
            success: false,
            action: 'handoff',
            details: `Unrecoverable error: ${error.code} - ${error.message}`
        };
    }

    /**
     * Attempts to recover from a verification failure
     * Requirements: 7.2, 7.3, 7.4
     * 
     * @param page - Playwright page (for rollback)
     * @param failureReason - The reason for verification failure
     * @param instruction - The original fix instruction
     * @param snapshotId - Snapshot ID for potential rollback
     * @returns Recovery result
     */
    async recoverFromVerificationFailure(
        page: Page,
        failureReason: string,
        instruction: FixInstruction,
        snapshotId?: string
    ): Promise<RecoveryResult> {
        const analysis = this.analyzeVerificationFailure(
            failureReason,
            this.extractTextFromInstruction(instruction)
        );

        switch (analysis.suggestedAction) {
            case 'improve_text':
                if (analysis.improvedText) {
                    const improvedInstruction = this.createImprovedTextInstruction(
                        instruction,
                        analysis.improvedText
                    );

                    return {
                        success: true,
                        action: 'text_improved',
                        details: `Text improved for ${analysis.failureType} issue`,
                        correctedInstruction: improvedInstruction
                    };
                }
                break;

            case 'rollback':
                if (snapshotId) {
                    const rollbackSuccess = await this.triggerRollback(page, snapshotId);
                    if (rollbackSuccess) {
                        return {
                            success: true,
                            action: 'rolled_back',
                            details: `Rolled back fix that caused: ${analysis.reason}`
                        };
                    }
                }
                break;

            case 'retry':
                // For retry, we return the original instruction
                return {
                    success: true,
                    action: 'selector_corrected', // Using this as "retry with same"
                    details: 'Retrying with original instruction',
                    correctedInstruction: instruction
                };
        }

        return {
            success: false,
            action: 'handoff',
            details: `Could not recover from verification failure: ${analysis.reason}`
        };
    }

    /**
     * Extracts text content from a fix instruction
     */
    private extractTextFromInstruction(instruction: FixInstruction): string | undefined {
        if (instruction.type === 'content') {
            const params = instruction.params as { innerText: string };
            return params.innerText;
        }

        if (instruction.type === 'attribute') {
            const params = instruction.params as { attribute: string; value: string };
            if (['alt', 'aria-label', 'title'].includes(params.attribute)) {
                return params.value;
            }
        }

        return undefined;
    }
}

/**
 * Singleton instance for convenience
 */
export const errorRecoveryService = new ErrorRecoveryService();
