/access-agents-monorepo
├── /apps
│   ├── /web                    # The Next.js Dashboard
│   │   ├── /app                # Routes
│   │   ├── /components         # React UI
│   │   └── /utils              # Client-side helpers
│   │
│   └── /worker                 # The Node.js Background Service
│       ├── /jobs               # Redis Queue Processors
│       └── /index.ts           # Worker Entry Point
│
├── /packages
│   ├── /core                   # [MIT] The "Brain" (Shared Logic)
│   │   ├── /agents             # Bedrock Nodes (Auditor, Planner, etc.)
│   │   ├── /tools              # Playwright/Axe wrappers
│   │   └── /types              # Shared TypeScript Interfaces
│   │
│   ├── /ui                     # [MIT] Shared React Components (Design System)
│   │
│   └── /enterprise             # [PROPRIETARY] SaaS Logic 🔒
│       ├── /billing            # Stripe Integration
│       ├── /auth               # Clerk/SSO Adapters
│       └── /infrastructure     # Multi-tenant Context Logic
│
├── /infrastructure
│   ├── /docker
│   │   ├── Dockerfile.dev      # Local Dev
│   │   └── Dockerfile.prod     # Production Build
│   └── /k8s                    # Kubernetes Manifests
│
├── docker-compose.yml          # For Self-Hosters
└── turbo.json                  # Turborepo Build Configuration
