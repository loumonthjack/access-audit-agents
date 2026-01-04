/**
 * Bedrock Agent Configuration
 * 
 * Provides configuration types and utilities for creating and managing
 * Amazon Bedrock Agents for accessibility remediation.
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

import { SYSTEM_PROMPT, getSystemPrompt, validateSystemPrompt } from './system-prompt.js';
import {
    getInjectorSchema,
    createInjectorActionGroupConfig,
    createAuditorActionGroupConfig,
    type OpenAPISchema,
    type ActionGroupConfig
} from './openapi-schemas.js';

// ============================================================================
// Foundation Model Configuration
// Requirements: 8.3
// ============================================================================

/**
 * Supported foundation models for the Bedrock Agent
 */
export const FOUNDATION_MODELS = {
    CLAUDE_3_5_SONNET: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    CLAUDE_3_SONNET: 'anthropic.claude-3-sonnet-20240229-v1:0',
    CLAUDE_3_HAIKU: 'anthropic.claude-3-haiku-20240307-v1:0'
} as const;

export type FoundationModel = typeof FOUNDATION_MODELS[keyof typeof FOUNDATION_MODELS];

/**
 * Default foundation model for the orchestrator
 * Requirements: 8.3 - Use Claude 3.5 Sonnet
 */
export const DEFAULT_FOUNDATION_MODEL: FoundationModel = FOUNDATION_MODELS.CLAUDE_3_5_SONNET;

// ============================================================================
// Agent Configuration Types
// ============================================================================

/**
 * Configuration for an Action Group Lambda
 */
export interface ActionGroupLambdaConfig {
    /** ARN of the Lambda function */
    functionArn: string;
    /** Optional description override */
    description?: string;
}

/**
 * Configuration for the Bedrock Agent
 */
export interface BedrockAgentConfig {
    /** Unique name for the agent */
    agentName: string;
    /** Description of the agent's purpose */
    description: string;
    /** Foundation model to use */
    foundationModel: FoundationModel;
    /** System prompt (instruction) for the agent */
    instruction: string;
    /** Session timeout in seconds (default: 1800 = 30 minutes) */
    idleSessionTTLInSeconds: number;
    /** Action groups attached to the agent */
    actionGroups: ActionGroupConfig[];
    /** Optional tags for the agent */
    tags?: Record<string, string>;
}

/**
 * Configuration for creating the orchestrator agent
 */
export interface OrchestratorAgentConfig {
    /** Auditor Lambda ARN */
    auditorLambdaArn: string;
    /** Injector Lambda ARN */
    injectorLambdaArn: string;
    /** Auditor OpenAPI schema (loaded from auditor package) */
    auditorSchema: OpenAPISchema;
    /** Optional custom agent name */
    agentName?: string;
    /** Optional custom session TTL */
    sessionTTLSeconds?: number;
    /** Optional custom foundation model */
    foundationModel?: FoundationModel;
    /** Optional custom system prompt */
    customInstruction?: string;
    /** Optional tags */
    tags?: Record<string, string>;
}

// ============================================================================
// Agent Configuration Builder
// ============================================================================

/**
 * Default session TTL (30 minutes)
 */
export const DEFAULT_SESSION_TTL_SECONDS = 1800;

/**
 * Default agent name
 */
export const DEFAULT_AGENT_NAME = 'AccessAgents-Orchestrator';

/**
 * Default agent description
 */
export const DEFAULT_AGENT_DESCRIPTION =
    'Senior Accessibility Engineer agent for autonomous WCAG 2.1 AA remediation';

/**
 * Creates a complete Bedrock Agent configuration for the orchestrator
 * 
 * Requirements: 8.1, 8.2, 8.3
 */
export function createOrchestratorAgentConfig(
    config: OrchestratorAgentConfig
): BedrockAgentConfig {
    const {
        auditorLambdaArn,
        injectorLambdaArn,
        auditorSchema,
        agentName = DEFAULT_AGENT_NAME,
        sessionTTLSeconds = DEFAULT_SESSION_TTL_SECONDS,
        foundationModel = DEFAULT_FOUNDATION_MODEL,
        customInstruction,
        tags
    } = config;

    // Validate system prompt if custom instruction provided
    const instruction = customInstruction ?? getSystemPrompt();
    const promptValidation = validateSystemPrompt(instruction);
    if (!promptValidation.valid) {
        console.warn(
            'System prompt validation warnings:',
            promptValidation.missingDirectives
        );
    }

    // Create action group configurations
    const auditorActionGroup = createAuditorActionGroupConfig(
        auditorSchema,
        auditorLambdaArn
    );
    const injectorActionGroup = createInjectorActionGroupConfig(injectorLambdaArn);

    return {
        agentName,
        description: DEFAULT_AGENT_DESCRIPTION,
        foundationModel,
        instruction,
        idleSessionTTLInSeconds: sessionTTLSeconds,
        actionGroups: [auditorActionGroup, injectorActionGroup],
        tags
    };
}

// ============================================================================
// CDK Construct Properties
// ============================================================================

/**
 * Properties for the Bedrock Agent CDK construct
 * This interface is designed to be compatible with AWS CDK patterns
 */
export interface BedrockAgentConstructProps {
    /** Agent configuration */
    agentConfig: BedrockAgentConfig;
    /** IAM role ARN for the agent (optional - will be created if not provided) */
    agentRoleArn?: string;
    /** KMS key ARN for encryption (optional) */
    kmsKeyArn?: string;
    /** Whether to prepare the agent after creation (default: true) */
    prepareAgent?: boolean;
    /** Whether to create an alias for the agent (default: true) */
    createAlias?: boolean;
    /** Alias name (default: 'live') */
    aliasName?: string;
}

/**
 * Output from the Bedrock Agent CDK construct
 */
export interface BedrockAgentConstructOutput {
    /** Agent ID */
    agentId: string;
    /** Agent ARN */
    agentArn: string;
    /** Agent alias ID (if alias was created) */
    agentAliasId?: string;
    /** Agent alias ARN (if alias was created) */
    agentAliasArn?: string;
    /** Agent status */
    agentStatus: string;
}

// ============================================================================
// CDK Construct Definition (Abstract)
// ============================================================================

/**
 * Abstract base class for Bedrock Agent CDK construct
 * 
 * This provides the interface for creating a Bedrock Agent using AWS CDK.
 * The actual implementation would extend this class and use CDK constructs.
 * 
 * Example usage with CDK:
 * ```typescript
 * const orchestratorAgent = new BedrockAgentConstruct(this, 'OrchestratorAgent', {
 *   agentConfig: createOrchestratorAgentConfig({
 *     auditorLambdaArn: auditorLambda.functionArn,
 *     injectorLambdaArn: injectorLambda.functionArn,
 *     auditorSchema: auditorOpenApiSchema
 *   })
 * });
 * ```
 */
export abstract class BedrockAgentConstruct {
    protected readonly props: BedrockAgentConstructProps;

    constructor(props: BedrockAgentConstructProps) {
        this.props = props;
    }

    /**
     * Gets the agent configuration
     */
    get agentConfig(): BedrockAgentConfig {
        return this.props.agentConfig;
    }

    /**
     * Gets the foundation model being used
     */
    get foundationModel(): FoundationModel {
        return this.props.agentConfig.foundationModel;
    }

    /**
     * Gets the action groups attached to the agent
     */
    get actionGroups(): ActionGroupConfig[] {
        return this.props.agentConfig.actionGroups;
    }

    /**
     * Validates the agent configuration
     */
    validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const config = this.props.agentConfig;

        // Validate agent name
        if (!config.agentName || config.agentName.length < 1) {
            errors.push('Agent name is required');
        }

        // Validate foundation model
        const validModels = Object.values(FOUNDATION_MODELS);
        if (!validModels.includes(config.foundationModel)) {
            errors.push(`Invalid foundation model: ${config.foundationModel}`);
        }

        // Validate instruction
        if (!config.instruction || config.instruction.length < 10) {
            errors.push('Instruction (system prompt) is required and must be at least 10 characters');
        }

        // Validate action groups
        if (!config.actionGroups || config.actionGroups.length === 0) {
            errors.push('At least one action group is required');
        }

        // Validate session TTL
        if (config.idleSessionTTLInSeconds < 60 || config.idleSessionTTLInSeconds > 3600) {
            errors.push('Session TTL must be between 60 and 3600 seconds');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Abstract method to create the agent resources
     * Implementations should create the actual AWS resources
     */
    abstract createResources(): Promise<BedrockAgentConstructOutput>;
}

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Validates a complete orchestrator agent configuration
 */
export function validateOrchestratorConfig(config: BedrockAgentConfig): {
    valid: boolean;
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check foundation model
    if (config.foundationModel !== DEFAULT_FOUNDATION_MODEL) {
        warnings.push(
            `Using non-default foundation model: ${config.foundationModel}. ` +
            `Recommended: ${DEFAULT_FOUNDATION_MODEL}`
        );
    }

    // Check action groups
    const actionGroupNames = config.actionGroups.map(ag => ag.name);
    if (!actionGroupNames.includes('Auditor')) {
        errors.push('Missing required Auditor action group');
    }
    if (!actionGroupNames.includes('Injector')) {
        errors.push('Missing required Injector action group');
    }

    // Validate system prompt
    const promptValidation = validateSystemPrompt(config.instruction);
    if (!promptValidation.valid) {
        for (const missing of promptValidation.missingDirectives) {
            warnings.push(`System prompt missing: ${missing}`);
        }
    }

    // Check session TTL
    if (config.idleSessionTTLInSeconds < 300) {
        warnings.push('Session TTL is less than 5 minutes, may cause issues with long remediation sessions');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

// ============================================================================
// Exports
// ============================================================================

export {
    SYSTEM_PROMPT,
    getSystemPrompt,
    validateSystemPrompt,
    getInjectorSchema
};
