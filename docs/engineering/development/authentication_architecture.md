# Authentication Architecture

This document describes the authentication system for AccessAgents, supporting both self-hosted and SaaS deployment modes.

## Overview

AccessAgents implements a dual-mode authentication architecture that supports:

- **Self-hosted mode**: Local JWT-based authentication for on-premise deployments
- **SaaS mode**: Amazon Cognito for managed multi-tenant authentication

The authentication mode is determined by the `VITE_AUTH_MODE` environment variable.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    AuthProvider                              │    │
│  │  ┌──────────────────┐  ┌──────────────────┐                 │    │
│  │  │ LocalAuthAdapter │  │ CognitoAuthAdapter│                 │    │
│  │  │  (self-hosted)   │  │    (SaaS)        │                 │    │
│  │  └────────┬─────────┘  └────────┬─────────┘                 │    │
│  └───────────┼─────────────────────┼───────────────────────────┘    │
│              │                     │                                 │
└──────────────┼─────────────────────┼─────────────────────────────────┘
               │                     │
               ▼                     ▼
     ┌─────────────────┐   ┌─────────────────────┐
     │   Local API     │   │  Amazon Cognito     │
     │  (JWT Issuer)   │   │   (User Pool)       │
     └─────────────────┘   └─────────────────────┘
```

## Authentication Modes

### Self-Hosted Mode

For organizations deploying to their own AWS account:

| Aspect | Implementation |
|--------|----------------|
| Token Type | JWT (JSON Web Token) |
| Token Storage | localStorage |
| Token Lifetime | 24 hours |
| Refresh Strategy | Manual re-login |
| User Store | PostgreSQL users table |

Configuration:

```env
VITE_AUTH_MODE=self-hosted
VITE_API_URL=http://localhost:3000
```

### SaaS Mode

For the managed multi-tenant platform:

| Aspect | Implementation |
|--------|----------------|
| Token Type | Cognito JWT (ID + Access) |
| Token Storage | Secure Amplify storage |
| Token Lifetime | 1 hour (configurable) |
| Refresh Strategy | Automatic via Refresh Token |
| User Store | Cognito User Pool |

Configuration:

```env
VITE_AUTH_MODE=saas
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_REGION=us-east-1
```

## Cognito User Pool Configuration

The Cognito User Pool is created with the following settings:

### Sign-Up Attributes

| Attribute | Required | Type | Description |
|-----------|----------|------|-------------|
| email | Yes | Standard | User's email address |
| name | No | Standard | User's full name |
| custom:orgId | No | Custom | Organization identifier |

### Password Policy

| Requirement | Value |
|-------------|-------|
| Minimum length | 8 characters |
| Lowercase letter | Required |
| Uppercase letter | Required |
| Digit | Required |
| Symbol | Not required |

### Token Configuration

| Token | Validity | Purpose |
|-------|----------|---------|
| Access Token | 1 hour | API authorization |
| ID Token | 1 hour | User identity claims |
| Refresh Token | 30 days | Silent re-authentication |

### OAuth Configuration

```
Flows: Authorization Code Grant
Scopes: email, openid, profile
Callback URLs: 
  - http://localhost:5173/callback (dev)
  - https://app.accessagents.com/callback (prod)
```

## Frontend Implementation

### AuthProvider Component

The `AuthProvider` wraps the application and provides authentication context:

```typescript
interface AuthContextValue {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: User | null;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, name?: string) => Promise<void>;
    logout: () => Promise<void>;
    getToken: () => Promise<string | null>;
}
```

### Auth Adapters

The adapter pattern allows switching between authentication providers:

```typescript
interface AuthAdapter {
    signIn(email: string, password: string): Promise<AuthResult>;
    signUp(email: string, password: string, name?: string): Promise<AuthResult>;
    signOut(): Promise<void>;
    getCurrentUser(): Promise<User | null>;
    getAccessToken(): Promise<string | null>;
}
```

Implementations:

- `LocalAuthAdapter`: Calls local API endpoints
- `CognitoAuthAdapter`: Uses AWS Amplify SDK

### Token Management

The `useApiAuth` hook automatically configures the API client with authentication:

```typescript
function useApiAuth() {
    const { getToken } = useAuth();

    useEffect(() => {
        apiClient.setTokenProvider(getToken);
    }, [getToken]);
}
```

## Backend Implementation

### Lambda Authorizer

API Gateway uses a Lambda authorizer to validate JWT tokens:

```typescript
// Validation flow
1. Extract Bearer token from Authorization header
2. Decode JWT without verification
3. Fetch Cognito JWKS from well-known endpoint
4. Verify signature using matching key
5. Validate claims (iss, aud, exp, token_use)
6. Return IAM policy document
```

### Token Validation Claims

| Claim | Validation |
|-------|------------|
| iss | Must match Cognito User Pool issuer |
| aud | Must match Client ID |
| token_use | Must be "id" or "access" |
| exp | Must be in the future |

### Database User Mapping

Cognito users are mapped to the PostgreSQL `users` table:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,  -- Cognito 'sub' claim
    org_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);
```

## Security Considerations

### Token Storage

| Mode | Storage | Security |
|------|---------|----------|
| Self-hosted | localStorage | Vulnerable to XSS |
| SaaS | Amplify secure storage | HttpOnly cookies available |

### CORS Configuration

API Gateway CORS is configured to allow:

```
Origins: Configured callback URLs only
Methods: GET, POST, PUT, DELETE, OPTIONS
Headers: Content-Type, Authorization
```

### Rate Limiting

API Gateway throttling protects against brute force:

| Limit | Value |
|-------|-------|
| Burst | 100 requests |
| Rate | 50 requests/second |

## Multi-Tenancy

### Organization Isolation

Each user belongs to an organization:

```typescript
interface User {
    id: string;
    email: string;
    orgId: string;
    role: 'admin' | 'member';
}
```

### Row-Level Security

PostgreSQL RLS policies ensure data isolation:

```sql
-- Set organization context from JWT claim
SELECT set_org_context(current_user_org_id);

-- RLS policy enforces isolation
CREATE POLICY org_isolation ON scan_sessions
    FOR ALL
    USING (org_id = current_setting('app.current_org_id')::UUID);
```

## Error Handling

### Authentication Errors

| Error | Code | User Message |
|-------|------|--------------|
| Invalid credentials | 401 | Invalid email or password |
| Token expired | 401 | Session expired, please log in again |
| Account not verified | 403 | Please verify your email |
| User not found | 404 | Account not found |

### Frontend Error Display

Errors are captured in the AuthContext and displayed to users:

```typescript
const { error } = useAuth();

if (error) {
    return <Alert variant="error">{error}</Alert>;
}
```

## Testing Authentication

### Local Development

For testing without Cognito:

```env
VITE_AUTH_MODE=self-hosted
VITE_API_URL=http://localhost:3000
```

MSW handlers mock the authentication API.

### Integration Testing

E2E tests use test accounts:

```typescript
// e2e/auth-flow.spec.ts
test('should login successfully', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'Password123');
    await page.click('[type="submit"]');
    await expect(page).toHaveURL('/');
});
```

## References

- AWS Cognito User Pools: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools.html
- AWS Amplify Auth: https://docs.amplify.aws/lib/auth/getting-started/
- JWT Specification: https://jwt.io/introduction


