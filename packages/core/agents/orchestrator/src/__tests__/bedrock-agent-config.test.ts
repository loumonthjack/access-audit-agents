/**
 * Unit Tests for Bedrock Agent Configuration
 * 
 * Tests system prompt content, action group attachment, and model selection.
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

import { describe, it, expect } from 'vitest';
import {
    SYSTEM_PROMPT,
    getSystemPrompt,
    validateSystemPrompt,
    buildSystemPrompt
} from '../config/system-prompt.js';
import {
    getInjectorSchema,
    validateOpenAPISchema,
    extractOperationIds,
    getInjectorOperations,
    getAuditorOperations,
    validateSchemaOperations,
    createInjectorActionGroupConfig,
    createAuditorActionGroupConfig
} from '../config/openapi-schemas.js';
import {
    FOUNDATION_MODELS,
    DEFAULT_FOUNDATION_MODEL,
    DEFAULT_SESSION_TTL_SECONDS,
    DEFAULT_AGENT_NAME,
    createOrchestratorAgentConfig,
    validateOrchestratorConfig,
    type OpenAPISchema
} from '../config/bedrock-agent-config.js';

// ============================================================================
// System Prompt Tests
// Requirements: 8.1
// ============================================================================

describe('System Prompt', () => {
    describe('SYSTEM_PROMPT constant', () => {
        it('should define the Senior Accessibility Engineer role', () => {
            expect(SYSTEM_PROMPT).toContain('Senior Accessibility Engineer');
            expect(SYSTEM_PROMPT).toContain('AccessAgents');
        });

        it('should include AUDIT FIRST directive', () => {
            expect(SYSTEM_PROMPT).toContain('AUDIT FIRST');
            expect(SYSTEM_PROMPT).toContain('ScanURL');
        });

        it('should include DO NO HARM directive', () => {
            expect(SYSTEM_PROMPT).toContain('DO NO HARM');
            expect(SYSTEM_PROMPT).toContain('Never remove functionality');
        });

        it('should include STRICT JSON OUTPUT directive', () => {
            expect(SYSTEM_PROMPT).toContain('STRICT JSON OUTPUT');
            expect(SYSTEM_PROMPT).toContain('valid JSON');
        });

        it('should include VERIFY YOUR WORK directive', () => {
            expect(SYSTEM_PROMPT).toContain('VERIFY YOUR WORK');
            expect(SYSTEM_PROMPT).toContain('VerifyElement');
        });

        it('should include remediation protocol', () => {
            expect(SYSTEM_PROMPT).toContain('Remediation Protocol');
            expect(SYSTEM_PROMPT).toContain('Analyze the Audit Report');
            expect(SYSTEM_PROMPT).toContain('highest priority violation');
        });

        it('should include error recovery instructions', () => {
            expect(SYSTEM_PROMPT).toContain('Error Recovery');
            expect(SYSTEM_PROMPT).toContain('SELECTOR_NOT_FOUND');
            expect(SYSTEM_PROMPT).toContain('GetPageStructure');
            expect(SYSTEM_PROMPT).toContain('3 failed attempts');
        });

        it('should include priority order', () => {
            expect(SYSTEM_PROMPT).toContain('Priority Order');
            expect(SYSTEM_PROMPT).toContain('Critical');
            expect(SYSTEM_PROMPT).toContain('Serious');
            expect(SYSTEM_PROMPT).toContain('Moderate');
            expect(SYSTEM_PROMPT).toContain('Minor');
        });

        it('should include safety rules', () => {
            expect(SYSTEM_PROMPT).toContain('Safety Rules');
            expect(SYSTEM_PROMPT).toContain('NEVER delete');
            expect(SYSTEM_PROMPT).toContain('buttons');
            expect(SYSTEM_PROMPT).toContain('links');
            expect(SYSTEM_PROMPT).toContain('inputs');
        });
    });

    describe('getSystemPrompt()', () => {
        it('should return the system prompt', () => {
            const prompt = getSystemPrompt();
            expect(prompt).toBe(SYSTEM_PROMPT);
        });
    });

    describe('validateSystemPrompt()', () => {
        it('should validate a complete system prompt', () => {
            const result = validateSystemPrompt(SYSTEM_PROMPT);
            expect(result.valid).toBe(true);
            expect(result.missingDirectives).toHaveLength(0);
        });

        it('should detect missing core directives', () => {
            const incompletePrompt = 'Role: Test agent';
            const result = validateSystemPrompt(incompletePrompt);
            expect(result.valid).toBe(false);
            expect(result.missingDirectives.length).toBeGreaterThan(0);
        });

        it('should detect missing sections', () => {
            const promptWithoutSections = `
                Role: Test
                AUDIT FIRST
                DO NO HARM
                STRICT JSON OUTPUT
                VERIFY YOUR WORK
            `;
            const result = validateSystemPrompt(promptWithoutSections);
            expect(result.valid).toBe(false);
            expect(result.missingDirectives.some(d => d.includes('Section'))).toBe(true);
        });
    });

    describe('buildSystemPrompt()', () => {
        it('should build a complete prompt with default options', () => {
            const prompt = buildSystemPrompt();
            expect(prompt).toContain('Role:');
            expect(prompt).toContain('Core Directives:');
            expect(prompt).toContain('Remediation Protocol:');
            expect(prompt).toContain('Error Recovery:');
            expect(prompt).toContain('Priority Order:');
            expect(prompt).toContain('Safety Rules:');
        });

        it('should exclude error recovery when disabled', () => {
            const prompt = buildSystemPrompt({ includeErrorRecovery: false });
            expect(prompt).not.toContain('Error Recovery:');
        });

        it('should exclude priority order when disabled', () => {
            const prompt = buildSystemPrompt({ includePriorityOrder: false });
            expect(prompt).not.toContain('Priority Order:');
        });

        it('should exclude safety rules when disabled', () => {
            const prompt = buildSystemPrompt({ includeSafetyRules: false });
            expect(prompt).not.toContain('Safety Rules:');
        });

        it('should use custom role when provided', () => {
            const customRole = 'Custom accessibility expert';
            const prompt = buildSystemPrompt({ customRole });
            expect(prompt).toContain(customRole);
        });
    });
});

// ============================================================================
// OpenAPI Schema Tests
// Requirements: 8.2, 8.4
// ============================================================================

describe('OpenAPI Schemas', () => {
    describe('Injector Schema', () => {
        it('should return a valid OpenAPI schema', () => {
            const schema = getInjectorSchema();
            const validation = validateOpenAPISchema(schema);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('should have correct OpenAPI version', () => {
            const schema = getInjectorSchema();
            expect(schema.openapi).toBe('3.0.3');
        });

        it('should have correct title', () => {
            const schema = getInjectorSchema();
            expect(schema.info.title).toBe('Injector Action Group API');
        });

        it('should contain all required operations', () => {
            const schema = getInjectorSchema();
            const expectedOps = getInjectorOperations();
            const validation = validateSchemaOperations(schema, expectedOps);
            expect(validation.valid).toBe(true);
            expect(validation.missingOperations).toHaveLength(0);
        });

        it('should have ApplyAttributeFix operation', () => {
            const schema = getInjectorSchema();
            const operations = extractOperationIds(schema);
            expect(operations).toContain('ApplyAttributeFix');
        });

        it('should have ApplyContentFix operation', () => {
            const schema = getInjectorSchema();
            const operations = extractOperationIds(schema);
            expect(operations).toContain('ApplyContentFix');
        });

        it('should have InjectStyle operation', () => {
            const schema = getInjectorSchema();
            const operations = extractOperationIds(schema);
            expect(operations).toContain('InjectStyle');
        });
    });

    describe('validateOpenAPISchema()', () => {
        it('should validate a correct schema', () => {
            const schema = getInjectorSchema();
            const result = validateOpenAPISchema(schema);
            expect(result.valid).toBe(true);
        });

        it('should reject non-object input', () => {
            const result = validateOpenAPISchema(null);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Schema must be an object');
        });

        it('should detect missing openapi field', () => {
            const result = validateOpenAPISchema({ info: {}, paths: {} });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('openapi'))).toBe(true);
        });

        it('should detect missing info field', () => {
            const result = validateOpenAPISchema({ openapi: '3.0.3', paths: {} });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('info'))).toBe(true);
        });

        it('should detect missing paths field', () => {
            const result = validateOpenAPISchema({
                openapi: '3.0.3',
                info: { title: 'Test', version: '1.0.0' }
            });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('paths'))).toBe(true);
        });
    });

    describe('extractOperationIds()', () => {
        it('should extract all operation IDs from schema', () => {
            const schema = getInjectorSchema();
            const operations = extractOperationIds(schema);
            expect(operations).toHaveLength(3);
            expect(operations).toContain('ApplyAttributeFix');
            expect(operations).toContain('ApplyContentFix');
            expect(operations).toContain('InjectStyle');
        });
    });

    describe('Action Group Configurations', () => {
        it('should create Injector action group config', () => {
            const lambdaArn = 'arn:aws:lambda:us-east-1:123456789:function:injector';
            const config = createInjectorActionGroupConfig(lambdaArn);
            expect(config.name).toBe('Injector');
            expect(config.lambdaArn).toBe(lambdaArn);
            expect(config.openApiSchema).toBeDefined();
        });

        it('should create Auditor action group config', () => {
            const mockAuditorSchema: OpenAPISchema = {
                openapi: '3.0.3',
                info: { title: 'Auditor', description: 'Test', version: '1.0.0' },
                paths: {}
            };
            const lambdaArn = 'arn:aws:lambda:us-east-1:123456789:function:auditor';
            const config = createAuditorActionGroupConfig(mockAuditorSchema, lambdaArn);
            expect(config.name).toBe('Auditor');
            expect(config.lambdaArn).toBe(lambdaArn);
            expect(config.openApiSchema).toBe(mockAuditorSchema);
        });
    });
});

// ============================================================================
// Bedrock Agent Configuration Tests
// Requirements: 8.1, 8.2, 8.3
// ============================================================================

describe('Bedrock Agent Configuration', () => {
    describe('Foundation Models', () => {
        it('should have Claude 3.5 Sonnet as default', () => {
            expect(DEFAULT_FOUNDATION_MODEL).toBe(FOUNDATION_MODELS.CLAUDE_3_5_SONNET);
        });

        it('should define Claude 3.5 Sonnet model ID', () => {
            expect(FOUNDATION_MODELS.CLAUDE_3_5_SONNET).toBe(
                'anthropic.claude-3-5-sonnet-20241022-v2:0'
            );
        });

        it('should define multiple Claude models', () => {
            expect(Object.keys(FOUNDATION_MODELS).length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('Default Configuration Values', () => {
        it('should have 30 minute default session TTL', () => {
            expect(DEFAULT_SESSION_TTL_SECONDS).toBe(1800);
        });

        it('should have default agent name', () => {
            expect(DEFAULT_AGENT_NAME).toBe('AccessAgents-Orchestrator');
        });
    });

    describe('createOrchestratorAgentConfig()', () => {
        const mockAuditorSchema: OpenAPISchema = {
            openapi: '3.0.3',
            info: { title: 'Auditor', description: 'Test', version: '1.0.0' },
            paths: {
                '/scan': {
                    post: { operationId: 'ScanURL', responses: {} }
                },
                '/verify': {
                    post: { operationId: 'VerifyElement', responses: {} }
                },
                '/structure': {
                    post: { operationId: 'GetPageStructure', responses: {} }
                }
            }
        };

        it('should create a complete agent configuration', () => {
            const config = createOrchestratorAgentConfig({
                auditorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:auditor',
                injectorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:injector',
                auditorSchema: mockAuditorSchema
            });

            expect(config.agentName).toBe(DEFAULT_AGENT_NAME);
            expect(config.foundationModel).toBe(DEFAULT_FOUNDATION_MODEL);
            expect(config.idleSessionTTLInSeconds).toBe(DEFAULT_SESSION_TTL_SECONDS);
            expect(config.instruction).toBe(SYSTEM_PROMPT);
            expect(config.actionGroups).toHaveLength(2);
        });

        it('should use custom agent name when provided', () => {
            const customName = 'CustomAgent';
            const config = createOrchestratorAgentConfig({
                auditorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:auditor',
                injectorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:injector',
                auditorSchema: mockAuditorSchema,
                agentName: customName
            });

            expect(config.agentName).toBe(customName);
        });

        it('should use custom session TTL when provided', () => {
            const customTTL = 3600;
            const config = createOrchestratorAgentConfig({
                auditorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:auditor',
                injectorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:injector',
                auditorSchema: mockAuditorSchema,
                sessionTTLSeconds: customTTL
            });

            expect(config.idleSessionTTLInSeconds).toBe(customTTL);
        });

        it('should use custom foundation model when provided', () => {
            const config = createOrchestratorAgentConfig({
                auditorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:auditor',
                injectorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:injector',
                auditorSchema: mockAuditorSchema,
                foundationModel: FOUNDATION_MODELS.CLAUDE_3_HAIKU
            });

            expect(config.foundationModel).toBe(FOUNDATION_MODELS.CLAUDE_3_HAIKU);
        });

        it('should use custom instruction when provided', () => {
            const customInstruction = 'Custom system prompt with AUDIT FIRST, DO NO HARM, STRICT JSON OUTPUT, VERIFY YOUR WORK';
            const config = createOrchestratorAgentConfig({
                auditorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:auditor',
                injectorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:injector',
                auditorSchema: mockAuditorSchema,
                customInstruction
            });

            expect(config.instruction).toBe(customInstruction);
        });

        it('should include both Auditor and Injector action groups', () => {
            const config = createOrchestratorAgentConfig({
                auditorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:auditor',
                injectorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:injector',
                auditorSchema: mockAuditorSchema
            });

            const actionGroupNames = config.actionGroups.map(ag => ag.name);
            expect(actionGroupNames).toContain('Auditor');
            expect(actionGroupNames).toContain('Injector');
        });

        it('should include tags when provided', () => {
            const tags = { Environment: 'test', Project: 'AccessAgents' };
            const config = createOrchestratorAgentConfig({
                auditorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:auditor',
                injectorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:injector',
                auditorSchema: mockAuditorSchema,
                tags
            });

            expect(config.tags).toEqual(tags);
        });
    });

    describe('validateOrchestratorConfig()', () => {
        const mockAuditorSchema: OpenAPISchema = {
            openapi: '3.0.3',
            info: { title: 'Auditor', description: 'Test', version: '1.0.0' },
            paths: {}
        };

        it('should validate a correct configuration', () => {
            const config = createOrchestratorAgentConfig({
                auditorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:auditor',
                injectorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:injector',
                auditorSchema: mockAuditorSchema
            });

            const result = validateOrchestratorConfig(config);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should warn when using non-default foundation model', () => {
            const config = createOrchestratorAgentConfig({
                auditorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:auditor',
                injectorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:injector',
                auditorSchema: mockAuditorSchema,
                foundationModel: FOUNDATION_MODELS.CLAUDE_3_HAIKU
            });

            const result = validateOrchestratorConfig(config);
            expect(result.warnings.some(w => w.includes('non-default foundation model'))).toBe(true);
        });

        it('should error when missing Auditor action group', () => {
            const config = {
                agentName: 'Test',
                description: 'Test',
                foundationModel: DEFAULT_FOUNDATION_MODEL,
                instruction: SYSTEM_PROMPT,
                idleSessionTTLInSeconds: 1800,
                actionGroups: [createInjectorActionGroupConfig()]
            };

            const result = validateOrchestratorConfig(config);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Auditor'))).toBe(true);
        });

        it('should error when missing Injector action group', () => {
            const config = {
                agentName: 'Test',
                description: 'Test',
                foundationModel: DEFAULT_FOUNDATION_MODEL,
                instruction: SYSTEM_PROMPT,
                idleSessionTTLInSeconds: 1800,
                actionGroups: [createAuditorActionGroupConfig(mockAuditorSchema)]
            };

            const result = validateOrchestratorConfig(config);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Injector'))).toBe(true);
        });

        it('should warn when session TTL is too short', () => {
            const config = createOrchestratorAgentConfig({
                auditorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:auditor',
                injectorLambdaArn: 'arn:aws:lambda:us-east-1:123456789:function:injector',
                auditorSchema: mockAuditorSchema,
                sessionTTLSeconds: 120
            });

            const result = validateOrchestratorConfig(config);
            expect(result.warnings.some(w => w.includes('Session TTL'))).toBe(true);
        });
    });
});
