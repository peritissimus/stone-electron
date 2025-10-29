# Stone Note-Taking App - High-Level Design Document

## 1. Architecture Overview

Stone is a production-ready Electron-based note-taking application with a comprehensive database management system, migration framework, and advanced search capabilities.

### System Architecture Diagram

```mermaid
graph TB
    subgraph "Presentation Layer"
        UI["React 18 UI Components<br/>Tailwind CSS + Shadcn/ui"]
        TitleBar["Custom Title Bar<br/>with Menu Integration"]
        Editor["Rich Text Editor<br/>TipTap + Markdown"]
    end

    subgraph "Renderer Process"
        RenderStore["Zustand Store<br/>State Management"]
        RenderIPC["IPC Client<br/>Message Handlers"]
        RenderUtils["Utils & Helpers"]
    end

    subgraph "Main Process"
        MainIPC["IPC Server<br/>Route Handlers"]
        DatabaseManager["Database Manager<br/>Migrations & Integrity"]
        SearchEngine["Search Engine<br/>FTS + Vector DB"]
        BackupSystem["Backup Manager<br/>Auto/Manual Backups"]
    end

    subgraph "Data Layer"
        SQLiteDB["Better-SQLite3<br/>Primary Database"]
        VectraDB["Vectra Vector DB<br/>Semantic Search"]
        FileSystem["File System<br/>Attachments"]
    end

    subgraph "External Services"
        Transformers["Xenova Transformers<br/>Embeddings Generation"]
        Electron["Electron APIs<br/>App Lifecycle"]
    end

    UI --> RenderStore
    UI --> Editor
    UI --> TitleBar
    RenderStore --> RenderIPC
    Editor --> RenderIPC
    RenderIPC --> MainIPC
    MainIPC --> DatabaseManager
    MainIPC --> SearchEngine
    MainIPC --> BackupSystem
    DatabaseManager --> SQLiteDB
    SearchEngine --> SQLiteDB
    SearchEngine --> VectraDB
    SearchEngine --> Transformers
    BackupSystem --> SQLiteDB
    SQLiteDB --> FileSystem
    Electron -.-> MainIPC
```

## 2. Database Architecture

### 2.1 Schema Diagram

```mermaid
erDiagram
    NOTEBOOKS ||--o{ NOTES : contains
    NOTEBOOKS ||--o{ NOTEBOOKS : parent
    NOTES ||--o{ NOTE_TAGS : has
    TAGS ||--o{ NOTE_TAGS : assigned
    NOTES ||--o{ NOTE_LINKS : source
    NOTES ||--o{ NOTE_LINKS : target
    NOTES ||--o{ ATTACHMENTS : contains
    NOTES ||--o{ NOTE_VERSIONS : tracks
    SETTINGS ||--o{ SCHEMA_MIGRATIONS : tracks

    NOTEBOOKS {
        string id PK
        string name
        string icon
        string color
        string parent_id FK
        integer position
        integer created_at
        integer updated_at
    }

    NOTES {
        string id PK
        string title
        text content
        string notebook_id FK
        boolean is_favorite
        boolean is_pinned
        boolean is_archived
        boolean is_deleted
        integer deleted_at
        integer created_at
        integer updated_at
    }

    TAGS {
        string id PK
        string name UK
        string color
        integer created_at
    }

    NOTE_TAGS {
        string note_id FK
        string tag_id FK
    }

    NOTE_LINKS {
        string source_note_id FK
        string target_note_id FK
        integer created_at
    }

    ATTACHMENTS {
        string id PK
        string note_id FK
        string filename
        string filepath
        string mimetype
        integer size
        integer created_at
    }

    NOTE_VERSIONS {
        string id PK
        string note_id FK
        string title
        text content
        integer version_number
        integer created_at
    }

    SCHEMA_MIGRATIONS {
        integer version PK
        string name
        integer applied_at
        string checksum
    }

    SETTINGS {
        string key PK
        string value
        integer updated_at
    }
```

### 2.2 Database Flow Diagram

```mermaid
sequenceDiagram
    participant App as Renderer/App
    participant DBM as DatabaseManager
    participant Repo as Repository
    participant DB as Better-SQLite3
    participant Vector as Vectra

    App->>DBM: Initialize App
    DBM->>DB: Open Connection
    DBM->>DB: Check Migrations
    alt Migration Pending
        DBM->>DBM: Run Migration
        DBM->>DB: Execute Migration SQL
        DBM->>DB: Update schema_migrations
    end
    DBM->>App: Ready

    App->>App: User Creates Note
    App->>Repo: create(noteData)
    Repo->>DB: Insert Note
    Repo->>Vector: Generate Embedding
    Vector->>Vector: Convert to Vector
    Repo->>Vector: Store Vector
    Repo->>App: Return Created Note

    App->>App: User Updates Note
    Repo->>DB: Begin Transaction
    Repo->>DB: Create Version Snapshot
    Repo->>DB: Update Note
    Repo->>Vector: Update Embedding
    Repo->>DB: Commit Transaction
    Repo->>App: Return Updated Note

    App->>App: User Searches
    App->>Repo: search(query)
    Repo->>DB: FTS Query
    Repo->>Vector: Vector Query
    Repo->>Repo: Merge & Rank Results
    Repo->>App: Return Results
```

## 3. Migration System Architecture

### 3.1 Migration Lifecycle

```mermaid
stateDiagram-v2
    [*] --> CheckPending: App Start
    CheckPending --> ApplyMigrations: Pending Found
    CheckPending --> Ready: No Pending

    ApplyMigrations --> BackupDB: Begin Migration
    BackupDB --> ParseMigration: Load Migration File
    ParseMigration --> ExecuteSQL: Execute SQL Statements
    ExecuteSQL --> RecordMigration: Update schema_migrations
    RecordMigration --> NextMigration: More Migrations?
    NextMigration --> ApplyMigrations: Yes
    NextMigration --> Ready: No

    Ready --> [*]

    note right of BackupDB
        Automatic backup
        before any migration
        for rollback safety
    end note

    note right of ExecuteSQL
        Wrapped in transaction
        Rollback on error
    end note
```

### 3.2 Migration Runner Flow

```mermaid
graph TD
    A["Migration Runner Started"] --> B{"Migration Pending?"}
    B -->|No| C["App Ready"]
    B -->|Yes| D["Create Backup"]
    D --> E["Load Migration File"]
    E --> F["Parse SQL Statements"]
    F --> G["Begin Transaction"]
    G --> H{"Execute Each<br/>Statement"}
    H -->|Error| I["Rollback Transaction"]
    I --> J["Restore from Backup"]
    J --> K["Report Error to UI"]
    H -->|Success| L["Next Statement"]
    L --> H
    H -->|All Complete| M["Commit Transaction"]
    M --> N["Record in schema_migrations"]
    N --> O{"More Migrations?"}
    O -->|Yes| E
    O -->|No| P["App Ready"]
    K --> Q["App Error State"]
    P --> C
    Q --> [*]
    C --> [*]
```

## 4. Repository Pattern Architecture

```mermaid
graph TB
    subgraph "Base Layer"
        BR["BaseRepository<T><br/>Abstract Base Class"]
        BR --> |implements| CRUD["CRUD Operations<br/>find, create, update, delete"]
        BR --> |implements| Batch["Batch Operations<br/>batchCreate, batchUpdate"]
        BR --> |implements| Trans["Transactions<br/>transaction support"]
    end

    subgraph "Repository Implementations"
        NR["NoteRepository<br/>extends BaseRepository<Note>"]
        NBR["NotebookRepository<br/>extends BaseRepository<Notebook>"]
        TR["TagRepository<br/>extends BaseRepository<Tag>"]
        VR["VersionRepository<br/>extends BaseRepository<Version>"]
    end

    subgraph "Domain-Specific Operations"
        NR --> |implements| Notes["searchFTS<br/>searchSemantic<br/>getFavorites<br/>getBacklinks"]
        NBR --> |implements| Books["getTree<br/>move<br/>getHierarchy"]
        TR --> |implements| Tags["addToNote<br/>removeFromNote<br/>getByNote"]
        VR --> |implements| Versions["createVersion<br/>getVersions<br/>restoreVersion"]
    end

    BR -.-> DB["Better-SQLite3<br/>Database Connection"]
    NR --> BR
    NBR --> BR
    TR --> BR
    VR --> BR
```

## 5. Search System Architecture

```mermaid
graph TB
    subgraph "Search Interface"
        Query["Search Query"]
        Filter["Apply Filters<br/>tags, date, notebooks"]
    end

    subgraph "Search Engines"
        FTS["Full-Text Search<br/>SQLite FTS5<br/>Exact/Fuzzy Matches"]
        Vector["Vector Search<br/>Vectra DB<br/>Semantic Similarity"]
        Hybrid["Hybrid Search<br/>Merge Results<br/>Rank by Relevance"]
    end

    subgraph "Result Processing"
        Merge["Merge Results<br/>Remove Duplicates"]
        Rank["Rank by Score<br/>FTS + Vector Scores"]
        Highlight["Highlight Matches<br/>in Content"]
    end

    subgraph "Output"
        Results["Ranked Results<br/>with Metadata"]
    end

    Query --> Filter
    Filter --> FTS
    Filter --> Vector
    FTS --> Merge
    Vector --> Merge
    Merge --> Rank
    Rank --> Highlight
    Highlight --> Results
```

## 6. IPC Communication Architecture

### 6.1 IPC Channels Organization

```mermaid
graph TD
    subgraph "Renderer Process"
        RP["React Components"]
    end

    subgraph "IPC Channels"
        Note["notes:*<br/>CRUD Operations"]
        Notebook["notebooks:*<br/>Hierarchy Ops"]
        Tag["tags:*<br/>Tag Mgmt"]
        Search["search:*<br/>Query Operations"]
        Attachment["attachments:*<br/>File Ops"]
        DB["db:*<br/>DB Management"]
        Setting["settings:*<br/>App Config"]
    end

    subgraph "Main Process Handlers"
        NH["Note Handlers"]
        NBH["Notebook Handlers"]
        TH["Tag Handlers"]
        SH["Search Handlers"]
        AH["Attachment Handlers"]
        DBH["DB Handlers"]
        SETH["Settings Handlers"]
    end

    RP --> Note
    RP --> Notebook
    RP --> Tag
    RP --> Search
    RP --> Attachment
    RP --> DB
    RP --> Setting

    Note --> NH
    Notebook --> NBH
    Tag --> TH
    Search --> SH
    Attachment --> AH
    DB --> DBH
    Setting --> SETH

    NH --> Repository
    NBH --> Repository
    TH --> Repository
    SH --> Repository
    AH --> Repository
    DBH --> Repository
    SETH --> Repository

    Repository --> Database
```

## 7. Data Flow - Create Note with Embedding

```mermaid
sequenceDiagram
    participant User as User
    participant UI as React Component
    participant Store as Zustand Store
    participant IPC as IPC Client
    participant Handler as Note Handler
    participant Repo as NoteRepository
    participant DB as Better-SQLite3
    participant Trans as Xenova Transformers
    participant Vector as Vectra DB

    User->>UI: Write Note Content
    UI->>Store: updateDraft(content)
    Store->>Store: Debounce 2s
    Store->>IPC: invoke('notes:create', noteData)

    IPC->>Handler: Handle notes:create
    Handler->>Repo: create(noteData)

    Repo->>DB: BEGIN TRANSACTION
    Repo->>DB: INSERT INTO notes
    DB-->>Repo: noteId, rowId

    Repo->>Trans: generateEmbedding(content)
    Trans-->>Repo: embedding vector

    Repo->>Vector: insertVector(noteId, embedding)
    Vector-->>Repo: success

    Repo->>DB: COMMIT
    Repo-->>Handler: created note

    Handler-->>IPC: return note
    IPC-->>Store: note result
    Store->>UI: Update note list
    UI->>User: Show created note
```

## 8. Backup and Restore Flow

```mermaid
stateDiagram-v2
    [*] --> Idle: App Running

    Idle --> AutoBackup: Time to Backup
    Idle --> ManualBackup: User Clicks Backup

    AutoBackup --> CheckFrequency: Trigger Check
    CheckFrequency --> ShouldBackup: Last < 24h?
    ShouldBackup --> Backup: Yes
    ShouldBackup --> Idle: No

    ManualBackup --> Backup: User Initiated
    Backup --> CreateBackupFile: Backup Started
    CreateBackupFile --> CompressDB: Copy & Compress
    CompressDB --> StoreMetadata: Save Info
    StoreMetadata --> CleanOld: Keep Last 5
    CleanOld --> BackupComplete: Done
    BackupComplete --> Idle: Success

    Idle --> Restore: User Restores
    Restore --> ValidateBackup: Verify Integrity
    ValidateBackup --> RestoreData: Load from Backup
    RestoreData --> VerifyRestore: Integrity Check
    VerifyRestore --> RestoreComplete: Success
    RestoreComplete --> Idle

    note right of CleanOld
        Retention policy:
        Keep 5 most recent
        Delete older backups
    end note
```

## 9. File Organization Structure

```mermaid
graph TD
    A["Stone Project Root"] --> B["src/"]
    A --> C["docs/"]
    A --> D["public/"]
    A --> E["migrations/"]
    A --> F["config/"]

    B --> B1["main/"]
    B --> B2["renderer/"]
    B --> B3["shared/"]

    B1 --> B1A["database/"]
    B1A --> B1A1["DatabaseManager.ts"]
    B1A --> B1A2["MigrationRunner.ts"]
    B1A --> B1A3["BackupManager.ts"]

    B1 --> B1B["repositories/"]
    B1B --> B1B1["BaseRepository.ts"]
    B1B --> B1B2["NoteRepository.ts"]
    B1B --> B1B3["NotebookRepository.ts"]
    B1B --> B1B4["TagRepository.ts"]
    B1B --> B1B5["VersionRepository.ts"]

    B1 --> B1C["ipc/"]
    B1C --> B1C1["handlers/"]
    B1C --> B1C2["channels.ts"]

    B1 --> B1D["services/"]
    B1D --> B1D1["SearchService.ts"]
    B1D --> B1D2["EmbeddingService.ts"]

    B1 --> B1E["preload.ts"]
    B1 --> B1F["index.ts"]

    B2 --> B2A["pages/"]
    B2 --> B2B["components/"]
    B2 --> B2C["stores/"]
    B2 --> B2D["hooks/"]
    B2 --> B2E["App.tsx"]
    B2 --> B2F["main.tsx"]

    B3 --> B3A["types/"]
    B3 --> B3B["constants/"]
    B3 --> B3C["utils/"]

    E --> E1["001_initial_schema.sql"]
    E --> E2["002_add_fts_index.sql"]
    E --> E3["migration_template.sql"]

    F --> F1["electron-builder.yml"]
    F --> F2["vite.config.ts"]
```

## 10. Component Hierarchy

```mermaid
graph TD
    A["App.tsx<br/>Root Component"]

    A --> B["MainLayout"]

    B --> B1["TitleBar"]
    B --> B2["Sidebar"]
    B --> B3["MainContent"]

    B1 --> B1A["AppMenu"]
    B1 --> B1B["WindowControls"]

    B2 --> B2A["NotebookTree"]
    B2A --> B2A1["NotebookNode"]
    B2B --> B2B1["NoteList"]
    B2B1 --> B2B2["NoteListItem"]
    B2C --> B2C1["TagManager"]
    B2D --> B2D1["SearchBar"]

    B3 --> B3A["NoteEditor"]
    B3A --> B3A1["EditorToolbar"]
    B3A --> B3A2["TipTapEditor"]
    B3A --> B3A3["EditorPreview"]
    B3B --> B3B1["NoteMetadata"]
    B3B1 --> B3B2["TagSelector"]
    B3B1 --> B3B3["VersionHistory"]
    B3C --> B3C1["SearchResults"]
    B3D --> B3D1["SettingsPanel"]
    B3D1 --> B3D2["DatabaseSettings"]
    B3D1 --> B3D3["BackupSettings"]
```

## 11. State Management Architecture

```mermaid
graph TD
    subgraph "Zustand Stores"
        NS["NotesStore<br/>notes, selectedNote,<br/>drafts"]
        NBS["NotebooksStore<br/>notebooks,<br/>expandedFolders"]
        TS["TagsStore<br/>tags"]
        SS["SearchStore<br/>query, results,<br/>filters"]
        US["UIStore<br/>theme, sidebar,<br/>modals"]
        AS["AppStore<br/>initialized,<br/>errors"]
    end

    NS --> |derived| Recent["Recent Notes"]
    NS --> |derived| Favorites["Favorite Notes"]

    NBS --> |derived| Tree["Notebook Tree"]
    NBS --> |derived| Breadcrumb["Breadcrumb"]

    SS --> |derived| Suggestions["Search Suggestions"]
    SS --> |derived| Highlights["Result Highlights"]

    React["React Components"] --> |subscribe| NS
    React --> |subscribe| NBS
    React --> |subscribe| TS
    React --> |subscribe| SS
    React --> |subscribe| US
    React --> |subscribe| AS
```

## 12. Error Handling and Recovery Flow

```mermaid
graph TD
    A["Error Occurs"] --> B{"Error Type?"}

    B -->|Migration| C["Migration Error Handler"]
    C --> D["Log to File"]
    D --> E["Restore from Backup"]
    E --> F["Report to User"]
    F --> G["App Error State"]

    B -->|Database| H["DB Error Handler"]
    H --> D
    H --> I{"Recoverable?"}
    I -->|Yes| J["Retry Operation"]
    J --> K["Resume Normal Op"]
    I -->|No| G

    B -->|IPC| L["IPC Error Handler"]
    L --> D
    L --> M["Return Error Response"]
    M --> N["UI Shows Error Toast"]
    N --> K

    B -->|Search| O["Search Error Handler"]
    O --> D
    O --> P["Fallback to FTS"]
    P --> K

    K --> Q["User Informed"]
    Q --> [*]
    G --> Q
```

## 13. Performance Optimization Strategy

```mermaid
graph LR
    subgraph "Database Optimization"
        A["Prepared Statements<br/>Reuse SQL Plans"]
        B["Connection Pooling<br/>Reduce Overhead"]
        C["Batch Operations<br/>Reduce Round Trips"]
        D["Indexes on Foreign Keys<br/>Fast Joins"]
        E["VACUUM Scheduling<br/>Reclaim Space"]
    end

    subgraph "Renderer Optimization"
        F["Component Memoization<br/>Prevent Re-renders"]
        G["Virtual Scrolling<br/>Large Lists"]
        H["Code Splitting<br/>Lazy Routes"]
        I["Debounce Auto-save<br/>2s Delay"]
        J["Lazy Load Attachments<br/>On Demand"]
    end

    subgraph "Search Optimization"
        K["FTS5 Index Optimization<br/>Fast Full-text"]
        L["Vector Index Caching<br/>In-memory"]
        M["Search Result Pagination<br/>50 Items/Page"]
    end

    A --> Result["Optimized App<br/>Handles 10k+ Notes"]
    B --> Result
    C --> Result
    D --> Result
    E --> Result
    F --> Result
    G --> Result
    H --> Result
    I --> Result
    J --> Result
    K --> Result
    L --> Result
    M --> Result
```

## 14. Security Considerations

```mermaid
graph TD
    A["Security Measures"] --> B["Database Security"]
    A --> C["File Security"]
    A --> D["IPC Security"]
    A --> E["Data Privacy"]

    B --> B1["Foreign Key Constraints<br/>Data Integrity"]
    B --> B2["Prepared Statements<br/>SQL Injection Prevention"]
    B --> B3["Transaction Integrity<br/>ACID Compliance"]

    C --> C1["User Data Directory<br/>OS Protected"]
    C --> C2["Attachment Validation<br/>Type Checking"]
    C --> C3["Backup Encryption<br/>Optional"]

    D --> D1["IPC Validation<br/>Type Checking"]
    D --> D2["Renderer Sandboxing<br/>Limited Privileges"]
    D --> D3["Error Message Sanitization<br/>No Sensitive Info"]

    E --> E1["No Cloud Sync<br/>Data Local Only"]
    E --> E2["User Database Ownership<br/>Full Control"]
    E --> E3["Export Encryption<br/>Protected Archives"]
```

## 15. Development Workflow

```mermaid
stateDiagram-v2
    [*] --> Dev: npm run dev
    Dev --> Watch: Watch Mode Active

    Watch --> EditMain: Edit Main Process
    EditMain --> Restart: Auto Restart
    Restart --> Watch

    Watch --> EditRenderer: Edit Renderer
    EditRenderer --> HMR: Hot Module Reload
    HMR --> Watch

    Watch --> EditDB: Edit Database Code
    EditDB --> Seed: Reseed DB
    Seed --> Watch

    Watch --> Test: npm test
    Test --> Watch

    Watch --> Build: npm run build
    Build --> Package: npm run package
    Package --> [*]
```

## 16. Migration Strategy Timeline

```
Phase 1: Foundation (Weeks 1-2)
├── Database manager with migration system
├── Repository pattern implementations
└── Basic CRUD operations

Phase 2: Editor & Storage (Weeks 3-4)
├── Rich text editor integration
├── Auto-save system
├── Version history

Phase 3: Search & Discovery (Weeks 5-6)
├── Full-text search implementation
├── Vector embeddings
├── Hybrid search

Phase 4: UI & UX (Weeks 7-8)
├── Main layout and components
├── Settings panel
├── Database management UI

Phase 5: Advanced Features (Weeks 9-10)
├── Export/import system
├── Backup/restore UI
├── Settings persistence

Phase 6: Polish & Testing (Weeks 11-12)
├── Error handling
├── Performance optimization
├── Packaging and distribution
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-29
**Status:** Architecture Design Complete - Ready for Implementation
