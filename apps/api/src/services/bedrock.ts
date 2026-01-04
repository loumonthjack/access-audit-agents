/**
 * Bedrock Agent Service
 * 
 * Invokes AWS Bedrock Agent for accessibility scanning and remediation.
 * For local development, can use local Browserless for direct scanning.
 */

import {
    BedrockAgentRuntimeClient,
    InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { query } from './database.js';
import { notifySession } from './websocket.js';
import { scanWithBrowserless } from './scanner.js';

// Lazy getters for environment variables - read at runtime, not module load time
function getBedrockAgentId(): string {
    return process.env.BEDROCK_AGENT_ID ?? '';
}

function getBedrockAgentAliasId(): string {
    return process.env.BEDROCK_AGENT_ALIAS_ID ?? '';
}

function getAwsRegion(): string {
    return process.env.AWS_REGION ?? 'us-east-1';
}

// Lazy-initialized client
let bedrockClient: BedrockAgentRuntimeClient | null = null;

function getBedrockClient(): BedrockAgentRuntimeClient {
    if (!bedrockClient) {
        bedrockClient = new BedrockAgentRuntimeClient({ region: getAwsRegion() });
    }
    return bedrockClient;
}

async function updateSessionStatus(
    sessionId: string,
    status: string,
    errorMessage?: string
): Promise<void> {
    const completedAt = status === 'complete' || status === 'error' ? 'NOW()' : 'NULL';
    
    await query(
        `UPDATE scan_sessions 
         SET status = $1, 
             error_message = $2,
             completed_at = ${completedAt},
             updated_at = NOW()
         WHERE id = $3`,
        [status, errorMessage ?? null, sessionId]
    );
}

function buildAgentPrompt(url: string, viewport: string): string {
    return `You MUST use the Auditor action group's ScanURL function to scan "${url}" for WCAG 2.2 AA accessibility violations using ${viewport} viewport.

IMPORTANT: Do NOT respond without first calling the ScanURL function. You cannot know what violations exist without actually scanning.

After scanning:
1. Report the violations found from the scan results
2. For each violation, apply fixes using the Injector action group
3. Verify each fix using the Auditor's VerifyElement function

Process violations in priority order: critical > serious > moderate > minor.

After completing all fixes, provide a summary of actions taken.`;
}

interface ActionGroupTrace {
    actionGroupName?: string;
    apiPath?: string;
    requestBody?: {
        content?: {
            'application/json'?: {
                properties?: Array<{ name: string; value: string }>;
            };
        };
    };
    responseBody?: {
        'application/json'?: {
            body?: string;
        };
    };
}

interface ViolationNode {
    selector: string;
    html: string;
    failureSummary?: string;
}

interface ScanViolation {
    id: string;
    impact: string;
    description: string;
    help?: string;
    helpUrl?: string;
    nodes?: ViolationNode[];
}

interface ScanResponse {
    success: boolean;
    violations?: ScanViolation[];
    violationCounts?: {
        total: number;
        critical: number;
        serious: number;
        moderate: number;
        minor: number;
    };
}

interface FixResponse {
    success: boolean;
    selector?: string;
    beforeHtml?: string;
    afterHtml?: string;
}

/**
 * Process trace events from Bedrock agent to persist violations and fixes
 */
async function processActionGroupTrace(
    sessionId: string,
    trace: ActionGroupTrace
): Promise<void> {
    const { actionGroupName, apiPath, responseBody } = trace;

    if (!responseBody?.['application/json']?.body) {
        return;
    }

    try {
        const responseData = JSON.parse(responseBody['application/json'].body);

        // Handle Auditor action group responses
        if (actionGroupName === 'Auditor' && apiPath === '/scan') {
            const scanResponse = responseData as ScanResponse;
            if (scanResponse.success && scanResponse.violations) {
                await persistViolations(sessionId, scanResponse.violations);
                await notifySession(sessionId, {
                    type: 'violation:detected',
                    sessionId,
                    count: scanResponse.violations.length,
                    timestamp: new Date().toISOString(),
                });
            }
        }

        // Handle Injector action group responses
        if (actionGroupName === 'Injector') {
            const fixResponse = responseData as FixResponse;
            if (fixResponse.success && fixResponse.selector) {
                await persistAppliedFix(sessionId, fixResponse, apiPath ?? '');
                await notifySession(sessionId, {
                    type: 'violation:fixed',
                    sessionId,
                    selector: fixResponse.selector,
                    timestamp: new Date().toISOString(),
                });
            }
        }
    } catch (error) {
        console.error('Failed to process action group trace:', error);
    }
}

/**
 * Persist violations from scan results to database
 */
async function persistViolations(
    sessionId: string,
    violations: ScanViolation[]
): Promise<void> {
    for (const violation of violations) {
        for (const node of violation.nodes ?? []) {
            await query(
                `INSERT INTO violations (id, session_id, rule_id, impact, description, selector, html, status)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'pending')
                 ON CONFLICT DO NOTHING`,
                [
                    sessionId,
                    violation.id,
                    violation.impact,
                    violation.description,
                    node.selector,
                    node.html,
                ]
            );
        }
    }
    console.log(`Persisted ${violations.length} violations for session ${sessionId}`);
}

/**
 * Persist applied fix to database
 */
async function persistAppliedFix(
    sessionId: string,
    fixResponse: FixResponse,
    fixType: string
): Promise<void> {
    // Find the violation by selector
    const violationResult = await query<{ id: string }>(
        `SELECT id FROM violations 
         WHERE session_id = $1 AND selector = $2 AND status = 'pending'
         LIMIT 1`,
        [sessionId, fixResponse.selector]
    );

    if (violationResult.rows.length === 0) {
        console.warn(`No pending violation found for selector: ${fixResponse.selector}`);
        return;
    }

    const violationId = violationResult.rows[0].id;

    // Insert the applied fix
    await query(
        `INSERT INTO applied_fixes (id, violation_id, fix_type, before_html, after_html, reasoning)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [
            violationId,
            fixType.replace('/apply-', '').replace('/inject-', ''),
            fixResponse.beforeHtml ?? '',
            fixResponse.afterHtml ?? '',
            'Applied by Bedrock Agent',
        ]
    );

    // Update violation status to fixed
    await query(
        `UPDATE violations SET status = 'fixed', updated_at = NOW() WHERE id = $1`,
        [violationId]
    );

    console.log(`Persisted fix for violation ${violationId}`);
}

async function processAgentChunk(sessionId: string, text: string): Promise<void> {
    console.log('Agent chunk:', text.substring(0, 200));

    // Text-based notifications as fallback
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

export async function invokeBedrock(
    sessionId: string,
    url: string,
    viewport: string
): Promise<void> {
    const agentId = getBedrockAgentId();
    const agentAliasId = getBedrockAgentAliasId();

    if (!agentId || !agentAliasId) {
        console.warn('Bedrock Agent not configured, using local scanner...');
        await localScan(sessionId, url, viewport);
        return;
    }

    try {
        await notifySession(sessionId, {
            type: 'session:status',
            sessionId,
            status: 'scanning',
            timestamp: new Date().toISOString(),
        });

        const inputText = buildAgentPrompt(url, viewport);

        const response = await getBedrockClient().send(
            new InvokeAgentCommand({
                agentId,
                agentAliasId,
                sessionId,
                inputText,
                enableTrace: true,
            })
        );

        console.log('Bedrock response metadata:', {
            sessionId,
            contentType: response.contentType,
            memoryId: response.memoryId,
            responseSessionId: response.sessionId,
        });

        if (response.completion) {
            for await (const event of response.completion) {
                // Process trace events to extract action group results
                if (event.trace?.trace) {
                    console.log('Bedrock trace:', JSON.stringify(event.trace.trace, null, 2));
                    
                    // Extract action group invocation results
                    // The trace structure varies, so we safely access properties
                    const orchestrationTrace = event.trace.trace.orchestrationTrace;
                    if (orchestrationTrace?.observation?.actionGroupInvocationOutput) {
                        const actionOutput = orchestrationTrace.observation.actionGroupInvocationOutput;
                        // Access properties safely as the SDK types may not include all fields
                        const traceData = actionOutput as Record<string, unknown>;
                        await processActionGroupTrace(sessionId, {
                            actionGroupName: traceData.actionGroupName as string | undefined,
                            apiPath: traceData.apiPath as string | undefined,
                            responseBody: {
                                'application/json': {
                                    body: actionOutput.text,
                                },
                            },
                        });
                    }
                }
                
                if (event.chunk?.bytes) {
                    const text = new TextDecoder().decode(event.chunk.bytes);
                    console.log('Bedrock response chunk:', text);
                    await processAgentChunk(sessionId, text);
                }
            }
        }

        await updateSessionStatus(sessionId, 'complete');
        await notifySession(sessionId, {
            type: 'session:complete',
            sessionId,
            timestamp: new Date().toISOString(),
        });

        console.log('Scan completed for session:', sessionId);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Bedrock agent invocation failed:', error);

        await updateSessionStatus(sessionId, 'error', message);
        await notifySession(sessionId, {
            type: 'error',
            sessionId,
            message,
            timestamp: new Date().toISOString(),
        });
    }
}

/**
 * Local scan using Browserless (for development without AWS Bedrock)
 */
async function localScan(sessionId: string, url: string, viewport: string): Promise<void> {
    try {
        await notifySession(sessionId, {
            type: 'session:status',
            sessionId,
            status: 'scanning',
            timestamp: new Date().toISOString(),
        });

        console.log('Starting local scan for:', url);
        const result = await scanWithBrowserless(url, viewport);

        if (!result.success) {
            throw new Error('Scan failed');
        }

        // Insert violations into database
        if (result.violations.length > 0) {
            await notifySession(sessionId, {
                type: 'violation:detected',
                sessionId,
                count: result.violations.length,
                timestamp: new Date().toISOString(),
            });

            for (const violation of result.violations) {
                await query(
                    `INSERT INTO violations (id, session_id, rule_id, impact, description, selector, html, status)
                     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'pending')`,
                    [sessionId, violation.id, violation.impact, violation.description, violation.selector, violation.html]
                );
            }
        }

        await updateSessionStatus(sessionId, 'complete');
        await notifySession(sessionId, {
            type: 'session:complete',
            sessionId,
            timestamp: new Date().toISOString(),
        });

        console.log('Local scan completed for session:', sessionId);
        console.log('Found', result.violationCounts.total, 'violations');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Local scan failed:', error);

        await updateSessionStatus(sessionId, 'error', message);
        await notifySession(sessionId, {
            type: 'error',
            sessionId,
            message,
            timestamp: new Date().toISOString(),
        });
    }
}

