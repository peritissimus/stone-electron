# Composite Components - Import Guide

## Quick Import (Most Common)

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
  TreeItem,
  ToolbarButton,
  ToolbarDivider,
  type SizeVariant
} from '@renderer/components/composites';
```

## Import Everything

```tsx
import * as Composites from '@renderer/components/composites';

// Usage:
<Composites.Header />
<Composites.ListItem />
// etc...
```

## Selective Imports

### Navigation & Headers Only
```tsx
import {
  Header,
  IconButton,
  QuickLink,
  SectionHeader
} from '@renderer/components/composites';
```

### Lists & Items Only
```tsx
import {
  ListItem,
  ListContainer,
  CompactCard
} from '@renderer/components/composites';
```

### Controls Only
```tsx
import {
  ControlGroup,
  ToolbarButton,
  ToolbarDivider
} from '@renderer/components/composites';
```

### Tree Components Only
```tsx
import {
  TreeItem
} from '@renderer/components/composites';
```

### Layout Only
```tsx
import {
  Spacer,
  PanelFooter
} from '@renderer/components/composites';
```

## Import Tokens Only

```tsx
import {
  type SizeVariant,
  sizeTextClasses,
  sizeHeightClasses,
  sizePaddingClasses,
  gapClasses,
  spacerSizeClasses,
  justifyClasses
} from '@renderer/components/composites';
```

## Grouped Import

```tsx
// Headers & Navigation
import {
  Header,
  IconButton,
  QuickLink,
  SectionHeader
} from '@renderer/components/composites';

// Lists & Items
import {
  ListItem,
  ListContainer,
  CompactCard,
  TreeItem
} from '@renderer/components/composites';

// Controls
import {
  ControlGroup,
  ToolbarButton,
  ToolbarDivider
} from '@renderer/components/composites';

// Layout
import {
  Spacer,
  PanelFooter
} from '@renderer/components/composites';
```

## TypeScript Types

```tsx
import type {
  SizeVariant,
  HeaderProps,
  ControlGroupProps,
  ListItemProps,
  ListContainerProps,
  CompactCardProps,
  SpacerProps,
  IconButtonProps,
  PanelFooterProps,
  SectionHeaderProps,
  QuickLinkProps,
  TreeItemProps,
  ToolbarButtonProps,
  ToolbarDividerProps
} from '@renderer/components/composites';
```

## Path Aliases

The project uses these path aliases:
- `@renderer/` → `src/renderer/`
- `@main/` → `src/main/`
- `@shared/` → `src/shared/`

So all imports use:
```tsx
import { Header } from '@renderer/components/composites';
```

**NOT:**
```tsx
import { Header } from '../../../components/composites';  // Don't do this!
```

## Common Import Patterns

### Page Component with Multiple Sections
```tsx
import React from 'react';
import {
  Header,
  ListContainer,
  ListItem,
  PanelFooter,
  IconButton
} from '@renderer/components/composites';
import { Button } from '@renderer/components/ui/button';

export function MyPage() {
  return (
    <>
      <Header
        left={<Title />}
        right={<IconButton icon={<Icon />} />}
      />

      <ListContainer viewMode="list">
        {items.map(item => (
          <ListItem key={item.id} title={item.title} />
        ))}
      </ListContainer>

      <PanelFooter>
        <Button>Save</Button>
      </PanelFooter>
    </>
  );
}
```

### Sidebar Component
```tsx
import {
  Header,
  IconButton,
  QuickLink,
  SectionHeader,
  PanelFooter,
  TreeItem
} from '@renderer/components/composites';

export function Sidebar() {
  return (
    <>
      <Header
        left={<Title>Stone</Title>}
        right={<IconButton icon={<Settings />} />}
      />

      <SectionHeader title="Quick Links" />
      <QuickLink icon={<Star />} label="Favorites" />
      <QuickLink icon={<Clock />} label="Recent" />

      <TreeItem icon="📁" label="Notebooks">
        <TreeItem level={1} icon="📄" label="Note 1" />
      </TreeItem>

      <PanelFooter>
        <Button>New</Button>
      </PanelFooter>
    </>
  );
}
```

### Editor/Toolbar Component
```tsx
import {
  ToolbarButton,
  ToolbarDivider
} from '@renderer/components/composites';

export function EditorToolbar({ editor }) {
  return (
    <div className="flex items-center gap-0.5">
      <ToolbarButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().toggleBold().run()}
        tooltip="Bold"
      >
        <Bold size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().toggleItalic().run()}
        tooltip="Italic"
      >
        <Italic size={16} />
      </ToolbarButton>
    </div>
  );
}
```

## Avoiding Common Mistakes

### ❌ DON'T import from wrong path
```tsx
import { Header } from '@renderer/components/composites/Header';  // Wrong!
import { Header } from './composites/Header';                     // Wrong!
```

### ✅ DO use the index export
```tsx
import { Header } from '@renderer/components/composites';  // Correct!
```

### ❌ DON'T forget to import composites
```tsx
export function MyComponent() {
  return <Header />  // Will fail - Header is not defined!
}
```

### ✅ DO import before using
```tsx
import { Header } from '@renderer/components/composites';

export function MyComponent() {
  return <Header />  // Works!
}
```

## IDE Auto-completion

Most IDEs (VS Code, WebStorm) will auto-suggest imports. When you type:
```tsx
<Header />
```

Your IDE should suggest:
```
Import 'Header' from '@renderer/components/composites'
```

Just accept the suggestion and the import will be added automatically.

## File Organization

When organizing imports in your component files, follow this order:
```tsx
// 1. React and external libraries
import React, { useState } from 'react';
import { useStore } from 'zustand';

// 2. Internal composites
import {
  Header,
  ListContainer,
  ListItem,
  PanelFooter
} from '@renderer/components/composites';

// 3. UI components
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';

// 4. Stores and hooks
import { useNoteStore } from '@renderer/stores/noteStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';

// 5. Types
import type { Note } from '@shared/types';
```

This organization makes imports easier to scan and maintain.
