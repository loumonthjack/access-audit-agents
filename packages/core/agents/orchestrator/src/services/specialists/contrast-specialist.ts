/**
 * ContrastSpecialist
 * 
 * Handles color contrast violations by calculating WCAG-compliant
 * color adjustments. Ensures text meets AA contrast requirements
 * (4.5:1 for normal text, 3:1 for large text).
 * 
 * Requirements: 6.3
 */

import type { FixInstruction, StyleFixParams } from '../../types/index.js';
import { BaseSpecialist, type Violation, type PageContext } from './specialist-agent.js';

// ============================================================================
// Color Utilities
// ============================================================================

interface RGB {
    r: number;
    g: number;
    b: number;
}

/**
 * Parses a color string to RGB values.
 * Supports hex (#RGB, #RRGGBB), rgb(), and rgba() formats.
 */
function parseColor(color: string): RGB | null {
    const trimmed = color.trim().toLowerCase();

    // Hex format
    const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (hexMatch && hexMatch[1]) {
        const hex = hexMatch[1];
        if (hex.length === 3) {
            return {
                r: parseInt((hex[0] ?? '0') + (hex[0] ?? '0'), 16),
                g: parseInt((hex[1] ?? '0') + (hex[1] ?? '0'), 16),
                b: parseInt((hex[2] ?? '0') + (hex[2] ?? '0'), 16)
            };
        }
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16)
        };
    }

    // RGB/RGBA format
    const rgbMatch = trimmed.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
        return {
            r: parseInt(rgbMatch[1], 10),
            g: parseInt(rgbMatch[2], 10),
            b: parseInt(rgbMatch[3], 10)
        };
    }

    return null;
}

/**
 * Converts RGB to hex string.
 */
function rgbToHex(rgb: RGB): string {
    const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Calculates relative luminance per WCAG 2.1.
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getRelativeLuminance(rgb: RGB): number {
    const sRGB = [rgb.r / 255, rgb.g / 255, rgb.b / 255];
    const linearized = sRGB.map(c =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );
    const r = linearized[0] ?? 0;
    const g = linearized[1] ?? 0;
    const b = linearized[2] ?? 0;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculates contrast ratio between two colors.
 * https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 */
function getContrastRatio(color1: RGB, color2: RGB): number {
    const l1 = getRelativeLuminance(color1);
    const l2 = getRelativeLuminance(color2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Adjusts a color to meet target contrast ratio.
 */
function adjustColorForContrast(
    foreground: RGB,
    background: RGB,
    targetRatio: number
): RGB {
    const bgLuminance = getRelativeLuminance(background);

    // Determine if we should lighten or darken the foreground
    const fgLuminance = getRelativeLuminance(foreground);
    const shouldDarken = fgLuminance > bgLuminance;

    let adjusted = { ...foreground };
    let iterations = 0;
    const maxIterations = 100;

    while (iterations < maxIterations) {
        const currentRatio = getContrastRatio(adjusted, background);
        if (currentRatio >= targetRatio) {
            break;
        }

        // Adjust color
        const step = 5;
        if (shouldDarken) {
            adjusted = {
                r: Math.max(0, adjusted.r - step),
                g: Math.max(0, adjusted.g - step),
                b: Math.max(0, adjusted.b - step)
            };
        } else {
            adjusted = {
                r: Math.min(255, adjusted.r + step),
                g: Math.min(255, adjusted.g + step),
                b: Math.min(255, adjusted.b + step)
            };
        }

        iterations++;
    }

    // If we hit max iterations and still don't meet ratio, use black or white
    if (getContrastRatio(adjusted, background) < targetRatio) {
        const blackRatio = getContrastRatio({ r: 0, g: 0, b: 0 }, background);
        const whiteRatio = getContrastRatio({ r: 255, g: 255, b: 255 }, background);
        return blackRatio > whiteRatio ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
    }

    return adjusted;
}

// ============================================================================
// ContrastSpecialist Implementation
// ============================================================================

export class ContrastSpecialist extends BaseSpecialist {
    readonly name = 'ContrastSpecialist';

    protected readonly handledRulePatterns: RegExp[] = [
        /contrast/i,
        /color-contrast/i,
        /link-in-text-block/i
    ];

    // WCAG AA contrast requirements
    private readonly NORMAL_TEXT_RATIO = 4.5;
    private readonly LARGE_TEXT_RATIO = 3.0;

    async planFix(violation: Violation, context: PageContext): Promise<FixInstruction> {
        const colors = this.extractColors(violation, context);
        const targetRatio = this.determineTargetRatio(violation);
        const adjustedColor = this.calculateAdjustedColor(colors, targetRatio);

        const params: StyleFixParams = {
            selector: violation.selector,
            cssClass: 'a11y-contrast-fix',
            styles: {
                color: adjustedColor
            }
        };

        return {
            type: 'style',
            selector: violation.selector,
            violationId: violation.id,
            reasoning: this.generateReasoning(violation, colors, adjustedColor, targetRatio),
            params
        };
    }

    /**
     * Extracts foreground and background colors from violation context.
     */
    private extractColors(violation: Violation, context: PageContext): { foreground: RGB; background: RGB } {
        // Try to get colors from context
        if (context.currentColors) {
            const fg = parseColor(context.currentColors.foreground);
            const bg = parseColor(context.currentColors.background);
            if (fg && bg) {
                return { foreground: fg, background: bg };
            }
        }

        // Try to extract from violation description or HTML
        const colorMatch = violation.description.match(
            /foreground[:\s]+([#\w(),.]+).*background[:\s]+([#\w(),.]+)/i
        );
        if (colorMatch && colorMatch[1] && colorMatch[2]) {
            const fg = parseColor(colorMatch[1]);
            const bg = parseColor(colorMatch[2]);
            if (fg && bg) {
                return { foreground: fg, background: bg };
            }
        }

        // Default fallback: assume light gray on white (common low contrast issue)
        return {
            foreground: { r: 150, g: 150, b: 150 },
            background: { r: 255, g: 255, b: 255 }
        };
    }

    /**
     * Determines the target contrast ratio based on text size.
     */
    private determineTargetRatio(violation: Violation): number {
        const description = violation.description.toLowerCase();
        const html = violation.html.toLowerCase();

        // Check for large text indicators
        const isLargeText =
            description.includes('large text') ||
            html.includes('font-size: 18') ||
            html.includes('font-size: 24') ||
            html.includes('<h1') ||
            html.includes('<h2') ||
            html.includes('<h3');

        // Add small buffer to ensure we meet the requirement
        return isLargeText ? this.LARGE_TEXT_RATIO + 0.1 : this.NORMAL_TEXT_RATIO + 0.1;
    }

    /**
     * Calculates an adjusted color that meets contrast requirements.
     */
    private calculateAdjustedColor(
        colors: { foreground: RGB; background: RGB },
        targetRatio: number
    ): string {
        const currentRatio = getContrastRatio(colors.foreground, colors.background);

        // If already meets requirements, return original
        if (currentRatio >= targetRatio) {
            return rgbToHex(colors.foreground);
        }

        // Adjust foreground color to meet target
        const adjusted = adjustColorForContrast(colors.foreground, colors.background, targetRatio);
        return rgbToHex(adjusted);
    }

    /**
     * Generates reasoning for the fix.
     */
    private generateReasoning(
        violation: Violation,
        originalColors: { foreground: RGB; background: RGB },
        adjustedColor: string,
        targetRatio: number
    ): string {
        const originalRatio = getContrastRatio(originalColors.foreground, originalColors.background);
        const originalHex = rgbToHex(originalColors.foreground);
        const bgHex = rgbToHex(originalColors.background);

        const ratioType = targetRatio > 4 ? 'normal text (4.5:1)' : 'large text (3:1)';

        return `Adjusting text color from ${originalHex} to ${adjustedColor} to meet WCAG AA ${ratioType} contrast requirement. ` +
            `Original contrast ratio was ${originalRatio.toFixed(2)}:1 against background ${bgHex}. ` +
            `New color achieves required ${targetRatio.toFixed(1)}:1 minimum ratio. ` +
            `Rule: ${violation.ruleId}`;
    }
}

// Export color utilities for testing
export { parseColor, rgbToHex, getRelativeLuminance, getContrastRatio, adjustColorForContrast };
export type { RGB };
