# Stone - Development Guide for Claude

## Release Notes 0.1.4

Date: 2025-11-03

Highlights
- Content architecture finalized: files are the source of truth; database stores metadata only. Migration drops `notes.content`.
- TipTap editor integrated with autosave, content loading, and improved header/toolbar styling.
- File system sync: workspaces sync with disk on startup; markdown renames emit repository events.
- UI/UX polish across editor and layout with macOS-style spacing and tokens.
- Logger adoption across scripts/handlers (replaces console logging).

New
- Editor
  - Note Editor components for content, header, and empty state.
  - Autosave after inactivity; silent saves write to file without store churn.
  - Content loading via new hooks; HTML persisted to markdown files on disk.
- IPC
  - `notes:getContent` channel to lazily load content from file.
  - Refactor: centralized all channel registration; array-based `all_channels` for consistency.
- File System / Repositories
  - Workspace sync on startup scans folders and aligns DB metadata.
  - Emits events on markdown file rename to keep references fresh.
- UI
  - Enhanced editor header and sync button styling; spacing aligned to tokens.
  - Sidebar/file tree refinements; folder file counts and active folder state.

Fixes
- Correct typing for `ALL_EVENTS` in IPC channel constants.
- Folder segment counting logic in workspace handlers.

Breaking/Migrations
- Migration 0002 removes `notes.content` column. Database now stores metadata only.
- Content is always read/written from files. List/search return metadata only.

Upgrade Notes
- Run migrations and rebuild before testing:
  - pnpm install
  - pnpm build:main && pnpm build:renderer
  - Start app: pnpm dev:electron
- If schema conflicts occur, delete the local DB to re-run migrations (see migrations/).
- Update any code that previously read `note.content` from DB:
  - Use repository method: `repos.note.getContentById(id)` or IPC `notes:getContent`.
  - Write updates via file content paths; DB stays metadata-only.

Developer Notes
- Always use pnpm commands (never npm/yarn).
- If `better-sqlite3` errors occur after upgrades, rebuild native modules:
  - pnpm electron-rebuild -f -w better-sqlite3
- Maintain macOS aesthetic and composite components; avoid inline classes.

## Keyboard Shortcuts

Stone includes a comprehensive keyboard shortcut system with platform-aware detection (Cmd on macOS, Ctrl on Windows/Linux).

### Available Shortcuts

- **Cmd+S** (Ctrl+S on Windows/Linux) - Save current note
- **Cmd+N** (Ctrl+N on Windows/Linux) - Create new note in current folder
- **Cmd+Shift+P** (Ctrl+Shift+P on Windows/Linux) - Create new personal note (in Personal folder)
- **Cmd+Shift+W** (Ctrl+Shift+W on Windows/Linux) - Create new work note (in Work folder)
- **Cmd+Shift+M** (Ctrl+Shift+M on Windows/Linux) - Toggle editor mode (rich text ↔ raw markdown)
- **Cmd+J** (Ctrl+J on Windows/Linux) - Open or create today's journal
- **Cmd+K** (Ctrl+K on Windows/Linux) - Open Command Center (search notes, run commands)
- **Cmd+\\** (Ctrl+\\ on Windows/Linux) - Toggle sidebar
- **Cmd+Shift+H** (Ctrl+Shift+H on Windows/Linux) - Go home
- **Cmd+W** (Ctrl+W on Windows/Linux) - Close current note
- **Cmd+,** (Ctrl+, on Windows/Linux) - Open settings

### Implementation

**Architecture:**
- `useKeyboardShortcuts` hook (`src/renderer/hooks/useKeyboardShortcuts.ts`) - Platform-aware keyboard event handling
- `NoteEditor` component exposes actions via `useImperativeHandle` for external triggers
- `MainLayout` component integrates shortcuts and passes refs to editor
- Shortcuts are disabled in input fields (except contenteditable editor)

**Adding New Shortcuts:**
1. Add action type to `ShortcutAction` union in `shortcutsStore.ts`
2. Add default shortcut definition to `DEFAULT_SHORTCUTS` array in `shortcutsStore.ts`
3. Add handler to `actionHandlers` in `useAppShortcuts.ts`
4. Add action ID to `shortcutIds` array in `useAppShortcuts.ts`
5. Add callback option to `UseAppShortcutsOptions` interface if needed
6. Wire up the handler in `MainLayout.tsx`

**Helper Functions:**
- `isMacOS()` - Platform detection
- `getModifierLabel()` - Returns '⌘' or 'Ctrl'
- `formatShortcut(key, meta, shift, alt)` - Format shortcuts for display (e.g., "⌘S" or "Ctrl+S")

**UI Integration:**
- Save button tooltip shows "Save changes (⌘S)"
- Settings button tooltip shows "Settings (⌘,)"
- All shortcuts use platform-appropriate symbols


## Node.js Version

This project requires **Node.js 20.16.0**. Use the included `.nvmrc` file:

```bash
nvm use          # Switch to correct Node.js version
nvm install      # Install if not available
```

All environments (development, testing, building) use the same Node.js version for consistency.

## Essential Commands

### Running the App

```bash
pnpm dev:electron          # Run in development mode
pnpm start                 # Run production build
```

### Building

```bash
pnpm build                 # Build all (main, preload, renderer)
pnpm build:main            # Build main process
pnpm build:preload         # Build preload script
pnpm build:renderer        # Build renderer (UI)
```

### Dependencies

```bash
pnpm install               # Install all dependencies
```

### Native Modules (better-sqlite3)

better-sqlite3 needs to be compiled for the specific Node.js version:

```bash
pnpm rebuild:electron      # Rebuild for Electron (app development)
pnpm rebuild:node          # Rebuild for Node.js (tests)
```

**When to rebuild:**

- After Node.js/Electron updates
- When switching between app development and testing
- If you get "NODE_MODULE_VERSION" errors

### shadcn/ui Components

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add dialog select tabs input
```

## Project Structure

```
stone/
├── src/
│   ├── main/              # Electron main process
│   │   ├── database/      # SQLite database management
│   │   ├── ipc/           # IPC handlers
│   │   └── repositories/  # Data access layer
│   ├── renderer/          # React UI
│   │   ├── components/    # React components
│   │   │   ├── ui/        # shadcn components
│   │   │   ├── Layout/    # Main layout components
│   │   │   ├── Editor/    # TipTap editor
│   │   │   ├── Notebook/  # Notebook tree
│   │   │   ├── Tag/       # Tag management
│   │   │   └── Settings/  # Settings modal
│   │   ├── stores/        # Zustand state management
│   │   ├── hooks/         # React hooks
│   │   └── lib/           # Utility functions
│   ├── preload.ts         # Electron preload script
│   └── shared/            # Shared types and constants
├── migrations/            # Database migrations (SQL)
└── dist/                  # Build output

```

## Tech Stack

- **Framework**: Electron + React + TypeScript
- **UI**:
  - shadcn/ui (Radix UI primitives)
  - Tailwind CSS (Notion-inspired design)
  - Lucide icons
- **Editor**: TipTap (rich text editor) with syntax highlighting
  - CodeBlockLowlight for code blocks
  - Lowlight (highlight.js) for syntax highlighting
  - Supports 19+ programming languages
  - Notion-like design and interactions
- **Database**: better-sqlite3
- **State**: Zustand
- **Build**: Vite

## Path Aliases

TypeScript and Vite are configured with these aliases:

```typescript
@/           → src/
@main/       → src/main/
@renderer/   → src/renderer/
@shared/     → src/shared/
```

## Design System

The app follows Notion's design principles with:

- **Font**: System fonts (SF Pro / Segoe UI / Helvetica Neue)
- **Colors**: Clean whites and subtle grays with blue accent
- **Border radius**: 6px (Notion-style)
- **Font size**: 16px base (editor), 13px (UI)
- **Layout**: Wide, spacious editor (900px max-width)
- **Interactions**: Hover states on blocks, smooth transitions

### CSS Variables

Available in both light and dark mode:

- `--background`, `--foreground`
- `--sidebar` (for sidebar background)
- `--primary`, `--primary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--border`, `--input`, `--ring`

## Native Modules

The project uses `better-sqlite3` which requires native compilation:

```bash
pnpm electron-rebuild -f -w better-sqlite3
```

This runs automatically via the `postinstall` script.

## Database

- **Location**: `~/Library/Application Support/Stone/stone-data/notes.db`
- **Migrations**: SQL files in `migrations/` directory
- **Format**: SQLite with FTS5 for full-text search

### Architecture: Content Storage

**IMPORTANT: Content is stored in FILES, NOT in the database.**

- **Database** = Metadata only (title, flags, timestamps, paths)
- **Files** = Actual note content (markdown files)
- **Source of Truth** = Files on disk

### Tables

- `notebooks` - Hierarchical notebook organization
- `notes` - Metadata only (NO content field - removed in migration 0002)
- `tags` - Tags for categorization
- `note_tags` - Many-to-many relationship
- `attachments` - File attachments
- `note_versions` - Version history (NO content field)
- `notes_fts` - Full-text search on title only

### Content Loading

```typescript
// Get metadata (fast - from DB)
const note = await repos.note.findById(id);
// { id, title, filePath, flags, timestamps }

// Get content (lazy - from file)
const content = await repos.note.getContentById(id);
// HTML converted from markdown file
```

### Why This Architecture?

1. **Performance** - List views don't load file content
2. **Scalability** - Large notes don't bloat the database
3. **Separation** - Clear boundary between metadata and content
4. **Git-friendly** - Markdown files can be version controlled
5. **No re-renders** - Autosave writes to file without updating store

## Publishing & Distribution

### Building for Distribution

```bash
pnpm build                 # Build all components
pnpm package              # Package for current platform
pnpm package:dir          # Package without installers (faster, for testing)
pnpm package:all          # Package for all platforms (macOS, Windows, Linux)
```

### Icon Assets

Icons are located in `build/` directory:
- `icon.svg` - Source SVG logo
- `icon.png` - Linux icon (1024x1024)
- `icon.icns` - macOS icon
- `icon.ico` - Windows icon

To regenerate icons from the SVG:
```bash
./scripts/convert-icons.sh
```

### Code Signing

**macOS:**
- Set `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables
- Update `electron-builder.yml` to remove `identity: null`
- Requires Apple Developer ID certificate

**Windows:**
- Set `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables
- Update `electron-builder.yml` with certificate path

### GitHub Releases

Two workflows are configured:

1. **Build & Test** (`.github/workflows/build.yml`)
   - Runs on every push and PR
   - Tests builds on all platforms
   - Validates code with typecheck and tests

2. **Release** (`.github/workflows/release.yml`)
   - Triggered by version tags (e.g., `v0.1.0`)
   - Builds for macOS, Windows, and Linux
   - Creates draft GitHub release with artifacts
   - Upload binaries for distribution

To create a release:
```bash
git tag v0.1.1
git push origin v0.1.1
```

### Distribution Formats

- **macOS**: DMG and ZIP
- **Windows**: NSIS installer and portable EXE
- **Linux**: AppImage and Deb package

### Troubleshooting Packaged Builds

**Common Issues:**

1. **Native module errors (libsql, better-sqlite3)**
   - Ensure `.npmrc` contains `node-linker=hoisted` and `shamefully-hoist=true`
   - pnpm's nested node_modules structure is incompatible with electron-builder
   - After adding .npmrc: `rm -rf node_modules && pnpm install`

2. **Migration files not found**
   - Migrations must be included in `electron-builder.yml` files list
   - In packaged apps, migrations path uses `process.resourcesPath/app.asar/migrations`
   - See `DatabaseManager.ts:69-71` for packaged vs dev path handling

3. **DATABASE_URL causing path errors**
   - `.env` file should not be used in packaged apps
   - DatabaseManager ignores `DATABASE_URL` when `app.isPackaged` is true
   - Packaged apps always use `app.getPath('userData')/stone-data/notes.db`

4. **Testing packaged builds**
   ```bash
   pnpm build && pnpm package:dir
   open dist/build/mac-arm64/Stone.app
   tail -f ~/Library/Application\ Support/Stone/logs/stone.log
   ```

**Key Configuration Files:**
- `.npmrc` - pnpm hoisting for native modules
- `electron-builder.yml` - File inclusion and ASAR unpacking
- `src/main/database/DatabaseManager.ts` - Path handling for dev vs packaged

## Important Notes

1. **Always use pnpm**, not npm
2. **Path imports**: Use `@renderer/` prefix for renderer components
3. **Native modules**: Rebuild after installing new native deps
4. **Migrations**: Place in `migrations/` as `001_name.sql`
5. **macOS design**: Follow the existing design tokens and spacing
6. **Content storage**: NEVER store content in DB - files are source of truth
7. **Documentation**: NEVER create standalone documentation files like TESTING_NOTES.md, CHANGES.md, etc. Add notes to CLAUDE.md or existing docs only.

## UI Components - Composite System

Stone uses a token-based composite component system to eliminate inline styling and ensure consistency.

### Composite Components (13 Total)

Instead of writing inline classes, use composites:

```tsx
// ❌ Before (avoid)
<div className="px-3 pt-titlebar pb-2.5 border-b border-border">
  <h3 className="text-sm">Title</h3>
</div>;

// ✅ After (use composites)
import { Header } from '@renderer/components/composites';
<Header left={<h3>Title</h3>} />;
```

### Quick Reference

**Navigation & Headers:**

- `<Header />` - Top navigation with left/right content
- `<IconButton />` - Preset icon buttons
- `<QuickLink />` - Sidebar navigation
- `<SectionHeader />` - Section headers

**Lists & Items:**

- `<ListItem />` - List items with optional title/subtitle
- `<ListContainer />` - Wrapper for list/grid/card views
- `<CompactCard />` - Grid and card view items
- `<TreeItem />` - Tree items with auto-indentation

**Controls:**

- `<ControlGroup />` - Related button/toggle groups
- `<ToolbarButton />` - Toolbar buttons
- `<ToolbarDivider />` - Toolbar dividers

**Layout:**

- `<Spacer />` - Layout spacing without divs
- `<PanelFooter />` - Footer sections

### Size Tokens

All composites support three size variants:

```tsx
<Header size="compact" />   // h-6 (24px), text-xs (12px)
<Header size="normal" />    // h-8 (32px), text-sm (13px) [default]
<Header size="spacious" />  // h-10 (40px), text-base (14px)
```

### Common Usage Patterns

**Header with Title and Action:**

```tsx
import { Header, IconButton } from '@renderer/components/composites';

<Header
  left={<Heading3>Notes</Heading3>}
  right={<IconButton icon={<Plus />} tooltip="New Note" />}
/>;
```

**List with Items:**

```tsx
import { ListContainer, ListItem } from '@renderer/components/composites';

<ListContainer viewMode="list">
  {notes.map((note) => (
    <ListItem
      key={note.id}
      isActive={note.id === activeId}
      onClick={() => setActive(note.id)}
      title={note.title}
      right={<Star />}
    />
  ))}
</ListContainer>;
```

**Control Group:**

```tsx
import { ControlGroup } from '@renderer/components/composites';

<ControlGroup gap="sm" background="bg-muted">
  <Toggle>
    <ListIcon />
  </Toggle>
  <Toggle>
    <GridIcon />
  </Toggle>
</ControlGroup>;
```

**Toolbar:**

```tsx
import { ToolbarButton, ToolbarDivider } from '@renderer/components/composites';

<div className="flex items-center gap-0.5">
  <ToolbarButton active={bold} onClick={toggleBold} tooltip="Bold">
    <Bold />
  </ToolbarButton>
  <ToolbarDivider />
</div>;
```

### Important Rules

✅ **DO:**

- Use composites instead of inline classes
- Use size tokens: `size="compact"`, `size="normal"`, `size="spacious"`
- Use left/right props instead of wrapper divs
- Import from `@renderer/components/composites`

❌ **DON'T:**

- Add inline classes like `className="px-3 py-2"` to composites
- Use `style={{ paddingLeft }}` for indentation (use `<TreeItem level={} />`)
- Create custom button styles (use `<IconButton />`)
- Mix inline classes with composites

### Documentation

For detailed information, see:

- **COMPOSITES_QUICK_REF.md** - Quick overview
- **COMPOSITES_GUIDE.md** - Complete reference with all props
- **COMPOSITES_IMPORTS.md** - Import patterns
- **REFACTORING_EXAMPLES.md** - Before/after examples
- **COMPOSITES_CHECKLIST.md** - Developer checklist

## Editor Features

### Notion-like Block Options & Slash Commands

The editor includes Notion-style block interactions:

**Slash Commands:**
- Type `/` anywhere to open the command menu
- Search by name or keyword (e.g., "h1", "list", "code")
- Navigate with arrow keys, select with Enter
- Available commands:
  - `/h1`, `/h2`, `/h3` - Headings
  - `/bullet`, `/number` - Lists
  - `/todo`, `/task` - Checklist
  - `/code` - Code block
  - `/quote` - Blockquote
  - `/divider` - Horizontal rule

**Block Options Menu:**
- Hover over any block to see the `⋮⋮` drag handle and `+` button
- Click `+` to add a new block type
- Drag the `⋮⋮` handle to reorder blocks (Notion-style)
- All blocks have hover states for easy interaction

**To-do Lists (Logseq-style Tasks):**
- Create with `/todo` or the block menu
- Supports both standalone and list-style TODO items:
  - `TODO task text` → Renders as checkbox task
  - `- TODO task text` → Also renders as checkbox task (in list)
- Supported task states: TODO, DOING, DONE, WAITING, HOLD, CANCELED, IDEA
- Click checkboxes to mark complete
- Completed items show strikethrough
- Notion-style checkbox design
- All TODO items are saved with dash prefix (`- TODO`) for consistency

### Mermaid Diagram Support

The editor supports **Mermaid diagrams** with **GitHub/Notion-style rendering** - just use a code block with language set to "mermaid":

**Features:**
- **Automatic rendering** - code blocks with `mermaid` language auto-render diagrams
- **Live preview** - diagram updates as you type (300ms debounce)
- **Toggle view** - switch between diagram view and code editor
- **Error handling** - helpful error messages with syntax issues
- **Language selector** - easy dropdown to switch to/from mermaid

**Usage (GitHub/Notion Style):**
1. Type `/code` or use the block menu to insert a code block
2. Select **"Mermaid"** from the language dropdown (top-right of code block)
3. Type your Mermaid diagram syntax in the code editor
4. The diagram automatically renders - click **"Edit Code"** to modify
5. Toggle between "Edit Code" and "View Diagram" as needed

**Supported Diagram Types:**
- Flowcharts (`graph`, `flowchart`)
- Sequence diagrams (`sequenceDiagram`)
- Class diagrams (`classDiagram`)
- State diagrams (`stateDiagram`)
- ER diagrams (`erDiagram`)
- Gantt charts (`gantt`)
- Pie charts (`pie`)
- Git graphs (`gitGraph`)
- Timeline, Kanban, Mindmap, and many more...

**Example - Just create a code block and set language to "mermaid":**
```
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action 1]
  B -->|No| D[Action 2]
  C --> E[End]
  D --> E
```

**Design:**
- Seamlessly integrated into code blocks
- Theme derives from design tokens (CSS variables)
- Clean borders and spacing consistent with Notion
- Automatic dark mode support
- Hover effects on diagram nodes
- Code remains visible for easy editing

Notes on theming:
- Mermaid theme variables are computed from `--background`, `--foreground`, `--primary`, `--accent`, `--muted`, `--border`, `--card`.
- Update tokens in `src/renderer/index.css` to adjust colors app‑wide; diagrams pick them up automatically.
- See `src/renderer/components/Editor/CodeBlockComponent.tsx:20` for `initializeMermaid()` that maps tokens to Mermaid `themeVariables`.

State diagram font:
- State diagrams (`stateDiagram`, `stateDiagram-v2`) use a handwriting font stack preferring `Patrick Hand` with macOS fallbacks (`Bradley Hand`, `Noteworthy`, `Chalkboard SE`).
- We bundle Patrick Hand via `@fontsource/patrick-hand` (imported in `src/renderer/main.tsx:8`).
- Update or swap the font by adjusting that import; Mermaid’s override lives in `initializeMermaid()`.

### Tables

- TipTap table extensions are enabled (Table, TableRow, TableHeader, TableCell) so pasted Markdown tables render and remain editable.
- Styling lives in `src/renderer/index.css` (`.stone-table*` classes) to keep cells on-brand.
- Markdown↔HTML conversion uses Turndown with GFM support, so tables survive round-trips through the file system.

### Code Block Support

The note editor includes enhanced code block support with syntax highlighting:

**Supported Languages:**
- JavaScript/TypeScript
- Python, Java, C++, C#
- Go, Rust, Ruby, PHP
- Swift, Kotlin, SQL
- Bash/Shell, JSON, HTML/XML
- CSS, Markdown

**Usage:**
1. Type `/code` or click the "Code Block" button in toolbar
2. A language selector appears when in a code block
3. Select your language from the dropdown
4. Code is automatically syntax highlighted

**Custom Color Scheme:**

The syntax highlighting uses a custom color scheme that integrates with the app's design system:

*Light Theme:*
- **Background**: Near-white (98% lightness)
- **Keywords**: Purple (hue 262) - matches app's secondary accent
- **Strings**: Green (hue 142) - for readability
- **Numbers**: Orange (hue 28) - warm accent
- **Functions**: Primary blue (hue 211) - uses app's primary color
- **Types**: Gold (hue 45) - complements the palette
- **Operators**: Cyan (hue 180) - subtle distinction
- **Comments**: Medium gray (55% lightness)

*Dark Theme:*
- **Background**: Deep dark (10% lightness) - consistent with app background
- **Keywords**: Light purple (70% lightness)
- **Strings**: Soft green (60% lightness)
- **Numbers**: Light orange (65% lightness)
- **Functions**: Light blue (65% lightness) - uses app's primary color
- **Types**: Light gold (65% lightness)
- **Operators**: Light cyan (65% lightness)
- **Comments**: Medium gray (50% lightness)

All colors use HSL CSS variables (`--code-*`) that automatically adapt to light/dark mode.

**Styling:**
- Uses SF Mono font family (macOS monospace)
- Custom theme matching app's neutral + blue design
- Enhanced readability with proper spacing
- Consistent with app's color system in both themes
- Inline code uses keyword color on subtle background

### Typography - Notion Style

The editor uses a Notion-inspired design with:
- **16px base font size** - large, comfortable reading
- **1.65 line height** - spacious, Notion-like spacing
- **Letter spacing -0.003em** - optimized for readability
- **Large heading hierarchy:**
  - H1: 5xl (48px) - line-height 1.2, very prominent
  - H2: 3xl (30px) - line-height 1.3
  - H3: 2xl (24px) - line-height 1.35
  - H4: xl (20px) - line-height 1.4
  - H5/H6: lg (18px) - line-height 1.5
- **SF Mono** for all code elements (14px, line-height 1.7)
- **Spacious layout:**
  - Paragraphs: 2 units bottom margin
  - Headings: Large top margins for visual hierarchy
  - Lists: Proper spacing with 1.65 line-height
  - Code blocks: 6 units padding, rounded-lg
  - Wide editor: 900px max-width with 16 units horizontal padding

### Notion-like Features

- **Block hover states** - subtle background on all block elements
- **Smooth transitions** on all interactive elements
- **Clean, minimal design:**
  - Subtle borders (90% lightness in light mode)
  - Pure white background (#FFFFFF)
  - No heavy shadows, just subtle borders
- **Better text formatting:**
  - Bold text uses semibold (600) weight
  - Strikethrough with 1.5px thickness
  - Custom text selection color (primary blue at 15% opacity)
- **Improved inline code:**
  - 0.875em font size with subtle border
  - Muted background matching Notion's style
  - Proper padding and weight
- **Polished interactions:**
  - Links show underline only on hover
  - Images with Notion-style shadows
  - Empty blocks have min-height for easy clicking
  - Placeholder text: "Type / for commands, or start writing..."
  - Slash commands with fuzzy search
  - Block hover menus with drag handles
- **Wide, spacious layout:**
  - 900px max-width (vs typical 800px)
  - Generous padding (16 units horizontal, 12 units vertical)
  - Comfortable reading experience

### Extensions Added

The editor now includes these TipTap extensions:
- `@tiptap/extension-placeholder` - Smart placeholder text
- `@tiptap/suggestion` - Powers slash commands
- `@tiptap/extension-task-list` - To-do lists
- `@tiptap/extension-task-item` - Individual tasks
- Custom `SlashCommand` extension - Notion-like command palette
- `tippy.js` - Tooltip positioning for menus

## Code Block & Mermaid Implementation Notes

### Markdown Conversion (HTML ↔ Markdown)

The app uses TurndownService to convert between HTML (editor format) and Markdown (file storage format). For code blocks to preserve their language information:

**Code blocks store language in `data-language` attribute:**
- `CodeBlockComponent.tsx` adds `data-language={language}` to wrapper divs
- TurndownService has custom rules to read this attribute
- When saving: HTML → Markdown conversion preserves ```language fences
- When loading: Markdown → HTML conversion restores language selector

**Important:** Without the `data-language` attribute, code blocks lose their language on save/load cycles, causing Mermaid diagrams to become plain text.

### Mermaid Auto-Rendering with Toggle

Mermaid diagrams work via language detection in code blocks:
1. User creates code block (`/code`)
2. Selects "Mermaid" from language dropdown
3. `CodeBlockComponent` detects `language === 'mermaid'`
4. Component shows rendered diagram by default (300ms debounce)
5. User can toggle "Edit Code" to modify the source
6. Click "View Diagram" to return to rendered view
7. On save, HTML → Markdown preserves the language in fence: ```mermaid

**Toggle Implementation:**
- State managed via `showCode` boolean in component
- Default view: diagram rendered (showCode = false)
- Edit mode: code editor visible (showCode = true)
- Button text changes: "Edit Code" ↔ "View Diagram"

This GitHub/Notion-style approach means:
- No custom TipTap node required
- Mermaid code is portable (standard markdown)
- Works with existing code block infrastructure
- Easy to switch between languages
- Clean UX with diagram-first presentation

## Troubleshooting

### better-sqlite3 errors

```bash
rm -rf node_modules
pnpm install
pnpm electron-rebuild -f -w better-sqlite3
```

### Database issues

Delete and recreate: `rm ~/Library/Application\ Support/Stone/stone-data/notes.db`

### Build issues

```bash
pnpm build:main
pnpm build:preload
pnpm build:renderer
```

### Type checking

```bash
pnpm  typecheck         # Check for TypeScript errors
```

## Development Rules for AI Assistants

### Documentation

❌ **NEVER create these files:**
- `TESTING_NOTES.md`
- `CHANGES.md`
- `ARCHITECTURE.md`
- `API_CHANGES.md`
- Any standalone documentation file

✅ **ALWAYS update existing files:**
- Add notes to `CLAUDE.md` (this file)
- Update `README.md` for user-facing changes
- Add to component-specific docs (e.g., `COMPOSITES_GUIDE.md`)

### Content Architecture Rules

1. **Never access `note.content`** - it doesn't exist in the type
2. **Use `getContentById()`** to load content from files
3. **Silent autosave** - use `updateNote(id, data, true)` to prevent re-renders
4. **List views** - show metadata only, no content previews
5. **Search results** - return metadata only, no content fields

### IPC Channels

- `notes:get` - Returns metadata only (no content)
- `notes:getContent` - Returns content from file (lazy load)
- `notes:update` - Accepts content, writes to file only (not DB)
### File Watcher and Sync Behavior

To reduce redundant scans and log noise during autosave, the sync flow is adjusted:

- The file watcher only schedules a full workspace sync for structural changes (file add/unlink). Pure content edits (change events from autosave) do not trigger a sync.
- `notes:getAll` no longer performs a full sync on each call; it simply queries the database. The watcher maintains DB↔filesystem alignment.
- Use `workspaces:sync` to trigger a manual integrity pass when needed (e.g., after bulk external changes), and initial sync still runs on startup.

This preserves correctness (files are the source of truth; DB stores metadata) while avoiding unnecessary rescans on frequent content writes.

### Editor Saving Behavior

- Autosave for editor content is disabled. The editor now shows a Save button in the note header when content changes are detected.
- Clicking Save converts the current editor document to Markdown and writes it to the backing file via `notes:update`.
- Title edits continue to persist promptly with a short debounce, so renaming a note still updates the filename and metadata without requiring a manual save.
