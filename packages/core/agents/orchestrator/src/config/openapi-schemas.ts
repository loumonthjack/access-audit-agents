/**
 * OpenAPI Schema Definitions for Action Groups
 * 
 * Provides TypeScript interfaces and utilities for working with
 * the Auditor and Injector Action Group OpenAPI schemas.
 * 
 * Requirements: 8.2, 8.4
 */

import injectorSchema from './openapi-injector.json';

// ============================================================================
// Schema Types
// ============================================================================

/**
 * OpenAPI 3.0 schema structure
 */
export interface OpenAPISchema {
    openapi: string;
    info: {
        title: string;
        description: string;
        version: string;
        contact?: {
            name?: string;
            email?: string;
            url?: string;
        };
    };
    servers?: Array<{
        url: string;
        description?: string;
    }>;
    paths: Record<string, PathItem>;
    components?: {
        schemas?: Record<string, SchemaObject>;
    };
}

export interface PathItem {
    get?: OperationObject;
    post?: OperationObject;
    put?: OperationObject;
    delete?: OperationObject;
    patch?: OperationObject;
}

export interface OperationObject {
    operationId: string;
    summary?: string;
    description?: string;
    requestBody?: {
        required?: boolean;
        content: Record<string, { schema: SchemaObject | RefObject }>;
    };
    responses: Record<string, ResponseObject>;
}

export interface ResponseObject {
    description: string;
    content?: Record<string, { schema: SchemaObject | RefObject }>;
}

export interface SchemaObject {
    type?: string;
    properties?: Record<string, SchemaObject | RefObject>;
    required?: string[];
    items?: SchemaObject | RefObject;
    enum?: string[];
    minLength?: number;
    minimum?: number;
    maximum?: number;
    additionalProperties?: boolean | SchemaObject;
    description?: string;
}

export interface RefObject {
    $ref: string;
}

// ============================================================================
// Action Group Configuration
// ============================================================================

/**
 * Action Group definition for Bedrock Agent
 */
export interface ActionGroupConfig {
    name: string;
    description: string;
    openApiSchema: OpenAPISchema;
    lambdaArn?: string;
}

/**
 * Gets the Injector Action Group OpenAPI schema
 */
export function getInjectorSchema(): OpenAPISchema {
    return injectorSchema as OpenAPISchema;
}

/**
 * Gets the Auditor Action Group OpenAPI schema path
 * Note: The actual schema is in the auditor package
 */
export function getAuditorSchemaPath(): string {
    return '@accessagents/auditor/openapi.json';
}

/**
 * Creates the Injector Action Group configuration
 */
export function createInjectorActionGroupConfig(lambdaArn?: string): ActionGroupConfig {
    return {
        name: 'Injector',
        description: 'DOM manipulation tools for applying accessibility fixes',
        openApiSchema: getInjectorSchema(),
        lambdaArn
    };
}

/**
 * Creates the Auditor Action Group configuration
 * Note: Requires the auditor schema to be loaded separately
 */
export function createAuditorActionGroupConfig(
    auditorSchema: OpenAPISchema,
    lambdaArn?: string
): ActionGroupConfig {
    return {
        name: 'Auditor',
        description: 'WCAG 2.1 AA accessibility scanning and verification tools',
        openApiSchema: auditorSchema,
        lambdaArn
    };
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Validates that an OpenAPI schema has the required structure
 */
export function validateOpenAPISchema(schema: unknown): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!schema || typeof schema !== 'object') {
        return { valid: false, errors: ['Schema must be an object'] };
    }

    const s = schema as Record<string, unknown>;

    // Check required top-level fields
    if (!s.openapi || typeof s.openapi !== 'string') {
        errors.push('Missing or invalid "openapi" field');
    }

    if (!s.info || typeof s.info !== 'object') {
        errors.push('Missing or invalid "info" field');
    } else {
        const info = s.info as Record<string, unknown>;
        if (!info.title) errors.push('Missing "info.title"');
        if (!info.version) errors.push('Missing "info.version"');
    }

    if (!s.paths || typeof s.paths !== 'object') {
        errors.push('Missing or invalid "paths" field');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Extracts operation IDs from an OpenAPI schema
 */
export function extractOperationIds(schema: OpenAPISchema): string[] {
    const operationIds: string[] = [];

    for (const pathItem of Object.values(schema.paths)) {
        const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
        for (const method of methods) {
            const operation = pathItem[method];
            if (operation?.operationId) {
                operationIds.push(operation.operationId);
            }
        }
    }

    return operationIds;
}

/**
 * Gets the expected operations for the Injector Action Group
 */
export function getInjectorOperations(): string[] {
    return ['ApplyAttributeFix', 'ApplyContentFix', 'InjectStyle'];
}

/**
 * Gets the expected operations for the Auditor Action Group
 */
export function getAuditorOperations(): string[] {
    return ['ScanURL', 'VerifyElement', 'GetPageStructure'];
}

/**
 * Validates that a schema contains all expected operations
 */
export function validateSchemaOperations(
    schema: OpenAPISchema,
    expectedOperations: string[]
): {
    valid: boolean;
    missingOperations: string[];
    extraOperations: string[];
} {
    const actualOperations = extractOperationIds(schema);
    const missingOperations = expectedOperations.filter(op => !actualOperations.includes(op));
    const extraOperations = actualOperations.filter(op => !expectedOperations.includes(op));

    return {
        valid: missingOperations.length === 0,
        missingOperations,
        extraOperations
    };
}
