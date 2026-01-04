#!/bin/bash

# Branch Name Validation Script
# Validates git branch names against allowed patterns
# 
# Allowed patterns:
#   - feature/*  - New features
#   - fix/*      - Bug fixes
#   - chore/*    - Maintenance tasks
#   - docs/*     - Documentation updates
#   - refactor/* - Code refactoring
#   - test/*     - Test additions/updates
#   - hotfix/*   - Urgent production fixes
#   - main, develop, staging - Protected branches
#
# Exit codes:
#   0 - Valid branch name
#   1 - Invalid branch name

# Get current branch name
BRANCH_NAME="${1:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null)}"

# Check if we got a branch name
if [ -z "$BRANCH_NAME" ]; then
    echo "Error: Could not determine branch name"
    exit 1
fi

# Protected branches (exact match)
PROTECTED_BRANCHES="^(main|develop|staging)$"

# Allowed branch patterns (prefix/*)
ALLOWED_PATTERNS="^(feature|fix|chore|docs|refactor|test|hotfix)/.+"

# Validate branch name
if [[ "$BRANCH_NAME" =~ $PROTECTED_BRANCHES ]]; then
    echo "✓ Valid branch name: '$BRANCH_NAME' (protected branch)"
    exit 0
fi

if [[ "$BRANCH_NAME" =~ $ALLOWED_PATTERNS ]]; then
    echo "✓ Valid branch name: '$BRANCH_NAME'"
    exit 0
fi

# Invalid branch name
echo "✗ Invalid branch name: '$BRANCH_NAME'"
echo ""
echo "Branch names must follow one of these patterns:"
echo "  - feature/*   (e.g., feature/add-login)"
echo "  - fix/*       (e.g., fix/button-alignment)"
echo "  - chore/*     (e.g., chore/update-deps)"
echo "  - docs/*      (e.g., docs/api-reference)"
echo "  - refactor/*  (e.g., refactor/auth-module)"
echo "  - test/*      (e.g., test/unit-coverage)"
echo "  - hotfix/*    (e.g., hotfix/critical-bug)"
echo ""
echo "Or use a protected branch: main, develop, staging"
exit 1
