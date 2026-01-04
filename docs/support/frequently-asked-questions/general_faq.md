# General FAQ

Frequently asked questions about AccessAgents and web accessibility.

## About AccessAgents

### What is AccessAgents?

AccessAgents is an AI-powered accessibility remediation platform that automatically detects and fixes WCAG 2.2 violations in web applications. It uses a multi-agent AI architecture to scan pages, identify accessibility issues, and apply intelligent fixes.

### How does AccessAgents work?

AccessAgents uses a Planner-Executor-Validator (PEV) architecture:

1. **Audit**: Scans your page using axe-core to detect WCAG violations
2. **Plan**: AI analyzes violations and creates a remediation strategy
3. **Execute**: Specialist agents apply DOM modifications to fix issues
4. **Validate**: Re-scans fixed elements to confirm compliance
5. **Iterate**: Retries failed fixes with alternative strategies

### What accessibility standards does AccessAgents support?

AccessAgents tests against WCAG 2.2 (Web Content Accessibility Guidelines) at levels A and AA. This covers the most common and impactful accessibility requirements.

### Is AccessAgents a replacement for manual accessibility testing?

AccessAgents significantly reduces manual effort but doesn't completely replace human review. It excels at detecting and fixing common, well-defined issues. Complex cases, user experience considerations, and content-specific decisions still benefit from human judgment.

## Account & Access

### How do I create an account?

Account creation depends on your deployment:
- **Self-hosted**: Contact your organization's administrator
- **SaaS**: Sign up through the registration page or request access from your admin

### I forgot my password. How do I reset it?

1. Go to the sign-in page
2. Click "Forgot password?"
3. Enter your email address
4. Check your email for a reset link
5. Follow the link to create a new password

### Can I have multiple users on one account?

Yes, AccessAgents supports team access. Contact your administrator to add team members. The SaaS Enterprise edition includes advanced team collaboration features.

### How do I change my email or password?

Navigate to your account settings (click your profile icon) to update your email address or password.

## Pricing & Plans

### How much does AccessAgents cost?

Pricing depends on your deployment model:

**Self-Hosted (Community Edition)**:
- Free to deploy
- You pay only AWS infrastructure costs
- Estimated $50-2,000/month based on usage

**SaaS (Enterprise Edition)**:
- Subscription pricing with usage tiers
- Contact sales for pricing details
- Includes priority support and enterprise features

### What's included in the free tier?

The self-hosted Community Edition is free to deploy with no feature restrictions. You only pay for the underlying AWS services (Lambda, Aurora, Bedrock).

### Can I try AccessAgents before committing?

Yes! For self-hosted deployments, you can deploy to your AWS account and test with your own pages. For SaaS, contact sales for a trial period.

## Data & Privacy

### Where is my data stored?

**Self-hosted**: All data stays in your AWS account. Nothing is sent to external servers.

**SaaS**: Data is stored in secure, SOC 2 compliant infrastructure with encryption at rest and in transit.

### What data does AccessAgents collect?

AccessAgents stores:
- Page URLs you scan
- Detected violations and applied fixes
- Scan session metadata (timestamps, viewport settings)
- User account information

It does NOT store:
- Full page content (only relevant HTML snippets)
- User credentials for scanned sites
- Personal data from scanned pages

### Can I delete my scan history?

Yes, you can delete individual scan sessions from the History page. Deleted data is permanently removed from the database.

### Is AccessAgents GDPR compliant?

Yes. AccessAgents is designed with privacy in mind:
- Self-hosted deployments give you complete data control
- SaaS deployments follow GDPR requirements
- You can request data deletion at any time

## About Web Accessibility

### What is WCAG?

WCAG (Web Content Accessibility Guidelines) is the international standard for web accessibility, published by the W3C. It provides guidelines for making web content accessible to people with disabilities.

### Why is accessibility important?

Web accessibility ensures that people with disabilities can perceive, understand, navigate, and interact with websites. It's both:
- **A legal requirement**: Many jurisdictions require accessible websites
- **Good business**: 15% of the global population has a disability
- **Better UX**: Accessibility improvements benefit all users

### What are the WCAG conformance levels?

| Level | Description |
|-------|-------------|
| **A** | Minimum accessibility requirements |
| **AA** | Addresses major barriers (most common target) |
| **AAA** | Highest level of accessibility |

AccessAgents tests against levels A and AA, which cover the requirements most organizations need to meet.

### What disabilities does accessibility address?

Web accessibility helps users with:
- **Visual**: Blindness, low vision, color blindness
- **Auditory**: Deafness, hard of hearing
- **Motor**: Limited fine motor control, paralysis
- **Cognitive**: Learning disabilities, attention disorders
- **Neurological**: Seizure disorders, vestibular disorders

### What are assistive technologies?

Assistive technologies help people with disabilities use computers and the web:
- **Screen readers**: Read page content aloud (JAWS, NVDA, VoiceOver)
- **Screen magnifiers**: Enlarge portions of the screen
- **Voice control**: Navigate using speech commands
- **Switch devices**: Navigate using physical switches
- **Braille displays**: Output text as braille

## Technical Questions

### What browsers does AccessAgents support?

The AccessAgents dashboard works in all modern browsers:
- Chrome (recommended)
- Firefox
- Safari
- Edge

### Can I scan pages behind authentication?

Currently, AccessAgents scans publicly accessible pages. Support for authenticated scanning is on the roadmap.

### Does AccessAgents work with single-page applications (SPAs)?

Yes, AccessAgents uses a real browser (Playwright) to render pages, so it works with React, Vue, Angular, and other SPA frameworks.

### Can I integrate AccessAgents with my CI/CD pipeline?

CI/CD integration is planned for a future release. Currently, you can use the API to trigger scans programmatically.

### What's the maximum page size AccessAgents can scan?

AccessAgents can scan most typical web pages. Very large pages (>10MB HTML) or pages with thousands of elements may experience longer scan times.

## Getting Help

### Where can I get support?

- **Self-hosted**: Community support via GitHub issues
- **SaaS**: Priority support via email and chat (Enterprise plans)

### How do I report a bug?

For self-hosted deployments, open an issue on the GitHub repository with:
- Steps to reproduce
- Expected vs actual behavior
- Browser and environment details

### How do I request a feature?

Submit feature requests through GitHub issues (self-hosted) or contact your account manager (SaaS).
