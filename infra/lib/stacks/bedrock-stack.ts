/**
 * Bedrock Stack - Amazon Bedrock Agent with Action Groups
 * 
 * Creates the Bedrock Agent for accessibility remediation orchestration.
 * Attaches Auditor and Injector action groups for AI-driven fixes.
 */

import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';

export interface BedrockStackProps extends cdk.StackProps {
    readonly description?: string;
    readonly auditorLambda: lambda.Function;
    readonly injectorLambda: lambda.Function;
    readonly scanManagerLambda: lambda.Function;
}

export class BedrockStack extends cdk.Stack {
    public readonly agent: bedrock.CfnAgent;
    public readonly agentAlias: bedrock.CfnAgentAlias;

    constructor(scope: Construct, id: string, props: BedrockStackProps) {
        super(scope, id, props);

        const { auditorLambda, injectorLambda, scanManagerLambda } = props;

        // S3 bucket for OpenAPI schemas
        const schemaBucket = new s3.Bucket(this, 'SchemaBucket', {
            bucketName: `${id}-schemas-${this.account}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
        });

        // IAM role for the Bedrock Agent
        const agentRole = new iam.Role(this, 'AgentRole', {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            roleName: `${id}-agent-role`,
            description: 'IAM role for AccessAgents Bedrock Agent',
        });

        // Grant Bedrock permissions to invoke foundation model
        // Using Amazon Nova Pro (no use case form required)
        agentRole.addToPolicy(new iam.PolicyStatement({
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
            ],
            resources: [
                `arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));

        // Grant access to schema bucket
        schemaBucket.grantRead(agentRole);

        // Grant Lambda invoke permissions
        auditorLambda.grantInvoke(agentRole);
        injectorLambda.grantInvoke(agentRole);

        // System prompt for the agent with specialist fix patterns
        const systemPrompt = `You are a Senior Accessibility Engineer AI agent specializing in WCAG 2.2 AA compliance.
Your mission is to autonomously detect, plan, and fix accessibility violations on web pages.

## Workflow
1. SCAN: Use the Auditor action group to scan URLs for accessibility violations
2. PLAN: Analyze violations and create a remediation plan prioritized by impact (critical > serious > moderate > minor)
3. FIX: Use the Injector action group to apply fixes (attributes, content, or styles)
4. VERIFY: Use the Auditor to verify each fix resolved the violation

## Specialist Fix Patterns

### Image Alt Text (image-alt, image-redundant-alt)
- Missing alt: ApplyAttributeFix with attribute="alt", value="[descriptive text from image context]"
- Decorative images: ApplyAttributeFix with attribute="alt", value="" AND attribute="role", value="presentation"
- Redundant alt (same as adjacent text): ApplyAttributeFix with attribute="alt", value=""

### Navigation & Landmarks (landmark-*, region, bypass)
- Missing main landmark: ApplyAttributeFix with attribute="role", value="main" on primary content container
- Missing navigation label: ApplyAttributeFix with attribute="aria-label", value="[navigation purpose]"
- Skip link: Add skip link before navigation

### Color Contrast (color-contrast, link-in-text-block)
- Insufficient contrast: InjectStyle with styles={"color":"#000000"} or {"background-color":"#ffffff"}
- Link visibility: InjectStyle with styles={"text-decoration":"underline"}

### Focus Management (focus-visible, focus-order-semantics)
- Missing focus indicator: InjectStyle with styles={"outline":"2px solid #005fcc","outline-offset":"2px"}
- Focus not visible: InjectStyle with cssClass="a11y-focus-visible"

### Interactive Elements (button-name, link-name, input-label)
- Missing button name: ApplyAttributeFix with attribute="aria-label", value="[action description]"
- Missing link purpose: ApplyAttributeFix with attribute="aria-label", value="[link destination]"
- Missing input label: ApplyAttributeFix with attribute="aria-label", value="[input purpose]"

### WCAG 2.2 Specific (target-size, dragging)
- Target size too small (2.5.8): InjectStyle with styles={"min-width":"24px","min-height":"24px"}
- Dragging operation (2.5.7): Flag for human review - requires alternative UI implementation

## Rules
- Always scan before attempting fixes
- Process violations in priority order (critical first)
- After 3 failed attempts on a violation, skip it and note for human review
- Provide clear reasoning for each fix applied
- Never modify content that could change meaning without explicit approval
- Always include the URL parameter when calling Injector actions

## Error Handling
- If a selector is not found, use GetPageStructure to find the correct element
- If a fix fails verification, try an alternative approach before skipping
- Log all actions and their outcomes for the final report

## Safety Rules
- NEVER delete buttons, links, inputs, selects, textareas, or forms
- NEVER remove event handlers or interactive functionality
- ALWAYS preserve existing ARIA attributes unless they are incorrect`;

        // Read OpenAPI schemas from files and use inline payload
        const auditorSchemaPath = path.join(__dirname, '../../schemas/auditor-openapi.yaml');
        const injectorSchemaPath = path.join(__dirname, '../../schemas/injector-openapi.yaml');

        const auditorSchema = fs.readFileSync(auditorSchemaPath, 'utf-8');
        const injectorSchema = fs.readFileSync(injectorSchemaPath, 'utf-8');

        // Create the Bedrock Agent
        // Using Amazon Nova Pro (no use case form required, works out of the box)
        this.agent = new bedrock.CfnAgent(this, 'OrchestratorAgent', {
            agentName: `${id}-orchestrator`,
            description: 'AI agent for autonomous WCAG 2.2 AA accessibility remediation',
            agentResourceRoleArn: agentRole.roleArn,
            foundationModel: 'amazon.nova-pro-v1:0',
            instruction: systemPrompt,
            idleSessionTtlInSeconds: 1800, // 30 minutes
            autoPrepare: true,
            actionGroups: [
                {
                    actionGroupName: 'Auditor',
                    description: 'Scans URLs for accessibility violations and verifies fixes',
                    actionGroupExecutor: {
                        lambda: auditorLambda.functionArn,
                    },
                    apiSchema: {
                        payload: auditorSchema,
                    },
                },
                {
                    actionGroupName: 'Injector',
                    description: 'Applies accessibility fixes to DOM elements',
                    actionGroupExecutor: {
                        lambda: injectorLambda.functionArn,
                    },
                    apiSchema: {
                        payload: injectorSchema,
                    },
                },
            ],
        });

        // Create agent alias for stable invocation
        this.agentAlias = new bedrock.CfnAgentAlias(this, 'AgentAlias', {
            agentId: this.agent.attrAgentId,
            agentAliasName: 'live',
            description: 'Production alias for the orchestrator agent',
        });

        // Grant Lambda permissions to be invoked by Bedrock
        // Note: Using wildcard to avoid cyclic dependency between stacks
        auditorLambda.addPermission('BedrockInvoke', {
            principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            action: 'lambda:InvokeFunction',
        });

        injectorLambda.addPermission('BedrockInvoke', {
            principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            action: 'lambda:InvokeFunction',
        });

        // Store Bedrock Agent IDs in SSM Parameter Store for scan-manager Lambda to read
        // Using fixed parameter names to avoid cyclic dependencies
        const paramPrefix = '/accessagents/bedrock';

        new ssm.StringParameter(this, 'AgentIdParam', {
            parameterName: `${paramPrefix}/agent-id`,
            stringValue: this.agent.attrAgentId,
            description: 'Bedrock Agent ID for accessibility scanning',
        });

        new ssm.StringParameter(this, 'AgentAliasIdParam', {
            parameterName: `${paramPrefix}/agent-alias-id`,
            stringValue: this.agentAlias.attrAgentAliasId,
            description: 'Bedrock Agent Alias ID for accessibility scanning',
        });

        // Deploy OpenAPI schemas to S3
        // Note: In production, these would be read from the packages/core/agents directories
        new s3deploy.BucketDeployment(this, 'DeploySchemas', {
            sources: [
                s3deploy.Source.asset(path.join(__dirname, '../../schemas')),
            ],
            destinationBucket: schemaBucket,
        });

        // Outputs
        new cdk.CfnOutput(this, 'AgentId', {
            value: this.agent.attrAgentId,
            description: 'Bedrock Agent ID',
        });

        new cdk.CfnOutput(this, 'AgentAliasId', {
            value: this.agentAlias.attrAgentAliasId,
            description: 'Bedrock Agent Alias ID',
        });

        new cdk.CfnOutput(this, 'AgentArn', {
            value: this.agent.attrAgentArn,
            description: 'Bedrock Agent ARN',
        });
    }
}

