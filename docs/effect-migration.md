# Effect Migration Plan

Companion to [ADR-0001](./adr/0001-adopt-effect-across-main-process.md). That ADR records
*what* was decided and *why*; this document is the execution plan. Update the status
column as phases land; the ADR itself is immutable.

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 0 | Decision codified, architecture enforcement | done (2026-07-25) |
| 1 | Jobs/workers subsystem | done (2026-07-25) |
| 2 | Out-adapters as layers | done (2026-07-26) |
| 3 | Use cases + container → `Layer` | done (2026-07-26) |
| 4 | Effect Schema at the IPC edges | landed via zod-compat shim (2026-07-25); idiomatic Schema pending |
| R | Renderer deep store factory (separate track, no Effect) | separate follow-up |

## Ground rules for every phase

1. **Ports are frozen during a phase.** Each phase rewrites the *inside* of a subsystem
   behind its existing `domain/ports/` contracts. Callers outside the subsystem must not
   change in the same PR. Rollback is therefore always "swap the old implementation
   back."
2. **The runtime lives at edges only.** `Effect.runPromise`/`runFork` appear in IPC
   handlers, `src/main/index.ts`, and worker bootstraps — nowhere else. Until Phase 3,
   not-yet-migrated use cases keep calling Promise-returning wrappers around migrated
   code.
3. **Domain obeys the allowlist** (CLAUDE.md §3, enforced by
   `tests/unit/architecture/effect-domain-boundaries.test.ts`): only `Data`, `Schema`,
   `Option`, `Either` anywhere in domain; `Effect`/`Context` only under `domain/ports/`;
   no `Layer`, no `Schedule`, no `Effect.gen`, no `Effect.run*`, no `@effect/*` packages.
4. **Never wrap pure code.** Domain services and entity methods stay plain synchronous
   functions. `Effect.gen` inside `domain/` is an anti-pattern (CLAUDE.md §29).
5. **Each phase lands with its tests.** `TestClock` for anything time-shaped; layer
   fakes replace hand-built mocks as code migrates.

## Phase 0 — codify and enforce (done)

- ADR-0001 committed; CLAUDE.md §§1–4, 12, 27, 29 amended.
- `effect-domain-boundaries.test.ts` enforces the domain allowlist (passes trivially
  until domain first imports `effect`).
- **Deferred to the Phase 1 branch** (working tree was shared with an in-flight
  workstream at decision time): `pnpm add effect`, and the ESLint
  `no-restricted-imports` scope for `src/main/domain` mirroring the architecture test.

## Phase 1 — jobs/workers subsystem

The first migration and the template for the rest. Chosen because it is self-contained
behind `IJobQueue`/`ILiveTranscriber`, has near-zero unit coverage to rewrite, and
contains the densest Effect-shaped problems (see ADR-0001 context).

**Scope (rewritten):**

- `infrastructure/workers/JobRunner.ts` — polling loop → `Schedule`; capacity gate →
  `Semaphore(maxConcurrency)`; per-job timeout → `Effect.timeout` with *real*
  interruption; adaptive idle backoff → `Schedule` union.
- `shared/utils/SupervisedProcess.ts` + `infrastructure/workers/WhisperServer.ts` —
  child lifecycle → `acquireRelease`/`Scope`; one health timeout (today there are two
  nested 30s timers); one session/health authority (today: three verdict mechanisms,
  four session-id holders).
- `application/usecases/meeting/FinalizeRecordingUseCase.ts` — stops catching all
  errors; failures propagate as tagged errors so the queue's retry/backoff/dead-letter
  actually fire. `RequestFinalizeRecordingUseCase` collapses into a one-line enqueue on
  the facade.
- `domain/entities/Job.ts` — keeps state-transition logic; backoff *policy* expressed as
  a `Schedule` value owned by the runner. Remove dead `markRunning` production path.
- Job payloads validated with `Schema` at the enqueue/claim seam (today: unchecked cast).
- Startup recovery sweeps **all** `running` jobs, not only those stale > 5 min (today a
  crash < 5 min after claim strands the job forever).
- Shutdown ordering via layer finalizers: JobRunner and workers stop **before** the DB
  closes (today it is the reverse, and the failure is swallowed). `WorkerManager` is
  deleted; its one live behavior (stop-all with grace) becomes the finalizer chain.

**Steps, in order:**

1. Branch from a clean tree. `pnpm add effect`. Land the ESLint domain scope.
2. Characterization tests for *target* behavior (they fail against current code by
   design — they encode the bug fixes): transcription failure → job retries with
   backoff → dead-letters at `maxAttempts` → recording marked `failed`; crashed
   `running` job is reclaimed at startup; shutdown persists in-flight job state before
   DB close.
3. Convert pipeline domain errors (`domain/errors/`) to `Data.TaggedError`.
4. Define `Context.Tag` equivalents for `IJobQueue` and `ILiveTranscriber` (old
   `I*` interfaces remain as thin Promise wrappers so IPC and other callers are
   untouched).
5. Rewrite JobRunner, then SupervisedProcess/WhisperServer, keeping the wrappers green.
6. `TestClock` suites: backoff sequence, dead-letter, timeout-interruption reaching the
   transcriber, breaker persistence across recording stops, startup recovery.
7. Wire layers in `container.ts` for this subsystem only; `Effect.runPromise` at the
   meeting IPC handlers and worker bootstrap.

**Exit criteria:** report candidate 1 fully resolved; candidates 2 and 6 substantially
resolved; `meetingTranscription` e2e green; JobRunner/SupervisedProcess covered by
deterministic tests; `WorkerManager`, `retry.ts` uses in this subsystem, and both
`withTimeout` copies deleted.

## Phase 2 — out-adapters as layers

Convert `adapters/out/` implementations to `Layer`s providing their port tags, one
adapter per PR where practical. Highest-value first:

1. `AISDKTextGenerator` — `withRetry` → `Schedule.exponential`; delete `retry.ts` when
   its last consumer converts.
2. `AppleCalendarSource` / `AppleMailSource` / `osascriptJxa` — `execFile` under
   `Effect.timeout` + interruption; inject the command runner so the JSON-parse/status
   mapping (currently untestable, `execFile` hard-coded) gets unit tests.
3. Repositories (`NoteRepository`, `JobRepository`, …) — mechanical wrap; keep Drizzle.
4. `EmbeddingWorker` — port supervision onto the Phase 1 primitives; delete its two
   inline timeout variants.

Delete `IJobTracer`/`LoggerJobTracer`/`OtelJobTracer` in favor of Effect's built-in
tracing spans (OTel exporter stays dev-only).

**Exit criteria:** every out-adapter is a layer; zero hand-rolled timeout/retry/sleep
implementations left in `src/main`; adapter unit tests use injected fakes, not
`vi.mock`.

## Phase 3 — use cases and the container

Convert `application/usecases/` feature-by-feature: per-action classes become
Effect-returning functions grouped by the existing `create{Domain}UseCases` facades;
constructor injection becomes the `R` channel. The IPC facade boundary is where
`Effect.runPromise` sits until a feature's IN adapter converts.

Order: meeting (already half-done from Phase 1) → dailyReview (pairs with the
external-source seam from report candidate 3, if adopted) → settings → notes/index/sync
(largest, last).

`container.ts` shrinks as each feature's wiring moves to composed layers; it is deleted
when the last feature converts. CLAUDE.md §11 naming/file-shape rules get their
revision in the first PR of this phase, when the class-per-file rule first fights the
service shape.

**Exit criteria:** no `new XxxUseCase(...)` wiring in infrastructure; DI order is
compiler-checked; application unit tests provide test layers instead of mock objects.

## Phase 4 — Effect Schema at the IPC edges

Replace Zod as the single source for wire types: schemas defined once (per-feature,
under `src/shared/`), decoded in `adapters/in/ipc/` on request and in `renderer/api/`
on response. Collapses today's four copies of shapes like `CalendarEvent` (Swift bridge
→ adapter → port → `shared/types`) to one definition each, and closes the
inconsistently-applied-validation gap (`dailyReviewAPI` validates nothing today;
`settingsAPI` does).

`zod` is removed from `package.json` when the last schema converts; the
`root-shared may import zod` carve-out in `backend-boundaries.test.ts` goes with it.

**Exit criteria:** one schema per wire type; both IPC edges validate; `zod` gone.

## Renderer track (no Effect — runs in parallel)

Per ADR-0001 the renderer keeps React + Zustand; Effect appears only inside
`renderer/api/` at the IPC edge (Phase 4 gives it the schemas). Its actual problems are
separate and were already in motion in the working tree at decision time
(`refactor(renderer): centralize state invalidation`, `src/renderer/services/settings/`):

This track is not an exit criterion for the main-process Effect migration. Its status
is tracked here for architectural context, but it should land as an independent
renderer refactor.

- Deep entity-store factory above `api/` (report candidate 4) absorbing the 21-store
  CRUD scaffold and 6-copy settings-hydrate template; delete `createEntityAPI` and the
  1:1 pass-through hooks.
- Centralized invalidation (report candidate 5) replacing the six independent
  debouncers.
- ESLint `hooks/` scope so the hooks→api bypasses stop regrowing.

## Sequencing and risk notes

- **One phase in flight at a time** in `src/main`; the renderer track may run
  concurrently (disjoint files).
- Interruption becoming real will surface latent bugs in code that assumed it never
  gets cancelled. Budget for a tail of small fixes in the phase that converts each
  subsystem; the e2e suite is the net.
- If a phase stalls, stopping is safe at any PR boundary: wrappers keep old and new
  worlds interoperable, and no phase leaves a subsystem half-converted across a release.

## Post-migration review findings (2026-07-26)

An adversarial review after the migration landed confirmed all five motivating bug
fixes as substantive (error propagation, cancellation, shutdown order, recovery sweep,
payload validation) and Phase 1 as genuinely Effect-native. Two concurrency bugs it
found in JobRunner — a `wake()`/claim race that could strand freshly claimed jobs, and
`stop()` failing its finalizer on shutdown-grace expiry — were fixed with regression
tests the same day.

Remaining backlog, in value order (none regress anything relative to pre-migration):

1. **Typed errors at ports.** Out-adapters are Promise classes lifted through a generic
   `tryPromise` proxy (`adapters/out/layers.ts`), so every port fails with bare `Error`
   — ADR-0001's rejected alternative relocated, not the native conversion. Converting
   adapters natively (tagged error unions per port) is the real remainder of Phase 2.
2. **Idiomatic Effect Schema.** `src/shared/schemas/schema.ts` reimplements the zod
   builder API over `Schema` with `any` casts; `.strict()` is silently a no-op.
   Replace call sites with native `Schema` structs, then delete the shim.
3. **Value-object branding** (ADR-0001 item 3) — untouched; no `Schema` in
   `domain/value-objects/`.
4. **`applicationRuntime.ts` (~1,090 lines)** — the container renamed more than
   replaced: 25 repetitive `runXxxEffect` blocks and hand-`new`ed adapters in
   comment-ordered sections. Shrinks naturally as items 1–2 land.
5. Small items: `retranscribeMeeting` swallows pipeline errors unlike `finalizeRecording`;
   `MeetingIPC` misses `COMMON_IPC_ERROR_MAP` so schema failures surface as
   `MEETING_ERROR`; dead `domain/services/mapWithConcurrency.ts` (zero callers);
   enqueue-side payload validation (claim-side only today); no test for the per-job
   timeout path; `pollOnce` busy-polls at `minIdleMs` when at capacity.
