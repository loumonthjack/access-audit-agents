/**
 * FixCard component
 * Displays a single applied fix with before/after HTML diff
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
import { useState, useCallback } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { Highlight, themes } from 'prism-react-renderer';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import type { FixCardProps } from '../types';

/**
 * Copy icon component
 */
const CopyIcon = () => (
    <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
    </svg>
);

/**
 * Check icon for copy success
 */
const CheckIcon = () => (
    <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
    >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);

/**
 * Get badge variant based on fix type
 */
function getFixTypeBadgeVariant(fixType: string): 'primary' | 'success' | 'warning' {
    switch (fixType) {
        case 'attribute':
            return 'primary';
        case 'content':
            return 'success';
        case 'style':
            return 'warning';
        default:
            return 'primary';
    }
}

/**
 * Get badge variant based on impact level
 */
function getImpactBadgeVariant(impact: string): 'error' | 'warning' | 'primary' | 'default' {
    switch (impact) {
        case 'critical':
            return 'error';
        case 'serious':
            return 'warning';
        case 'moderate':
            return 'primary';
        default:
            return 'default';
    }
}

/**
 * Custom syntax highlighter for diff viewer
 */
const highlightSyntax = (str: string) => (
    <Highlight theme={themes.github} code={str} language="html">
        {({ tokens, getLineProps, getTokenProps }) => (
            <pre style={{ display: 'inline' }}>
                {tokens.map((line, i) => (
                    <span key={i} {...getLineProps({ line })}>
                        {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                        ))}
                    </span>
                ))}
            </pre>
        )}
    </Highlight>
);

/**
 * FixCard displays a single applied fix with before/after HTML diff
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export function FixCard({ fix, onCopy }: FixCardProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(fix.afterHtml);
            setCopied(true);
            onCopy?.(fix.afterHtml);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [fix.afterHtml, onCopy]);

    return (
        <Card className="overflow-hidden" data-testid="fix-card">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                    {/* Violation header with rule ID and badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <code className="rounded bg-neutral-100 px-2 py-1 text-sm font-mono font-medium text-neutral-800">
                            {fix.ruleId}
                        </code>
                        <Badge variant={getImpactBadgeVariant(fix.impact)} size="sm">
                            {fix.impact}
                        </Badge>
                        <Badge variant={getFixTypeBadgeVariant(fix.fixType)} size="sm">
                            {fix.fixType} fix
                        </Badge>
                    </div>
                    {/* Violation description */}
                    <CardTitle as="h4" className="text-base text-neutral-900">
                        {fix.description}
                    </CardTitle>
                    {/* Selector */}
                    <p className="mt-1 text-xs font-mono text-neutral-500 break-all">
                        {fix.selector}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    aria-label={copied ? 'Copied to clipboard' : 'Copy fixed HTML to clipboard'}
                    leftIcon={copied ? <CheckIcon /> : <CopyIcon />}
                    className="self-start"
                >
                    {copied ? 'Copied!' : 'Copy'}
                </Button>
            </CardHeader>

            <CardContent padding="none" className="p-0">
                {/* Reasoning section */}
                <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                    <h5 className="mb-1 text-sm font-medium text-neutral-700">AI Reasoning</h5>
                    <p className="text-sm text-neutral-600" data-testid="fix-reasoning">
                        {fix.reasoning}
                    </p>
                </div>

                {/* Diff viewer */}
                <div className="overflow-x-auto" data-testid="fix-diff">
                    <ReactDiffViewer
                        oldValue={fix.beforeHtml}
                        newValue={fix.afterHtml}
                        splitView={false}
                        useDarkTheme={false}
                        compareMethod={DiffMethod.WORDS}
                        renderContent={highlightSyntax}
                        styles={{
                            variables: {
                                light: {
                                    diffViewerBackground: '#ffffff',
                                    addedBackground: '#e6ffec',
                                    addedColor: '#24292f',
                                    removedBackground: '#ffebe9',
                                    removedColor: '#24292f',
                                    wordAddedBackground: '#abf2bc',
                                    wordRemovedBackground: '#ff8182',
                                    addedGutterBackground: '#ccffd8',
                                    removedGutterBackground: '#ffd7d5',
                                    gutterBackground: '#f6f8fa',
                                    gutterBackgroundDark: '#f0f1f2',
                                    highlightBackground: '#fffbdd',
                                    highlightGutterBackground: '#fff5b1',
                                },
                            },
                            contentText: {
                                fontFamily: 'ui-monospace, monospace',
                                fontSize: '13px',
                            },
                        }}
                        leftTitle="Before"
                        rightTitle="After"
                    />
                </div>

                {/* Applied timestamp */}
                <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-2">
                    <p className="text-xs text-neutral-500">
                        Applied at: {new Date(fix.appliedAt).toLocaleString()}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
