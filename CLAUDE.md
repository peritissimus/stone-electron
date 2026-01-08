# Stone - Development Guide for Claude

---

### 1. Layer Definitions

```
src/hex/
├── domain/            # Core business logic
├── application/       # Use cases (orchestration)
├── adapters/          # External world connections
├── infrastructure/    # Bootstrap & wiring
└── shared/            # Cross-cutting utilities
```

| Layer              | Purpose                    | Contains                                        |
| ------------------ | -------------------------- | ----------------------------------------------- |
| **Domain**         | Business logic & contracts | Entities, Value Objects, Domain Services, Ports |
| **Application**    | Orchestration              | Use Cases, DTOs                                 |
| **Adapters**       | Connect to real world      | In (IPC, HTTP) / Out (DB, APIs)                 |
| **Infrastructure** | Wire everything            | DI Container, Config, DB setup                  |
| **Shared**         | Neutral utilities          | Logger, Schema, Types                           |

---

### 2. Dependency Rule

```
ALLOWED IMPORTS (→ means "can import")

domain/          → NOTHING (zero external deps)
application/     → domain/
adapters/        → domain/, application/
infrastructure/  → Everything
shared/          → NOTHING (or only external libs)

FORBIDDEN IMPORTS (✗)

domain/          ✗ application/, adapters/, infrastructure/
application/     ✗ adapters/, infrastructure/
adapters/        ✗ infrastructure/
```

**Visual:**

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
│              (imports nothing)                  │
└─────────────────────────────────────────────────┘

        Dependencies point INWARD only
```

---

### 3. Domain Layer Rules

```
domain/
├── entities/           # Business objects with behavior
├── value-objects/      # Immutable, identity-less values
├── services/           # Pure business logic
├── errors/             # Domain-specific errors
└── ports/
    ├── in/             # What app CAN DO (interfaces)
    └── out/            # What app NEEDS (interfaces)
```

| Component           | Rules                                                   |
| ------------------- | ------------------------------------------------------- |
| **Entities**        | Have identity, mutable, contain business logic          |
| **Value Objects**   | No identity, immutable, validated on creation           |
| **Domain Services** | Pure functions, no external deps, business calculations |
| **Ports/In**        | Interfaces that USE CASES implement                     |
| **Ports/Out**       | Interfaces that ADAPTERS implement                      |

**Domain MUST:**

- Be pure (no side effects in entities/value objects/services)
- Have zero external imports (no npm packages)
- Define all contracts (ports) for external needs

**Domain MUST NOT:**

- Import from any other layer
- Contain infrastructure concerns (DB, HTTP, etc.)
- Know how it's being used (IPC vs HTTP vs CLI)

---

### 4. Port Rules

```
┌─────────────────────────────────────────────────────────────────┐
│                         PORTS                                   │
├─────────────────────────────────┬───────────────────────────────┤
│           IN                    │            OUT                │
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
│ • INotebookUseCases             │ • IEmailService               │
│                                 │ • ISearchEngine               │
└─────────────────────────────────┴───────────────────────────────┘
```

**Port Rules:**

- Ports are ALWAYS interfaces (never concrete classes)
- Ports live in `domain/ports/`
- Ports define the contract, not the implementation
- Naming: `I{Name}` prefix (e.g., `INoteRepository`)

---

### 5. Application Layer Rules

```
application/
├── usecases/          # Use case implementations
└── dto/               # Data transfer objects
```

| Component     | Rules                                               |
| ------------- | --------------------------------------------------- |
| **Use Cases** | Implement IN ports, orchestrate business operations |
| **DTOs**      | Simple data structures for input/output             |

**Use Cases MUST:**

- Implement an IN port interface
- Receive OUT ports via constructor (dependency injection)
- Orchestrate domain logic + external calls
- Represent a single user action/intent

**Use Cases MUST NOT:**

- Contain business rules (delegate to domain)
- Know about delivery mechanism (HTTP, IPC, etc.)
- Import from adapters or infrastructure

**Use Case vs Domain Service:**

| Question                      | Use Case | Domain Service |
| ----------------------------- | -------- | -------------- |
| User can directly request it? | ✅ Yes   | ❌ No          |
| Has side effects?             | ✅ Yes   | ❌ No          |
| Orchestrates multiple things? | ✅ Yes   | ❌ No          |
| Pure calculation?             | ❌ No    | ✅ Yes         |

---

### 6. Adapter Rules

```
adapters/
├── in/                # Driving adapters (receive requests)
│   ├── ipc/           # Electron IPC handlers
│   ├── http/          # REST/GraphQL controllers
│   └── cli/           # Command line interface
│
└── out/               # Driven adapters (external systems)
    ├── persistence/   # Database implementations
    ├── storage/       # File system
    ├── external/      # Third-party APIs
    └── search/        # Search engines
```

| Adapter Type | Direction     | Purpose                      | Implements               |
| ------------ | ------------- | ---------------------------- | ------------------------ |
| **IN**       | Outside → App | Receive & translate requests | Nothing (calls IN ports) |
| **OUT**      | App → Outside | Fulfill external needs       | OUT ports                |

**Adapter Rules:**

- IN adapters call use cases (via IN port interface)
- OUT adapters implement OUT port interfaces
- Adapters handle all translation (HTTP → DTO, Entity → SQL)
- Adapters are swappable (that's the point)

**Adapters MUST:**

- Depend on port interfaces (not concrete classes)
- Handle all external library usage
- Translate between external format and domain format

**Adapters MUST NOT:**

- Contain business logic
- Import from infrastructure
- Know about other adapters

---

### 7. Infrastructure Layer Rules

```
infrastructure/
├── di/                # Dependency injection container
├── database/          # DB connection, migrations
├── config/            # App configuration
└── workers/           # Background workers
```

**Infrastructure MUST:**

- Wire all dependencies together
- Be the only place that instantiates adapters
- Handle app bootstrap/shutdown

**Infrastructure CAN:**

- Import from any layer
- Know about concrete implementations

---

### 8. Shared Layer Rules

```
shared/
├── database/          # Drizzle schema (neutral zone)
├── logger/            # Logging utility
├── types/             # Shared TypeScript types
└── utils/             # Generic utilities
```

**Shared MUST:**

- Be truly cross-cutting (used by multiple layers)
- Have no business logic
- Be stable (rarely changes)

**Shared MUST NOT:**

- Import from domain, application, adapters, or infrastructure
- Contain domain concepts

---

### 9. Service Placement Rules

```
┌─────────────────────────────────────────────────────────────────┐
│              WHERE DOES THIS SERVICE GO?                        │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
                    Does it need external deps?
                    (APIs, libraries, DB, filesystem)
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
                   NO                          YES
                    │                           │
                    ▼                           ▼
           domain/services/          domain/ports/out/ (interface)
           (concrete class)                    +
                                     adapters/out/ (implementation)
```

| Service Type            | External Deps | Location                     |
| ----------------------- | ------------- | ---------------------------- |
| `NoteScorer`            | ❌            | `domain/services/`           |
| `SlugGenerator`         | ❌            | `domain/services/`           |
| `PriceCalculator`       | ❌            | `domain/services/`           |
| `ClassificationService` | ✅ OpenAI     | `ports/out` + `adapters/out` |
| `MarkdownProcessor`     | ✅ unified    | `ports/out` + `adapters/out` |
| `SearchEngine`          | ✅ MiniSearch | `ports/out` + `adapters/out` |
| `EmbeddingService`      | ✅ API        | `ports/out` + `adapters/out` |

---

### 10. Naming Conventions

| Type               | Convention                    | Example                                                |
| ------------------ | ----------------------------- | ------------------------------------------------------ |
| **Entity**         | PascalCase, noun              | `Note`, `Notebook`, `User`                             |
| **Value Object**   | PascalCase, noun              | `NoteId`, `Email`, `Money`                             |
| **Port Interface** | `I` + PascalCase              | `INoteRepository`, `INoteUseCases`                     |
| **Use Case**       | PascalCase + `UseCases`       | `NoteUseCases`, `AuthUseCases`                         |
| **Adapter**        | Implementation + Adapter/Impl | `DrizzleNoteRepository`, `OpenAIClassificationService` |
| **DTO**            | PascalCase + `DTO`            | `CreateNoteDTO`, `NoteResponseDTO`                     |
| **Domain Error**   | PascalCase + `Error`          | `NoteNotFoundError`, `InvalidEmailError`               |

---

### 11. Dependency Injection Rules

```typescript
// infrastructure/di/container.ts

export function createContainer(db: Database, config: Config) {
  // 1. Domain services (no deps - can instantiate directly)
  const noteScorer = new NoteScorer();

  // 2. OUT adapters (implement OUT ports)
  const noteRepo = new DrizzleNoteRepository(db);
  const classifier = new OpenAIClassificationService(config.apiKey);

  // 3. Use cases (receive OUT ports via constructor)
  const noteUseCases = new NoteUseCases(noteRepo, classifier, noteScorer);

  // 4. IN adapters (receive use cases via constructor)
  const noteIPC = new NoteIPC(noteUseCases);

  return { noteIPC };
}
```

**DI Rules:**

- Instantiation order: Domain Services → OUT Adapters → Use Cases → IN Adapters
- Only infrastructure creates concrete instances
- Dependencies flow via constructor injection
- Use interfaces, not concrete classes

---

### 12. Testing Rules

| Layer            | Test Type   | Mocking Strategy                   |
| ---------------- | ----------- | ---------------------------------- |
| **Domain**       | Unit        | No mocks needed (pure)             |
| **Application**  | Unit        | Mock OUT ports                     |
| **Adapters/In**  | Integration | Mock use cases                     |
| **Adapters/Out** | Integration | Real DB/service or test containers |
| **Full Flow**    | E2E         | No mocks                           |

```typescript
// Testing use case - mock OUT ports only
describe('NoteUseCases', () => {
  it('creates note', async () => {
    const mockRepo: INoteRepository = {
      save: vi.fn(),
      findById: vi.fn(),
    };

    const useCases = new NoteUseCases(mockRepo);
    await useCases.createNote({ title: 'Test', content: 'Hello' });

    expect(mockRepo.save).toHaveBeenCalled();
  });
});
```

---

### 13. File/Folder Rules

```
✅ DO:
- One entity/class per file
- Index files for clean exports
- Group by feature within layers
- Keep related things close

❌ DON'T:
- Create deeply nested folders
- Put multiple entities in one file
- Create circular dependencies
- Mix concerns in single file
```

---

### 14. Development Order

```
PHASE 1: Domain (Define WHAT)
─────────────────────────────
1. Entities
2. Value Objects
3. Domain Errors
4. Ports/Out (what you need)
5. Ports/In (what you offer)
6. Domain Services (if any)

PHASE 2: Application (Define HOW)
─────────────────────────────────
7. DTOs
8. Use Cases

PHASE 3: Adapters (Connect to REAL WORLD)
─────────────────────────────────────────
9. Out Adapters (DB, APIs)
10. In Adapters (IPC, HTTP)

PHASE 4: Infrastructure (WIRE it up)
────────────────────────────────────
11. DI Container
12. Database setup
13. Config
14. Entry point (main.ts)
```

---

### 15. Quick Decision Reference

| When Adding...  | Create In Order                                                                       |
| --------------- | ------------------------------------------------------------------------------------- |
| New Entity      | `entities/` → `ports/out` (repo) → `ports/in` (use cases) → `usecases/` → `adapters/` |
| New Feature     | `ports/in` (interface) → `usecases/` (impl) → `adapters/in` (expose)                  |
| New Integration | `ports/out` (interface) → `adapters/out` (impl) → wire in DI                          |
| New Calculation | `domain/services/` (if pure)                                                          |

---

### 16. Anti-Patterns to Avoid

| Anti-Pattern                   | Problem                   | Solution                      |
| ------------------------------ | ------------------------- | ----------------------------- |
| Domain imports adapter         | Breaks dependency rule    | Use ports                     |
| Business logic in adapter      | Logic scattered           | Move to domain/use case       |
| Use case knows about HTTP      | Coupled to delivery       | Use DTOs                      |
| Concrete classes in use case   | Hard to test/swap         | Inject interfaces             |
| God use case                   | Too many responsibilities | Split into focused use cases  |
| Anemic domain                  | Entities are just data    | Add behavior to entities      |
| Shared becoming dumping ground | Unclear boundaries        | Be strict about what's shared |

---

### 17. The Golden Rules

```
1. DEPENDENCIES POINT INWARD
   Infrastructure → Adapters → Application → Domain

2. DOMAIN IS SACRED
   Zero external deps, pure business logic only

3. PORTS ARE CONTRACTS
   IN = what app does, OUT = what app needs

4. ADAPTERS ARE SWAPPABLE
   Change DB, API, or UI without touching domain

5. USE CASES ORCHESTRATE
   They coordinate, domain decides

6. INFRASTRUCTURE WIRES
   Only place that knows all concrete implementations

7. TEST FROM INSIDE OUT
   Domain (unit) → Application (unit) → Adapters (integration) → E2E
```

---

This is the complete rulebook. Print it, reference it, internalize it. 🎯
