# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is This

**Simvyn** is a universal mobile device devtool — a Node.js/TypeScript monorepo that provides a CLI and React dashboard for controlling iOS Simulators, Android Emulators, and real devices from a single interface.

## Commands

```bash
# Development
npm run dev              # Start CLI server + dashboard (concurrent)
npm run dev:server       # Start CLI/server only
npm run dev:dashboard    # Start dashboard only (Vite HMR)

# Build
npm run build            # Build dashboard only
npm run build:cli        # Bundle CLI for distribution
npm run build:release    # Full production build (dashboard + CLI)
npm run build:all        # Build all workspaces

# Quality
npm run typecheck        # TypeScript type checking (project references)
npm run lint             # oxlint
npm run format           # Prettier (writes in place)
npm run format:check     # Prettier (CI check)

# Testing
npm test                 # Node native test runner (no Jest/Vitest)
# Tests live in packages/core/src/__tests__/*.test.ts
```

**Node >= 22.12.0 required.** Pre-commit hook runs Prettier via lint-staged.

## Monorepo Structure

npm workspaces with these packages:

| Package | Name | Role |
|---|---|---|
| `packages/types` | `@simvyn/types` | Shared TypeScript types |
| `packages/core` | `@simvyn/core` | Device management, platform adapters |
| `packages/server` | `@simvyn/server` | Fastify server + WebSocket broker |
| `packages/cli` | `simvyn` | Commander.js CLI, entry point |
| `packages/dashboard` | `@simvyn/dashboard` | React + Vite frontend |
| `packages/modules/*` | `@simvyn/module-*` | Feature plugins (14 modules) |

## Architecture

### Module Plugin System

Every feature is a self-contained module under `packages/modules/`. Each module exports a `SimvynModule` object:

```typescript
interface SimvynModule {
  name: string
  register(fastify, opts): Promise<void>  // HTTP routes + WS handlers
  cli?(program): void                      // CLI commands
  capabilities?: PlatformCapability[]     // iOS/Android support flags
}
```

Modules register themselves in `packages/cli/src/all-modules.ts`. They are loaded dynamically by the server at startup and by Commander.js for CLI.

### Platform Adapter Pattern

`packages/core/src/adapters/` provides a `PlatformAdapter` interface implemented by:
- `createIosAdapter()` — wraps `xcrun simctl` / `xcrun devicectl`
- `createAndroidAdapter()` — wraps `adb`

Use these adapters rather than shelling out to `xcrun` or `adb` directly.

### WebSocket Broker

All real-time updates flow through a single multiplexed WebSocket connection. The server-side broker is at `packages/server/src/ws-broker.ts`. Messages use the envelope format:

```typescript
{ channel: string, type: string, payload: unknown, requestId?: string }
```

On the dashboard, subscribe via `useWsListener(channel, type, handler)` from `packages/dashboard/src/hooks/use-ws.tsx`.

### Dashboard State (Zustand)

Three primary stores in `packages/dashboard/src/stores/`:
- `useDeviceStore` — device list and multi-device selection
- `useModuleStore` — available modules and active module
- `useFavouriteStore` — persisted favorites

### Routing

React Router v7 with a single parameterized route: `/:moduleName?`. The `RouterSync` component keeps the URL in sync with `useModuleStore`.

## Adding a New Module

1. Create `packages/modules/<name>/` with `src/index.ts` exporting a `SimvynModule`
2. Add `manifest.ts`, `routes.ts`, and `ws-handler.ts` following existing modules
3. Register in `packages/cli/src/all-modules.ts`
4. Add corresponding panel component in `packages/dashboard/src/panels/`
