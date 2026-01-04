# Contributing Guide

Thank you for your interest in contributing to AccessAgents! This guide covers everything you need to know to make successful contributions.

## Table of Contents

- [Getting Started](#getting-started)
- [Code Style and Conventions](#code-style-and-conventions)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Commit Guidelines](#commit-guidelines)

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. Read the [Local Development Setup](./local_setup.md) guide
2. Set up your development environment
3. Familiarized yourself with the codebase structure

### Development Workflow

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Write/update tests
5. Submit a pull request

```bash
# Clone your fork
git clone https://github.com/loumonthjack/access-audit-agents.git
cd access-audit-agents

# Add upstream remote
git remote add upstream https://github.com/loumonthjack/access-audit-agents.git

# Create a feature branch
git checkout -b feature/your-feature-name

# Make changes, then push
git push origin feature/your-feature-name
```

## Code Style and Conventions

### TypeScript

We use TypeScript throughout the project. Follow these conventions:

- Use strict TypeScript settings
- Prefer explicit types over `any`
- Use interfaces for object shapes, types for unions/primitives
- Export types alongside their implementations

```typescript
// Good
interface UserProfile {
  id: string;
  email: string;
  createdAt: Date;
}

// Avoid
const user: any = { ... };
```

### ESLint Configuration

The project uses ESLint with the following plugins:

- `@typescript-eslint` - TypeScript-specific rules
- `eslint-plugin-react-hooks` - React hooks rules
- `eslint-plugin-react-refresh` - Fast refresh compatibility

Run linting:
```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Prettier Configuration

Code formatting is handled by Prettier with these settings:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

Format code before committing:
```bash
npm run format
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | PascalCase | `ScanProgress.tsx` |
| Files (utilities) | camelCase | `formatDate.ts` |
| Files (tests) | `*.test.ts` or `*.spec.ts` | `ScanProgress.test.tsx` |
| Components | PascalCase | `ScanProgress` |
| Functions | camelCase | `formatViolation` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Types/Interfaces | PascalCase | `ScanSession` |
| CSS classes | kebab-case | `scan-progress-bar` |

### Project Structure

Follow the existing project structure:

```
apps/web/src/
├── config/           # App configuration
├── features/         # Feature modules (domain-driven)
│   └── {feature}/
│       ├── api/      # API calls
│       ├── components/
│       ├── hooks/
│       └── types.ts
├── routes/           # Page components
├── shared/           # Shared utilities
│   ├── components/   # Reusable UI components
│   ├── hooks/        # Shared hooks
│   ├── lib/          # Utilities
│   └── store/        # State management
├── test/             # Test utilities
└── types/            # Global types
```

### React Conventions

- Use functional components with hooks
- Prefer composition over inheritance
- Keep components focused and small
- Extract logic into custom hooks

```typescript
// Good - focused component with extracted logic
function ScanProgress({ sessionId }: ScanProgressProps) {
  const { progress, isLoading } = useScanProgress(sessionId);
  
  if (isLoading) return <LoadingSpinner />;
  
  return <ProgressBar value={progress} />;
}

// Avoid - component doing too much
function ScanProgress({ sessionId }: ScanProgressProps) {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  // ... lots of logic
}
```

### Import Order

Organize imports in this order:

1. React and external libraries
2. Internal modules (absolute imports)
3. Relative imports
4. Types (with `type` keyword)

```typescript
// External
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// Internal (absolute)
import { Button } from '@/shared/components/ui';
import { formatDate } from '@/shared/lib/utils';

// Relative
import { ScanCard } from './ScanCard';
import { useScanData } from './hooks';

// Types
import type { ScanSession } from '@/types';
```

## Pull Request Process

### Before Submitting

1. **Update from main**: Rebase your branch on the latest main
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   ```

3. **Update documentation**: If your changes affect APIs or user-facing features

### PR Requirements

Your pull request must:

- [ ] Have a clear, descriptive title
- [ ] Include a description of changes
- [ ] Reference any related issues
- [ ] Pass all CI checks
- [ ] Have adequate test coverage
- [ ] Follow code style guidelines

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Fixes #123

## Testing
Describe how you tested the changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No new warnings
```

### Review Process

1. **Automated checks**: CI runs linting, type checking, and tests
2. **Code review**: At least one maintainer must approve
3. **Feedback**: Address any requested changes
4. **Merge**: Maintainer merges after approval

### Review Guidelines for Reviewers

- Be constructive and respectful
- Focus on code quality, not style preferences (Prettier handles that)
- Check for:
  - Logic errors
  - Security issues
  - Performance concerns
  - Test coverage
  - Documentation accuracy

## Testing Requirements

### Test Coverage

All contributions must include appropriate tests:

| Change Type | Required Tests |
|-------------|----------------|
| New feature | Unit tests + integration tests |
| Bug fix | Regression test |
| Refactor | Existing tests must pass |
| API change | Update API tests |

### Unit Tests

Use Vitest for unit testing:

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

Example test:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScanProgress } from './ScanProgress';

describe('ScanProgress', () => {
  it('displays progress percentage', () => {
    render(<ScanProgress progress={50} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows completed state at 100%', () => {
    render(<ScanProgress progress={100} />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });
});
```

### Property-Based Tests

For complex logic, use property-based testing with fast-check:

```typescript
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatViolation } from './formatViolation';

describe('formatViolation', () => {
  it('always produces valid output for any violation', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          ruleId: fc.string({ minLength: 1 }),
          impact: fc.constantFrom('critical', 'serious', 'moderate', 'minor'),
        }),
        (violation) => {
          const result = formatViolation(violation);
          expect(result).toBeDefined();
          expect(result.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### E2E Tests

Use Playwright for end-to-end testing:

```bash
# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

E2E tests are located in `apps/web/e2e/`.

### Test File Location

Place test files next to the code they test:

```
src/features/scan/
├── components/
│   ├── ScanForm.tsx
│   └── ScanForm.test.tsx    # Unit test
├── hooks/
│   ├── useScan.ts
│   └── useScan.test.ts      # Hook test
└── __tests__/
    └── integration.test.ts   # Integration tests
```

## Commit Guidelines

### Commit Message Format

Use conventional commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes nor adds |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |

### Examples

```bash
# Feature
feat(scan): add batch scanning support

# Bug fix
fix(auth): resolve token refresh race condition

# Documentation
docs(api): update endpoint examples

# With body
feat(report): add PDF export option

Adds ability to export accessibility reports as PDF documents.
Includes page-by-page breakdown and summary statistics.

Closes #456
```

### Commit Best Practices

- Keep commits atomic (one logical change per commit)
- Write clear, descriptive messages
- Reference issues when applicable
- Don't commit generated files

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue
- **Security**: Email security@accessagents.com

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License (for core packages) or proprietary license (for enterprise packages).

---

Thank you for contributing to AccessAgents! Your efforts help make the web more accessible for everyone. 🌐
