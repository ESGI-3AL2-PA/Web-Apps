# `Turborepo`

### Apps and Packages

- `admin-front`: react [vite](https://vitejs.dev) ts app
- `user-front`: react [vite](https://vitejs.dev) ts app
- `api`: node.js and express app
- `@repo/ui`: a stub component library shared by `admin-front and user-front` application
- `@repo/eslint-config`: shared `eslint` configurations
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Getting Started

- `npm run dev`: launch all apps with live reload
- `npm run build`: build all apps
- `npm run lint`: lint all apps with eslint
- `npm rum format`: format all apps with prettier
