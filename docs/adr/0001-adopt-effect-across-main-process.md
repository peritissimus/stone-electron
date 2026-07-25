# ADR-0001: Adopt Effect across the main process

## Status

Accepted (2026-07-25)

## Context

The 2026-07-25 architecture review found that the main process has organically
re-invented a large fraction of an effect system, in nine incompatible pieces:

- Nine independent error/retry/cancellation mechanisms that do not compose:
  job-queue backoff (`Job.ts`), JobRunner's per-job timeout and capacity loop,
  `recoverStale`, SupervisedProcess's circuit breaker/backoff/grace,
  WhisperServer's chunk timeout + session kill-switch, `withRetry`,
  `mapWithConcurrency`, and renderer-side single-flight guards.
- `withTimeout` implemented four times, `sleep`/`delay` three times.
- Errors swallowed at the job seam: `FinalizeRecordingUseCase` catches all
  pipeline errors and returns normally, so JobRunner marks failed jobs `done`
  and its retry/dead-letter machinery is unreachable for the only registered
  job type.
- Cancellation never crosses a module seam: `JobContext.signal` is dropped by
  the only handler; no `AbortSignal` reaches the transcriber.
- Shutdown ordering bug: the database closes before workers stop; JobRunner's
  final save hits a closed DB and the error is swallowed.
- Wire types copied four times (Swift bridge, adapter, port, `shared/types`)
  with Zod validation applied inconsistently at the renderer edge.
- The DI container is ~750 lines of hand-wiring whose instantiation order is
  enforced by a comment.
- JobRunner — the module deciding whether a meeting gets transcribed — has
  zero tests; debounce/throttle/backoff logic is untestable without an
  injectable clock.

These are precisely the concerns Effect solves with one composable model:
typed error channel, structured concurrency/interruption, `Schedule`,
`Layer`, `Scope`/`acquireRelease`, `Semaphore`, Effect Schema, and
`TestClock`.

## Decision

Rewrite the **main process** Effect-native, subsystem by subsystem behind the
existing hexagonal ports.

1. **Domain import allowlist.** `src/main/domain` may import from the
   `effect` package only: `Data`, `Schema`, `Option`, `Either`, `Context`,
   and the `Effect` type (in port signatures only). All `@effect/*` scoped
   packages, `Layer`, `Schedule`, `Queue`, `Ref`, `Fiber`, `Clock`, and every
   `Effect.run*` remain banned from domain. Domain stays pure and
   synchronous: it decides, it never does.
2. **Ports become `Context.Tag`s.** Port method signatures return
   `Effect<A, E>` with `R = never` — a port describes a capability and its
   failure modes, never its own dependencies. Requirements accumulate only in
   application-layer compositions.
3. **Domain errors become `Data.TaggedError`; value objects use
   `Schema` branded types.** Entity business logic stays synchronous;
   fallible pure transitions return `Either`.
4. **`Layer` replaces the hand-wired DI container.** Adapters are provided as
   layers; test fakes are alternative layers. The runtime is invoked only at
   edges: IPC handlers, the entry point, and worker bootstraps.
5. **Effect Schema replaces Zod** as the single source for wire types,
   validated at both IPC edges.
6. **The renderer is excluded.** It keeps React + Zustand; Effect runs only
   inside the renderer `api/` layer at the IPC edge. The renderer's store
   repetition is a separate problem (deep entity-store factory) that Effect
   does not address, and Effect-in-React is the least mature part of the
   ecosystem.
7. **Migration order.** Jobs/workers subsystem first (JobRunner,
   SupervisedProcess, WhisperServer) behind the existing `IJobQueue` /
   `ILiveTranscriber` ports — self-contained, zero existing unit tests to
   rewrite, and the densest concentration of Effect-shaped problems. Then
   out-adapters, then use cases; domain errors/schemas are converted as their
   consumers migrate.
8. **Enforcement lands with the first migration PR**: an ESLint
   `no-restricted-imports` scope allowlisting the six modules for
   `src/main/domain`, plus an architecture test asserting no `Effect.run` or
   `Layer` reference appears under `domain/`.

## Consequences

Positive:

- One failure/concurrency model replaces nine; the swallowed-error class of
  bug becomes a visible type-level decision.
- Interruption propagates across every seam without hand-threading
  `AbortSignal`.
- Finalizer ordering makes the DB-closed-before-workers-stopped bug
  structurally impossible.
- `TestClock` makes every timeout/backoff/debounce deterministic and
  testable; test fakes become alternative layers instead of hand-built mocks.
- Roughly 1,000–1,500 lines of the hardest-to-get-right plumbing
  (retry.ts, mapWithConcurrency, tracer shims, timeout/sleep copies,
  in-flight guards, most of the DI container) are deleted.

Accepted costs:

- CLAUDE.md rule 2 ("domain imports NOTHING") is amended to the allowlist
  above; the class-per-file conventions will need revisiting where idiomatic
  Effect is service/Layer-shaped rather than class-shaped.
- Learning curve: generators, fiber semantics, `Layer` composition; fiber
  stack traces in crash logs. Effect idioms are less represented in AI
  training data, so agent assistance will be weaker here initially.
- Interruption actually firing will surface latent bugs in code that relied
  on never being cancelled — expect a tail of behavior changes; the e2e suite
  (plus characterization tests around finalize) is the safety net.
- The renderer's 21-store/14-hook repetition is explicitly NOT addressed by
  this decision.

## Alternatives considered

- **Plain-TS consolidation** (one shared timeout/retry/delay toolkit, fix the
  error propagation and signal threading by hand): fixes the confirmed bugs
  cheaply but keeps failure handling as convention rather than contract, and
  leaves cancellation, resource ordering, and clock injection as ongoing
  hand-maintenance. Rejected in favor of full adoption.
- **Promise-based ports with `Effect.tryPromise` lifting in the application
  layer** (keeps `effect` out of domain entirely): strips typed errors and
  interruption off every port signature — fencing the migration's main
  benefit out of the layer that defines all contracts. Rejected.
- **Effect in the renderer as well** (effect-rx or similar): deferred; least
  mature ecosystem edge, smallest payoff, and the renderer's actual pain is
  store-template repetition.
