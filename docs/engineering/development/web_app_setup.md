# Web App Setup

This document covers the setup and configuration of the React web application.

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool and dev server |
| TanStack Router | Latest | File-based routing |
| TanStack Query | Latest | Server state management |

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher

### Installation

```bash
cd apps/web
npm install
```

### Development Server

```bash
npm run dev
```

The development server starts at `http://localhost:5173`.

## Project Structure

```
apps/web/
├── src/
│   ├── config/           # App configuration
│   ├── features/         # Feature modules
│   │   ├── auth/         # Authentication
│   │   ├── history/      # Scan history
│   │   ├── report/       # Report viewing
│   │   └── scan/         # Scanning functionality
│   ├── routes/           # File-based routes
│   ├── shared/           # Shared components and utilities
│   │   ├── components/   # Reusable components
│   │   ├── hooks/        # Custom hooks
│   │   ├── lib/          # Utilities and API
│   │   └── store/        # State management
│   ├── test/             # Test utilities
│   └── types/            # TypeScript types
├── e2e/                  # Playwright E2E tests
└── public/               # Static assets
```

## Build Configuration

### Vite Plugins

The project uses the following Vite plugins:

- `@vitejs/plugin-react` - React support with Babel for Fast Refresh

### TypeScript Configuration

The project uses multiple TypeScript configurations:

- `tsconfig.json` - Base configuration
- `tsconfig.app.json` - Application-specific settings
- `tsconfig.node.json` - Node.js environment settings

## ESLint Configuration

For production applications, enable type-aware lint rules:

```javascript
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

### React-Specific Rules

Install additional React lint plugins:

```bash
npm install eslint-plugin-react-x eslint-plugin-react-dom --save-dev
```

```javascript
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      reactX.configs['recommended-typescript'],
      reactDom.configs.recommended,
    ],
  },
])
```

## Testing

### Unit Tests

```bash
npm run test
```

### E2E Tests

```bash
npx playwright test
```

### Test Coverage

```bash
npm run test:coverage
```

## Build for Production

```bash
npm run build
```

Output is generated in the `dist/` directory.

## Environment Variables

Create a `.env.local` file for local development:

```env
VITE_API_URL=http://localhost:3000
VITE_COGNITO_USER_POOL_ID=your-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id
```

## Performance Optimization

### React Compiler

The React Compiler is not enabled by default due to performance impact on development. See the [React Compiler documentation](https://react.dev/learn/react-compiler/installation) for setup instructions.

### Code Splitting

The application uses file-based routing which enables automatic code splitting per route.

