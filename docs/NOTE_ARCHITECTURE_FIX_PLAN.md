# Note Architecture Fix Plan

## Goal
Remove structural bottlenecks in note editing/management and settings/config so future note features can be added without spreading file-shape logic, folder conventions, or config migration logic across use cases and infrastructure.

## Priority order
1. Note document boundary
2. Canonical note metadata ownership
3. Unified typed settings/config boundary
4. Configurable note location/workspace policy
5. Consolidated note write policy
6. Stable note identity separate from file path

## 1. Normalize note document parsing/serialization
### Problem
Note title/body/markdown shape is currently assembled directly in use cases, and read/write behavior is asymmetric.

### Fix
Introduce a single note document boundary responsible for:
- parsing markdown into title, body, and metadata
- serializing note edits back to markdown
- defining the canonical rules for headings, frontmatter, and empty/default values

### Target shape
- domain/app-facing `NoteDocument` or equivalent typed model
- one application dependency/port for parse + serialize
- use cases stop concatenating markdown strings manually

### First moves
- move `# {title}\n\n{content}` logic out of note use cases
- make reads and writes round-trip through the same document rules
- define whether frontmatter is supported now or reserved but structurally allowed

## 2. Define canonical note metadata ownership
### Problem
Metadata is split between DB columns, inferred file content, and sync-time extraction rules.

### Fix
Define a canonical metadata model and explicit ownership for each field.

### Normalize around
- stable note identity
- title
- tags
- pinned/favorite/status-like flags
- timestamps
- path/location
- future extensible properties

### Decision required
For each field, define whether the source of truth is:
- file content/frontmatter
- database
- derived/cache-only

### First moves
- create a typed metadata contract used by note reads, writes, and sync
- stop partial extraction rules that only update title on file changes
- document conflict-resolution rules for file-vs-db discrepancies

## 3. Unify settings/config behind one typed boundary
### Problem
Settings are split across DB key/value storage and app config JSON, with migration logic leaking into infrastructure.

### Fix
Move to a single typed settings/config boundary with one repository abstraction.

### Normalize around
- app-wide settings model grouped by capability
- internal migration/versioning hidden behind the repository
- typed accessors for note/editor/workspace behavior

### First moves
- define one typed settings root model
- classify existing settings into capability groups: appearance, workspace, editor, note behavior
- deprecate direct generic key/value access outside the repository layer

## 4. Replace folder-name conventions with configurable policies
### Problem
Behavior depends on hardcoded folder names like `Personal` and `Journal`.

### Fix
Introduce configurable note location/workspace policies.

### Normalize around
- default note destination
- journal/daily-note destination and naming
- workspace root behavior
- folder/category semantics as config, not business logic

### First moves
- remove special handling keyed to literal folder names
- replace seed assumptions with config-backed defaults
- define a typed policy object for note placement and collection behavior

## 5. Consolidate note mutations behind a note write policy
### Problem
Create/update/save/rename flows each own part of note mutation behavior.

### Fix
Centralize note mutation orchestration behind one policy/service so all note writes follow the same rules.

### Normalize around
- create note
- update title/body/metadata
- rename/move
- autosave/manual save
- future link/template/conflict hooks

### First moves
- inventory overlapping responsibilities across note write use cases
- define shared mutation steps: load, apply change, serialize, persist, sync indexes/metadata
- keep user-intent use cases, but route write mechanics through a shared boundary

## 6. Decouple note identity from file path
### Problem
Path strings currently carry too much domain meaning.

### Fix
Make note ID the primary domain identity and treat path as mutable storage metadata.

### Normalize around
- ID-based note operations in application/domain
- path as repository/storage concern
- path changes modeled as move/rename operations, not identity changes

### First moves
- audit use cases that infer note semantics from relative path strings
- reduce path-based branching in retrieval and sync logic
- prepare for aliases, moves, virtual collections, and cross-workspace references

## Suggested implementation sequence
### Phase 1: Contracts
- define note document contract
- define canonical note metadata model
- define unified typed settings model
- define configurable note location policy

### Phase 2: Application refactor
- refactor note read/write use cases to use document + metadata boundaries
- route settings access through unified typed repository
- remove hardcoded folder semantics from note flows

### Phase 3: Sync and migration
- update workspace sync to reconcile canonical metadata
- migrate legacy settings into unified typed config storage
- add migration rules for existing note content/metadata assumptions if needed

### Phase 4: Feature unlocks
Once normalized, the codebase is in a better position to support:
- structured note properties/frontmatter
- templates
- daily notes and custom collections
- richer editor behaviors/preferences
- rename/move with stable references
- workspace-specific note policies

## Success criteria
- note use cases no longer build markdown strings directly
- every note metadata field has a declared source of truth
- settings access is typed and centralized
- note behavior does not depend on literal folder names
- note identity is stable even when file location changes
