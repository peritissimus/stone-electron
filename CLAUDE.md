# Stone - Development Guide for Claude

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
  - Tailwind CSS (macOS-inspired design)
  - Lucide icons
- **Editor**: TipTap (rich text editor) with syntax highlighting
  - CodeBlockLowlight for code blocks
  - Lowlight (highlight.js) for syntax highlighting
  - Supports 19+ programming languages
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

The app follows macOS design guidelines with:

- **Font**: SF Pro Display/Text (system fonts)
- **Colors**: Neutral grays with blue accent (#007AFF)
- **Border radius**: 10px (macOS-style)
- **Font size**: 13px base (macOS standard)

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
1. Click the "Code Block" button in the toolbar
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

### Typography

The editor uses Apple's SF Pro Text font with:
- **14px base font size** - optimized for screen reading
- **1.6 line height** - tighter, more comfortable spacing
- **Letter spacing -0.011em** - improved density
- **Improved heading hierarchy:**
  - H1: 3xl (24px) - line-height 1.2
  - H2: 2xl (20px) - line-height 1.25
  - H3: xl (18px) - line-height 1.3
  - H4: lg (16px) - line-height 1.35
  - H5/H6: base (14px) - line-height 1.4
- **SF Mono** for all code elements (13px, line-height 1.5)
- **Reduced spacing:**
  - Paragraphs: 3 units bottom margin (was 5)
  - Headings: Tighter top/bottom margins
  - Lists: Minimal item spacing (0.5 units)
  - Code blocks: 4 units padding (was 5)
  - Images: 4 units margin (was 6)

### Enhanced Features

- **Smooth transitions** on links, images, and editor state
- **Better text formatting:**
  - Bold text uses semibold (600) weight
  - Strikethrough with 1.5px thickness
  - Custom text selection color (primary blue at 20% opacity)
- **Improved inline code:**
  - 0.9em font size (90% of base)
  - 450 font weight for subtle emphasis
  - Keyword color on subtle background
- **Polished interactions:**
  - Links with 2px underline offset
  - Images scale to 101% on hover with enhanced shadow
  - Code blocks with proper syntax color contrast

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
