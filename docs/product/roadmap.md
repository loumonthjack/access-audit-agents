# Product Roadmap

## Overview

This roadmap outlines planned features and improvements for AccessAgents. Items are organized by priority and estimated timeline. Priorities may shift based on user feedback and market needs.

## Current Status (Q1 2025)

### ✅ Released Features

| Feature | Description | Status |
|---------|-------------|--------|
| Single Page Scanning | Scan individual URLs for WCAG violations | Released |
| AI Remediation | Automatic fix generation using Bedrock agents | Released |
| Report Generation | Detailed reports with before/after comparisons | Released |
| JSON/HTML Export | Download reports in multiple formats | Released |
| Scan History | View and manage past scan sessions | Released |
| Mobile Viewport | Scan pages in mobile viewport mode | Released |
| WebSocket Progress | Real-time scan progress updates | Released |
| Cognito Authentication | Secure user authentication | Released |

## Roadmap

### 🚀 Q1 2025 - Batch Scanning

**Priority: High**

#### Sitemap Scanning
Enable scanning entire websites by providing a sitemap URL.

| Feature | Description | Status |
|---------|-------------|--------|
| Sitemap Parser | Parse standard sitemap XML and sitemap index files | Planned |
| URL Preview | Review and select URLs before scanning | Planned |
| Batch Progress | Track progress across multiple pages | Planned |
| Pause/Resume | Control batch scan execution | Planned |
| Batch Reports | Aggregated reports across all pages | Planned |
| Priority Recommendations | Site-wide fix prioritization | Planned |

**User Value**: Scan entire websites efficiently instead of one page at a time.

**Technical Details**: See [Sitemap Scanning Spec](../engineering/requirements/sitemap_scanning.md)

---

### 🔄 Q2 2025 - CI/CD Integration

**Priority: High**

#### GitHub Actions Integration
Native GitHub Actions for accessibility testing in CI pipelines.

| Feature | Description | Status |
|---------|-------------|--------|
| GitHub Action | `accessagents/scan-action` for workflows | Planned |
| PR Comments | Post scan results as PR comments | Planned |
| Status Checks | Block PRs with critical violations | Planned |
| SARIF Output | GitHub Security tab integration | Planned |

#### GitLab CI Integration
GitLab CI/CD component for accessibility testing.

| Feature | Description | Status |
|---------|-------------|--------|
| GitLab Component | Native CI component | Planned |
| MR Comments | Post results to merge requests | Planned |
| Pipeline Gates | Quality gates for accessibility | Planned |

**User Value**: Catch accessibility regressions before they reach production.

---

### 📅 Q3 2025 - Scheduled Scans & Monitoring

**Priority: Medium**

#### Scheduled Scans
Automated recurring accessibility audits.

| Feature | Description | Status |
|---------|-------------|--------|
| Cron Scheduling | Configure scan frequency | Planned |
| Email Notifications | Alert on new violations | Planned |
| Slack Integration | Post results to Slack channels | Planned |
| Webhook Support | Custom integrations via webhooks | Planned |

#### Trend Analysis
Track accessibility improvements over time.

| Feature | Description | Status |
|---------|-------------|--------|
| Historical Charts | Violation trends over time | Planned |
| Regression Detection | Alert on accessibility regressions | Planned |
| Compliance Score | Overall accessibility health score | Planned |
| Team Dashboards | Organization-wide metrics | Planned |

**User Value**: Maintain continuous accessibility compliance with automated monitoring.

---

### 🏢 Q4 2025 - Enterprise Features

**Priority: Medium**

#### Team Collaboration
Multi-user workspaces for teams.

| Feature | Description | Status |
|---------|-------------|--------|
| Team Workspaces | Shared scan history and reports | Planned |
| Role-Based Access | Admin, editor, viewer roles | Planned |
| Audit Logs | Track team activity | Planned |
| SSO Integration | SAML/OIDC single sign-on | Planned |

#### Custom Rules
Organization-specific accessibility requirements.

| Feature | Description | Status |
|---------|-------------|--------|
| Custom Rule Builder | Define custom axe-core rules | Planned |
| Rule Templates | Pre-built rule sets for industries | Planned |
| Severity Overrides | Customize impact levels | Planned |
| Exclusion Patterns | Ignore specific elements/pages | Planned |

**User Value**: Enterprise-grade features for large organizations with specific compliance needs.

---

### 🔮 Future Considerations

These items are under consideration but not yet scheduled:

| Feature | Description | Priority |
|---------|-------------|----------|
| Browser Extension | Scan pages directly from browser | Low |
| VS Code Extension | IDE integration for developers | Low |
| API Rate Limiting | Usage-based pricing tiers | Medium |
| Multi-language Support | Localized UI and reports | Low |
| PDF Export | Generate PDF reports | Low |
| Jira Integration | Create tickets from violations | Medium |
| Component Library Scanning | Scan design system components | Medium |
| Accessibility Score API | Public API for compliance scores | Low |

## Feedback

We prioritize features based on user feedback. To request a feature or provide input:

1. **GitHub Issues**: Open an issue with the `feature-request` label
2. **Community Discord**: Join our Discord server for discussions
3. **Email**: Contact product@accessagents.io

## Release Process

- **Major releases**: Quarterly with new features
- **Minor releases**: Monthly with improvements and fixes
- **Patch releases**: As needed for critical bugs

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 1.0.0 | 2024-01 | Initial release with single page scanning |
| 1.1.0 | 2024-03 | Added HTML export |
| 1.2.0 | 2024-06 | Mobile viewport support |
| 1.3.0 | 2024-09 | WebSocket progress, violation screenshots |
| 2.0.0 | 2025-Q1 | Sitemap scanning (planned) |

---

*Last updated: January 2025*
