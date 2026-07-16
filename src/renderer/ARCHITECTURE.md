# Renderer architecture

The renderer is a persistent desktop workbench. Routes describe the active view; they do not own
workspace data or long-lived document state.

## Top-level ownership

- `workbench/` owns persistent application chrome, view activation, panels, and overlays.
- `features/` owns product domains. Every domain uses `model/`, `commands/`, `hooks/`, and `views/`
  where those responsibilities exist.
- `services/` owns renderer-wide capabilities such as navigation, workspace state, documents,
  view-state, telemetry, bootstrap, and system commands.
- `api/` contains typed IPC wrappers only.
- `components/` contains reusable feature-neutral UI primitives and composites.
- `lib/` contains small pure utilities with no renderer state.

## Feature dependency flow

```text
views -> hooks -> model
              -> commands -> api
```

- Views render and handle interaction. They never import models or APIs directly.
- Hooks provide focused React subscriptions and lifecycle integration.
- Models own cached application data and view state. They stay React-free.
- Commands orchestrate mutations and IPC. They do not render.
- Cross-feature collaboration happens through hooks or explicit public contracts, never by
  importing another feature's views.
- Features build paths and navigate through `services/navigation`; they never depend upward on the
  workbench shell.

## Desktop lifecycle rules

- Workspace data survives route unmounts.
- First load may show a matching skeleton; later visits render cached data immediately.
- Refreshes happen in the background and do not replace usable content.
- Filters, selections, and scroll positions are restored per workspace.
- Navigation intent prefetches lazy view bundles.
- CPU-heavy and filesystem work remains behind main-process IPC or workers.

These rules are enforced by `tests/unit/architecture/renderer-boundaries.test.ts` and ESLint.
