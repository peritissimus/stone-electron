# Hybrid Storage Plan: SQLite + `.stone/` Files

Research-only analysis — not yet approved for implementation.

## Premise

Stone currently uses SQLite (Drizzle + libsql) as the primary persistence for almost everything, with `AppConfigRepository` (`config.json`) as the sole file-backed adapter — now holding appearance, editor settings, and shortcuts after the recent settings rollout.

The question: **which features genuinely need a query engine, and which are in the DB just because the DB is there?**

Notes already live as `.md` files on disk. The DB mostly indexes/mirrors them. A hybrid model can push more metadata onto the filesystem (git-friendly, portable, human-readable) and leave SQLite as a pure index/search layer.

---

## 1) What's DB-shaped today

| Entity / Repo | Key operations | Indexes | Verdict |
|---|---|---|---|
| **Note** (`INoteRepository`) | findById, findByNotebookId, findByWorkspaceId, findByFilePath, searchByTitle, count | 8 indexes incl. flags (favorite/pinned/archived), timestamps | Hybrid — core index stays DB; flags → frontmatter |
| **Notebook** (`INotebookRepository`) | findByWorkspaceId, findByParentId, hierarchy ops | workspace, parent, folderPath | File-shaped |
| **Tag** (`ITagRepository`) | findAllWithCounts (N+1 loop), findByNoteId, junction ops | tag name, note→tag links | File-shaped (with in-memory index) |
| **NoteLink** (`INoteLinkRepository`) | getBacklinks, getForwardLinks | (sourceId, targetId) | **DB-essential** (graph queries) |
| **Topic** + centroids (`ITopicRepository`) | findByNoteId, centroid blobs, confidence scores | 3 indexes + 384-dim F32_BLOBs | **DB-essential** (vector ops) |
| **Attachment** (`IAttachmentRepository`) | findByNoteId | noteId | File-shaped (frontmatter) |
| **Version** (`IVersionRepository`) | findAllForNote, append on save | noteId | File-shaped (append log) |
| **Workspace** (`IWorkspaceRepository`) | findAll, findActive | isActive, folderPath | File-shaped |
| **Settings (legacy)** (`ISettingsRepository`) | free-form KV | key PK | Already deprecated for typed prefs |
| **Search** (`ISearchEngine`) | full-text, semantic, hybrid, byTags, byDateRange | FTS5 (partial), embeddings | **DB-essential** (FTS5 + vector distance) |

**DB-essential:** NoteLinks graph, topic centroids, embeddings, FTS index. Everything else is a candidate to move.

---

## 2) What could move to files without much pain

| Feature | Current | Proposed layout | Size | Pain |
|---|---|---|---|---|
| Workspace registry | `workspaces` table | `.stone/workspaces.json` | <50KB | Trivial — no FKs, read once |
| Notebook tree | `notebooks` table | `.stone/{wsId}/notebooks.json` | <500KB | Low — tree already implicit in folder structure |
| Tag catalog | `tags` + `note_tags` junction | `.stone/{wsId}/tags.json` + IDs in frontmatter | <200KB | Low — build in-memory index on cold start |
| Note flags | `notes.isFavorite/isPinned/isArchived` | Frontmatter YAML | Per-note | Low — already in memory when editing |
| Attachments metadata | `attachments` table | Frontmatter `attachments: [...]` | Per-note | Low |
| Note versions | `note_versions` table | `.stone/{wsId}/versions/{noteId}.json` append log | <10MB/ws | Low — lazy-load for history panel |
| Recents / UI state | Scattered | `.stone/{wsId}/state.json` or `AppConfig` | <10KB | Trivial |

---

## 3) Strongest hybrid model

```
.stone/                              (workspace-local, git-trackable)
├── config.json                      (✅ exists — appearance, editor, shortcuts)
├── workspaces.json                  (registry: id, name, path, isActive)
└── {workspaceId}/
    ├── metadata.json                (lastAccessedAt, noteCount, syncState)
    ├── notebooks.json               (tree: id, name, parentId, folderPath, icon, color, position)
    ├── tags.json                    (catalog: id, name, color, timestamps)
    ├── state.json                   (UI: activeNoteId, expanded notebooks, sidebar width)
    └── versions/
        └── {noteId}.json            (append-only: [{ versionNumber, content, createdAt }])

Per-note frontmatter (YAML):
  ---
  id: note-123
  title: "My Note"
  notebook_id: nb-456
  tags: [tag-1, tag-2]               # IDs only; names resolved via tags.json
  is_favorite: false
  is_pinned: true
  is_archived: false
  attachments:
    - { filename: "image.png", mimeType: "image/png", size: 2048, path: ".attachments/image.png" }
  created_at: 2025-04-21T10:00:00Z
  updated_at: 2025-04-21T10:00:00Z
  ---
  # Note body...

SQLite (workspace DB)                (hidden index, not in git)
├── notes (lightened: id, filePath, workspaceId, timestamps, embedding)
├── noteLinks                        (graph: sourceId → targetId)
├── topics + noteTopics              (centroids, classification)
└── settings                         (deprecated free-form KV)
```

**Why this split:**

| Layer | Content | Rationale |
|---|---|---|
| `.stone/` JSON | Workspace, notebooks, tags, versions, UI state | Portable, git-friendly, low cardinality, no joins needed, loads into memory once |
| Frontmatter | Flags, tags list, attachments, timestamps | Travels with the note; no separate read; hand-editable; diffs well |
| SQLite | Graph, embeddings, centroids, FTS | Requires vector ops, indexed FK joins, distance queries — genuinely query-heavy |

**Tradeoffs accepted:**
- Cold-start loads `.stone/*.json` fully — fine up to ~10k notes.
- Tag renames require rewriting all matching frontmatter (debounce + batch).
- Atomic writes needed (temp + rename) to avoid corruption.
- SQLite DB becomes rebuildable from files (useful for recovery; new pitfall if out of sync).

---

## 4) Migration path (minimum churn)

Hexagonal architecture makes this almost mechanical: introduce new OUT-port implementations, swap via DI, leave domain/application untouched. Exactly the pattern `AppConfigRepository` set.

**Phase 1 — parallel adapters (non-breaking)**
- Create file-backed implementations of existing OUT ports:
  - `FileBackedWorkspaceRepository : IWorkspaceRepository`
  - `FileBackedNotebookRepository : INotebookRepository`
  - `FileBackedTagRepository : ITagRepository`
  - `FrontmatterNoteRepository` (composes over `NoteRepository` — reads frontmatter, DB for graph/embeddings)
- Feature flag in DI container: `useFileStorage: { workspaces, notebooks, tags, ... }`
- Zero domain/application changes.

**Phase 2 — dual-write / cold-start handoff**
- On launch: load `.stone/workspaces.json`, `.stone/{wsId}/notebooks.json`, `tags.json` into stores.
- Writes go to both files and DB; DB becomes shadow.
- Parity check on open; flag divergence.

**Phase 3 — per-feature cutover (ordered by risk)**
1. Workspace registry (trivial, no FKs)
2. Notebook tree (medium — sidebar tree uses it)
3. Tags (medium — search + sidebar filters; need in-memory index)
4. Note flags (easy — already conceptually per-note)
5. Attachments metadata (easy, low cardinality)
6. Versions (deferred, optional)

**Phase 4 — optimize and deprecate**
- In-memory indexes: `Map<tagId, TagProps>`, `Map<tagName, TagId>`, notebook tree + flat ID index.
- Debounced persistence for hot writes (tag catalog).
- Drop dual-write; delete legacy DB columns/tables.

**Sharp edges:**
1. **Concurrent writes** — frontend note frontmatter ↔ backend save. Fix: atomic temp+rename.
2. **DB↔file divergence** during dual-run. Fix: always write both; parity check on open; recovery flow.
3. **Large tag catalog churn** — rewriting `tags.json` per keystroke is wasteful. Fix: cache in memory, debounce.
4. **Graph queries still need DB** — `findBacklinks` can't scan all `.md` files. Accepted: keep `noteLinks` table.
5. **SQLite rebuild from files** — useful for recovery but needs an explicit "reindex" path.

**Testing strategy:**
- Unit: each file-backed adapter against a temp `.stone/` dir.
- Integration: DB↔file parity checks on workspace open.
- E2E: offline scenario, multi-device via git, recovery after divergence.

---

## Recommendation

The cleanest order, if the user green-lights implementation:
1. **Workspaces first** — trivial, high symbolic value (proves the pattern past `AppConfig`).
2. **Tags second** — the N+1 in `findAllWithCounts` is a real perf bug that goes away with an in-memory index.
3. **Notebooks third** — bigger change to sidebar rendering but mostly mechanical.
4. **Flags / attachments / versions** — opportunistic, can be bundled with other feature work.
5. **Never** — note graph (links), embeddings, topic centroids, FTS5. These are what SQLite is for.
