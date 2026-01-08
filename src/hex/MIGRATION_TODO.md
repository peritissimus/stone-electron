# Hexagonal Architecture Migration - Detailed TODO

## Phase 1: Complete Note Features (favorite, pin, archive, tasks)

### 1.1 Domain Services - Task Extraction
```
src/hex/domain/services/
├── index.ts
└── TaskExtractor.ts
```

**TaskExtractor.ts:**
- [ ] Define `TaskState` type: `'todo' | 'doing' | 'done' | 'waiting' | 'hold' | 'canceled' | 'idea'`
- [ ] Define `RawTask` interface: `{ index, state, text, lineNumber }`
- [ ] Implement `extractTasks(markdown: string): RawTask[]` - pure regex extraction
- [ ] Implement `replaceTaskState(markdown: string, index: number, newState: TaskState): string`
- [ ] Export `TASK_PATTERN` regex constant
- [ ] Port logic from `src/main/services/TaskService.ts:62-63,206-238`

**index.ts:**
- [ ] Export TaskExtractor, TaskState, RawTask

---

### 1.2 Ports - Task Use Cases
```
src/hex/domain/ports/in/
└── ITaskUseCases.ts
```

**ITaskUseCases.ts:**
- [ ] Define `IGetAllTasksUseCase`: `execute() => Promise<TaskDTO[]>`
- [ ] Define `IGetNoteTasksUseCase`: `execute(noteId: string) => Promise<TaskDTO[]>`
- [ ] Define `IUpdateTaskStateUseCase`: `execute(noteId: string, taskIndex: number, state: TaskState) => Promise<void>`
- [ ] Update `index.ts` to export

---

### 1.3 DTOs - Task
```
src/hex/application/dto/
└── TaskDTO.ts
```

**TaskDTO.ts:**
- [ ] Define `TaskDTO` interface matching legacy `TodoItem`
- [ ] Define `GetAllTasksResponseDTO`
- [ ] Define `UpdateTaskStateRequestDTO`
- [ ] Port from `src/main/services/TaskService.ts:15-25`

---

### 1.4 Use Cases - Task
```
src/hex/application/usecases/task/
├── index.ts
├── GetAllTasksUseCase.ts
├── GetNoteTasksUseCase.ts
└── UpdateTaskStateUseCase.ts
```

**GetAllTasksUseCase.ts:**
- [ ] Inject: `INoteRepository`, `IFileStorage`, `IMarkdownProcessor`
- [ ] `execute()`:
  - [ ] Fetch all non-deleted notes
  - [ ] For each note, read markdown file via `IFileStorage`
  - [ ] Use `TaskExtractor.extractTasks()` on content
  - [ ] Map to `TaskDTO[]` with note metadata
- [ ] Port logic from `src/main/services/TaskService.ts:73-95`

**GetNoteTasksUseCase.ts:**
- [ ] Inject: `INoteRepository`, `IFileStorage`
- [ ] `execute(noteId)`:
  - [ ] Get note by ID
  - [ ] Read file content
  - [ ] Extract tasks
- [ ] Port from `src/main/services/TaskService.ts:100-112`

**UpdateTaskStateUseCase.ts:**
- [ ] Inject: `INoteRepository`, `IWorkspaceRepository`, `IFileStorage`
- [ ] `execute(noteId, taskIndex, newState)`:
  - [ ] Validate state
  - [ ] Read file content
  - [ ] Use `TaskExtractor.replaceTaskState()`
  - [ ] Write updated content to file
  - [ ] Update note timestamp
- [ ] Port from `src/main/services/TaskService.ts:121-182`

**index.ts:**
- [ ] Factory function `createTaskUseCases(deps)`
- [ ] Export all use cases

---

### 1.5 IPC Adapter - Task
```
src/hex/adapters/in/ipc/
└── TaskIPC.ts
```

**TaskIPC.ts:**
- [ ] Import from `@shared/constants/ipcChannels` (or define channels)
- [ ] Handler: `notes:getAllTodos` → `GetAllTasksUseCase`
- [ ] Handler: `notes:updateTaskState` → `UpdateTaskStateUseCase`
- [ ] Wrap responses in `{ success, data, error }` format
- [ ] Add logging
- [ ] Export `registerTaskHandlers(container)`

---

### 1.6 Extend Note Use Cases (favorite, pin, archive)
```
src/hex/application/usecases/note/
├── ToggleFavoriteUseCase.ts
├── TogglePinUseCase.ts
└── ArchiveNoteUseCase.ts
```

**ToggleFavoriteUseCase.ts:**
- [ ] Inject: `INoteRepository`
- [ ] `execute(noteId)`:
  - [ ] Get note
  - [ ] Call `note.toggleFavorite()` (entity method exists)
  - [ ] Save via repository
  - [ ] Return updated note

**TogglePinUseCase.ts:**
- [ ] Same pattern as favorite
- [ ] Call `note.togglePin()` (need to add to entity if missing)

**ArchiveNoteUseCase.ts:**
- [ ] Inject: `INoteRepository`
- [ ] `execute(noteId)`:
  - [ ] Get note
  - [ ] Call `note.archive()` / `note.unarchive()` (entity methods exist)
  - [ ] Save

---

### 1.7 Extend NoteIPC
```
src/hex/adapters/in/ipc/NoteIPC.ts
```

- [ ] Add handler: `notes:favorite` → `ToggleFavoriteUseCase`
- [ ] Add handler: `notes:pin` → `TogglePinUseCase`
- [ ] Add handler: `notes:archive` → `ArchiveNoteUseCase`

---

### 1.8 Update DI Container
```
src/hex/infrastructure/di/container.ts
```

- [ ] Register `TaskExtractor` (or use as static)
- [ ] Register `GetAllTasksUseCase`
- [ ] Register `GetNoteTasksUseCase`
- [ ] Register `UpdateTaskStateUseCase`
- [ ] Register `ToggleFavoriteUseCase`
- [ ] Register `TogglePinUseCase`
- [ ] Register `ArchiveNoteUseCase`
- [ ] Register `TaskIPC` handlers

---

## Phase 2: Workspace Folder Operations + Sync

### 2.1 Ports
```
src/hex/domain/ports/in/IWorkspaceUseCases.ts (extend)
src/hex/domain/ports/out/ISystemService.ts (new)
```

**IWorkspaceUseCases.ts (extend):**
- [ ] Add `ICreateFolderUseCase`: `execute(workspaceId, folderPath) => Promise<void>`
- [ ] Add `IRenameFolderUseCase`: `execute(workspaceId, oldPath, newPath) => Promise<void>`
- [ ] Add `IDeleteFolderUseCase`: `execute(workspaceId, folderPath) => Promise<void>`
- [ ] Add `IMoveFolderUseCase`: `execute(workspaceId, sourcePath, destPath) => Promise<void>`
- [ ] Add `IScanWorkspaceUseCase`: `execute(workspaceId) => Promise<ScanResult>`
- [ ] Add `ISyncWorkspaceUseCase`: `execute(workspaceId) => Promise<SyncResult>`

**ISystemService.ts (new):**
- [ ] `selectFolder(): Promise<string | null>` - Electron dialog
- [ ] `validatePath(path: string): Promise<boolean>`
- [ ] `getFonts(): Promise<string[]>`

---

### 2.2 Use Cases
```
src/hex/application/usecases/workspace/
├── CreateFolderUseCase.ts
├── RenameFolderUseCase.ts
├── DeleteFolderUseCase.ts
├── MoveFolderUseCase.ts
├── ScanWorkspaceUseCase.ts
└── SyncWorkspaceUseCase.ts
```

**CreateFolderUseCase.ts:**
- [ ] Inject: `IWorkspaceRepository`, `IFileStorage`
- [ ] Create directory in workspace
- [ ] Port from `src/main/ipc/handlers/workspaceHandlers.ts`

**ScanWorkspaceUseCase.ts:**
- [ ] Inject: `IWorkspaceRepository`, `IFileStorage`
- [ ] Glob markdown files
- [ ] Return folder structure
- [ ] Port from `src/main/services/WorkspaceService.ts`

**SyncWorkspaceUseCase.ts:**
- [ ] Inject: `IWorkspaceRepository`, `INoteRepository`, `INotebookRepository`, `IFileStorage`
- [ ] Compare DB state with filesystem
- [ ] Create/update/delete notes as needed
- [ ] Port from `src/main/services/WorkspaceService.ts`

---

### 2.3 Service Adapter
```
src/hex/adapters/out/services/
└── SystemService.ts
```

**SystemService.ts:**
- [ ] Implement `ISystemService`
- [ ] Use Electron `dialog.showOpenDialog()` for folder picker
- [ ] Use `font-list` for getFonts()
- [ ] Port from `src/main/ipc/handlers/workspaceHandlers.ts:23-38`

---

### 2.4 Infrastructure - Electron Utilities
```
src/hex/infrastructure/electron/
├── index.ts
├── dialog.ts
└── shell.ts
```

**dialog.ts:**
- [ ] `showFolderPicker(): Promise<string | null>`
- [ ] `showFilePicker(options): Promise<string | null>`

**shell.ts:**
- [ ] `openExternal(url): Promise<void>`
- [ ] `showItemInFolder(path): void`

---

### 2.5 IPC Adapter
```
src/hex/adapters/in/ipc/
└── WorkspaceIPC.ts (extend)
```

- [ ] Add: `workspaces:selectFolder`
- [ ] Add: `workspaces:validatePath`
- [ ] Add: `workspaces:createFolder`
- [ ] Add: `workspaces:renameFolder`
- [ ] Add: `workspaces:deleteFolder`
- [ ] Add: `workspaces:moveFolder`
- [ ] Add: `workspaces:scan`
- [ ] Add: `workspaces:sync`

---

## Phase 3: Topics & ML Classification

### 3.1 Repository
```
src/hex/adapters/out/persistence/
└── TopicRepository.ts
```

**TopicRepository.ts:**
- [ ] Implement `ITopicRepository`
- [ ] CRUD for topics table
- [ ] Query noteTopics junction table
- [ ] Handle centroids (Uint8Array)
- [ ] Port from `src/main/repositories/TopicRepository.ts`

---

### 3.2 DTOs
```
src/hex/application/dto/
└── TopicDTO.ts
```

- [ ] `TopicDTO`, `CreateTopicDTO`, `UpdateTopicDTO`
- [ ] `ClassifyNoteRequestDTO`, `ClassifyNoteResponseDTO`
- [ ] `SimilarNotesRequestDTO`, `SimilarNotesResponseDTO`

---

### 3.3 Use Cases
```
src/hex/application/usecases/topic/
├── index.ts
├── TopicCRUDUseCases.ts
├── ClassifyNoteUseCase.ts
├── ClassifyAllUseCase.ts
├── AssignTopicUseCase.ts
├── RemoveTopicUseCase.ts
├── GetSimilarNotesUseCase.ts
├── SemanticSearchUseCase.ts
└── RecomputeCentroidsUseCase.ts
```

**ClassifyNoteUseCase.ts:**
- [ ] Inject: `IEmbeddingService`, `INoteRepository`, `ITopicRepository`
- [ ] Generate embedding for note content
- [ ] Calculate similarity to topic centroids
- [ ] Assign best matching topic
- [ ] Port from `src/main/services/TopicService.ts`

**ClassifyAllUseCase.ts:**
- [ ] Batch classification with progress reporting
- [ ] Use `MLStatusService` for status updates
- [ ] Port from `src/main/services/TopicService.ts`

---

### 3.4 IPC Adapter
```
src/hex/adapters/in/ipc/
└── TopicIPC.ts
```

**17 Channels:**
- [ ] `topics:initialize`
- [ ] `topics:getAll`
- [ ] `topics:getById`
- [ ] `topics:create`
- [ ] `topics:update`
- [ ] `topics:delete`
- [ ] `topics:getNotesByTopic`
- [ ] `topics:getTopicsForNote`
- [ ] `topics:assignToNote`
- [ ] `topics:removeFromNote`
- [ ] `topics:classifyNote`
- [ ] `topics:classifyAll`
- [ ] `topics:reclassifyAll`
- [ ] `topics:semanticSearch`
- [ ] `topics:getSimilarNotes`
- [ ] `topics:recomputeCentroids`
- [ ] `topics:getEmbeddingStatus`

---

## Phase 4: Graph (Backlinks, Forward Links)

### 4.1 Domain Service
```
src/hex/domain/services/
└── LinkExtractor.ts
```

**LinkExtractor.ts:**
- [ ] `extractWikiLinks(markdown): string[]` - `[[Note Title]]`
- [ ] `extractMarkdownLinks(markdown): string[]` - `[text](path)`
- [ ] `extractAllLinks(markdown): Link[]`
- [ ] Port regex from `src/main/services/GraphService.ts`

---

### 4.2 Repository
```
src/hex/adapters/out/persistence/
└── NoteLinkRepository.ts
```

**NoteLinkRepository.ts:**
- [ ] Implement `INoteLinkRepository`
- [ ] Store source/target note links
- [ ] Query backlinks (notes linking TO a note)
- [ ] Query forward links (notes linked FROM a note)

---

### 4.3 DTOs
```
src/hex/application/dto/
└── GraphDTO.ts
```

- [ ] `LinkDTO`: `{ sourceId, targetId, linkText }`
- [ ] `BacklinksResponseDTO`
- [ ] `GraphDataDTO`: nodes + edges for visualization

---

### 4.4 Use Cases
```
src/hex/application/usecases/graph/
├── index.ts
├── GetBacklinksUseCase.ts
├── GetForwardLinksUseCase.ts
├── GetGraphDataUseCase.ts
└── UpdateNoteLinksUseCase.ts
```

**GetBacklinksUseCase.ts:**
- [ ] Query NoteLinkRepository for notes linking to target
- [ ] Return with note metadata

**GetGraphDataUseCase.ts:**
- [ ] Build node/edge structure for visualization
- [ ] Port from `src/main/services/GraphService.ts`

**UpdateNoteLinksUseCase.ts:**
- [ ] Called after note save
- [ ] Extract links from content
- [ ] Update noteLinks table

---

### 4.5 IPC Adapter
```
src/hex/adapters/in/ipc/
└── GraphIPC.ts
```

- [ ] `notes:getBacklinks`
- [ ] `notes:getForwardLinks`
- [ ] `notes:getGraphData`

---

## Phase 5: Versions & Attachments

### 5.1 Repositories
```
src/hex/adapters/out/persistence/
├── VersionRepository.ts
└── AttachmentRepository.ts
```

**VersionRepository.ts:**
- [ ] Implement `IVersionRepository`
- [ ] Store note versions with content
- [ ] Query version history
- [ ] Port from `src/main/repositories/VersionRepository.ts`

**AttachmentRepository.ts:**
- [ ] Implement `IAttachmentRepository`
- [ ] Store attachment metadata
- [ ] Link to notes
- [ ] Port from `src/main/repositories/AttachmentRepository.ts`

---

### 5.2 DTOs
```
src/hex/application/dto/
├── VersionDTO.ts
└── AttachmentDTO.ts
```

---

### 5.3 Use Cases
```
src/hex/application/usecases/version/
├── index.ts
├── GetVersionsUseCase.ts
├── CreateVersionUseCase.ts
└── RestoreVersionUseCase.ts

src/hex/application/usecases/attachment/
├── index.ts
├── AddAttachmentUseCase.ts
├── DeleteAttachmentUseCase.ts
├── GetAttachmentsUseCase.ts
└── UploadImageUseCase.ts
```

---

### 5.4 IPC Adapters
```
src/hex/adapters/in/ipc/
├── VersionIPC.ts
└── AttachmentIPC.ts
```

**VersionIPC.ts:**
- [ ] `notes:getVersions`
- [ ] `notes:restoreVersion`

**AttachmentIPC.ts:**
- [ ] `attachments:add`
- [ ] `attachments:delete`
- [ ] `attachments:getAll`
- [ ] `attachments:uploadImage`

---

## Phase 6: Git Integration

### 6.1 Service Adapter
```
src/hex/adapters/out/services/
└── GitService.ts
```

**GitService.ts:**
- [ ] Implement `IGitService`
- [ ] Use `simple-git` library
- [ ] Methods: `init`, `status`, `commit`, `pull`, `push`, `setRemote`, `getCommits`
- [ ] Port from `src/main/services/GitService.ts`

---

### 6.2 DTOs
```
src/hex/application/dto/
└── GitDTO.ts
```

- [ ] `GitStatusDTO`
- [ ] `GitCommitDTO`
- [ ] `GitSyncResultDTO`

---

### 6.3 Use Cases
```
src/hex/application/usecases/git/
├── index.ts
├── GetStatusUseCase.ts
├── InitRepoUseCase.ts
├── CommitUseCase.ts
├── PullUseCase.ts
├── PushUseCase.ts
├── SyncUseCase.ts
├── SetRemoteUseCase.ts
└── GetCommitsUseCase.ts
```

---

### 6.4 IPC Adapter
```
src/hex/adapters/in/ipc/
└── GitIPC.ts
```

- [ ] `git:getStatus`
- [ ] `git:init`
- [ ] `git:commit`
- [ ] `git:pull`
- [ ] `git:push`
- [ ] `git:sync`
- [ ] `git:setRemote`
- [ ] `git:getCommits`

---

## Phase 7: Export, Database, System Utilities

### 7.1 Export
```
src/hex/domain/ports/out/
└── IExportService.ts

src/hex/adapters/out/services/
└── ExportService.ts

src/hex/application/usecases/export/
├── ExportHtmlUseCase.ts
├── ExportPdfUseCase.ts
└── ExportMarkdownUseCase.ts

src/hex/adapters/in/ipc/
└── ExportIPC.ts
```

**IExportService.ts:**
- [ ] `renderToPdf(html: string, options): Promise<Buffer>`
- [ ] `generateHtml(note, options): Promise<string>`

**ExportService.ts:**
- [ ] Use `puppeteer` or `electron` print for PDF
- [ ] Port from `src/main/services/ExportService.ts`

**Channels:**
- [ ] `notes:exportHtml`
- [ ] `notes:exportPdf`
- [ ] `notes:exportMarkdown`

---

### 7.2 Database
```
src/hex/application/usecases/database/
├── GetStatusUseCase.ts
├── VacuumUseCase.ts
└── CheckIntegrityUseCase.ts

src/hex/adapters/in/ipc/
└── DatabaseIPC.ts
```

**Channels:**
- [ ] `db:getStatus`
- [ ] `db:vacuum`
- [ ] `db:checkIntegrity`

---

### 7.3 Quick Capture
```
src/hex/application/usecases/quickcapture/
└── AppendToJournalUseCase.ts

src/hex/adapters/in/ipc/
└── QuickCaptureIPC.ts
```

**AppendToJournalUseCase.ts:**
- [ ] Find or create today's journal note
- [ ] Append timestamped content
- [ ] Port from `src/main/ipc/handlers/quickCaptureHandlers.ts`

**Channels:**
- [ ] `quickCapture:appendToJournal`

---

### 7.4 System
```
src/hex/adapters/in/ipc/
└── SystemIPC.ts
```

**SystemIPC.ts:**
- [ ] `system:getFonts` - Direct call to `SystemService.getFonts()`
- [ ] No use case needed (simple passthrough)

---

## Summary Checklist

### Domain Layer
- [ ] `domain/services/index.ts`
- [ ] `domain/services/TaskExtractor.ts`
- [ ] `domain/services/LinkExtractor.ts`
- [ ] `domain/services/SimilarityCalculator.ts`
- [ ] `domain/ports/in/ITaskUseCases.ts`
- [ ] `domain/ports/in/IGraphUseCases.ts`
- [ ] `domain/ports/in/IVersionUseCases.ts`
- [ ] `domain/ports/in/IExportUseCases.ts`
- [ ] `domain/ports/out/IExportService.ts`
- [ ] `domain/ports/out/ISystemService.ts`
- [ ] `domain/ports/out/IGitService.ts`

### Application Layer
- [ ] `application/dto/TaskDTO.ts`
- [ ] `application/dto/TopicDTO.ts`
- [ ] `application/dto/AttachmentDTO.ts`
- [ ] `application/dto/VersionDTO.ts`
- [ ] `application/dto/GraphDTO.ts`
- [ ] `application/dto/GitDTO.ts`
- [ ] `application/usecases/task/*`
- [ ] `application/usecases/topic/*`
- [ ] `application/usecases/attachment/*`
- [ ] `application/usecases/version/*`
- [ ] `application/usecases/graph/*`
- [ ] `application/usecases/export/*`
- [ ] `application/usecases/git/*`
- [ ] `application/usecases/database/*`
- [ ] `application/usecases/quickcapture/*`
- [ ] `application/usecases/workspace/* (folder ops)`
- [ ] `application/usecases/note/* (favorite, pin, archive)`

### Adapters Layer
- [ ] `adapters/out/persistence/TopicRepository.ts`
- [ ] `adapters/out/persistence/AttachmentRepository.ts`
- [ ] `adapters/out/persistence/VersionRepository.ts`
- [ ] `adapters/out/persistence/NoteLinkRepository.ts`
- [ ] `adapters/out/services/ExportService.ts`
- [ ] `adapters/out/services/SystemService.ts`
- [ ] `adapters/out/services/GitService.ts`
- [ ] `adapters/in/ipc/TaskIPC.ts`
- [ ] `adapters/in/ipc/TopicIPC.ts`
- [ ] `adapters/in/ipc/AttachmentIPC.ts`
- [ ] `adapters/in/ipc/VersionIPC.ts`
- [ ] `adapters/in/ipc/GraphIPC.ts`
- [ ] `adapters/in/ipc/ExportIPC.ts`
- [ ] `adapters/in/ipc/GitIPC.ts`
- [ ] `adapters/in/ipc/DatabaseIPC.ts`
- [ ] `adapters/in/ipc/QuickCaptureIPC.ts`
- [ ] `adapters/in/ipc/SystemIPC.ts`

### Infrastructure Layer
- [ ] `infrastructure/electron/index.ts`
- [ ] `infrastructure/electron/dialog.ts`
- [ ] `infrastructure/electron/shell.ts`
- [ ] `infrastructure/di/container.ts` (update with all new registrations)

### Shared
- [ ] `shared/types/index.ts`
- [ ] `shared/types/common.ts`
