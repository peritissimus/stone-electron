# Sidebar and Navigation Architecture Fix Plan

## Goal

Remove structural bottlenecks in sidebar composition, routing, and selection state so future navigation features can be added without hardcoded destinations, duplicated selection logic, or folder-name branching. Scope is bounded to renderer-side navigation/layout — backend hexagonal boundaries stay untouched.

## Non-goals

- No changes to main-process domain, use cases, adapters, or IPC channel shapes.
- No editor, settings, ML, or git-sync feature work beyond removing layer violations incidentally introduced in this layer.
- No redesign of persistence, note identity, or notebook semantics.

## Ground truth from audit

| Area                  | File                                                                          | What's there today                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Sidebar destinations  | `src/renderer/components/composites/layout/Sidebar.tsx:67-93`                 | Four hardcoded `QuickLink`s: Home, Tasks, Graph, Topics; active state via `location.pathname` string match           |
| Sidebar co-mingling   | `Sidebar.tsx:46-65, 96-98, 101, 104`                                          | Workspace selector, `<FileTree />`, `<GitSyncButton />`, `<MLStatusIndicator />` all wired inline                    |
| Routes                | `src/renderer/pages/routes.tsx`                                               | `/home`, `/tasks`, `/graph`, `/topics`, `/note/:noteId`; only note id is in the URL                                  |
| Router shell          | `src/renderer/App.tsx`                                                        | `HashRouter` + `<Route path="/*" element={<MainLayout />} />`                                                        |
| Selection stores      | `noteStore.activeNoteId`, `notebookStore.activeNotebookId`, `workspaceStore.activeWorkspaceId`, `fileTreeStore.activeFolder`/`selectedFile` | Four independent stores each holding a piece of "what's open"                                |
| URL→store sync        | `MainLayout.tsx:103-107`                                                      | `useEffect` pulls `noteId` from params and calls `setActiveNote(noteId)` — reactive, not atomic                      |
| Multi-store + navigate | `FileLeaf.tsx:50-51,61,72`, `FileTree.tsx:43,47`, `useJournalActions.ts:64-75`, `MainLayout.tsx:156-165` | Every "open a note" path manually sets 2–3 stores then calls `navigate()`                                         |
| Folder-name branching | `useJournalActions.ts:21, 89, 120, 170`                                       | Hardcoded `'Journal'` folder path + `filePath?.includes('Journal')`; journal semantics leak into UI logic            |
| Dead layout seam      | `LayoutContainer.tsx:25,28,46,120-130`; `MainLayout.tsx:274,277`              | `noteList` prop always `null`, `showNoteList` always `false` — never consumed                                        |
| Layer violation       | `LayoutContainer.tsx:54-56, 72-92`                                            | Shell component imports `useWorkspaceAPI`, `useFileTreeAPI`, `useNoteAPI`, runs sync orchestration inline in onClick  |
| Renderer tests        | none (`src/renderer/**/*.test.*` empty)                                       | No existing coverage for sidebar, stores, routing, or file tree                                                      |

## Priority order (unchanged intent, reordered by effort/risk)

1. **§5 first — delete the dead panel seam** (trivial, no design decisions).
2. **§1 — nav descriptor layer** (pure rendering refactor, no behavior change).
3. **§3 — route-first selection ownership** (the real unlock; decides where each field lives).
4. **§2 — collapse selection state** (falls out of §3; mostly deletion).
5. **§4 — replace journal folder-name branching with a typed destination** (smallest real instance of folder coupling).

---

## 1. Delete the dead panel seam (formerly §5)

### Problem
`LayoutContainer` exposes `noteList`/`showNoteList`/`noteListWidth` props, `MainLayout` passes `null`/`false`, and nothing else consumes them. The shell component also owns sync-button orchestration — three API hooks and an onClick that reloads workspaces, file tree, and notes inline — violating the component → hooks → stores → api dependency rule in CLAUDE.md §16.

### Fix
- Remove `noteList`, `showNoteList`, `noteListWidth`, `onNoteListWidthChange` from `LayoutContainer` props and the rendering branch at `LayoutContainer.tsx:120-130`.
- Remove their pass-through in `MainLayout.tsx:274-277`.
- Extract the sync orchestration into a `useWorkspaceSync()` hook; `LayoutContainer` keeps only `onSyncClick` wiring, not the hook imports.
- Do **not** invent a replacement panel model speculatively. Introduce it when the second panel shows up.

### Exit criteria
- `grep -r 'noteList' src/renderer/` returns zero matches.
- `LayoutContainer.tsx` no longer imports `useWorkspaceAPI`, `useFileTreeAPI`, `useNoteAPI`, `useFileTree`.
- Visual behavior unchanged (verified by running the app and toggling sidebar).

### Estimated blast radius
2 files, ~40 lines removed, ~15 lines moved into a new hook.

---

## 2. Nav descriptor layer (formerly §1)

### Problem
Four top-level destinations are rendered inline with `navigate()` callbacks and `currentPath === '/x'` active checks. Adding a fifth means editing `Sidebar.tsx` control flow. The sidebar also directly renders three feature components (`<FileTree />`, `<GitSyncButton />`, `<MLStatusIndicator />`) alongside navigation.

### Fix
Introduce a typed descriptor in `src/renderer/navigation/` (new directory):

```ts
// src/renderer/navigation/types.ts
export interface NavDescriptor {
  id: string;               // 'home' | 'tasks' | 'graph' | 'topics' | ...
  path: string;             // '/home'
  label: string;
  icon: ReactNode;
  isActive: (pathname: string) => boolean;
  section: 'primary';       // room for 'secondary' later, not populated now
}
```

- Move the four current destinations into `navigation/destinations.ts` as a frozen array.
- Rewrite `Sidebar.tsx:67-93` to `.map()` over the array.
- Extract the workspace selector (lines 46-65), FileTree region (96-98), and status rail (101, 104) into three sibling components composed by `Sidebar` — no behavior change, just moves the seams.
- Descriptor visibility rules (`isVisible?: () => boolean`) and badges are **not** added now; add when the first consumer needs them.

### Exit criteria
- `Sidebar.tsx` contains no literal path strings or hardcoded destination labels.
- Adding a fifth destination requires one entry in `destinations.ts` and zero edits to `Sidebar.tsx`.
- Snapshot/visual diff shows no rendered change.

### Estimated blast radius
1 new directory (3–4 small files), `Sidebar.tsx` drops from 107 to ~50 lines.

---

## 3. Route-first selection ownership (formerly §3)

### Problem
Identity for an opened note is held in both `/note/:noteId` and `noteStore.activeNoteId`. Every "open a note" path (FileLeaf, FileTree, journal hook, MainLayout create) manually updates 2–3 stores, then calls `navigate()`. URL→store sync happens reactively in `MainLayout.tsx:103-107`.

### Fix — explicit per-field ownership (per CLAUDE.md §23)

| Field                      | Owner after refactor | Why                                                                         |
| -------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `activeNoteId`             | **Route** (`/note/:noteId`) | Already in URL; store field becomes a selector over route params       |
| `activeWorkspaceId`        | **Store** (`workspaceStore`)| Session-scoped, not user-shareable via URL; unchanged                   |
| `activeNotebookId`         | **Store** (`notebookStore`) | Same reasoning; unchanged                                              |
| `activeFolder`/`selectedFile` | **Derived** from route + workspace | When `/note/:noteId` is open, folder/selected-file derive from the note's `filePath`; eliminates manual syncing in FileLeaf/FileTree/journal hook |

### First moves
- Add `useActiveNoteId()` hook returning `useParams().noteId` — replace every `useNoteStore(s => s.activeNoteId)` read with it. Delete `activeNoteId` from `noteStore` once read sites are migrated.
- Add `useSelectedFile()` that derives `{ folder, file }` from active note's `filePath`. Replace the manual `setActiveFolder`/`setSelectedFile` calls in `FileLeaf.tsx`, `FileTree.tsx`, and `useJournalActions.ts` with a single `navigateToNote(noteId)` action that only calls `navigate()`.
- Remove the URL→store effect at `MainLayout.tsx:103-107`.
- `fileTreeStore` keeps only tree-expansion state (which folders are open), not selection.

### Exit criteria
- `grep -r 'setActiveNote\b' src/renderer/` returns zero matches.
- `grep -r 'setSelectedFile\b' src/renderer/` returns zero matches outside the fileTreeStore expansion logic.
- `navigateToNote(id)` is the only function that opens a note; callers don't touch stores.
- Round-trip test: manually typing `/#/note/:id` in the URL opens the note with correct folder expansion.

### Estimated blast radius
~6 call sites migrated, 2 store fields deleted, 1 effect removed.

---

## 4. Collapse selection state (formerly §2)

### Problem
Same as §3. Listed separately because the *deletion* of duplicated state and the *derivation* of secondary state happen after §3's route-ownership decision lands.

### Fix
- After §3 migrations, delete `activeNoteId` from `noteStore`.
- Delete `selectedFile` and `activeFolder` from `fileTreeStore` if they're no longer read (tree expansion state stays).
- Keep `activeWorkspaceId` and `activeNotebookId` in their stores.
- Audit `useNoteStore` / `useNotebookStore` / `useWorkspaceStore` for any remaining cross-store `set*` combos — there should be none.

### Exit criteria
- Each "open a note" call site is a single function call (no multi-store setter sequences).
- `TypeScript` removal of the deleted fields surfaces zero stale readers.

---

## 5. Replace journal folder-name branching with a typed destination (formerly §4)

### Problem
`useJournalActions.ts` encodes journal as the string `'Journal'` (file path at line 21, folder path at lines 120 and 170, substring match at line 89). If a user renames or relocates their journal folder, navigation breaks. The name leaks into renderer logic that should only know about destinations.

### Fix
- Add a `JournalDestination` typed resource resolved via an existing backend use case (journal location already lives in main process config — confirm and reuse; do not re-derive in renderer).
- Renderer calls `journalApi.openOrCreateToday()` which returns `{ noteId }`; renderer navigates via `navigateToNote(noteId)` from §3.
- `useJournalActions.ts` becomes a thin wrapper over the API; `getJournalInfoForDate`, hardcoded `'Journal'` folder path, and `filePath?.includes('Journal')` all deleted.

### Out of scope for this plan
Other "special" destinations (smart views, search results, quick capture) are **not** added now. The typed-destination shape is introduced only for journal because it's the one concrete instance in the audit. Generalize when a second instance appears.

### Exit criteria
- `grep -r "'Journal'" src/renderer/` returns zero matches (outside test fixtures).
- `grep -r "includes('Journal')" src/renderer/` returns zero matches.
- Renaming the journal folder in workspace config doesn't break today/yesterday shortcuts.

### Estimated blast radius
`useJournalActions.ts` loses ~80 lines; one renderer API method added; one main-process use case possibly exposed via IPC (check first — it may already be).

---

## Test seeding (new section)

Zero renderer tests exist. Before §3 lands (the riskiest change), add the minimum viable harness:

- Vitest + React Testing Library config for `src/renderer/` (reuse existing `vitest.config.ts`).
- One test per phase's exit criteria, not exhaustive coverage:
  - §1: `Sidebar` renders one `QuickLink` per descriptor (array-driven).
  - §3: `navigateToNote(id)` updates URL only; `useActiveNoteId()` reflects `useParams`.
  - §5: `useJournalActions` calls the API and `navigateToNote`, without reading folder strings.
- Stub IPC via a thin `window.electron` mock; don't stand up the main process.

---

## Phased execution

| Phase | Sections | Effort | Depends on |
| ----- | -------- | ------ | ---------- |
| P1    | §1 (dead panel) + layer-leak extraction | ~0.5 day | — |
| P2    | Test harness + §2 (descriptors) | ~1 day | P1 |
| P3    | §3 (route ownership) + §4 (selection collapse) | ~2 days | P2 |
| P4    | §5 (journal destination) | ~0.5 day | P3 |

Each phase is a separate PR. P3 is the only risky one; hold behind the test harness from P2.

---

## Success criteria (testable)

- Adding a fifth top-level destination: diff is +1 entry in `destinations.ts`, 0 edits to `Sidebar.tsx`. Grep-verifiable.
- `grep -r 'setActiveNote\b' src/renderer/` → 0 matches (except inside the deleted code's git history).
- `grep -r "'Journal'" src/renderer/` → 0 matches outside test fixtures.
- `LayoutContainer.tsx` imports no `*API` hooks.
- Opening a note via URL paste, sidebar click, file tree click, and journal shortcut all funnel through one `navigateToNote(id)` call site. Verified by call-graph inspection or a lint rule.
- TypeScript compiles with selection fields removed from their old stores — if any reader was missed, the build fails.

## Risks

- **§3 migration order matters.** Delete the URL→store effect (`MainLayout.tsx:103-107`) *last*, after all readers migrate to `useActiveNoteId()`. Deleting first leaves readers reading a stale store.
- **Workspace sync hook extraction** from §1 must preserve the existing load order (`syncWorkspace → loadWorkspaces → loadFileTree → loadNotes`); out-of-order loads cause empty-state flashes.
- **Journal IPC surface.** If journal location isn't already exposed via an existing main-process use case, adding one is in-scope for §5 and must follow CLAUDE.md's hexagonal rules (port/use case/adapter/IPC), not a shortcut.
