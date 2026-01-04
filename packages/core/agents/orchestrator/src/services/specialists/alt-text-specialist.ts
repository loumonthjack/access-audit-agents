/**
 * AltTextSpecialist
 * 
 * Handles image-alt and img-alt violations by generating descriptive
 * alt text from context. Uses surrounding text, filename, and image
 * analysis to create meaningful descriptions.
 * 
 * Requirements: 6.1
 */

import type { FixInstruction, AttributeFixParams } from '../../types/index.js';
import { BaseSpecialist, type Violation, type PageContext } from './specialist-agent.js';

// ============================================================================
// AltTextSpecialist Implementation
// ============================================================================

export class AltTextSpecialist extends BaseSpecialist {
    readonly name = 'AltTextSpecialist';

    protected readonly handledRulePatterns: RegExp[] = [
        /image-alt/i,
        /img-alt/i,
        /input-image-alt/i,
        /area-alt/i,
        /object-alt/i,
        /svg-img-alt/i
    ];

    async planFix(violation: Violation, context: PageContext): Promise<FixInstruction> {
        const altText = this.generateAltText(violation, context);

        const params: AttributeFixParams = {
            selector: violation.selector,
            attribute: 'alt',
            value: altText,
            reasoning: this.generateReasoning(violation, context, altText)
        };

        return {
            type: 'attribute',
            selector: violation.selector,
            violationId: violation.id,
            reasoning: params.reasoning,
            params
        };
    }

    /**
     * Generates descriptive alt text based on available context.
     * 
     * Priority order:
     * 1. Surrounding text context
     * 2. Image filename analysis
     * 3. Parent element context
     * 4. Generic fallback based on violation type
     */
    private generateAltText(violation: Violation, context: PageContext): string {
        // Try to extract meaningful text from filename
        if (context.imageFilename) {
            const filenameAlt = this.extractAltFromFilename(context.imageFilename);
            if (filenameAlt) {
                return filenameAlt;
            }
        }

        // Use surrounding text if available
        if (context.surroundingText) {
            const trimmedText = context.surroundingText.trim();
            if (trimmedText.length > 0 && trimmedText.length <= 125) {
                return `Image related to: ${trimmedText}`;
            }
            if (trimmedText.length > 125) {
                return `Image related to: ${trimmedText.substring(0, 122)}...`;
            }
        }

        // Check if this is a decorative image (empty alt is appropriate)
        if (this.isLikelyDecorative(violation, context)) {
            return '';
        }

        // Fallback: generate generic but informative alt text
        return this.generateGenericAlt(violation, context);
    }

    /**
     * Extracts meaningful alt text from image filename.
     */
    private extractAltFromFilename(filename: string): string | null {
        // Remove file extension
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

        // Skip generic filenames
        const genericPatterns = [
            /^img\d*$/i,
            /^image\d*$/i,
            /^photo\d*$/i,
            /^picture\d*$/i,
            /^untitled/i,
            /^dsc\d+$/i,
            /^screenshot/i,
            /^\d+$/
        ];

        if (genericPatterns.some(pattern => pattern.test(nameWithoutExt))) {
            return null;
        }

        // Convert kebab-case, snake_case, or camelCase to readable text
        const readable = nameWithoutExt
            .replace(/[-_]/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .toLowerCase()
            .trim();

        if (readable.length > 0 && readable.length <= 100) {
            // Capitalize first letter
            return readable.charAt(0).toUpperCase() + readable.slice(1);
        }

        return null;
    }

    /**
     * Determines if an image is likely decorative.
     */
    private isLikelyDecorative(violation: Violation, context: PageContext): boolean {
        const html = violation.html.toLowerCase();

        // Check for common decorative patterns
        const decorativePatterns = [
            /role\s*=\s*["']presentation["']/i,
            /aria-hidden\s*=\s*["']true["']/i,
            /class\s*=\s*["'][^"']*(?:icon|decoration|spacer|divider)[^"']*["']/i
        ];

        if (decorativePatterns.some(pattern => pattern.test(html))) {
            return true;
        }

        // Check filename for decorative indicators
        if (context.imageFilename) {
            const decorativeFilenames = [
                /spacer/i,
                /divider/i,
                /decoration/i,
                /border/i,
                /bullet/i,
                /arrow/i,
                /icon/i
            ];
            if (decorativeFilenames.some(pattern => pattern.test(context.imageFilename!))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generates generic alt text when no context is available.
     */
    private generateGenericAlt(violation: Violation, context: PageContext): string {
        // Try to determine image type from HTML
        const html = violation.html.toLowerCase();

        if (html.includes('logo')) {
            return context.title ? `${context.title} logo` : 'Company logo';
        }

        if (html.includes('avatar') || html.includes('profile')) {
            return 'User profile image';
        }

        if (html.includes('banner') || html.includes('hero')) {
            return 'Banner image';
        }

        if (html.includes('thumbnail')) {
            return 'Thumbnail image';
        }

        // Default fallback
        return 'Image';
    }

    /**
     * Generates reasoning for the fix.
     */
    private generateReasoning(violation: Violation, context: PageContext, altText: string): string {
        if (altText === '') {
            return `Setting empty alt attribute to mark image as decorative. ` +
                `This is appropriate when the image does not convey meaningful content. ` +
                `Rule: ${violation.ruleId}`;
        }

        const sources: string[] = [];

        if (context.imageFilename) {
            sources.push('filename analysis');
        }
        if (context.surroundingText) {
            sources.push('surrounding text context');
        }
        if (sources.length === 0) {
            sources.push('HTML structure analysis');
        }

        return `Generated alt text "${altText}" based on ${sources.join(' and ')}. ` +
            `This provides a meaningful description for screen reader users. ` +
            `Rule: ${violation.ruleId}`;
    }
}
