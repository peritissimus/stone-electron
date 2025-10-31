# Composite Components - Quick Reference

## Most Common Components

### Header
```tsx
<Header
  left={<Heading>Title</Heading>}
  right={<Button>Action</Button>}
  size="normal"
  divided
/>
```

### ControlGroup (Toggle Groups)
```tsx
<ControlGroup gap="sm" background="bg-muted">
  <Toggle><List /></Toggle>
  <Toggle><Grid /></Toggle>
</ControlGroup>
```

### ListItem (List View Items)
```tsx
<ListItem
  isActive={id === activeId}
  onClick={() => setActive(id)}
  title="Title"
  subtitle="Subtitle"
  right={<Star />}
/>
```

### ListContainer (List Wrapper)
```tsx
<ListContainer viewMode={viewMode}>
  {items.map(item => <ListItem key={item.id} {...item} />)}
</ListContainer>
```

### CompactCard (Grid/Card Items)
```tsx
<CompactCard
  isActive={isActive}
  onClick={onClick}
  title="Title"
>
  Content here
</CompactCard>
```

### IconButton (Small Buttons)
```tsx
<IconButton
  icon={<Settings size={13} />}
  label="Settings"
  tooltip="Open settings"
  onClick={handleClick}
/>
```

### PanelFooter (Footer Area)
```tsx
<PanelFooter justify="between">
  <Button>Cancel</Button>
  <Button>Save</Button>
</PanelFooter>
```

### QuickLink (Sidebar Links)
```tsx
<QuickLink
  icon={<Star size={12} />}
  label="Favorites"
  isActive={active === 'favorites'}
  onClick={() => setActive('favorites')}
/>
```

### Spacer (Gap Without Div)
```tsx
<Spacer size="md" direction="vertical" />
```

---

## Size Options
```
compact   → h-6 (24px), text-xs (12px)
normal    → h-8 (32px), text-sm (13px)  [default]
spacious  → h-10 (40px), text-base (14px)
```

## Gap Options
```
xs  → gap-0.5 (2px)
sm  → gap-1 (4px)
md  → gap-2 (8px)
```

---

## Before & After

### ❌ Before (Inline Classes)
```tsx
<div className="px-3 pt-titlebar pb-2.5 border-b border-border">
  <div className="flex items-center justify-between">
    <h3 className="text-sm">Notes</h3>
    <button className="h-7 w-7 p-0">
      <Icon />
    </button>
  </div>
</div>
```

### ✅ After (Composites)
```tsx
<Header
  left={<Heading3>Notes</Heading3>}
  right={<IconButton icon={<Icon />} />}
/>
```

---

## Do's and Don'ts

✅ **DO**
- Use composite components for common patterns
- Use `size="compact"` instead of `className="h-6 text-xs"`
- Use `left={}` and `right={}` props for layout
- Stack composites for complex layouts
- Combine with Container components for structure

❌ **DON'T**
- Mix inline classes with composites (pick one)
- Use `className="px-3 py-2"` when you can use `size="normal"`
- Create wrapper divs when composites have `left`/`right` props
- Nest multiple padding/spacing utilities - use Spacer component
- Forget to import from `@renderer/components/composites`

---

## Quick Import
```tsx
import {
  Header,
  ControlGroup,
  ListItem,
  ListContainer,
  CompactCard,
  IconButton,
  PanelFooter,
  QuickLink,
  Spacer,
  SectionHeader,
  type SizeVariant
} from '@renderer/components/composites';
```
