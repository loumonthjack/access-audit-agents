/**
 * Bedrock Agent Invocation
 * 
 * Handles invoking the Bedrock Agent for accessibility remediation
 * and processing the streaming response.
 */

import {
    BedrockAgentRuntimeClient,
    InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
    SSMClient,
    GetParameterCommand,
} from '@aws-sdk/client-ssm';
import {
    LambdaClient,
    InvokeCommand,
} from '@aws-sdk/client-lambda';
import { notifySession } from './websocket';

// SSM parameter names (set by CDK)
const BEDROCK_AGENT_ID_PARAM = process.env.BEDROCK_AGENT_ID_PARAM ?? '';
const BEDROCK_AGENT_ALIAS_ID_PARAM = process.env.BEDROCK_AGENT_ALIAS_ID_PARAM ?? '';
const AUDITOR_FUNCTION_NAME = process.env.AUDITOR_FUNCTION_NAME ?? '';

// Direct environment variables (fallback for local testing)
let BEDROCK_AGENT_ID = process.env.BEDROCK_AGENT_ID ?? '';
let BEDROCK_AGENT_ALIAS_ID = process.env.BEDROCK_AGENT_ALIAS_ID ?? '';

const bedrockClient = new BedrockAgentRuntimeClient({});
const ssmClient = new SSMClient({});
const lambdaClient = new LambdaClient({});

// Violation types from Auditor
interface ViolationNode {
    selector: string;
    html: string;
    failureSummary: string;
    screenshot?: string;
}

interface AuditorViolation {
    id: string;
    impact: string;
    description: string;
    help: string;
    helpUrl: string;
    nodes: ViolationNode[];
    recommendation?: string;
}

interface AuditorScanResult {
    success: boolean;
    url: string;
    viewport: string;
    violations: AuditorViolation[];
    violationCounts: {
        critical: number;
        serious: number;
        moderate: number;
        minor: number;
        total: number;
    };
    pageScreenshot?: string;
    message: string;
    errorCode?: string;
    errorDetails?: string;
}

// Cache for SSM parameters
let ssmParamsLoaded = false;

/**
 * Load Bedrock Agent IDs from SSM Parameter Store
 */
async function loadBedrockConfig(): Promise<void> {
    if (ssmParamsLoaded) return;

    // If direct env vars are set, use them (for local testing)
    if (BEDROCK_AGENT_ID && BEDROCK_AGENT_ALIAS_ID) {
        ssmParamsLoaded = true;
        return;
    }

    // Load from SSM if parameter names are provided
    if (BEDROCK_AGENT_ID_PARAM) {
        try {
            const response = await ssmClient.send(new GetParameterCommand({
                Name: BEDROCK_AGENT_ID_PARAM,
            }));
            BEDROCK_AGENT_ID = response.Parameter?.Value ?? '';
            console.log('Loaded BEDROCK_AGENT_ID from SSM');
        } catch (error) {
            console.error('Failed to load BEDROCK_AGENT_ID from SSM:', error);
        }
    }

    if (BEDROCK_AGENT_ALIAS_ID_PARAM) {
        try {
            const response = await ssmClient.send(new GetParameterCommand({
                Name: BEDROCK_AGENT_ALIAS_ID_PARAM,
            }));
            BEDROCK_AGENT_ALIAS_ID = response.Parameter?.Value ?? '';
            console.log('Loaded BEDROCK_AGENT_ALIAS_ID from SSM');
        } catch (error) {
            console.error('Failed to load BEDROCK_AGENT_ALIAS_ID from SSM:', error);
        }
    }

    ssmParamsLoaded = true;
}

/**
 * Update session status in database
 * Uses query without RLS since we have the session ID directly
 */
async function updateSessionStatus(
    sessionId: string,
    orgId: string,
    status: string,
    errorMessage?: string
): Promise<void> {
    const { query } = await import('../shared/database.js');
    const completedAt = status === 'complete' || status === 'error' ? 'NOW()' : 'NULL';

    console.log('Updating session status:', { sessionId, orgId, status, errorMessage });

    await query(
        `UPDATE scan_sessions 
         SET status = $1, 
             error_message = $2,
             completed_at = ${completedAt}
         WHERE id = $3`,
        [status, errorMessage ?? null, sessionId]
    );

    console.log('Session status updated successfully');
}

/**
 * Get organization ID for a session
 * Uses query without RLS to look up any session
 */
async function getSessionOrgId(sessionId: string): Promise<string> {
    const { query } = await import('../shared/database.js');
    const result = await query<{ orgId: string }>(
        'SELECT org_id as "orgId" FROM scan_sessions WHERE id = $1',
        [sessionId]
    );
    console.log('getSessionOrgId result:', { sessionId, found: result.rows.length > 0, orgId: result.rows[0]?.orgId });
    return result.rows[0]?.orgId ?? '00000000-0000-0000-0000-000000000000';
}

/**
 * Call Auditor Lambda directly to scan URL and get violations
 */
async function callAuditorLambda(url: string, viewport: string): Promise<AuditorScanResult | null> {
    if (!AUDITOR_FUNCTION_NAME) {
        console.error('AUDITOR_FUNCTION_NAME not configured');
        return null;
    }

    console.log('Calling Auditor Lambda:', AUDITOR_FUNCTION_NAME);

    try {
        // Create a Bedrock-style event for the Auditor
        const auditorEvent = {
            actionGroup: 'AuditorActionGroup',
            apiPath: '/scan',
            httpMethod: 'POST',
            messageVersion: '1.0',
            requestBody: {
                content: {
                    'application/json': {
                        properties: [
                            { name: 'url', type: 'string', value: url },
                            { name: 'viewport', type: 'string', value: viewport },
                        ],
                    },
                },
            },
        };

        const response = await lambdaClient.send(new InvokeCommand({
            FunctionName: AUDITOR_FUNCTION_NAME,
            Payload: JSON.stringify(auditorEvent),
        }));

        if (response.Payload) {
            const payloadStr = new TextDecoder().decode(response.Payload);
            console.log('Auditor response:', payloadStr.substring(0, 500));

            const auditorResponse = JSON.parse(payloadStr);

            // Parse the nested response body
            if (auditorResponse.response?.responseBody?.['application/json']?.body) {
                const scanResult = JSON.parse(auditorResponse.response.responseBody['application/json'].body);
                return scanResult as AuditorScanResult;
            }
        }

        return null;
    } catch (error) {
        console.error('Failed to call Auditor Lambda:', error);
        return null;
    }
}

/**
 * Store violations in the database
 */
async function storeViolations(sessionId: string, violations: AuditorViolation[], pageScreenshot?: string): Promise<void> {
    if (violations.length === 0) {
        console.log('No violations to store');
        return;
    }

    const { query } = await import('../shared/database.js');

    console.log(`Storing ${violations.length} violations for session ${sessionId}`);

    // Store page screenshot if available
    if (pageScreenshot) {
        try {
            await query(
                `UPDATE scan_sessions SET page_screenshot = $1 WHERE id = $2`,
                [pageScreenshot, sessionId]
            );
            console.log('Page screenshot stored');
        } catch (error) {
            console.error('Failed to store page screenshot:', error);
        }
    }

    for (const violation of violations) {
        for (const node of violation.nodes) {
            try {
                await query(
                    `INSERT INTO violations (
                        session_id, rule_id, impact, description, help, help_url,
                        selector, html, failure_summary, screenshot, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')`,
                    [
                        sessionId,
                        violation.id,
                        violation.impact,
                        violation.description,
                        violation.help,
                        violation.helpUrl,
                        node.selector,
                        node.html,
                        node.failureSummary,
                        node.screenshot ?? null,
                    ]
                );
            } catch (error) {
                console.error('Failed to store violation:', error);
            }
        }
    }

    console.log('Violations stored successfully');
}

/**
 * Invoke Bedrock Agent for accessibility scanning and remediation
 */
export async function invokeBedrock(
    sessionId: string,
    url: string,
    viewport: string
): Promise<void> {
    // Get org ID first for status updates
    const orgId = await getSessionOrgId(sessionId);
    console.log('invokeBedrock called with:', { sessionId, url, viewport, orgId });

    // Load Bedrock config from SSM if not already loaded
    await loadBedrockConfig();

    console.log('Bedrock config:', {
        agentId: BEDROCK_AGENT_ID ? `${BEDROCK_AGENT_ID.substring(0, 8)}...` : 'NOT SET',
        aliasId: BEDROCK_AGENT_ALIAS_ID ? `${BEDROCK_AGENT_ALIAS_ID.substring(0, 8)}...` : 'NOT SET',
        ssmAgentIdParam: BEDROCK_AGENT_ID_PARAM || 'NOT SET',
        ssmAliasIdParam: BEDROCK_AGENT_ALIAS_ID_PARAM || 'NOT SET',
        auditorFunctionName: AUDITOR_FUNCTION_NAME || 'NOT SET'
    });

    try {
        // Notify clients that scanning has started
        await notifySession(sessionId, {
            type: 'session:status',
            sessionId,
            status: 'scanning',
            timestamp: new Date().toISOString(),
        });

        // Step 1: Call Auditor Lambda directly to get violations
        console.log('Step 1: Calling Auditor Lambda to scan URL');
        const scanResult = await callAuditorLambda(url, viewport);

        if (!scanResult) {
            throw new Error('Failed to get scan results from Auditor Lambda');
        }

        if (!scanResult.success) {
            // Use the user-friendly error message from the Auditor
            const errorMessage = scanResult.message;
            const errorCode = scanResult.errorCode || 'SCAN_ERROR';

            console.error('Scan failed:', { errorCode, errorMessage, details: scanResult.errorDetails });

            await updateSessionStatus(sessionId, orgId, 'error', errorMessage);
            await notifySession(sessionId, {
                type: 'error',
                sessionId,
                message: errorMessage,
                errorCode,
                errorDetails: scanResult.errorDetails,
                timestamp: new Date().toISOString(),
            });
            return;
        }

        console.log('Scan completed:', {
            url: scanResult.url,
            totalViolations: scanResult.violationCounts.total,
            critical: scanResult.violationCounts.critical,
            serious: scanResult.violationCounts.serious,
        });

        // Step 2: Store violations in database
        console.log('Step 2: Storing violations in database');
        await storeViolations(sessionId, scanResult.violations, scanResult.pageScreenshot);

        // Notify about violations found
        await notifySession(sessionId, {
            type: 'violations:found',
            sessionId,
            count: scanResult.violationCounts.total,
            counts: scanResult.violationCounts,
            timestamp: new Date().toISOString(),
        });

        // Step 3: If no violations, mark as complete
        if (scanResult.violationCounts.total === 0) {
            console.log('No violations found, marking session as complete');
            await updateSessionStatus(sessionId, orgId, 'complete');
            await notifySession(sessionId, {
                type: 'session:complete',
                sessionId,
                message: 'No accessibility violations found',
                timestamp: new Date().toISOString(),
            });
            return;
        }

        // Step 4: If Bedrock Agent is configured, invoke it for remediation
        if (!BEDROCK_AGENT_ID || !BEDROCK_AGENT_ALIAS_ID) {
            console.log('Bedrock Agent not configured, skipping remediation');
            await updateSessionStatus(sessionId, orgId, 'complete');
            await notifySession(sessionId, {
                type: 'session:complete',
                sessionId,
                message: `Found ${scanResult.violationCounts.total} violations. Bedrock Agent not configured for remediation.`,
                timestamp: new Date().toISOString(),
            });
            return;
        }

        // Update status to remediating
        await updateSessionStatus(sessionId, orgId, 'remediating');
        await notifySession(sessionId, {
            type: 'session:status',
            sessionId,
            status: 'remediating',
            timestamp: new Date().toISOString(),
        });

        // Step 5: Invoke Bedrock Agent for remediation
        console.log('Step 3: Invoking Bedrock Agent for remediation');
        const inputText = buildAgentPrompt(url, viewport, scanResult.violations);
        console.log('Invoking Bedrock Agent with prompt length:', inputText.length);

        const response = await bedrockClient.send(
            new InvokeAgentCommand({
                agentId: BEDROCK_AGENT_ID,
                agentAliasId: BEDROCK_AGENT_ALIAS_ID,
                sessionId,
                inputText,
            })
        );

        console.log('Bedrock Agent response received');

        // Process streaming response
        if (response.completion) {
            for await (const event of response.completion) {
                if (event.chunk?.bytes) {
                    const text = new TextDecoder().decode(event.chunk.bytes);
                    await processAgentChunk(sessionId, text);
                }
            }
        }

        // Mark session as complete
        await updateSessionStatus(sessionId, orgId, 'complete');
        await notifySession(sessionId, {
            type: 'session:complete',
            sessionId,
            timestamp: new Date().toISOString(),
        });

        console.log('Scan completed for session:', sessionId);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        console.error('Scan/remediation failed:', {
            errorName,
            message,
            sessionId,
            stack: error instanceof Error ? error.stack : undefined
        });

        await updateSessionStatus(sessionId, orgId, 'error', message);
        await notifySession(sessionId, {
            type: 'error',
            sessionId,
            message,
            timestamp: new Date().toISOString(),
        });
    }
}

/**
 * Build the prompt for the Bedrock Agent
 */
function buildAgentPrompt(url: string, viewport: string, violations: AuditorViolation[]): string {
    // Build a summary of violations for the agent
    const violationSummary = violations.map((v, i) => {
        const nodeInfo = v.nodes.map(n => `  - Selector: ${n.selector}\n    HTML: ${n.html.substring(0, 100)}...`).join('\n');
        return `${i + 1}. [${v.impact.toUpperCase()}] ${v.id}: ${v.description}\n${nodeInfo}`;
    }).join('\n\n');

    return `The URL "${url}" has been scanned for WCAG 2.1 AA accessibility violations using ${viewport} viewport.

Found ${violations.length} violations:

${violationSummary}

For each violation:
1. Analyze the issue and determine the best fix
2. Apply the fix using the Injector action group (ApplyAttributeFix, ApplyContentFix, or InjectStyle)
3. Verify the fix resolved the issue

Process violations in priority order: critical > serious > moderate > minor.

After completing all fixes, provide a summary of actions taken.`;
}

/**
 * Process a chunk from the Bedrock Agent response
 */
async function processAgentChunk(sessionId: string, text: string): Promise<void> {
    console.log('Agent chunk:', text.substring(0, 200));

    // Parse agent actions and send real-time updates
    if (text.includes('violation detected') || text.includes('Violation:')) {
        await notifySession(sessionId, {
            type: 'violation:detected',
            sessionId,
            timestamp: new Date().toISOString(),
        });
    }

    if (text.includes('fix applied') || text.includes('Fixed:')) {
        await notifySession(sessionId, {
            type: 'violation:fixed',
            sessionId,
            timestamp: new Date().toISOString(),
        });
    }
}

