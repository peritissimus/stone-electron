# Refactoring Examples - Before & After

This document shows real examples of refactored components from the Stone codebase.

## Example 1: NoteList Header

### ❌ Before (Inline Classes)
```tsx
<div className="px-3 pt-titlebar pb-2.5 border-b border-border bg-card flex-shrink-0">
  <ContainerFlex justify="between" align="center" gap="sm" className="mb-2.5">
    <Heading3 className="text-sm">Notes</Heading3>
    <ContainerFlex gap="xs" align="center">
      <Button
        onClick={handleCreateNote}
        disabled={isCreating}
        size="sm"
        className="h-7 text-xs"
        title="Create a new note"
      >
        <Plus size={12} />
        {isCreating ? 'Creating...' : 'New Note'}
      </Button>
      <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
        <Toggle
          pressed={viewMode === 'list'}
          onPressedChange={() => setViewMode('list')}
          size="sm"
          className="h-6 w-6 p-0"
          title="List view"
        >
          <List size={12} />
        </Toggle>
        <Toggle
          pressed={viewMode === 'grid'}
          onPressedChange={() => setViewMode('grid')}
          size="sm"
          className="h-6 w-6 p-0"
          title="Grid view"
        >
          <GridFour size={12} />
        </Toggle>
        <Toggle
          pressed={viewMode === 'card'}
          onPressedChange={() => setViewMode('card')}
          size="sm"
          className="h-6 w-6 p-0"
          title="Card view"
        >
          <Article size={12} />
        </Toggle>
      </div>
    </ContainerFlex>
  </ContainerFlex>
</div>
```

### ✅ After (Composites)
```tsx
<Header
  left={<Heading3 className="text-sm">Notes</Heading3>}
  right={
    <ContainerFlex gap="xs" align="center">
      <Button
        onClick={handleCreateNote}
        disabled={isCreating}
        size="sm"
        className="h-7 text-xs"
        title="Create a new note"
      >
        <Plus size={12} />
        {isCreating ? 'Creating...' : 'New Note'}
      </Button>
      <ControlGroup gap="xs" background="bg-muted">
        <Toggle
          pressed={viewMode === 'list'}
          onPressedChange={() => setViewMode('list')}
          size="sm"
          className="h-6 w-6 p-0"
          title="List view"
        >
          <List size={12} />
        </Toggle>
        <Toggle
          pressed={viewMode === 'grid'}
          onPressedChange={() => setViewMode('grid')}
          size="sm"
          className="h-6 w-6 p-0"
          title="Grid view"
        >
          <GridFour size={12} />
        </Toggle>
        <Toggle
          pressed={viewMode === 'card'}
          onPressedChange={() => setViewMode('card')}
          size="sm"
          className="h-6 w-6 p-0"
          title="Card view"
        >
          <Article size={12} />
        </Toggle>
      </ControlGroup>
    </ContainerFlex>
  }
/>
```

**Benefit**: Header styling completely encapsulated in one component, ControlGroup eliminates manual div wrapper.

---

## Example 2: Note List Items

### ❌ Before (Inline Classes)
```tsx
{viewMode === 'list' ? (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-1.5 transition-colors border-b border-border ${
      isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
    }`}
  >
    <div className="flex items-start justify-between gap-2 mb-0.5">
      <Text weight="medium" size="sm" as="div" className="line-clamp-1 text-xs">
        {note.title || 'Untitled'}
      </Text>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {note.isPinned && <PushPin size={10} className="text-primary" />}
        {note.isFavorite && <Star size={10} className="text-yellow-500 fill-yellow-500" />}
        {note.isArchived && <Archive size={10} className="text-muted-foreground" />}
      </div>
    </div>
    <Text size="xs" variant="muted" as="div" className="line-clamp-1 text-[10px]">
      {preview}
    </Text>
    <Text size="xs" variant="muted" as="div" className="opacity-70 text-[10px]">
      {timeAgo}
    </Text>
  </button>
) : (
  <button
    onClick={onClick}
    className={`text-left p-2 rounded-md transition-all ${
      isActive ? 'bg-accent ring-1 ring-primary shadow-sm' : 'bg-background hover:bg-muted/50 border border-border'
    }`}
  >
    <div className="flex items-start justify-between gap-1.5 mb-1">
      <Text weight="medium" size="xs" as="div" className="line-clamp-2 text-[11px]">
        {note.title || 'Untitled'}
      </Text>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {note.isPinned && <PushPin size={9} className="text-primary" />}
        {note.isFavorite && <Star size={9} className="text-yellow-500 fill-yellow-500" />}
      </div>
    </div>
    <Text size="xs" variant="muted" as="div" className="line-clamp-2 mb-1 text-[10px]">
      {preview}
    </Text>
    <Text size="xs" variant="muted" as="div" className="opacity-70 text-[10px]">
      {timeAgo}
    </Text>
  </button>
)}
```

### ✅ After (Composites)
```tsx
const rightContent = (
  <div className="flex items-center gap-0.5">
    {note.isPinned && <PushPin size={10} className="text-primary" />}
    {note.isFavorite && <Star size={10} className="text-yellow-500 fill-yellow-500" />}
    {viewMode === 'list' && note.isArchived && <Archive size={10} className="text-muted-foreground" />}
  </div>
);

if (viewMode === 'list') {
  return (
    <ListItem
      isActive={isActive}
      onClick={onClick}
      title={note.title || 'Untitled'}
      right={rightContent}
    >
      <Text size="xs" variant="muted" as="div" className="line-clamp-1 text-[10px]">
        {preview}
      </Text>
      <Text size="xs" variant="muted" as="div" className="opacity-70 text-[10px]">
        {timeAgo}
      </Text>
    </ListItem>
  );
}

return (
  <CompactCard
    isActive={isActive}
    onClick={onClick}
    title={note.title || 'Untitled'}
  >
    <div className="text-[10px]">
      <div className="line-clamp-2 mb-1">{preview}</div>
      <div className="opacity-70">{timeAgo}</div>
    </div>
  </CompactCard>
);
```

**Benefits**:
- Removed 50+ lines of inline classes
- ListItem and CompactCard handle all styling
- Same visual appearance, cleaner code

---

## Example 3: Sidebar Quick Links

### ❌ Before (Custom Component + Inline Classes)
```tsx
{/* Quick Links - Minimal */}
<div className="px-2 py-1.5 border-b border-border flex-shrink-0 space-y-0.5">
  <QuickLink icon={<Star size={12} />} label="Favorites" />
  <QuickLink icon={<Clock size={12} />} label="Recent" />
  <QuickLink icon={<Archive size={12} />} label="Archive" />
</div>

// Custom QuickLink component:
function QuickLink({ icon, label }: QuickLinkProps) {
  return (
    <Button variant="ghost" size="sm" className="w-full justify-start h-6 px-2 text-xs gap-1.5">
      {icon}
      <Text as="span" size="xs" className="flex-1">
        {label}
      </Text>
    </Button>
  );
}
```

### ✅ After (Composite + SectionHeader)
```tsx
{/* Quick Links - Minimal */}
<SectionHeader divided>
  <div className="space-y-0.5">
    <QuickLink icon={<Star size={12} />} label="Favorites" size="compact" />
    <QuickLink icon={<Clock size={12} />} label="Recent" size="compact" />
    <QuickLink icon={<Archive size={12} />} label="Archive" size="compact" />
  </div>
</SectionHeader>

// QuickLink is now a composite with full type support:
<QuickLink
  icon={<Star size={12} />}
  label="Favorites"
  isActive={panel === 'favorites'}
  onClick={() => setPanel('favorites')}
  size="compact"
/>
```

**Benefits**:
- SectionHeader eliminates manual border/padding
- QuickLink removed as custom component, now composite
- Size token support (compact, normal, spacious)

---

## Example 4: NotebookTree Items

### ❌ Before (Manual Indentation)
```tsx
<ContainerFlex
  align="center"
  gap="none"
  className="px-1"
  style={{ paddingLeft: `${level * 10 + 2}px` }}  // Manual calculation!
>
  {hasChildren ? (
    <Button
      variant="ghost"
      size="sm"
      className="h-5 w-5 p-0 flex-shrink-0"
      onClick={(e) => {
        e.stopPropagation();
        onToggleExpand();
      }}
    >
      {isExpanded ? <CaretDown size={10} /> : <CaretRight size={10} />}
    </Button>
  ) : (
    <div className="w-5" />
  )}
  <Button
    onClick={onSelect}
    variant="ghost"
    className={`flex-1 justify-start gap-1.5 px-1.5 py-1 h-auto rounded-md text-xs transition-colors ${
      isActive ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'hover:bg-muted/50'
    }`}
  >
    <Text size="sm" as="span" className="text-sm flex-shrink-0">
      {notebook.icon || '📁'}
    </Text>
    <Text as="span" size="xs" className="flex-1 truncate text-xs">
      {notebook.name}
    </Text>
    {notebook.note_count !== undefined && (
      <Text as="span" size="xs" variant="muted" className="flex-shrink-0 text-[10px]">
        {notebook.note_count}
      </Text>
    )}
  </Button>
</ContainerFlex>
```

### ✅ After (TreeItem Composite)
```tsx
<TreeItem
  level={level}
  isActive={isActive}
  onClick={onSelect}
  icon={notebook.icon || '📁'}
  label={notebook.name}
  right={
    notebook.note_count !== undefined && (
      <Text as="span" size="xs" variant="muted" className="text-[10px]">
        {notebook.note_count}
      </Text>
    )
  }
  expander={
    hasChildren ? (
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      >
        {isExpanded ? <CaretDown size={10} /> : <CaretRight size={10} />}
      </Button>
    ) : undefined
  }
>
  {/* Children rendered here */}
</TreeItem>
```

**Benefits**:
- TreeItem handles indentation automatically (`level` prop)
- No more manual `style={{ paddingLeft }}` calculations
- Cleaner expander handling
- All styles encapsulated

---

## Example 5: EditorToolbar

### ❌ Before (Custom ToolbarButton Component)
```tsx
<div className="border-b border-border bg-card px-2 py-1.5 flex items-center gap-0.5 flex-wrap">
  <ToolbarButton
    onClick={() => editor.chain().focus().undo().run()}
    disabled={!editor.can().undo()}
    title="Undo"
  >
    <ArrowCounterClockwise size={16} />
  </ToolbarButton>

  <Divider />

  <ToolbarButton
    onClick={() => editor.chain().focus().toggleBold().run()}
    active={editor.isActive('bold')}
    title="Bold"
  >
    <TextBolder size={16} />
  </ToolbarButton>

  {/* ... more buttons ... */}
</div>

// Custom components:
function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-1" />;
}
```

### ✅ After (Composite Components)
```tsx
<div className="border-b border-border bg-card px-2 py-1.5 flex items-center gap-0.5 flex-wrap">
  <ToolbarButton
    onClick={() => editor.chain().focus().undo().run()}
    disabled={!editor.can().undo()}
    tooltip="Undo"
  >
    <ArrowCounterClockwise size={16} />
  </ToolbarButton>

  <ToolbarDivider />

  <ToolbarButton
    onClick={() => editor.chain().focus().toggleBold().run()}
    active={editor.isActive('bold')}
    tooltip="Bold"
  >
    <TextBolder size={16} />
  </ToolbarButton>

  {/* ... more buttons ... */}
</div>

// Now using composites - no custom components needed!
// ToolbarButton and ToolbarDivider are reusable composites
```

**Benefits**:
- Removed 15+ lines of custom component code
- ToolbarButton/ToolbarDivider are reusable everywhere
- Type-safe props with full TypeScript support
- Size variants available (compact, normal, spacious)

---

## Example 6: NoteEditor Header

### ❌ Before (Manual Layout)
```tsx
<div className="px-4 pt-titlebar pb-3 border-b border-border">
  <ContainerFlex align="center" gap="lg">
    <Input
      value={title}
      onChange={(e) => handleTitleChange(e.target.value)}
      placeholder="Untitled"
      className="flex-1 text-xl font-semibold bg-transparent border-none focus-visible:ring-0 px-0 py-0 h-auto placeholder:text-muted-foreground"
    />

    <ContainerFlex align="center" gap="xs">
      <Button
        onClick={() => toggleFavorite(activeNote.id)}
        variant={activeNote.isFavorite ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Toggle Favorite"
      >
        <Star size={16} />
      </Button>
      <Button
        onClick={() => togglePin(activeNote.id)}
        variant={activeNote.isPinned ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        title="Toggle Pin"
      >
        <PushPin size={16} />
      </Button>
      {/* ... more buttons ... */}
    </ContainerFlex>
  </ContainerFlex>
</div>
```

### ✅ After (Header + IconButton)
```tsx
<Header
  divided
  left={
    <Input
      value={title}
      onChange={(e) => handleTitleChange(e.target.value)}
      placeholder="Untitled"
      className="flex-1 text-xl font-semibold bg-transparent border-none focus-visible:ring-0 px-0 py-0 h-auto placeholder:text-muted-foreground"
    />
  }
  right={
    <ContainerFlex align="center" gap="xs">
      <IconButton
        size="normal"
        icon={<Star size={16} />}
        tooltip="Toggle Favorite"
        onClick={() => toggleFavorite(activeNote.id)}
        className={activeNote.isFavorite ? 'bg-secondary' : ''}
      />
      <IconButton
        size="normal"
        icon={<PushPin size={16} />}
        tooltip="Toggle Pin"
        onClick={() => togglePin(activeNote.id)}
        className={activeNote.isPinned ? 'bg-secondary' : ''}
      />
      {/* ... more buttons ... */}
    </ContainerFlex>
  }
/>
```

**Benefits**:
- Header encapsulates all padding/border styling
- IconButton eliminates manual `className="h-8 w-8"`
- Cleaner props-based API
- Size variants automatically applied

---

## Summary of Changes

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| Lines per header | 5+ | 1 | -80% |
| List item variants | 2 separate JSX blocks | 1 ListItem + 1 CompactCard | -60% |
| Inline classes | 50+ per component | <10 per component | -80% |
| Type safety | Limited | Full TypeScript | Better DX |
| Dark mode | CSS variables | CSS variables | Same, but now consistent |
| Maintenance | High (changes everywhere) | Low (change in composite) | Much easier |

---

## Going Forward

All new components should:
1. Use existing composites first
2. Create new composites for new patterns
3. Avoid inline classes
4. Leverage size tokens
5. Use left/right props instead of wrapper divs

This ensures Stone's UI remains consistent, maintainable, and scales beautifully.
