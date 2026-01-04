# Glossary

A comprehensive glossary of accessibility and platform-specific terms used in AccessAgents.

## Accessibility Terms

### A11y
Numeronym for "accessibility" (a + 11 letters + y). Commonly used shorthand in the accessibility community.

### Accessible Name
The name of a user interface element that is exposed to assistive technologies. It can come from visible text, `aria-label`, `aria-labelledby`, or other sources.

### Alt Text (Alternative Text)
A text description of an image that conveys its meaning to users who cannot see it. Read aloud by screen readers and displayed when images fail to load.

### ARIA (Accessible Rich Internet Applications)
A set of HTML attributes that define ways to make web content more accessible. ARIA provides additional semantics for complex widgets and dynamic content.

### Assistive Technology (AT)
Software or hardware that helps people with disabilities use computers and the web. Examples include screen readers, screen magnifiers, and voice control software.

### Audit
The process of evaluating a website or application for accessibility compliance. Can be automated, manual, or a combination of both.

### axe-core
An open-source accessibility testing engine developed by Deque Systems. AccessAgents uses axe-core to detect WCAG violations.

### Cognitive Accessibility
Design considerations that help users with cognitive disabilities, including learning disabilities, attention disorders, and memory impairments.

### Color Contrast
The difference in luminance between foreground (text) and background colors. WCAG requires minimum contrast ratios for readability.

### Contrast Ratio
A numerical value representing the difference between two colors. WCAG AA requires 4.5:1 for normal text and 3:1 for large text.

### DOM (Document Object Model)
A programming interface for HTML documents that represents the page structure as a tree of objects. AccessAgents modifies the DOM to fix accessibility issues.

### Focus
The currently active element that receives keyboard input. Proper focus management is essential for keyboard accessibility.

### Focus Indicator
A visual indication of which element currently has keyboard focus. Usually a border or outline around the focused element.

### Heading Structure
The hierarchical organization of headings (h1-h6) on a page. Proper heading structure helps users navigate and understand content organization.

### Keyboard Accessibility
The ability to use all website functionality using only a keyboard, without requiring a mouse or touch input.

### Keyboard Trap
A situation where keyboard focus gets stuck in an element and users cannot navigate away using the keyboard.

### Landmark
A region of a page identified by ARIA roles (banner, navigation, main, complementary, contentinfo) that helps users navigate.

### Live Region
An area of a page that announces dynamic content changes to screen reader users. Configured using `aria-live` attribute.

### Motor Accessibility
Design considerations for users with limited fine motor control, tremors, or paralysis who may use alternative input devices.

### Perceivable
One of WCAG's four principles. Content must be presentable in ways users can perceive (see, hear, or otherwise sense).

### Programmatically Determined
Information that can be extracted by assistive technologies from the code, not just visually apparent.

### Remediation
The process of fixing accessibility issues to achieve compliance with accessibility standards.

### Screen Reader
Assistive technology that reads screen content aloud for users who are blind or have low vision. Examples: JAWS, NVDA, VoiceOver.

### Semantic HTML
Using HTML elements according to their intended purpose (e.g., `<button>` for buttons, `<nav>` for navigation) rather than generic elements.

### Skip Link
A link at the beginning of a page that allows keyboard users to skip repetitive content (like navigation) and jump to main content.

### Tab Order
The sequence in which elements receive focus when users press the Tab key. Should follow a logical reading order.

### Visual Accessibility
Design considerations for users with visual impairments, including blindness, low vision, and color blindness.

### VPAT (Voluntary Product Accessibility Template)
A document that explains how a product conforms to accessibility standards. Often required for government procurement.

### WCAG (Web Content Accessibility Guidelines)
The international standard for web accessibility published by the W3C. The current version is WCAG 2.2.

### WCAG Conformance Levels
Three levels of accessibility compliance:
- **Level A**: Minimum accessibility
- **Level AA**: Standard compliance target (most common requirement)
- **Level AAA**: Highest level of accessibility

### Web Accessibility
The practice of making websites usable by people with disabilities, ensuring equal access to information and functionality.

## WCAG Principles (POUR)

### Perceivable
Information and user interface components must be presentable to users in ways they can perceive.

### Operable
User interface components and navigation must be operable by all users.

### Understandable
Information and the operation of the user interface must be understandable.

### Robust
Content must be robust enough to be interpreted by a wide variety of user agents, including assistive technologies.

## Impact Levels

### Critical
Violations that completely block access for users with disabilities. These prevent users from accessing content or functionality entirely.

### Serious
Violations that significantly degrade the user experience for people with disabilities. Users can access content but with major difficulty.

### Moderate
Violations that cause some difficulty for users with disabilities but don't prevent access to content or functionality.

### Minor
Violations that cause minor inconvenience but have limited impact on accessibility.

## Platform-Specific Terms

### AccessAgents
The AI-powered accessibility remediation platform you're using. Automatically detects and fixes WCAG violations.

### Auditor Agent
The AI component that scans pages using axe-core to detect accessibility violations.

### Batch Scan
A scan session that processes multiple URLs from a sitemap (planned feature).

### Bedrock Agent
The Amazon Bedrock-powered AI that orchestrates the remediation process using Amazon Nova Pro.

### Browserless.io
A cloud browser service that AccessAgents uses to render and interact with web pages.

### Fix Pattern
A predefined strategy for fixing a specific type of accessibility violation.

### Injector Agent
The AI component that applies DOM modifications to fix detected violations.

### Needs Review
A status indicating that an AI-applied fix should be verified by a human for accuracy.

### Orchestrator
The component that coordinates the scanning, analysis, and remediation workflow.

### PEV Architecture
Planner-Executor-Validator architecture used by AccessAgents for systematic remediation.

### Scan Session
A single accessibility scan of one URL, including detection and remediation.

### Skipped Violation
A violation that couldn't be automatically fixed and requires manual remediation.

### Viewport
The visible area of a web page. AccessAgents supports desktop (1920x1080) and mobile (375x667) viewports.

### WebSocket
A communication protocol that enables real-time updates during scans.

## Common Violation Types

### Empty Button
A button element with no accessible name (no text, aria-label, or aria-labelledby).

### Empty Link
A link element with no accessible name, making it unclear where the link goes.

### Form Label Missing
A form input without an associated label, making it unclear what information to enter.

### Image Alt Missing
An image without alternative text, making it inaccessible to screen reader users.

### Link Purpose Unclear
A link whose purpose cannot be determined from the link text alone (e.g., "click here").

### Low Contrast
Text that doesn't meet minimum contrast ratio requirements against its background.

### Missing Document Language
A page without a `lang` attribute on the `<html>` element.

### Missing Heading
Content that should have a heading for structure but doesn't.

### Skipped Heading Level
Heading levels that skip numbers (e.g., h1 to h3), breaking the logical hierarchy.

## File Formats

### HTML Export
A human-readable report format suitable for sharing and printing.

### JSON Export
A machine-readable report format suitable for integration with other tools.

### Sitemap
An XML file listing URLs on a website, following the sitemaps.org protocol.

## AWS Services (Self-Hosted)

### Amazon Aurora
The PostgreSQL-compatible database service used to store scan data.

### Amazon Bedrock
AWS's managed AI service that powers the remediation intelligence.

### Amazon Cognito
AWS's authentication service used for user management.

### API Gateway
AWS service that handles REST and WebSocket API requests.

### AWS CDK
Cloud Development Kit used to deploy AccessAgents infrastructure.

### AWS Lambda
Serverless compute service that runs AccessAgents backend functions.

## Related Standards

### ADA (Americans with Disabilities Act)
US law prohibiting discrimination against people with disabilities, including in digital spaces.

### EN 301 549
European standard for ICT accessibility requirements.

### Section 508
US federal law requiring accessible electronic and information technology.

### AODA (Accessibility for Ontarians with Disabilities Act)
Canadian provincial law requiring accessible websites.
