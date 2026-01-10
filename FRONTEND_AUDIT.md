# Frontend Architecture Audit

**Date**: 2026-01-11
**Branch**: feat/arch

---

## 1. Direct Store Imports in Components (27 files) — HIGH PRIORITY

Components should use hooks, not import stores directly. Found violations in:

| Category | Files |
|----------|-------|
| Layout/Composites | `LayoutContainer.tsx`, `MainLayout.tsx` |
| Editor | `NoteEditor.tsx`, `NoteEditorContent.tsx`, `NoteEditorHeader.tsx`, `BacklinksPanel.tsx`, `GraphView.tsx` |
| Navigation | `Sidebar.tsx`, `NoteList.tsx`, `NoteListFolderItem.tsx`, `FileTree.tsx` |
| Features | `HomePage.tsx`, `TodoList.tsx`, `TasksPage.tsx`, `TopicsPage.tsx`, `GraphPage.tsx` |
| Settings | `SettingsModal.tsx`, `GitSettings.tsx`, `FontSettings.tsx`, `FontPreview.tsx`, `KeyboardShortcutsSettings.tsx` |
| Other | `CommandCenter.tsx`, `DraftRecoveryDialog.tsx`, `NotebookTree.tsx`, `TagList.tsx`, `MLStatusIndicator.tsx`, `FindReplaceModal.tsx` |

**Root cause**: Missing wrapper hooks for:
- `uiStore` → needs `useUI()` hook
- `shortcutsStore` → needs full `useShortcuts()` hook (only partial coverage)
- `mlStatusStore` → needs `useMLStatus()` hook (only event sync exists)

---

## 2. Default Export (1 file) — MEDIUM

```
src/renderer/components/features/Editor/GraphView.tsx:201
```

---

## 3. `alert()` Usage (3 instances) — MEDIUM

| File | Line | Issue |
|------|------|-------|
| `LayoutContainer.tsx` | 85, 89 | Sync failure alerts |
| `Sidebar.tsx` | 290 | Workspace creation error |

**Fix**: Replace with toast notifications or error dialogs.

---

## 4. Console Statements (3 instances) — LOW

| File | Line | Type |
|------|------|------|
| `QuickCaptureWindow.tsx` | 45 | `console.error` (acceptable) |
| `CodeBlockToolbar.tsx` | 63 | `console.error` (acceptable) |
| `TopicsPage.tsx` | 144 | `console.log` ← **Remove** |

---

## 5. Try/Catch in Components (16 files) — MEDIUM

Per architecture rules, error handling should live in hooks, not components. Components with embedded try/catch:

- `BacklinksPanel.tsx`, `GraphView.tsx`, `CodeBlockToolbar.tsx`, `NoteEditor.tsx`
- `CreateWorkspaceModal.tsx`, `NoteList.tsx`, `FileTree.tsx`, `MainLayout.tsx`
- `TopicsPage.tsx`, `HomePage.tsx`, `TasksPage.tsx`, `GraphPage.tsx`
- `CommandCenter.tsx`, `QuickCaptureWindow.tsx`, `Sidebar.tsx`, `LayoutContainer.tsx`

---

## 6. UI Composition Inconsistencies — MEDIUM

| Pattern | Issue | Files |
|---------|-------|-------|
| Raw `<button>` | Should use `Button` composite | `SettingsModal.tsx`, `Sidebar.tsx`, `NoteLinkMenu.tsx`, `BlockMenu.tsx`, `FloatingBlockMenu.tsx` |
| Raw typography | Inline `text-sm font-medium` instead of `Body`/`Caption` | `NoteEditorHeader.tsx`, `NoteLinkMenu.tsx`, `QuickCaptureWindow.tsx` |
| Modal patterns | 3 different approaches (TabbedModal, Dialog, custom div) | `SettingsModal.tsx`, `CreateWorkspaceModal.tsx`, `FindReplaceModal.tsx` |
| Raw spacing | `p-3`, `py-1.5` instead of spacing tokens | `NoteLinkMenu.tsx`, `EditorToolbar.tsx` |

---

## 7. Factory Function Naming — LOW

`useEntityAction()` and `useEntityVoidAction()` in `createEntityAPI.ts` should be `createEntityAction()` and `createVoidAction()` (they're factories, not hooks).

---

## Recommended Fix Order

1. **Create missing hooks** (`useUI`, `useMLStatus`, `useShortcuts`) — unblocks all 27 store import fixes
2. **Migrate components to hooks** — high-impact architecture fix
3. **Replace `alert()` with toast/dialog** — UX consistency
4. **Fix GraphView default export** — module consistency
5. **Remove debug `console.log`** — code hygiene
6. **Standardize modal pattern** — pick one (Dialog or TabbedModal) and migrate

---

## Fixes Already Applied

- Removed direct API usage from QuickCapture UI (`QuickCaptureWindow.tsx`)
- Made `useQuickCaptureAPI` safe for unmount scenarios
- Removed unused API type import in `GitSettings.tsx`
- Refactored `FindReplaceModal.tsx` to use base UI primitives and named export
- Added `FindReplace/index.ts` barrel export

### Store Import Migration (16 files migrated)

**Created wrapper hooks:**
- `useUI()` - main hook + granular: `useSidebarUI`, `useEditorUI`, `useNoteListUI`, `useTheme`, `useModals`
- `useMLStatus()` - for mlStatusStore access + `useMLServiceState`, `useMLOperation`
- `useShortcuts()` - for shortcutsStore access + `useShortcut`, `useShortcutDisplay`, `useShortcutEditor`

**Migrated components:**
- `FindReplaceModal.tsx` → `useModals`
- `FontPreview.tsx`, `FontSettings.tsx` → `useTheme`
- `NoteEditorContent.tsx`, `NoteEditorHeader.tsx` → `useEditorUI`, `useSidebarUI`
- `SettingsModal.tsx` → `useModals`, `useTheme`, `useEditorUI`
- `LayoutContainer.tsx` → `useModals`
- `MLStatusIndicator.tsx` → `useMLStatus`
- `KeyboardShortcutsSettings.tsx` → `useShortcuts`
- `CommandCenter.tsx` → `useModals` (keeps `.getState()` for callbacks)
- `NoteList.tsx` → `useNoteListUI`
- `TopicsPage.tsx`, `GraphPage.tsx`, `TasksPage.tsx` → `useSidebarUI`
- `HomePage.tsx` → `useSidebarUI`
- `MainLayout.tsx` → `useUI`
- `Sidebar.tsx` → `useUI`
- `NoteEditor.tsx` → `useEditorUI` (keeps `.getState()` for callbacks)

### Quick Fixes

- **Removed default export** from `GraphView.tsx` (now uses named export only)
- **Removed debug `console.log`** from `TopicsPage.tsx`

### React.memo on List Items (P0 Performance)

- `TopicsPage.tsx` → memoized `TopicRow`, `NoteRow`
- `HomePage.tsx` → memoized `RecentNote`
- `TaskItem.tsx` → memoized `TaskItem`

### Icon Library Consolidation (P1)

Migrated all feature components from lucide-react to phosphor-react:
- `TaskSection.tsx` - ChevronRight → CaretRight
- `TaskItem.tsx` - ArrowRight, Circle from phosphor
- `TodoList.tsx` - CheckSquare, Square, ArrowRight from phosphor
- `TasksPage.tsx` - CheckSquare, MagnifyingGlass, FolderOpen, Stack, Funnel from phosphor
- `DraftRecoveryDialog.tsx` - FileText, X, CheckCircle from phosphor
- `CodeBlockToolbar.tsx` - Copy, Check from phosphor
- `TopicsPage.tsx` - MagnifyingGlass, Plus, CaretRight, X, FileText, ArrowsClockwise
- `GraphPage.tsx` - GitFork, CaretRight from phosphor
- `HomePage.tsx` - FileText, BookOpen, ArrowRight, Sparkle from phosphor

Note: Base UI components (shadcn/ui) still use lucide-react as designed.

### Inline Handler Extraction (P0)

Extracted 25+ inline handlers in `EditorToolbar.tsx` to memoized callbacks using `useCallback`:
- History: `handleUndo`, `handleRedo`
- Text formatting: `handleToggleBold`, `handleToggleItalic`, `handleToggleStrike`, `handleToggleCode`, `handleToggleHighlight`
- Headings: `handleToggleH1`, `handleToggleH2`, `handleToggleH3`
- Lists: `handleToggleBulletList`, `handleToggleOrderedList`
- Blocks: `handleToggleBlockquote`, `handleSetHorizontalRule`, `handleCodeBlockInsert`, `handleLanguageChange`
- Tables: `handleInsertTable`, `handleAddRowBefore`, `handleAddRowAfter`, `handleAddColumnBefore`, `handleAddColumnAfter`, `handleDeleteRow`, `handleDeleteColumn`
- Links: `handleInsertLink`, `handleLinkKeyDown`, `handleCancelLink`
- Images: `handleInsertImage`, `handleImageKeyDown`, `handleCancelImage`
- Memoized `isInTable` computed value with `useMemo`

### useMemo for Expensive Computations (P2)

Added `useMemo` to `HomePage.tsx` for:
- `activeWorkspace` - find on workspaces array
- `recentNotes` - sort + slice on notes array
- `journalFilename`, `journalTitle`, `todayDateString` - date computations
- `todaysJournal` - find on notes array
- `todayNotes` - filter + count on notes array

Note: TodoList sorting happens inside async `loadTodos` callback, not on render - no useMemo needed.

### Toast Notifications (Medium)

Replaced all `alert()` calls with toast notifications:
- Added `sonner` package for toast notifications
- Added `Toaster` component to `App.tsx`
- `LayoutContainer.tsx` - replaced sync failure alerts with `toast.error()`
- `Sidebar.tsx` - replaced workspace creation error alert with `toast.error()`

---

# Part 2: Performance Inefficiencies

## 8. Missing React.memo on List Items — HIGH

Components rendered in `.map()` loops lack memoization:

| File | Component | Lines |
|------|-----------|-------|
| `TopicsPage.tsx` | `NoteRow`, `TopicRow` | 325-331, 354-361, 407-409 |
| `HomePage.tsx` | `RecentNote` | 348-359 |
| `TaskSection.tsx` | `TaskItem` | 64-72 |
| `TodoList.tsx` | List items | 188-207 |
| `DraftRecoveryDialog.tsx` | Draft items | 109-145 |

---

## 9. Inline Event Handlers — HIGH

70+ inline arrow functions in JSX cause new references on every render:

| File | Issue | Lines |
|------|-------|-------|
| `EditorToolbar.tsx` | 50+ inline editor command handlers | 137-342 |
| `BlockMenu.tsx` | 9+ inline handlers | 98-170 |
| `FloatingBlockMenu.tsx` | 9+ inline handlers | 170-251 |
| `TopicsPage.tsx` | Multiple inline onClick in loops | 275, 329, 358, 408, 434 |
| `NoteList.tsx` | Inline handlers in recursive render | 217, 235 |

**Fix**: Extract to `useCallback` or memoized handler factories.

---

## 10. Inline Style Objects — MEDIUM

Dynamic `style={{}}` objects create new references each render:

| File | Lines |
|------|-------|
| `TopicsPage.tsx` | 59, 384, 441 |
| `TagList.tsx` | 47 |
| `FontPicker.tsx` | 57, 87 |
| `FontPreview.tsx` | 30, 36, 42 |

---

## 11. Missing useMemo — MEDIUM

Expensive computations run on every render:

| File | Computation | Lines |
|------|-------------|-------|
| `HomePage.tsx` | `recentNotes` sort + slice | 97-99 |
| `HomePage.tsx` | `todayNotes` filter | 122-125 |
| `TodoList.tsx` | `sortedTodos` sort | 112-126 |

---

## 12. Editor Polling — MEDIUM

`MainLayout.tsx` polls for editor instance every 500ms instead of using callbacks:

```typescript
// Lines 140-154
const interval = setInterval(checkEditor, 500);
```

---

# Part 3: State Management Inefficiencies

## 13. Over-Fetching Store State — MEDIUM

Components subscribe to entire stores when only few fields needed:

| File | Issue |
|------|-------|
| `HomePage.tsx:84` | Subscribes to all `notes` just to compute `recentNotes` |
| `NoteList.tsx:35-48` | Subscribes to 5+ fields from `uiStore` and `fileTreeStore` |
| `NoteEditor.tsx:60-61` | Gets all `workspaces` array, searches for one |

---

## 14. Missing Zustand Selectors — MEDIUM

Stores lack granular selectors, forcing full subscriptions:

| Store | Missing Selectors |
|-------|-------------------|
| `uiStore.ts` | `useEditorUI`, `useSidebarUI`, `useListUI`, `useTheme` |
| `noteStore.ts` | `useFavoriteNotes`, `usePinnedNotes`, `useRecentNotes` |
| `workspaceStore.ts` | `useActiveWorkspace`, `useWorkspaceById` |

---

## 15. Waterfall Data Fetching — MEDIUM

Sequential fetches where parallel is possible:

| File | Pattern | Lines |
|------|---------|-------|
| `MainLayout.tsx` | `await loadWorkspaces()` blocks before parallel phase | 167-177 |
| `useWorkspaceAPI.ts` | `loadWorkspaces()` after switch is sequential | 43 |
| `useNotebookAPI.ts` | Full reload after `moveNotebook` | 109 |

---

## 16. State Not Derived — LOW

Stored state that could be computed:

| File | State | Should Be |
|------|-------|-----------|
| `notebookStore.ts` | `note_count` per notebook | Derived from `noteStore` |
| `fileTreeStore.ts` | `allFolderPaths` (manually synced) | Derived from `tree` |
| `workspaceStore.ts` | `activeWorkspaceId` | Selector on `workspaces` |

---

# Part 4: Code Duplication

## 17. Dual Icon Libraries — HIGH

Both `phosphor-react` (36 imports) and `lucide-react` (16 imports) used. Four files import both:

- `TasksPage.tsx` (lines 5-6)
- `HomePage.tsx` (lines 2-3)
- `GraphPage.tsx` (lines 7-8)
- `TopicsPage.tsx` (lines 6-7)

**Fix**: Consolidate to single icon library.

---

## 18. Duplicate Error Handling Patterns — MEDIUM

Same try/catch/loading/error pattern repeated in 7+ hooks:

- `useNoteAPI.ts`, `useTagAPI.ts`, `useTopicAPI.ts`, `useNotebookAPI.ts`
- `useGitAPI.ts`, `useSearchAPI.ts`, `useQuickCaptureAPI.ts`

Factory pattern exists (`createEntityAPI.ts`) but underutilized.

---

## 19. Logger vs Console Inconsistency — LOW

| Pattern | Files |
|---------|-------|
| Uses `logger.*` | Most hooks |
| Uses `console.*` | `useTopicAPI.ts` (20+ instances), `useDocumentBuffer.ts` |

---

## 20. Local State vs Store Pattern — LOW

Some hooks use local `useState` when store pattern expected:

- `useGitAPI.ts` — local state for status, commits, loading
- `useSearchAPI.ts` — local loading/error state

---

# Part 5: Bundle Inefficiencies

## 21. Large Components — MEDIUM

Components exceeding 450 lines (consider splitting):

| Component | Lines | Already Lazy? |
|-----------|-------|---------------|
| `FileTree.tsx` | 696 | No (always loaded) |
| `TasksPage.tsx` | 529 | Yes |
| `EditorToolbar.tsx` | 474 | No (part of editor) |
| `TopicsPage.tsx` | 458 | Yes |
| `NoteEditor.tsx` | 448 | Yes |
| `CommandCenter.tsx` | 420 | No |

---

## Summary: Inefficiency Priorities

| Priority | Category | Items | Impact |
|----------|----------|-------|--------|
| **P0** | Missing memoization | 5 list components | Re-renders scale with list size |
| **P0** | Inline handlers | 70+ in EditorToolbar alone | Constant re-creation |
| **P1** | Dual icon libraries | 4 files | 2x icon bundle size |
| **P1** | Over-fetching stores | 3+ components | Unnecessary re-renders |
| **P1** | Missing selectors | 3 stores | No granular subscriptions |
| **P2** | Missing useMemo | 3 computations | Recalculates on each render |
| **P2** | Waterfall fetching | 3 locations | Delayed startup |
| **P2** | Editor polling | 1 location | Unnecessary CPU |
| **P3** | Duplicate patterns | 7+ hooks | Maintenance burden |
| **P3** | Logger inconsistency | 2 hooks | Debug confusion |
