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
- **Editor**: TipTap (rich text editor)
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

### Tables

- `notebooks` - Hierarchical notebook organization
- `notes` - Main notes with title, content, flags
- `tags` - Tags for categorization
- `note_tags` - Many-to-many relationship
- `attachments` - File attachments
- `note_versions` - Version history
- `notes_fts` - Full-text search (FTS5)

## Important Notes

1. **Always use pnpm**, not npm
2. **Path imports**: Use `@renderer/` prefix for renderer components
3. **Native modules**: Rebuild after installing new native deps
4. **Migrations**: Place in `migrations/` as `001_name.sql`
5. **macOS design**: Follow the existing design tokens and spacing

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
