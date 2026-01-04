# CI Pipeline Guide

This document describes the Continuous Integration (CI) pipeline for AccessAgents, including GitHub Actions workflows and local git hooks.

## Overview

The CI system consists of two layers:

1. **Local Git Hooks** (Lefthook) - Run before pushing code
2. **GitHub Actions** - Run on pull requests and pushes to protected branches

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer Workflow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   git push  ──►  Lefthook Pre-Push  ──►  GitHub Actions CI     │
│                  ├─ format-check         ├─ Build Job          │
│                  ├─ lint                 ├─ Test Job           │
│                  ├─ typecheck            └─ Quality Job        │
│                  └─ branch-check                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## GitHub Actions Workflow

The CI workflow is defined in `.github/workflows/ci.yml` and triggers on:
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`

### Jobs

#### Build Job

Compiles all TypeScript packages to verify there are no build errors.

| Step | Description |
|------|-------------|
| Checkout | Clone repository |
| Setup Node.js | Install Node.js 20 with npm caching |
| Install dependencies | Run `npm ci` for all workspaces |
| Build | Run `npm run build` across all packages |

**Workspaces built:**
- `apps/web` - React web application
- `apps/api` - Express API server
- `infra` - AWS CDK infrastructure
- `packages/core/agents/auditor` - Auditor agent
- `packages/core/agents/orchestrator` - Orchestrator agent

#### Test Job

Runs automated tests and generates coverage reports.

| Step | Description |
|------|-------------|
| Type checking | Run `npm run typecheck` for all packages |
| Unit tests | Run `npm run test` with Vitest |
| Coverage upload | Upload coverage reports as artifacts |

**Coverage artifacts:**
- `web-coverage-report` - Web app coverage (14-day retention)
- `auditor-coverage-report` - Auditor agent coverage
- `orchestrator-coverage-report` - Orchestrator agent coverage

#### Quality Job

Enforces code quality standards.

| Step | Description |
|------|-------------|
| ESLint | Run linting across all packages |
| Prettier | Verify code formatting |
| Branch validation | Check branch name follows conventions (PRs only) |

### Workflow Status

Check CI status on any pull request:

1. Open the PR on GitHub
2. Scroll to the "Checks" section
3. Click on a job to view detailed logs

### Required Checks

All three jobs must pass before a PR can be merged:
- ✅ Build
- ✅ Test
- ✅ Quality

## Local Git Hooks (Lefthook)

### Installation

Hooks are automatically installed when you run `npm install` in the project root. The `prepare` script triggers `lefthook install`.

To manually reinstall:

```bash
npx lefthook install
```

### Pre-Push Hooks

The following checks run in parallel before each `git push`:

| Hook | Command | Purpose |
|------|---------|---------|
| `format-check` | `npm run format:check` | Verify Prettier formatting |
| `lint` | `npm run lint` | Run ESLint |
| `typecheck` | `npm run typecheck` | Validate TypeScript types |
| `branch-check` | `./scripts/check-branch-name.sh` | Validate branch naming |

### Configuration

Hooks are configured in `lefthook.yml`:

```yaml
pre-push:
  parallel: true
  commands:
    format-check:
      run: npm run format:check --workspaces --if-present
      fail_text: "Formatting check failed."
    lint:
      run: npm run lint --workspaces --if-present
      fail_text: "Linting failed."
    typecheck:
      run: npm run typecheck --workspaces --if-present
      fail_text: "Type checking failed."
    branch-check:
      run: ./scripts/check-branch-name.sh
      fail_text: "Branch name does not follow conventions."
```

### Bypassing Hooks

In emergencies, bypass pre-push hooks with:

```bash
git push --no-verify
```

⚠️ **Use sparingly** - CI will still run all checks on the remote.

## Branch Naming Conventions

All branches must follow these patterns:

| Pattern | Use Case | Example |
|---------|----------|---------|
| `feature/*` | New features | `feature/batch-scanning` |
| `fix/*` | Bug fixes | `fix/auth-refresh` |
| `chore/*` | Maintenance | `chore/update-deps` |
| `docs/*` | Documentation | `docs/api-guide` |
| `refactor/*` | Refactoring | `refactor/scan-service` |
| `test/*` | Test updates | `test/e2e-coverage` |
| `hotfix/*` | Urgent fixes | `hotfix/security-patch` |

Protected branches: `main`, `develop`, `staging`

### Validation Script

The branch validation script is located at `scripts/check-branch-name.sh`:

```bash
# Test a branch name
./scripts/check-branch-name.sh "feature/my-feature"
# Output: ✓ Valid branch name: 'feature/my-feature'

./scripts/check-branch-name.sh "invalid-name"
# Output: ✗ Invalid branch name: 'invalid-name'
```

## Troubleshooting

### CI Build Failures

**Symptom:** Build job fails

**Solutions:**
1. Run `npm run build` locally to reproduce
2. Check for TypeScript errors in the failing package
3. Ensure all dependencies are properly declared

### CI Test Failures

**Symptom:** Test job fails

**Solutions:**
1. Run `npm run test` locally
2. Check test output for specific failures
3. Run `npm run typecheck` to catch type errors

### Lefthook Not Running

**Symptom:** Hooks don't execute on push

**Solutions:**
1. Verify installation: `npx lefthook check-install`
2. Reinstall hooks: `npx lefthook install`
3. Check `.git/hooks/pre-push` exists

### Branch Name Rejected

**Symptom:** Push blocked with "Branch name does not follow conventions"

**Solutions:**
1. Rename your branch to follow conventions:
   ```bash
   git branch -m old-name feature/new-name
   ```
2. Use an allowed prefix (feature/, fix/, chore/, etc.)

## Adding New Checks

### Adding a CI Job

Edit `.github/workflows/ci.yml`:

```yaml
jobs:
  # ... existing jobs ...
  
  new-check:
    name: New Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run new-check
```

### Adding a Lefthook Command

Edit `lefthook.yml`:

```yaml
pre-push:
  commands:
    # ... existing commands ...
    
    new-check:
      run: npm run new-check
      fail_text: "New check failed."
```

## Related Documentation

- [Contributing Guide](./contributing.md) - Full contribution workflow
- [Local Setup](./local_setup.md) - Development environment setup
- [Testing Strategy](../testing/testing_strategy.md) - Testing guidelines
