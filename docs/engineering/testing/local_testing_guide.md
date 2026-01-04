# Local Testing Guide

This document outlines what's been built and what needs to be tested locally to validate the WCAG 2.2 implementation.

## Full Stack Local Development

Run the complete UI + API stack locally with real AWS Bedrock integration.

### Prerequisites

- Node.js 18+
- Docker Desktop (for PostgreSQL)
- AWS credentials configured (for Bedrock Agent)

### Quick Start

```bash
# 1. Start PostgreSQL database
docker-compose up -d

# 2. Start local API server (Terminal 1)
cd apps/api
npm install
npm run dev

# 3. Start frontend (Terminal 2)
cd apps/web
npm run dev

# 4. Open http://localhost:5173
```

### With Real Bedrock Integration

To enable real AI-powered accessibility scanning:

```bash
# 1. Start Docker Desktop

# 2. Deploy CDK development stack
cd infra
npm install
npm run deploy:dev

# 3. Note the outputs and update apps/api/.env
# BEDROCK_AGENT_ID=<from outputs>
# BEDROCK_AGENT_ALIAS_ID=<from outputs>

# 4. Restart the API server
cd apps/api && npm run dev
```

### Simulation Mode (No AWS Required)

Without Bedrock credentials, the API runs in simulation mode:
- Scans complete after a short delay
- Mock violations are inserted
- No actual accessibility scanning occurs

This is useful for UI development without AWS costs.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Local Environment                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   React     │────▶│   Express   │────▶│ PostgreSQL  │   │
│  │   :5173     │     │   :3001     │     │   :5432     │   │
│  └─────────────┘     └──────┬──────┘     └─────────────┘   │
└──────────────────────────────┼──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   AWS Bedrock Agent │
                    │   (Cloud)           │
                    └─────────────────────┘
```

## What Has Been Built

### Core Auditor Package

Location: `packages/core/agents/auditor/`

| Component | Path | Description | Test Coverage |
|-----------|------|-------------|---------------|
| Focus Obscured Analyzer | `src/services/focus-obscured-analyzer.ts` | WCAG 2.4.11 - Detects when focused elements are hidden by sticky/fixed overlays | Needs tests |
| Dragging Analyzer | `src/services/dragging-analyzer.ts` | WCAG 2.5.7 - Detects draggable elements without single-pointer alternatives | Needs tests |
| Scanner | `src/services/scanner.ts` | Core axe-core wrapper for accessibility scanning | Has property tests |
| Structure Analyzer | `src/services/structure-analyzer.ts` | Page structure analysis | Has tests |
| Verifier | `src/services/verifier.ts` | Element verification after fixes | Has tests |
| Lambda Handler | `src/handler.ts` | Bedrock Action Group entry point | Has property tests |

### Core Orchestrator Package

Location: `packages/core/agents/orchestrator/`

| Component | Path | Description | Test Coverage |
|-----------|------|-------------|---------------|
| Interaction Specialist | `src/services/specialists/interaction-specialist.ts` | WCAG 2.5.7/2.5.8 fix planning (dragging, target size) | Needs tests |
| Focus Specialist | `src/services/specialists/focus-specialist.ts` | WCAG 2.4.11 focus visibility fixes | Needs tests |
| Alt-Text Specialist | `src/services/specialists/alt-text-specialist.ts` | Image alt text fixes | Routed |
| Contrast Specialist | `src/services/specialists/contrast-specialist.ts` | Color contrast fixes | Routed |
| Navigation Specialist | `src/services/specialists/navigation-specialist.ts` | Keyboard navigation fixes | Routed |
| Specialist Router | `src/services/specialists/specialist-router.ts` | Routes violations to specialists | Has property tests |

## Test Commands

### Run All Tests in a Package

```bash
# Auditor tests
cd packages/core/agents/auditor
npm install
npm run test

# Orchestrator tests
cd packages/core/agents/orchestrator
npm install
npm run test
```

### Run Tests with Coverage

```bash
cd packages/core/agents/auditor
npm run test:coverage

cd packages/core/agents/orchestrator
npm run test:coverage
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

## Missing Tests

### Focus Obscured Analyzer Tests

**File to create:** `packages/core/agents/auditor/src/__tests__/focus-obscured-analyzer.test.ts`

**What to test:**
- `getFocusableElements()` - correctly identifies buttons, links, inputs
- `getOverlayElements()` - finds sticky/fixed positioned elements
- `calculateOverlapPercentage()` - geometry calculations are accurate
- `analyze()` - returns empty array when no overlays exist
- `analyze()` - detects violations when elements are >50% obscured
- `transformToViolations()` - produces correct Violation format
- Impact level: critical (100%), serious (75%+), moderate (50%+)

**Test fixtures needed:**

```html
<!-- Fixture: sticky header obscuring form -->
<header style="position: fixed; top: 0; height: 60px; z-index: 1000;"></header>
<button style="position: absolute; top: 30px;">Obscured Button</button>
```

### Dragging Analyzer Tests

**File to create:** `packages/core/agents/auditor/src/__tests__/dragging-analyzer.test.ts`

**What to test:**
- `detectDraggableElements()` - finds `[draggable="true"]` elements
- `detectDraggableElements()` - detects library patterns (jQuery UI, Sortable.js)
- `inferDragPattern()` - correctly categorizes: slider, reorder, map, resize, draw
- `findAlternatives()` - detects existing buttons as alternatives
- `findAlternatives()` - detects number inputs for sliders
- `analyze()` - returns violations only for elements without alternatives
- `generateSuggestedFix()` - provides appropriate fix suggestions per pattern

**Test fixtures needed:**

```html
<!-- Fixture: sortable list without alternatives -->
<ul class="sortable">
  <li draggable="true">Item 1</li>
  <li draggable="true">Item 2</li>
</ul>

<!-- Fixture: slider with number input alternative -->
<input type="range" id="slider">
<input type="number" id="slider-value">
```

### Interaction Specialist Tests

**File to create:** `packages/core/agents/orchestrator/src/__tests__/interaction-specialist.test.ts`

**What to test:**
- `canHandle()` - matches dragging, target-size, 2.5.7, 2.5.8 rules
- `planFix()` - returns CSS fix for target-size violations
- `planFix()` - returns data-attribute fix for dragging violations
- `calculateConfidence()` - returns 85 (medium) for target-size
- `calculateConfidence()` - returns 30 (low) for dragging
- `createHumanHandoff()` - produces correct handoff items
- `generateDraggingAlternative()` - suggests inputs for sliders
- `generateDraggingAlternative()` - suggests buttons for sortables

### Focus Specialist Tests

**File to create:** `packages/core/agents/orchestrator/src/__tests__/focus-specialist.test.ts`

**What to test:**
- `canHandle()` - matches focus-obscured, 2.4.11 rules
- `planFix()` - generates scroll-margin-top CSS fixes
- `calculateConfidence()` - returns appropriate confidence tiers
- Integration with FocusObscuredAnalyzer results

## Integration Testing

### Manual Browser Testing with Playwright

The analyzers require a real browser context. Create an integration test:

**File:** `packages/core/agents/auditor/src/__tests__/integration/wcag-22-analyzers.test.ts`

```typescript
import { test, expect } from 'vitest';
import { chromium } from 'playwright';
import { FocusObscuredAnalyzer } from '../../services/focus-obscured-analyzer.js';
import { DraggingAnalyzer } from '../../services/dragging-analyzer.js';

test('FocusObscuredAnalyzer detects sticky header violations', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.setContent(`
    <style>
      header { position: fixed; top: 0; height: 60px; background: white; z-index: 1000; width: 100%; }
      main { margin-top: 100px; }
    </style>
    <header>Sticky Header</header>
    <main>
      <button style="margin-top: -40px;">Partially Obscured</button>
    </main>
  `);
  
  const analyzer = new FocusObscuredAnalyzer();
  const violations = await analyzer.analyze(page);
  
  expect(violations.length).toBeGreaterThan(0);
  expect(violations[0].id).toBe('focus-not-obscured');
  
  await browser.close();
});
```

## Quick Start Testing Checklist

```bash
# 1. Install dependencies
cd packages/core/agents/auditor && npm install
cd ../orchestrator && npm install

# 2. Build packages
npm run build

# 3. Run existing tests (should all pass)
npm run test

# 4. Check test coverage to see gaps
npm run test:coverage
```

## Test Development Priority

| Priority | Component | Reason |
|----------|-----------|--------|
| P0 | Focus Obscured Analyzer | New WCAG 2.2 - no tests exist |
| P0 | Dragging Analyzer | New WCAG 2.2 - no tests exist |
| P1 | Interaction Specialist | Orchestrator for 2.5.7/2.5.8 |
| P1 | Focus Specialist | Orchestrator for 2.4.11 |
| P2 | E2E Integration | Full workflow validation |

## End to End Testing

The web app has E2E tests in `apps/web/e2e/`:

| Test File | Description |
|-----------|-------------|
| `accessibility.spec.ts` | Accessibility scanning flows |
| `scan-flow.spec.ts` | Main scan workflow |
| `history-flow.spec.ts` | Scan history management |
| `auth-flow.spec.ts` | Authentication flows |
| `error-recovery.spec.ts` | Error handling |

### Running E2E Tests

```bash
cd apps/web
npm install
npx playwright test
```

## Human in the Loop Testing

The confidence scoring system needs manual validation:

### Test Cases for Confidence Scoring

| Scenario | Expected Confidence | Expected Action |
|----------|---------------------|-----------------|
| Target size < 24px | 85 (Medium) | Auto-apply CSS fix |
| Dragging without alternative | 30 (Low) | Flag for human review |
| Focus completely obscured (100%) | - | Critical severity, needs fix |
| Focus partially obscured (50-75%) | - | Moderate severity |

### To Validate
1. Create a test page with known violations
2. Run the analyzers
3. Verify confidence scores match expectations
4. Verify human handoff items are created for low-confidence fixes

## Test Fixtures Directory

Test fixtures should live in:
- `packages/core/agents/auditor/src/__fixtures__/`
- `packages/core/agents/orchestrator/src/__fixtures__/`

### Recommended Fixtures to Create

1. **sticky-header-page.html** - Page with fixed header obscuring focusable elements
2. **draggable-list.html** - Sortable list without keyboard alternatives
3. **slider-with-alt.html** - Range slider with number input alternative
4. **small-touch-targets.html** - Buttons smaller than 24x24px

## Definition of Done

Local testing is complete when:

- All unit tests pass (`npm run test`)
- Test coverage > 80% for new analyzers
- Focus Obscured Analyzer has integration test with Playwright
- Dragging Analyzer has integration test with Playwright
- Specialist routing correctly sends violations to new specialists
- Confidence scores are validated for auto-apply vs human-review decisions
- Build succeeds (`npm run build`)

## Next Steps

1. Create the missing test files listed above
2. Write test fixtures for WCAG 2.2 scenarios
3. Run integration tests with Playwright
4. Validate confidence scoring logic
5. Test the full workflow: Audit → Plan → Execute → Validate

