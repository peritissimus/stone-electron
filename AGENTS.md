## Complete Architecture Rules — Full Stack Electron App

---

# PART 1: BACKEND (Main Process — Hexagonal Architecture)

---

## 1. Layer Definitions

```
src/main/
├── domain/            # Core business logic (ZERO deps)
├── application/       # Use cases (orchestration)
├── adapters/          # External world connections
├── infrastructure/    # Bootstrap & wiring
└── shared/            # Cross-cutting utilities
```

| Layer              | Purpose                    | Contains                                                |
| ------------------ | -------------------------- | ------------------------------------------------------- |
| **Domain**         | Business logic & contracts | Entities, Value Objects, Domain Services, Ports, Errors |
| **Application**    | Orchestration              | Use Cases, DTOs                                         |
| **Adapters**       | Connect to real world      | In (IPC, HTTP) / Out (DB, APIs, Services)               |
| **Infrastructure** | Wire everything            | DI Container, Config, DB setup, Workers                 |
| **Shared**         | Neutral utilities          | Schema, Logger, Types                                   |

---

## 2. Dependency Rule

```
ALLOWED IMPORTS (→ means "can import")

domain/          → NOTHING
application/     → domain/
adapters/        → domain/, application/
infrastructure/  → Everything
shared/          → NOTHING (only external libs)

FORBIDDEN IMPORTS (✗)

domain/          ✗ application/, adapters/, infrastructure/
application/     ✗ adapters/, infrastructure/
adapters/        ✗ infrastructure/
```

```
┌─────────────────────────────────────────────────┐
│               INFRASTRUCTURE                    │
│                 (imports all)                   │
├─────────────────────────────────────────────────┤
│                  ADAPTERS                       │
│          (imports domain, application)          │
├─────────────────────────────────────────────────┤
│                APPLICATION                      │
│              (imports domain)                   │
├─────────────────────────────────────────────────┤
│                   DOMAIN                        │
│              (imports NOTHING)                  │
└─────────────────────────────────────────────────┘

        Dependencies point INWARD only
```

---

## 3. Domain Layer Rules

```
domain/
├── entities/           # Business objects with identity
├── value-objects/      # Immutable, identity-less values
├── services/           # Pure business logic (no I/O)
├── errors/             # Domain-specific errors
└── ports/
    ├── in/             # What app CAN DO
    └── out/            # What app NEEDS
```

| Component           | Rules                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **Entities**        | Have identity (ID), mutable, contain business behavior             |
| **Value Objects**   | No identity, immutable, validated on creation, comparable by value |
| **Domain Services** | Pure functions, no external deps, business calculations only       |
| **Domain Errors**   | Business rule violations, extend base DomainError                  |
| **Ports/In**        | Interfaces that USE CASES implement                                |
| **Ports/Out**       | Interfaces that ADAPTERS implement                                 |

**Domain MUST:**

- Be pure (no side effects in entities/value objects/services)
- Have zero external imports (no npm packages)
- Define all contracts (ports) for external needs
- Contain all business rules and validations

**Domain MUST NOT:**

- Import from any other layer
- Contain infrastructure concerns (DB, HTTP, IPC)
- Know how it's being used
- Have any I/O operations

---

## 4. Port Rules

```
┌─────────────────────────────────┬───────────────────────────────┐
│           IN PORT               │           OUT PORT            │
├─────────────────────────────────┼───────────────────────────────┤
│ "What can the app DO?"          │ "What does the app NEED?"     │
├─────────────────────────────────┼───────────────────────────────┤
│ Implemented by: Use Cases       │ Implemented by: Adapters/Out  │
├─────────────────────────────────┼───────────────────────────────┤
│ Called by: Adapters/In          │ Called by: Use Cases          │
├─────────────────────────────────┼───────────────────────────────┤
│ Examples:                       │ Examples:                     │
│ • INoteUseCases                 │ • INoteRepository             │
│ • IAuthUseCases                 │ • IFileStorage                │
│ • ISearchUseCases               │ • IEmbedder                   │
└─────────────────────────────────┴───────────────────────────────┘
```

**Port Rules:**

- Ports are ALWAYS interfaces (never concrete classes)
- Ports live in `domain/ports/`
- Ports define the contract, not the implementation
- Naming: `I{Name}` prefix

---

## 5. Application Layer Rules

```
application/
├── usecases/          # Use case implementations (grouped by feature)
└── dto/               # Data transfer objects
```

| Component     | Rules                                                 |
| ------------- | ----------------------------------------------------- |
| **Use Cases** | Implement IN ports, orchestrate domain + OUT ports    |
| **DTOs**      | Simple data structures, no behavior, for input/output |

**Use Cases MUST:**

- Implement an IN port interface
- Receive OUT ports via constructor (DI)
- Orchestrate domain logic + external calls
- Represent a single user action/intent
- Be the BRIDGE between IN and OUT ports

**Use Cases MUST NOT:**

- Contain business rules (delegate to domain)
- Know about delivery mechanism (HTTP, IPC)
- Import from adapters or infrastructure
- Have multiple responsibilities

---

## 6. Use Case vs Domain Service

| Question                      | Use Case | Domain Service |
| ----------------------------- | -------- | -------------- |
| User can directly request it? | ✅ Yes   | ❌ No          |
| Has side effects (DB, API)?   | ✅ Yes   | ❌ No          |
| Orchestrates multiple things? | ✅ Yes   | ❌ No          |
| Pure calculation/logic?       | ❌ No    | ✅ Yes         |
| Needs external dependencies?  | ✅ Yes   | ❌ No          |

**Examples:**

| Domain Service                    | Used By Use Case         |
| --------------------------------- | ------------------------ |
| `NoteScorer.calculateRelevance()` | `SearchNotesUseCase`     |
| `TaskExtractor.extract()`         | `GetAllTasksUseCase`     |
| `SimilarityCalculator.cosine()`   | `GetSimilarNotesUseCase` |

---

## 7. Adapter Rules

```
adapters/
├── in/                # Driving adapters (receive requests)
│   ├── ipc/           # Electron IPC handlers
│   ├── http/          # REST/GraphQL (if needed)
│   └── cli/           # Command line (if needed)
│
└── out/               # Driven adapters (external systems)
    ├── persistence/   # Database repositories
    ├── storage/       # File system
    ├── integrations/  # Third-party libs / OS / ML / git
    └── external/      # Third-party APIs
```

| Adapter Type | Direction     | Purpose                      | Implements               |
| ------------ | ------------- | ---------------------------- | ------------------------ |
| **IN**       | Outside → App | Receive & translate requests | Nothing (calls IN ports) |
| **OUT**      | App → Outside | Fulfill external needs       | OUT ports                |

**Adapter Rules:**

- IN adapters call use cases (via IN port interface)
- OUT adapters implement OUT port interfaces
- Adapters handle all translation (IPC → DTO, Entity → SQL row)
- Adapters are swappable

**Adapters MUST:**

- Depend on port interfaces (not concrete classes)
- Handle all external library usage
- Translate between external format and domain format

**Adapters MUST NOT:**

- Contain business logic
- Import from infrastructure
- Know about other adapters

---

## 8. Infrastructure Layer Rules

```
infrastructure/
├── di/                # Dependency injection container
├── database/          # DB connection, migrations
├── config/            # App configuration
├── workers/           # Background workers
└── electron/          # Electron-specific utilities
```

**Infrastructure MUST:**

- Wire all dependencies together
- Be the only place that instantiates concrete adapters
- Handle app bootstrap/shutdown
- Manage technical cross-cutting concerns

**Infrastructure CAN:**

- Import from any layer
- Know about all concrete implementations

---

## 9. Shared Layer Rules

```
shared/
├── database/          # Drizzle schema (neutral zone)
├── utils/             # Logger, helpers
└── types/             # Shared enums, result types
```

**Shared MUST:**

- Be truly cross-cutting (used by multiple layers)
- Have no business logic
- Be stable (rarely changes)

**Shared MUST NOT:**

- Import from domain, application, adapters, or infrastructure
- Contain domain concepts
- Be a dumping ground

---

## 10. Service Placement Decision

```
Does it need external deps? (APIs, libraries, DB, filesystem)
                │
    ┌───────────┴───────────┐
    │                       │
   NO                      YES
    │                       │
    ▼                       ▼
domain/services/     domain/ports/out/ (interface)
(concrete class)            +
                     adapters/out/ (implementation)
```

| Service                | External Deps | Location                     |
| ---------------------- | ------------- | ---------------------------- |
| `TaskExtractor`        | ❌            | `domain/services/`           |
| `LinkExtractor`        | ❌            | `domain/services/`           |
| `SimilarityCalculator` | ❌            | `domain/services/`           |
| `MarkdownProcessor`    | ✅ unified    | `ports/out` + `adapters/out` |
| `EmbeddingService`     | ✅ ML model   | `ports/out` + `adapters/out` |
| `GitService`           | ✅ simple-git | `ports/out` + `adapters/out` |

---

## 11. Naming Conventions (Backend)

| Type                 | Convention                              | Example                            |
| -------------------- | --------------------------------------- | ---------------------------------- |
| Entity               | PascalCase noun + `Entity` suffix       | `NoteEntity`, `NotebookEntity`     |
| Entity file          | PascalCase noun (no suffix)             | `Note.ts`, `Notebook.ts`           |
| Value Object         | PascalCase noun                         | `NoteId`, `FilePath`               |
| Port Interface       | `I` + PascalCase                        | `INoteRepository`                  |
| Use Case (per-action) | PascalCase verb + `UseCase`            | `UpdateNoteUseCase`, `IndexNoteUseCase` |
| Use Case facade       | PascalCase noun + `UseCases` (plural)  | `INoteUseCases`, `IIndexUseCases`  |
| Domain Service       | PascalCase                              | `TaskExtractor`                    |
| Persistence Adapter  | PascalCase noun + `Repository`          | `NoteRepository`                   |
| IPC Adapter          | PascalCase noun + `IPC`                 | `NoteIPC`                          |
| Other Out Adapter    | Descriptive PascalCase                  | `FileSystemStorage`, `GitClient`, `Embedder`, `Exporter` |
| DTO                  | PascalCase + `DTO`                      | `CreateNoteDTO`                    |
| Domain Error         | PascalCase + `Error`                    | `NoteNotFoundError`                |

**Notes:**

- Entity classes use the `Entity` suffix to disambiguate from wire-type DTOs in `@shared/types` that share the bare noun (e.g. domain `NoteEntity` vs shared `Note` DTO). Files keep the bare noun.
- Persistence adapters omit the tech prefix (e.g. `NoteRepository`, not `DrizzleNoteRepository`) since there is one persistence implementation per repo and no plan to swap. Add a tech prefix only when introducing a parallel implementation (e.g. `InMemoryNoteRepository` for tests).
- Do NOT use generic suffixes like `Service` for adapters — name by the role they play (`Embedder`, `Exporter`, `GitClient`, `SystemBridge`, `FileWatcher`).
- **Use cases**: one class per action (`UpdateNoteUseCase`, `IndexNoteUseCase`, `FinalizeRecordingUseCase`) is the pattern, NOT one mega-class per entity. The grouped IN port (`INoteUseCases`, `IIndexUseCases`) is a facade exposed to IPC adapters — it composes the per-action classes via a `create{Domain}UseCases(deps)` factory in `application/usecases/{domain}/index.ts`. Per-action classes don't need an individual matching `IX` port interface; the facade is the contract. IN adapters depend only on the facade, never on the per-action class or on OUT ports.

### File homogeneity rule (filename case carries meaning)

Every `.ts` file in `src/main` is exactly one of two kinds, and the **filename case tells you which** — no exceptions:

| Filename case | Kind | Shape | Examples |
| ------------- | ---- | ----- | -------- |
| **PascalCase** | A *thing with identity* | Exports **exactly one** class named the same as the file | `CreateNoteUseCase.ts`, `NoteRepository.ts`, `MeetingIPC.ts`, `TaskExtractor.ts` |
| **camelCase** | A *pure helper module* | Exports only functions / consts / types — **no classes** | `hashText.ts`, `journalDate.ts`, `meetingReprocess.ts`, `whisperPaths.ts`, `editorHelpers.ts`, `statusReportPrompts.ts` |

**Therefore:**

- Never put a `class` in a camelCase file, and never put more than one identity-class in a PascalCase file. A topic-file holding several `UseCase` classes (the old `settings/editor.ts` shape) is a violation — split it into one `XxxUseCase.ts` per class.
- Shared private helpers used by 2+ use cases in a feature go in a camelCase helper module beside them (e.g. `application/usecases/settings/editorHelpers.ts`), exported and imported — not duplicated, not buried inside one class file.
- A reader scanning any feature folder can tell entry-point use cases (PascalCase) from plumbing (camelCase) at a glance. Keep every feature folder shaped the same way.

---

## 12. Dependency Injection Rules

```typescript
// infrastructure/di/container.ts

export function createContainer(db: Database) {
  // ORDER MATTERS:

  // 1. Domain services (no deps)
  const taskExtractor = new TaskExtractor();

  // 2. OUT adapters (implement OUT ports)
  const noteRepo = new DrizzleNoteRepository(db);
  const markdownProcessor = new UnifiedMarkdownProcessor();

  // 3. Use cases (implement IN ports, receive OUT ports)
  const noteUseCases = new NoteUseCases(noteRepo, markdownProcessor);

  // 4. IN adapters (receive use cases)
  const noteIPC = new NoteIPC(noteUseCases);

  return { noteIPC };
}
```

**DI Rules:**

- Instantiation order: Domain Services → OUT Adapters → Use Cases → IN Adapters
- Only infrastructure creates concrete instances
- Dependencies flow via constructor injection
- Always inject interfaces, never concrete classes

---

## 13. Testing Rules (Backend)

| Layer        | Test Type   | Mocking Strategy           |
| ------------ | ----------- | -------------------------- |
| Domain       | Unit        | No mocks (pure)            |
| Application  | Unit        | Mock OUT ports             |
| Adapters/In  | Integration | Mock use cases             |
| Adapters/Out | Integration | Real DB or test containers |
| Full Flow    | E2E         | No mocks                   |

---

## 14. Development Order (Backend)

```
PHASE 1: Domain
─────────────────
1. Entities
2. Value Objects
3. Domain Errors
4. Ports/Out (what you need)
5. Ports/In (what you offer)
6. Domain Services (if any)

PHASE 2: Application
─────────────────────
7. DTOs
8. Use Cases

PHASE 3: Adapters
──────────────────
9. Out Adapters (DB, APIs)
10. In Adapters (IPC)

PHASE 4: Infrastructure
────────────────────────
11. DI Container
12. Database setup
13. Config
14. Entry point
```

---

# PART 2: FRONTEND (Renderer Process — React)

---

## 15. Frontend Layer Definitions

```
src/renderer/
├── api/               # IPC calls to main process
├── stores/            # State management (Zustand)
├── hooks/             # React hooks
├── components/        # UI components
├── pages/             # Route-level components
├── types/             # Frontend-specific types
└── utils/             # Frontend utilities
```

| Layer          | Purpose           | Contains                                      |
| -------------- | ----------------- | --------------------------------------------- |
| **API**        | IPC communication | Thin wrappers around `window.electron.invoke` |
| **Stores**     | State management  | Zustand stores, actions, state                |
| **Hooks**      | React integration | Lifecycle, side effects, combine stores       |
| **Components** | UI rendering      | Presentational + container components         |
| **Pages**      | Route views       | Top-level page components                     |
| **Types**      | Frontend types    | UI-specific interfaces                        |
| **Utils**      | Helpers           | Formatters, constants                         |

---

## 16. Frontend Dependency Rule

```
ALLOWED:

Components   → Hooks
Hooks        → Stores, API
Stores       → API
API          → IPC (window.electron)

FORBIDDEN:

Components   ✗ Stores (directly)
Components   ✗ API (directly)
Stores       ✗ React hooks
API          ✗ State management
```

Hook dependency rule:

- Data/state hooks go through stores when they read or mutate shared renderer state.
- Command/service hooks may call API directly when they do not own shared state.
- Components and pages still never import stores or API directly.

```
┌─────────────────────────────────────────────────┐
│               COMPONENTS                        │
│              (uses hooks)                       │
├─────────────────────────────────────────────────┤
│                  HOOKS                          │
│       (state hooks use stores; command hooks    │
│        may call api directly)                   │
├─────────────────────────────────────────────────┤
│                 STORES                          │
│              (uses api)                         │
├─────────────────────────────────────────────────┤
│                   API                           │
│             (uses IPC)                          │
└─────────────────────────────────────────────────┘

        Data flows DOWN, Actions flow UP
```

---

## 17. API Layer Rules

```typescript
// renderer/api/noteApi.ts
```

**API Layer MUST:**

- Be thin wrappers around IPC calls
- Return promises
- Handle IPC channel names
- Type inputs and outputs

**API Layer MUST NOT:**

- Hold state
- Contain business logic
- Transform data (beyond serialization)
- Know about React

**Structure:**

```typescript
export const noteApi = {
  create: (input) => window.electron.invoke('note:create', input),
  getById: (id) => window.electron.invoke('note:getById', id),
  getAll: () => window.electron.invoke('note:getAll'),
  update: (input) => window.electron.invoke('note:update', input),
  delete: (id) => window.electron.invoke('note:delete', id),

  // Event subscriptions
  onCreated: (cb) => window.electron.on('note:created', cb),
  onUpdated: (cb) => window.electron.on('note:updated', cb),
};
```

---

## 18. Store Layer Rules

```typescript
// renderer/stores/noteStore.ts
```

**Stores MUST:**

- Hold application state
- Provide actions that call API
- Update state after API calls
- Be the single source of truth
- Handle loading/error states

**Stores MUST NOT:**

- Use React hooks
- Import from components
- Know about UI/rendering
- Contain UI-only state (use separate uiStore)

**Structure:**

```typescript
interface NoteState {
  // State
  notes: Note[];
  activeNoteId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchNotes: () => Promise<void>;
  createNote: (input) => Promise<Note>;
  updateNote: (input) => Promise<void>;
  deleteNote: (id) => Promise<void>;
  setActiveNote: (id) => void;

  // Event handlers (for main process events)
  _onNoteCreated: (note) => void;
  _onNoteUpdated: (note) => void;
}
```

---

## 19. Hooks Layer Rules

```typescript
// renderer/hooks/useNotes.ts
```

**Hooks MUST:**

- Combine store state + actions
- Handle React lifecycle (useEffect)
- Subscribe to main process events
- Provide clean interface to components

**Hooks MUST NOT:**

- Call API directly (go through store)
- Contain business logic
- Render anything

**Types of Hooks:**

| Hook Type    | Purpose             | Example                        |
| ------------ | ------------------- | ------------------------------ |
| Data hooks   | Fetch + return data | `useNotes()`, `useNote(id)`    |
| Action hooks | Provide actions     | `useNoteActions()`             |
| Filter hooks | Derived data        | `useNotebookNotes(notebookId)` |
| UI hooks     | UI behavior         | `useKeyboardShortcuts()`       |

**Structure:**

```typescript
export function useNotes() {
  const store = useNoteStore();

  // Lifecycle
  useEffect(() => {
    store.fetchNotes();
  }, []);

  // Event subscriptions
  useEffect(() => {
    const unsub = noteApi.onCreated(store._onNoteCreated);
    return () => unsub();
  }, []);

  return {
    notes: store.notes,
    isLoading: store.isLoading,
    createNote: store.createNote,
    // ...
  };
}
```

---

## 20. Component Layer Rules

```
components/
├── common/            # Shared UI (Button, Modal, Input)
├── notes/             # Note-specific components
├── notebooks/         # Notebook-specific components
├── sidebar/           # Sidebar components
└── layout/            # Layout components
```

**Components MUST:**

- Use hooks for data/actions
- Be focused on rendering
- Handle user interactions
- Be composable

**Components MUST NOT:**

- Import from stores directly
- Import from API directly
- Contain business logic
- Make IPC calls

**Component Types:**

| Type           | Purpose                 | Data Source         |
| -------------- | ----------------------- | ------------------- |
| Presentational | Pure UI, receives props | Props only          |
| Container      | Connects to hooks       | Hooks               |
| Page           | Route-level             | Hooks + composition |

---

## 21. Frontend Data Flow

```
User Action
     │
     ▼
┌──────────────┐
│  Component   │  onClick={() => createNote(input)}
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Hook      │  useNotes().createNote()
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Store     │  noteStore.createNote()
└──────┬───────┘
       │
       ▼
┌──────────────┐
│     API      │  noteApi.create()
└──────┬───────┘
       │
       ▼
═══════════════════════ IPC ═══════════════════════
       │
       ▼
┌──────────────┐
│  Adapter/In  │  NoteIPC
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Use Case   │  NoteUseCases.createNote()
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Adapter/Out │  DrizzleNoteRepository.save()
└──────────────┘
```

---

## 22. Naming Conventions (Frontend)

| Type      | Convention                   | Example                     |
| --------- | ---------------------------- | --------------------------- |
| API       | camelCase + `Api`            | `noteApi`, `searchApi`      |
| Store     | `use` + PascalCase + `Store` | `useNoteStore`              |
| Hook      | `use` + PascalCase           | `useNotes`, `useSearch`     |
| Component | PascalCase                   | `NoteList`, `NoteEditor`    |
| Page      | PascalCase + `Page`          | `NotesPage`, `SettingsPage` |
| Type      | PascalCase                   | `NoteListProps`             |

---

## 23. State Management Rules

**What goes WHERE:**

| State Type      | Location         | Example                  |
| --------------- | ---------------- | ------------------------ |
| Server data     | Feature stores   | `noteStore.notes`        |
| Active/selected | Feature stores   | `noteStore.activeNoteId` |
| Loading/error   | Feature stores   | `noteStore.isLoading`    |
| UI-only state   | `uiStore`        | `uiStore.sidebarOpen`    |
| Form state      | Local `useState` | Input values             |
| Derived data    | Selectors/hooks  | `useNotebookNotes()`     |

**Store Separation:**

```
stores/
├── noteStore.ts         # Notes data + actions
├── notebookStore.ts     # Notebooks data + actions
├── workspaceStore.ts    # Workspace data + actions
├── searchStore.ts       # Search state + actions
└── uiStore.ts           # UI-only state (modals, sidebar)
```

---

# PART 3: SHARED (Between Processes)

---

## 24. Shared Layer Rules

```
src/shared/
├── types/              # Shared interfaces/types
│   ├── note.ts         # Note, CreateNoteInput, etc.
│   ├── notebook.ts
│   └── index.ts
│
└── constants/          # Shared constants
    └── channels.ts     # IPC channel names
```

**Shared MUST:**

- Contain types used by BOTH main and renderer
- Contain IPC channel name constants
- Be serializable (no classes, only interfaces)

**Shared MUST NOT:**

- Contain implementation
- Import from main or renderer
- Contain React or Electron specific code

---

## 25. IPC Channel Rules

```typescript
// shared/constants/channels.ts

export const NOTE_CHANNELS = {
  CREATE: 'note:create',
  GET_BY_ID: 'note:getById',
  GET_ALL: 'note:getAll',
  UPDATE: 'note:update',
  DELETE: 'note:delete',
  // Events (main → renderer)
  CREATED: 'note:created',
  UPDATED: 'note:updated',
  DELETED: 'note:deleted',
} as const;
```

**Rules:**

- Single source of truth for channel names
- Use in both main (IPC handlers) and renderer (API)
- Naming: `feature:action` pattern
- Events use past tense: `note:created`

---

# PART 4: COMPLETE STRUCTURE

---

## 26. Full Project Structure

```
src/
│
├── main/                            # MAIN PROCESS
│   ├── index.ts                     # Electron main entry
│   │
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── services/
│   │   ├── errors/
│   │   └── ports/
│   │       ├── in/
│   │       └── out/
│   │
│   ├── application/
│   │   ├── usecases/
│   │   └── dto/
│   │
│   ├── adapters/
│   │   ├── in/
│   │   │   └── ipc/
│   │   └── out/
│   │       ├── persistence/
│   │       ├── storage/
│   │       └── services/
│   │
│   ├── infrastructure/
│   │   ├── di/
│   │   ├── database/
│   │   ├── config/
│   │   └── workers/
│   │
│   └── shared/
│       ├── database/
│       ├── utils/
│       └── types/
│
├── renderer/                        # RENDERER PROCESS
│   ├── index.tsx                    # React entry
│   ├── App.tsx
│   │
│   ├── api/                         # IPC client
│   ├── stores/                      # Zustand stores
│   ├── hooks/                       # React hooks
│   ├── components/                  # UI components
│   ├── pages/                       # Route pages
│   ├── types/                       # Frontend types
│   └── utils/                       # Frontend utils
│
├── shared/                          # SHARED
│   ├── types/                       # Shared types (DTOs)
│   └── constants/                   # IPC channels
│
└── preload/                         # PRELOAD
    └── index.ts                     # window.electron exposure
```

---

## 27. The Golden Rules

```
BACKEND (Hexagonal):

1. DEPENDENCIES POINT INWARD
   Infrastructure → Adapters → Application → Domain

2. DOMAIN IS SACRED
   Zero external deps, pure business logic only

3. PORTS ARE CONTRACTS
   IN = what app does, OUT = what app needs

4. USE CASES ARE THE BRIDGE
   They implement IN ports and use OUT ports

5. ADAPTERS ARE SWAPPABLE
   Change DB, API, or delivery without touching domain


FRONTEND (React):

6. COMPONENTS USE HOOKS
   Never access stores or API directly

7. HOOKS COMBINE STORES + LIFECYCLE
   They're the glue between React and state

8. STORES OWN STATE + ACTIONS
   Single source of truth, call API

9. API IS THIN
   Just IPC wrappers, no logic


BOTH:

10. SHARED IS MINIMAL
    Only types and constants used by both

11. IPC IS THE BOUNDARY
    Main ↔ Renderer communication via channels

12. SINGLE RESPONSIBILITY
    Each file/class does one thing well
```

---

## 28. Quick Decision Reference

| Need To...               | Backend Location                           | Frontend Location |
| ------------------------ | ------------------------------------------ | ----------------- |
| Add entity               | `domain/entities/`                         | —                 |
| Add business rule        | `domain/services/` or entity               | —                 |
| Add external integration | `ports/out/` + `adapters/out/`             | —                 |
| Add user action          | `ports/in/` + `usecases/` + `adapters/in/` | —                 |
| Add IPC handler          | `adapters/in/ipc/`                         | `api/`            |
| Add state                | —                                          | `stores/`         |
| Add React behavior       | —                                          | `hooks/`          |
| Add UI                   | —                                          | `components/`     |
| Share types              | `shared/types/`                            | `shared/types/`   |

### Settings storage rule

Editor settings, keyboard shortcuts, and any other typed user preferences live **only** in `AppConfig` (`config.json`) via `IAppConfigRepository`. Do **not** add new editor- or shortcut-related rows to the DB `settings` table or `ISettingsRepository`. The DB-backed settings path remains for legacy free-form key/value preferences only; new preference categories should extend `AppConfig` and be managed by typed use cases under `application/usecases/settings/` that emit `settings:changed` domain events with a discriminating `scope`.

---

## 29. Anti-Patterns to Avoid

| Anti-Pattern                   | Layer    | Solution                      |
| ------------------------------ | -------- | ----------------------------- |
| Domain imports adapter         | Backend  | Use ports                     |
| Business logic in adapter      | Backend  | Move to domain/use case       |
| Use case knows IPC/HTTP        | Backend  | Use DTOs                      |
| Component calls API directly   | Frontend | Use hooks                     |
| Component imports store        | Frontend | Use hooks                     |
| Store uses React hooks         | Frontend | Keep store pure               |
| Logic in API layer             | Frontend | Move to store                 |
| Shared contains implementation | Shared   | Only types/constants          |
| God use case                   | Backend  | Split by responsibility       |
| God component                  | Frontend | Split into smaller components |

---

## 30. Testing Strategy

| Layer        | Test Type   | What to Mock        |
| ------------ | ----------- | ------------------- |
| Domain       | Unit        | Nothing             |
| Application  | Unit        | OUT ports           |
| Adapters/In  | Integration | Use cases           |
| Adapters/Out | Integration | DB (test container) |
| API          | Unit        | IPC                 |
| Stores       | Unit        | API                 |
| Hooks        | Unit        | Stores              |
| Components   | Unit        | Hooks               |
| E2E          | E2E         | Nothing             |

---
