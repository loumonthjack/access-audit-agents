# AI Agent Logic Specification: AccessAgents Core

**Version:** 1.0.0  
**Runtime:** Amazon Bedrock Agents (Claude 3.5 Sonnet)  
**Architecture Pattern:** Planner-Executor-Validator (PEV)

---

## 1. Cognitive Architecture Overview

The AccessAgents "Brain" is not a simple chatbot; it is a **Goal-Directed Agent** operating within a strict Finite State Machine (FSM). It uses the Planner-Executor-Validator pattern to ensure safety and accuracy.

### 1.1 The Logic Loop

1. **Perceive (Audit):** The agent scans the DOM to build a "World Model."
2. **Plan (Reason):** It identifies violations and prioritizes them based on user impact (Critical > Serious > Minor).
3. **Act (Execute):** It generates specific JSON instructions to modify the DOM.
4. **Verify (Validate):** It re-scans the specific element to confirm the fix works.
5. **Reflect (Learn):** If verification fails, it updates its strategy and retries.

---

## 2. The System Prompt ("The Constitution")

The following prompt is injected into the Bedrock Agent's "Instruction" field. It acts as the immutable constitution for the AI's behavior.

> **Role:** You are the Senior Accessibility Engineer for AccessAgents. Your mission is to autonomously detect and fix WCAG 2.1 AA violations on web pages. You are precise, code-centric, and safety-obsessed.

### Core Directives

1. **Audit First:** You MUST run `Auditor::ScanURL` before proposing any fixes. You cannot fix what you cannot see.
2. **Do No Harm:** Never remove functionality. If a fix requires deleting an interactive element, ABORT and flag for human review.
3. **Strict JSON Output:** When calling `Injector::ApplyFix`, your output must be valid JSON adhering to the tool's schema. Do not include conversational text inside the tool call.
4. **Verify Your Work:** After applying a fix, you MUST run `Auditor::VerifyElement` on the specific selector to confirm compliance.

### The Remediation Protocol

1. Analyze the Audit Report.
2. Select the highest priority violation (Critical).
3. Formulate a hypothesis for the fix (e.g., "The button is missing a label, I will add `aria-label='Submit'`").
4. Execute the fix.
5. Verify the fix.
6. Move to the next violation.

---

## 3. Action Groups (Tool Definitions)

The Agent interacts with the world via Action Groups (Lambda functions). These are the "Hands" of the system.

### 3.1 Group: Auditor

Responsible for perception and verification.

| Function Name   | Description                                          | Inputs                                            | Outputs                                                                              |
|-----------------|------------------------------------------------------|---------------------------------------------------|--------------------------------------------------------------------------------------|
| `ScanURL`       | Runs a full axe-core scan on the target page.        | `url` (string), `viewport` (enum: mobile/desktop) | `violations[]`: Array of violation objects containing impact, selector, failureSummary |
| `VerifyElement` | Re-runs checks on a single selector to save compute. | `selector` (string), `ruleId` (string)            | `status` (pass/fail), `newScore` (number)                                            |

**Logic Constraint:** The `ScanURL` output can be massive. The Lambda function pre-processes the JSON to truncate strictly decorative nodes and returns only the "Violating Nodes" to fit within the Claude 3.5 context window.

### 3.2 Group: Injector (The Specialist Swarm)

Responsible for DOM manipulation.

| Function Name        | Description                                           | Schema (Strict Zod)                                                                  |
|----------------------|-------------------------------------------------------|--------------------------------------------------------------------------------------|
| `ApplyAttributeFix`  | Adds/Modifies HTML attributes.                        | `{ selector: string, attribute: string, value: string, reasoning: string }`          |
| `ApplyContentFix`    | Modifies text content (e.g., for non-descriptive links). | `{ selector: string, innerText: string, originalTextHash: string }`               |
| `InjectStyle`        | Adds CSS classes for contrast issues.                 | `{ selector: string, cssClass: string, styles: Record<string, string> }`             |

**Safety Guardrail:** The `ApplyContentFix` tool requires an `originalTextHash`. If the DOM has changed since the audit (e.g., dynamic content update), the hash mismatch causes the tool to throw an error, forcing the Agent to re-audit.

---

## 4. State Management & Graph Logic

Bedrock Agents maintain state via `sessionAttributes`. We use these attributes to track the "Cursor" (current task) and "Retry Count."

### 4.1 Session Attributes

```json
{
  "current_url": "https://example.com",
  "pending_violations": ["vio_123", "vio_124", "vio_125"],
  "current_violation_id": "vio_123",
  "retry_attempts": 0,
  "human_handoff_reason": null
}
```

### 4.2 The "Stuck" Logic (Loop Prevention)

Infinite loops are a major risk in Agentic workflows. We implement a **"Three-Strike Rule."**

**Condition:** If `Injector::ApplyFix` fails OR `Auditor::VerifyElement` returns "Fail" for the same violation ID three times in a row.

**Action:**
1. The Agent sets `human_handoff_reason = "Unable to fix selector #btn-123 after 3 attempts."`
2. The Agent moves the violation to a "Skipped" list.
3. The Agent proceeds to the next violation.

---

## 5. Reasoning Trace Example (Chain of Thought)

Here is a verbatim example of how the Agent thinks during a successful remediation.

**User:** "Fix the accessibility issues on https://my-shop.com"

**Agent Trace:**

1. **Thought:** The user wants to fix a site. I have not scanned it yet. I must call `Auditor::ScanURL`.
2. **Action:** `Auditor::ScanURL("https://my-shop.com")`
3. **Observation:** (Returns JSON) Found 1 Critical Issue: `<button id="checkout">` (Missing accessible name).
4. **Thought:** There is a critical issue on `#checkout`. It is an icon-only button. I need to add an `aria-label`. The context suggests it is a cart checkout button.
5. **Action:** `Injector::ApplyAttributeFix(selector="#checkout", attribute="aria-label", value="Checkout")`
6. **Observation:** Success. Attribute applied.
7. **Thought:** I must verify the fix worked and didn't break the syntax.
8. **Action:** `Auditor::VerifyElement(selector="#checkout", ruleId="button-name")`
9. **Observation:** Status: Pass.

**Final Response:** "I have scanned the page and found a critical issue with the checkout button. I fixed it by adding an `aria-label='Checkout'`. The element is now compliant."

---

## 6. Error Handling & Self-Correction Strategies

### 6.1 Hallucinated Selectors

- **Scenario:** Agent tries to fix `#submit-button-FINAL` but the ID is actually `#submit-button`.
- **Error:** Injector returns `DOMError: Selector not found`.
- **Correction Strategy:** The Agent is prompted to catch this error. It will then call `Auditor::GetPageStructure` (a lightweight tool) to fuzzy-match the ID or switch to using an XPath selector.

### 6.2 "Fix Ineffective" Loop

- **Scenario:** Agent adds `alt="image"` (which is bad alt text). Auditor fails it because "Alt text must be descriptive."
- **Correction Strategy:** The Agent reads the failure reason ("Text is redundant or vague"). It then analyzes the image context again and retries with `alt="Red running shoe side view"`.

### 6.3 Token Limit Exhaustion

- **Scenario:** The page has 5,000 violations.
- **Strategy:** The Auditor Lambda implements "Pagination." It returns only the top 5 Critical issues and a flag `more_issues_remaining: true`. The Agent fixes the batch, then asks the user: "I fixed the top 5 critical issues. Shall I continue to the next batch?"
