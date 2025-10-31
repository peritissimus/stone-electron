# Stone - AI Agent Guidelines

This document provides guidelines for AI assistants (like Claude) working on the Stone note-taking application.

## Core Principles

1. **Always use pnpm** - Never use npm or yarn
2. **Preserve macOS design** - Follow the established design system
3. **Use TypeScript path aliases** - `@renderer/`, `@main/`, `@shared/`
4. **Test changes** - Build and verify before marking tasks complete
5. **Document changes** - Update relevant docs when modifying architecture

## Development Workflow

### When Adding Features

1. **Plan first** - Use TodoWrite to break down complex tasks
2. **Read existing code** - Understand current patterns before adding new code
3. **Follow conventions** - Match existing code style and architecture
4. **Update components** - Use existing design tokens and Tailwind classes
5. **Test thoroughly** - Build main, preload, and renderer as needed

### When Fixing Bugs

1. **Investigate root cause** - Don't just patch symptoms
2. **Check logs** - Use the logger to understand what's failing
3. **Verify the fix** - Test in both light and dark mode
4. **Document the fix** - Explain what was wrong and how you fixed it

### When Refactoring

1. **Don't break existing features** - Ensure all functionality still works
2. **Maintain design consistency** - Keep the macOS aesthetic
3. **Update imports** - Use path aliases consistently
4. **Test native modules** - Rebuild if touching database code

## File Organization

### Where to Put Code

- **UI Components** → `src/renderer/components/`
  - shadcn/ui → `src/renderer/components/ui/`
  - Layout → `src/renderer/components/Layout/`
  - Feature-specific → `src/renderer/components/[Feature]/`

- **State Management** → `src/renderer/stores/`
  - One store per domain (notes, notebooks, tags, ui)

- **Database** → `src/main/database/`
  - Migrations → `migrations/` (root level, not in src)

- **IPC Handlers** → `src/main/ipc/handlers/`
  - One file per domain (noteHandlers.ts, notebookHandlers.ts)

- **Shared Types** → `src/shared/`
  - Constants → `src/shared/constants/`
  - Types → `src/shared/types/`

### Naming Conventions

- **Components**: PascalCase (e.g., `NoteEditor.tsx`)
- **Files**: camelCase (e.g., `noteHandlers.ts`)
- **Stores**: camelCase with "Store" suffix (e.g., `noteStore.ts`)
- **CSS classes**: Tailwind utilities (no custom CSS unless necessary)
- **Migrations**: `001_description.sql` (numbered, snake_case)

## Composite Components (IMPORTANT!)

Stone uses a **token-based composite component system** to eliminate inline styling. **Always use composites instead of inline classes**.

### The System

Instead of writing inline classes:
```tsx
// ❌ AVOID - inline classes
<div className="px-3 pt-titlebar pb-2.5 border-b border-border">
  <button className="h-8 w-8 p-0">Icon</button>
</div>
```

Use composites:
```tsx
// ✅ USE - composites
import { Header, IconButton } from '@renderer/components/composites';
<Header left={<Title />} right={<IconButton icon={<Icon />} />} />
```

### 13 Composite Components Available

**Navigation & Headers:**
- `<Header />` - Top navigation (replaces manual header divs)
- `<IconButton />` - Icon buttons (replaces `className="h-8 w-8"`)
- `<QuickLink />` - Sidebar links
- `<SectionHeader />` - Section headers

**Lists & Items:**
- `<ListItem />` - List items (replaces custom button styling)
- `<ListContainer />` - List wrapper (handles list/grid/card modes)
- `<CompactCard />` - Grid/card items
- `<TreeItem />` - Tree items (replaces `style={{ paddingLeft }}`)

**Controls:**
- `<ControlGroup />` - Button/toggle groups (replaces manual divs)
- `<ToolbarButton />` - Toolbar buttons
- `<ToolbarDivider />` - Toolbar dividers

**Layout:**
- `<Spacer />` - Spacing (replaces `<div className="h-4" />`)
- `<PanelFooter />` - Footer sections (replaces manual footer styling)

### Size Tokens

All composites support size variants:
```tsx
size="compact"   // h-6 (24px), text-xs (12px) - tight spacing
size="normal"    // h-8 (32px), text-sm (13px) - default
size="spacious"  // h-10 (40px), text-base (14px) - relaxed spacing
```

### Common Usage

**Header:**
```tsx
import { Header } from '@renderer/components/composites';
<Header
  left={<Title>Notes</Title>}
  right={<IconButton icon={<Plus />} tooltip="New" />}
/>
```

**List:**
```tsx
import { ListContainer, ListItem } from '@renderer/components/composites';
<ListContainer viewMode="list">
  {items.map(item => (
    <ListItem title={item.name} isActive={item.id === active} />
  ))}
</ListContainer>
```

**Controls:**
```tsx
import { ControlGroup } from '@renderer/components/composites';
<ControlGroup gap="sm" background="bg-muted">
  <Toggle><ListIcon /></Toggle>
  <Toggle><GridIcon /></Toggle>
</ControlGroup>
```

### Critical Rules

✅ **ALWAYS:**
- Use composites from `@renderer/components/composites`
- Use size tokens: `size="compact"`, `size="normal"`, `size="spacious"`
- Use `left` and `right` props instead of wrapper divs
- Import from the composites index, not individual files

❌ **NEVER:**
- Add inline classes like `className="px-3 py-2"` to composites
- Use `style={{ paddingLeft }}` for indentation (use `<TreeItem level={} />`)
- Create custom button styling (use `<IconButton />`)
- Mix inline classes with composites on the same component
- Use manual header divs (use `<Header />`)

### Documentation

For complete details:
- See **COMPOSITES_QUICK_REF.md** for quick overview
- See **COMPOSITES_GUIDE.md** for full API reference
- See **REFACTORING_EXAMPLES.md** for before/after comparisons
- See **COMPOSITES_CHECKLIST.md** for developer checklist

## Design System Rules

### Colors

Always use CSS variables, never hardcoded colors:

✅ **Good:**
```tsx
<div className="bg-background text-foreground border-border">
<button className="bg-primary text-primary-foreground">
<span className="text-muted-foreground">
```

❌ **Bad:**
```tsx
<div className="bg-white text-black border-gray-200">
<button className="bg-blue-600 text-white">
<span className="text-gray-500">
```

### Spacing

Use composites for spacing instead of inline classes:

✅ **Good:**
```tsx
import { Header, Spacer } from '@renderer/components/composites';
<Header left={<Title />} />
<Spacer size="md" />
```

❌ **Bad:**
```tsx
<div className="px-3 py-2">Header</div>
<div className="h-4" />
```

Follow macOS-style compact spacing:
- **With composites**: size="compact", size="normal", size="spacious"
- **In containers**: `gap-1`, `gap-2`, `gap-3` (4px, 8px, 12px)

### Border Radius

Use consistent rounded corners:

- **Small elements**: `rounded-md` (6px)
- **Buttons/inputs**: `rounded-lg` (10px)
- **Cards/modals**: `rounded-lg` or `rounded-xl`

### Typography

- **Body text**: `text-xs` or `text-sm`
- **Headings**: `text-base`, `text-lg`
- **Labels**: `text-xs font-medium`
- **Always** use `font-semibold` or `font-medium`, not `font-bold`

## Common Patterns

### Adding a New IPC Handler

1. Define channel in `src/shared/constants/ipcChannels.ts`
2. Create handler in `src/main/ipc/handlers/`
3. Register in `src/main/ipc/index.ts`
4. Create hook in `src/renderer/hooks/`
5. Use in component via the hook

### Adding a New Component

1. Create in appropriate `src/renderer/components/` subdirectory
2. Use TypeScript with proper prop types
3. Import from `@renderer/` path alias
4. Use Tailwind + CSS variables for styling
5. Export from the file

### Adding a Database Table

1. Create migration in `migrations/XXX_table_name.sql`
2. Create/update repository in `src/main/repositories/`
3. Add type to `src/shared/types/`
4. Update IPC handlers if needed
5. Delete database and restart to run migration

### Adding shadcn Component

```bash
pnpm dlx shadcn@latest add [component-name]
```

The component will be automatically placed in `src/renderer/components/ui/` with correct imports.

## Error Handling

### Frontend (Renderer)

```typescript
try {
  const response = await window.api.invoke('channel:name', params)
  if (response.success && response.data) {
    // Handle success
  } else {
    // Log and show error
    logger.error('Operation failed:', response.error)
    alert(response.error?.message || 'Operation failed')
  }
} catch (error) {
  logger.error('Exception:', error)
  alert('An error occurred')
}
```

### Backend (Main Process)

```typescript
import { createHandler, IpcError } from '../utils'

ipcMain.handle(
  'channel:name',
  createHandler(async (event, request) => {
    // Validation
    if (!request.param) {
      throw new IpcError('INVALID_INPUT', 'Param is required')
    }
    
    // Operation
    const result = await doSomething(request.param)
    
    // Return data (createHandler wraps in success response)
    return result
  })
)
```

## Testing Strategy

### What to Test

1. **After building main**: Run `pnpm dev:electron` to verify
2. **After UI changes**: Check both light and dark mode
3. **After database changes**: Delete DB and restart to test migrations
4. **After adding shadcn**: Import and use the component to verify

### How to Build

```bash
# Build only what changed
pnpm build:main      # If you modified main process
pnpm build:renderer  # If you modified UI
pnpm build:preload   # Rarely needed

# Or build everything
pnpm build
```

## Common Mistakes to Avoid

### 1. NOT using composites (CRITICAL!)
❌ `<div className="px-3 pt-titlebar pb-2.5 border-b border-border">`
✅ `<Header left={<Title />} />`

❌ `<button className="h-8 w-8 p-0"><Icon /></button>`
✅ `<IconButton size="normal" icon={<Icon />} />`

❌ `<div style={{ paddingLeft: `${level * 10}px` }}>`
✅ `<TreeItem level={level} />`

See **COMPOSITES_QUICK_REF.md** for when to use which composite.

### 2. Using npm instead of pnpm
❌ `npm install`
✅ `pnpm install`

### 3. Hardcoding colors
❌ `className="bg-gray-800 text-white"`
✅ `className="bg-background text-foreground"`

### 4. Wrong import paths
❌ `import { cn } from "../../../lib/utils"`
✅ `import { cn } from "@renderer/lib/utils"`

❌ `import { Header } from './composites/Header'`
✅ `import { Header } from '@renderer/components/composites'`

### 5. Skipping migration files
❌ Modifying schema directly in code
✅ Create SQL migration in `migrations/`

### 6. Large button/text sizes
❌ `className="text-base px-4 py-3"`
✅ `className="text-xs px-3 py-2"` or better: `<Header />`, `<IconButton />`

### 7. Forgetting to rebuild native modules
After installing/updating better-sqlite3:
```bash
pnpm electron-rebuild -f -w better-sqlite3
```

### 8. Not using the logger
❌ `console.log('Something happened')`
✅ `logger.info('Something happened')`

### 9. Creating files without reading
Always read a file first before attempting to edit/write it.

### 10. Mixing inline classes with composites
❌ `<Header className="px-3 py-2" />`
✅ `<Header size="normal" />` (composites handle all styling)

### 11. Creating wrapper divs instead of using left/right props
❌ `<Header><div className="flex gap-2"><Button /><Button /></div></Header>`
✅ `<Header right={<ControlGroup><Button /><Button /></ControlGroup>} />`

## Project-Specific Knowledge

### Electron Window Configuration

- Title bar is hidden (`hiddenInset`)
- Traffic lights positioned at `{ x: 16, y: 16 }`
- Vibrancy effect enabled for macOS
- Window background is white (will show through CSS)

### TipTap Editor

- StarterKit includes basic markdown support
- Extensions: Link, Image, Highlight, Table, TaskList
- Content saved as HTML
- Autosave after 1000ms of inactivity

### Zustand Stores

- `uiStore` - UI state (sidebar, modals, theme, search)
- `noteStore` - Active note, note list, filters
- `notebookStore` - Notebook tree, expanded state
- `tagStore` - Tag list, selected tags

### Database

- SQLite with better-sqlite3
- FTS5 for full-text search
- Foreign keys enabled
- Timestamps are Unix epoch (seconds)

## When Stuck

1. **Check CLAUDE.md** for commands and structure
2. **Read existing similar code** for patterns
3. **Check the logs** in Electron DevTools console
4. **Rebuild main process** if IPC not working
5. **Delete database** if schema issues
6. **Ask user for clarification** if requirements unclear

## Success Checklist

Before marking a task complete:

- [ ] Code follows existing patterns
- [ ] Uses pnpm (not npm)
- [ ] Uses path aliases (@renderer/, etc.)
- [ ] Follows macOS design system
- [ ] Uses CSS variables (not hardcoded colors)
- [ ] Properly typed with TypeScript
- [ ] Includes error handling
- [ ] Tested in the app
- [ ] No console errors
- [ ] Works in both light and dark mode

## Quick Reference

### Most Common Commands
```bash
pnpm dev:electron                          # Start development
pnpm build:main                            # Rebuild main process
pnpm dlx shadcn@latest add [component]     # Add UI component
pnpm electron-rebuild -f -w better-sqlite3 # Rebuild native module
```

### Most Common Paths
```
src/renderer/components/Layout/  # Main UI components
src/renderer/components/ui/      # shadcn components
src/main/ipc/handlers/           # IPC handlers
migrations/                      # Database migrations
```

### Most Common Imports
```typescript
// Utils
import { cn } from "@renderer/lib/utils"

// Composites (USE THESE!)
import {
  Header,
  ListItem,
  ListContainer,
  IconButton,
  ControlGroup,
  TreeItem
} from "@renderer/components/composites"

// Stores
import { useNoteStore } from "@renderer/stores/noteStore"
import { useUIStore } from "@renderer/stores/uiStore"

// Logger
import { logger } from "@renderer/utils/logger"

// Icons
import { Star, Pin, Archive } from "lucide-react"

// shadcn (only for specialized components)
import { Button } from "@renderer/components/ui/button"
import { Dialog } from "@renderer/components/ui/dialog"
```

---

**Remember**: This is a production-quality macOS note-taking app. Maintain high standards for code quality, design consistency, and user experience.
