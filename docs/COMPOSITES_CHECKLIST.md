# Composite Components - Developer Checklist

## Before Writing a New Component

### ✅ Planning Phase
- [ ] Check if a composite already exists for this pattern
- [ ] Read COMPOSITES_QUICK_REF.md to see all available components
- [ ] Check if you can combine existing composites
- [ ] Identify the size variant you need (compact/normal/spacious)

### ✅ Implementation Phase
- [ ] Use `Header` for top navigation/header areas
- [ ] Use `ListItem` + `ListContainer` for lists
- [ ] Use `CompactCard` for grid/card views
- [ ] Use `ControlGroup` for related buttons/toggles
- [ ] Use `IconButton` instead of `<Button className="h-8 w-8">`
- [ ] Use `Spacer` instead of manual padding/margin
- [ ] Use `TreeItem` for tree structures with indentation
- [ ] Use `ToolbarButton` + `ToolbarDivider` for toolbars
- [ ] Use `PanelFooter` for footer sections
- [ ] Use `SectionHeader` for section headers
- [ ] Use `QuickLink` for sidebar navigation

### ✅ Styling Phase
- [ ] ❌ DON'T add inline classes like `className="px-3 py-2"`
- [ ] ❌ DON'T use `style={{ paddingLeft }}` for indentation
- [ ] ❌ DON'T hardcode sizes like `className="h-8 w-8"`
- [ ] ❌ DON'T create custom button styles
- [ ] ✅ DO use `size="compact"` instead of manual sizing
- [ ] ✅ DO use tokens from `@renderer/components/composites`
- [ ] ✅ DO leverage `left` and `right` props to avoid wrapper divs

### ✅ Import Phase
- [ ] Import composites from `@renderer/components/composites`
- [ ] Don't use relative imports like `./composites/Header`
- [ ] Group related imports together
- [ ] Import types if using TypeScript

### ✅ Testing Phase
- [ ] Test light mode appearance
- [ ] Test dark mode appearance
- [ ] Test all size variants (compact, normal, spacious)
- [ ] Test keyboard navigation
- [ ] Test tooltips/aria-labels
- [ ] Test responsive behavior

## When Refactoring Existing Components

### ✅ Pre-Refactor
- [ ] Backup your changes (git commit)
- [ ] Understand the current component structure
- [ ] Identify which patterns can use composites
- [ ] Plan the refactoring steps

### ✅ During Refactor
- [ ] Replace manual header divs with `<Header />`
- [ ] Replace manual control groups with `<ControlGroup />`
- [ ] Replace button with inline sizes with `<IconButton />`
- [ ] Replace manual spacing with `<Spacer />`
- [ ] Replace manual indentation with `<TreeItem level={} />`
- [ ] Replace manual list styling with `<ListItem />`
- [ ] Keep test coverage high
- [ ] Keep component logic intact

### ✅ Post-Refactor
- [ ] Run tests to ensure no regressions
- [ ] Check light/dark mode
- [ ] Check responsive behavior
- [ ] Commit with clear message
- [ ] Remove unused imports

## Composite Component Checklist

### Headers & Navigation
- [x] Header - top navigation
- [x] IconButton - icon buttons
- [x] QuickLink - sidebar links
- [x] SectionHeader - section headers

### Lists & Items
- [x] ListItem - list items
- [x] ListContainer - list wrapper
- [x] CompactCard - grid/card items
- [x] TreeItem - tree items

### Controls
- [x] ControlGroup - button groups
- [x] ToolbarButton - toolbar buttons
- [x] ToolbarDivider - toolbar dividers

### Layout
- [x] Spacer - spacing without divs
- [x] PanelFooter - footer sections

## Feature Matrix

| Component | Size Variants | Dark Mode | Accessible | Tested |
|-----------|---------------|-----------|-----------|--------|
| Header | ✅ | ✅ | ✅ | ✅ |
| IconButton | ✅ | ✅ | ✅ | ✅ |
| ControlGroup | ✅ | ✅ | ✅ | ✅ |
| ListItem | ✅ | ✅ | ✅ | ✅ |
| ListContainer | ✅ | ✅ | ✅ | ✅ |
| CompactCard | ✅ | ✅ | ✅ | ✅ |
| TreeItem | ✅ | ✅ | ✅ | ✅ |
| Spacer | ✅ | ✅ | ✅ | ✅ |
| PanelFooter | ✅ | ✅ | ✅ | ✅ |
| SectionHeader | ✅ | ✅ | ✅ | ✅ |
| QuickLink | ✅ | ✅ | ✅ | ✅ |
| ToolbarButton | ✅ | ✅ | ✅ | ✅ |
| ToolbarDivider | ✅ | ✅ | ✅ | ✅ |

## Quick Decision Tree

```
Need to build a UI element?
│
├─ Is it a top navigation/header?
│  └─ YES → Use <Header />
│
├─ Is it a single button with an icon?
│  └─ YES → Use <IconButton />
│
├─ Is it a group of related buttons?
│  └─ YES → Use <ControlGroup />
│
├─ Is it a list of items?
│  ├─ List view? → Use <ListContainer viewMode="list" /> + <ListItem />
│  ├─ Grid view? → Use <ListContainer viewMode="grid" /> + <CompactCard />
│  └─ Card view? → Use <ListContainer viewMode="card" /> + <CompactCard />
│
├─ Is it a tree structure?
│  └─ YES → Use <TreeItem level={} />
│
├─ Is it a toolbar?
│  └─ YES → Use <ToolbarButton /> + <ToolbarDivider />
│
├─ Is it a footer section?
│  └─ YES → Use <PanelFooter />
│
├─ Is it a section header?
│  └─ YES → Use <SectionHeader />
│
├─ Is it spacing/padding?
│  └─ YES → Use <Spacer />
│
└─ Otherwise → Use a container component (ContainerFlex, ContainerStack, etc.)
```

## Code Review Checklist

When reviewing code that uses composites:

- [ ] Composites are imported from `@renderer/components/composites`
- [ ] No magic number values (px/py/h/w hardcoded)
- [ ] Size variants used consistently
- [ ] Left/right props used instead of wrapper divs
- [ ] No unnecessary className attributes on composites
- [ ] Dark mode works correctly
- [ ] Accessibility features present (aria-labels, tooltips)
- [ ] Type-safe prop usage

## Common Mistakes to Avoid

### ❌ Mistake 1: Mixing inline classes with composites
```tsx
// Wrong!
<Header className="px-3 py-2" />
```

### ✅ Fix: Use composites' built-in styling
```tsx
// Correct!
<Header size="normal" />
```

---

### ❌ Mistake 2: Manual sizing instead of IconButton
```tsx
// Wrong!
<Button className="h-8 w-8 p-0">
  <Icon />
</Button>
```

### ✅ Fix: Use IconButton composite
```tsx
// Correct!
<IconButton size="normal" icon={<Icon />} />
```

---

### ❌ Mistake 3: Creating wrapper divs when left/right exists
```tsx
// Wrong!
<Header>
  <div className="flex gap-2">
    <Button>Action 1</Button>
    <Button>Action 2</Button>
  </div>
</Header>
```

### ✅ Fix: Use left/right props
```tsx
// Correct!
<Header
  left={<Title />}
  right={
    <div className="flex gap-2">
      <Button>Action 1</Button>
      <Button>Action 2</Button>
    </div>
  }
/>
```

---

### ❌ Mistake 4: Manual padding instead of Spacer
```tsx
// Wrong!
<div style={{ marginTop: '16px' }}>Content</div>
```

### ✅ Fix: Use Spacer
```tsx
// Correct!
<Spacer size="md" />
<div>Content</div>
```

---

### ❌ Mistake 5: Hardcoded indentation instead of TreeItem
```tsx
// Wrong!
<div style={{ paddingLeft: `${level * 10}px` }}>
  <Button>{label}</Button>
</div>
```

### ✅ Fix: Use TreeItem
```tsx
// Correct!
<TreeItem level={level} label={label} />
```

## Documentation References

| Need | Resource |
|------|----------|
| Quick overview | COMPOSITES_QUICK_REF.md |
| Complete reference | COMPOSITES_GUIDE.md |
| Real examples | REFACTORING_EXAMPLES.md |
| Implementation details | COMPOSITES_IMPLEMENTATION_SUMMARY.md |
| Import patterns | COMPOSITES_IMPORTS.md |
| This checklist | COMPOSITES_CHECKLIST.md |

## Useful Commands

### Check if composites are being used properly
```bash
# Find all inline classes that should use composites
grep -r "className=\".*px-\|py-\|pt-\|pb-" src/renderer/components --include="*.tsx"

# Find all hardcoded sizes
grep -r "className=\".*h-[0-9]\|w-[0-9]" src/renderer/components --include="*.tsx"
```

### Check for style attributes
```bash
# Find all inline styles that could use composites
grep -r "style={{" src/renderer/components --include="*.tsx"
```

## Success Criteria

Your refactoring is complete when:

✅ No inline padding/margin classes (px-*, py-*, pt-*, pb-*)
✅ No hardcoded sizes (h-6, w-6, etc.) - use IconButton or Spacer instead
✅ No style attributes for layout - use composites instead
✅ All headers use `<Header />`
✅ All lists use `<ListItem />` + `<ListContainer />`
✅ All buttons with icons use `<IconButton />`
✅ All toolbars use `<ToolbarButton />` + `<ToolbarDivider />`
✅ All footers use `<PanelFooter />`
✅ Dark mode still works
✅ Accessibility features present
✅ Tests pass
✅ Code review approved

---

**Remember**: When in doubt, check COMPOSITES_QUICK_REF.md or ask for help! 🎉
