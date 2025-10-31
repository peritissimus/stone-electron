# Composite Components Guide

## Overview

The composite components system eliminates inline styling and provides a token-based, declarative API for building consistent layouts. Instead of writing:

```tsx
className="px-3 pt-titlebar pb-2.5 border-b border-border flex-shrink-0"
```

You now write:

```tsx
<Header left={<Title>Notes</Title>} right={<Button>New</Button>} />
```

## Size Tokens

All components support three size variants:

- **compact**: Tight spacing (12px text, 4px gaps) - for dense UIs
- **normal**: Standard spacing (13px text) - the default
- **spacious**: Relaxed spacing (14px text, 12px padding) - for spacious layouts

```tsx
<Header size="compact" />
<ListItem size="normal" />
<IconButton size="spacious" />
```

## Components

### Header

Consistent top navigation/title areas with optional border divider.

**Replaces**: `className="px-3 pt-titlebar pb-2.5 border-b border-border"`

```tsx
<Header
  left={<Heading3>Notes</Heading3>}
  right={<Button>New</Button>}
  size="normal"
  divided={true}
/>

// With children for more control
<Header size="compact" divided>
  <YourCustomContent />
</Header>
```

**Props**:
- `size?: 'compact' | 'normal' | 'spacious'` - Size variant
- `divided?: boolean` - Include bottom border (default: true)
- `left?: ReactNode` - Left content area
- `right?: ReactNode` - Right content area
- `children?: ReactNode` - Custom content

---

### ControlGroup

Container for related buttons/toggles without inline classes.

**Replaces**: `className="flex items-center gap-0.5 bg-muted rounded-md p-0.5"`

```tsx
<ControlGroup gap="sm" background="bg-muted">
  <Toggle pressed={mode === 'list'}><List /></Toggle>
  <Toggle pressed={mode === 'grid'}><Grid /></Toggle>
  <Toggle pressed={mode === 'card'}><Card /></Toggle>
</ControlGroup>
```

**Props**:
- `size?: 'compact' | 'normal' | 'spacious'`
- `gap?: 'xs' | 'sm' | 'md'` - Gap between controls (default: 'sm')
- `wrap?: boolean` - Allow wrapping (default: false)
- `background?: string` - Background class (default: 'bg-muted')
- `children` - Toggle/button elements

---

### ListItem

Consistent list item styling for list views.

**Replaces**: `className="w-full text-left px-3 py-1.5 transition-colors border-b border-border"`

```tsx
// Simple usage with title/subtitle
<ListItem
  isActive={activeId === item.id}
  onClick={() => setActive(item.id)}
  title="Note Title"
  subtitle="Preview text..."
  right={<Star />}
/>

// Custom content
<ListItem isActive={isActive} onClick={onClick}>
  <Text>Custom content</Text>
</ListItem>
```

**Props**:
- `size?: 'compact' | 'normal' | 'spacious'`
- `isActive?: boolean` - Active/selected state
- `left?: ReactNode` - Left icon/content
- `right?: ReactNode` - Right icons/badges
- `title?: ReactNode` - Primary text
- `subtitle?: ReactNode` - Secondary text
- `children?: ReactNode` - Custom content

---

### ListContainer

Wrapper for lists with layout based on view mode.

**Replaces**: `className="divide-y divide-border"` or `className="p-2 grid grid-cols-2 gap-2"`

```tsx
<ListContainer viewMode={viewMode}>
  {notes.map(note => (
    <ListItem key={note.id} title={note.title} />
  ))}
</ListContainer>
```

**Props**:
- `viewMode?: 'list' | 'grid' | 'card'` - Layout mode
- `size?: 'compact' | 'normal' | 'spacious'`
- `children` - List item elements

---

### CompactCard

Simplified card for grid/card views.

**Replaces**: `className="text-left p-2 rounded-md transition-all"`

```tsx
<CompactCard
  isActive={isActive}
  onClick={onClick}
  title="Note Title"
>
  <Text>Preview content</Text>
</CompactCard>
```

**Props**:
- `size?: 'compact' | 'normal' | 'spacious'`
- `isActive?: boolean` - Active/selected state
- `title?: ReactNode` - Card title
- `children?: ReactNode` - Card content

---

### Spacer

Layout spacing without extra divs.

**Replaces**: `style={{ paddingLeft: "..." }}`

```tsx
<div>
  <Text>Top</Text>
  <Spacer size="md" direction="vertical" />
  <Text>Bottom</Text>
</div>

<Spacer size="sm" direction="horizontal" />
```

**Props**:
- `size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'` - Spacing amount
- `direction?: 'vertical' | 'horizontal'` (default: 'vertical')

---

### IconButton

Preset icon button without className needed.

**Replaces**: `className="h-7 w-7 p-0 flex-shrink-0"`

```tsx
<IconButton
  size="compact"
  icon={<Settings size={13} />}
  label="Settings"
  tooltip="Open settings"
  onClick={openSettings}
/>
```

**Props**:
- `size?: 'compact' | 'normal' | 'spacious'`
- `icon: ReactNode` - Icon to display
- `label?: string` - Aria label
- `tooltip?: string` - Tooltip text
- Standard button props (onClick, disabled, etc.)

---

### PanelFooter

Consistent footer styling with border and padding.

**Replaces**: `className="px-2.5 py-2 border-t border-border flex-shrink-0"`

```tsx
<PanelFooter justify="between">
  <Button variant="outline">Cancel</Button>
  <Button>Save</Button>
</PanelFooter>
```

**Props**:
- `size?: 'compact' | 'normal' | 'spacious'`
- `divided?: boolean` - Include top border (default: true)
- `justify?: 'start' | 'center' | 'between' | 'end'` (default: 'between')
- `children` - Footer content

---

### SectionHeader

Consistent section header with optional divider and description.

```tsx
<SectionHeader
  title="Quick Links"
  description="Fast access"
  divided={true}
/>

// Custom content
<SectionHeader divided>
  <YourCustomContent />
</SectionHeader>
```

**Props**:
- `size?: 'compact' | 'normal' | 'spacious'`
- `divided?: boolean` - Include bottom border (default: true)
- `title?: ReactNode` - Header title
- `description?: ReactNode` - Supporting text
- `action?: ReactNode` - Right-side action
- `children?: ReactNode` - Custom content

---

### QuickLink

Button-style link with icon and label.

**Replaces**: `className="w-full justify-start h-6 px-2 text-xs gap-1.5"`

```tsx
<QuickLink
  icon={<Star size={12} />}
  label="Favorites"
  isActive={panel === 'favorites'}
  onClick={() => setPanel('favorites')}
  size="compact"
/>
```

**Props**:
- `size?: 'compact' | 'normal' | 'spacious'`
- `icon?: ReactNode` - Icon to display
- `label: ReactNode` - Link label
- `isActive?: boolean` - Active state
- Standard button props

---

## Migration Examples

### Before (NoteList Header)

```tsx
<div className="px-3 pt-titlebar pb-2.5 border-b border-border bg-card flex-shrink-0">
  <ContainerFlex justify="between" align="center" gap="sm" className="mb-2.5">
    <Heading3 className="text-sm">Notes</Heading3>
    <ContainerFlex gap="xs" align="center">
      <Button size="sm" className="h-7 text-xs">
        <Plus size={12} /> New Note
      </Button>
      <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
        <Toggle className="h-6 w-6 p-0"><List /></Toggle>
        <Toggle className="h-6 w-6 p-0"><Grid /></Toggle>
      </div>
    </ContainerFlex>
  </ContainerFlex>
</div>
```

### After (Using Composites)

```tsx
<Header
  left={<Heading3 className="text-sm">Notes</Heading3>}
  right={
    <ContainerFlex gap="xs" align="center">
      <Button size="sm" className="h-7 text-xs">
        <Plus size={12} /> New Note
      </Button>
      <ControlGroup gap="xs" background="bg-muted">
        <Toggle className="h-6 w-6 p-0"><List /></Toggle>
        <Toggle className="h-6 w-6 p-0"><Grid /></Toggle>
      </ControlGroup>
    </ContainerFlex>
  }
/>
```

### Before (List Items)

```tsx
{sortedNotes.map((note) => (
  <button
    key={note.id}
    onClick={() => setActive(note.id)}
    className={`w-full text-left px-3 py-1.5 transition-colors border-b border-border ${
      isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
    }`}
  >
    <div className="flex items-start justify-between gap-2 mb-0.5">
      <Text weight="medium" size="sm" className="line-clamp-1">
        {note.title || 'Untitled'}
      </Text>
      <div className="flex items-center gap-0.5">
        {note.isFavorite && <Star size={10} />}
      </div>
    </div>
    <Text size="xs" variant="muted">{preview}</Text>
  </button>
))}
```

### After (Using Composites)

```tsx
<ListContainer viewMode={viewMode}>
  {sortedNotes.map((note) => (
    <ListItem
      key={note.id}
      isActive={note.id === activeId}
      onClick={() => setActive(note.id)}
      title={note.title || 'Untitled'}
      right={note.isFavorite && <Star size={10} />}
    >
      <Text size="xs" variant="muted">{preview}</Text>
    </ListItem>
  ))}
</ListContainer>
```

## Token Reference

### Size Classes

```ts
// Text sizes
sizeTextClasses = {
  compact: 'text-xs',    // 12px
  normal: 'text-sm',     // 13px
  spacious: 'text-base'  // 14px
}

// Heights
sizeHeightClasses = {
  compact: 'h-6',   // 24px
  normal: 'h-8',    // 32px
  spacious: 'h-10'  // 40px
}

// Padding
sizePaddingClasses = {
  compact: 'p-1',    // 4px
  normal: 'p-2',     // 8px
  spacious: 'p-3'    // 12px
}
```

### Gap Classes

```ts
gapClasses = {
  xs: 'gap-0.5',  // 2px
  sm: 'gap-1',    // 4px
  md: 'gap-2'     // 8px
}
```

### Spacing (Spacer)

```ts
spacerSizeClasses = {
  xs: 4px,   // h-1 or w-1
  sm: 8px,   // h-2 or w-2
  md: 16px,  // h-4 or w-4
  lg: 24px,  // h-6 or w-6
  xl: 32px   // h-8 or w-8
}
```

## Best Practices

1. **Use composites instead of containers for UI patterns** - Containers are for layout structure, composites are for consistent patterns
2. **Prefer props over className** - Use `size="compact"` instead of `className="text-xs h-6"`
3. **Keep sizes consistent** - Use the same size variant throughout a feature area
4. **Leverage left/right props** - Use `left` and `right` props instead of nested divs
5. **Use title/subtitle for simple text** - Don't add custom children for simple title + subtitle

## File Structure

```
src/renderer/components/
├── composites/
│   ├── tokens.ts           # Design tokens
│   ├── Header.tsx
│   ├── ControlGroup.tsx
│   ├── ListItem.tsx
│   ├── ListContainer.tsx
│   ├── CompactCard.tsx
│   ├── Spacer.tsx
│   ├── IconButton.tsx
│   ├── PanelFooter.tsx
│   ├── SectionHeader.tsx
│   ├── QuickLink.tsx
│   └── index.ts            # Exports
├── ui/                     # Base UI components (Button, Input, etc.)
├── Layout/                 # Page layouts
└── ...
```

## Importing

```tsx
import {
  Header,
  ControlGroup,
  ListItem,
  ListContainer,
  CompactCard,
  Spacer,
  IconButton,
  PanelFooter,
  SectionHeader,
  QuickLink,
  type SizeVariant
} from '@renderer/components/composites';
```
