# Component Architecture Guide

## Overview

This document defines the rules and patterns for building UI components in Stone. The architecture follows a three-tier hierarchy: **Base → Composite → Feature**, ensuring consistency, maintainability, and reusability.

## Component Hierarchy

```
┌─────────────────────────────────────────┐
│  Feature Components                     │  Application-specific logic
│  (NoteEditor, NotebookTree, TagList)    │  Business logic & state
└─────────────────────────────────────────┘
                   ↓ uses
┌─────────────────────────────────────────┐
│  Composite Components                   │  Reusable patterns
│  (ActionCard, SettingsSection, etc.)    │  Domain-agnostic
└─────────────────────────────────────────┘
                   ↓ uses
┌─────────────────────────────────────────┐
│  Base Components                        │  Primitives
│  (Text, Button, Input, Dialog, etc.)    │  Design system foundation
└─────────────────────────────────────────┘
```

### 1. Base Components (`src/renderer/components/ui/`)

**Purpose**: Fundamental building blocks that implement the design system.

**Characteristics**:
- Direct implementation or thin wrappers around shadcn/Radix primitives
- No business logic
- Design token integration (colors, spacing, typography)
- Maximum flexibility through props
- Full TypeScript support with exported types

**Examples**: `Text`, `Button`, `Input`, `Dialog`, `Card`

**Rules**:
1. Must use `forwardRef` to support refs
2. Must include `displayName` for debugging
3. Must use `cn()` utility for className merging
4. Must export all prop types
5. Must support theme variants (light/dark)
6. Should use CSS variables from design system
7. Should include sensible defaults

### 2. Composite Components (`src/renderer/components/[Domain]/`)

**Purpose**: Reusable patterns combining multiple base components.

**Characteristics**:
- Combine 2+ base components
- Implement common UI patterns
- Domain-agnostic (could be used in any app)
- Preset styling with optional customization
- Opinionated but flexible

**Examples**: `ActionCard`, `SettingsSection`, `StatusCard`

**Rules**:
1. Must compose from base components only
2. Must accept `className` prop for overrides
3. Should limit customization to common use cases
4. Should use TypeScript interfaces (not types)
5. Should export props interface
6. Should focus on layout and structure
7. May include simple state (UI state only, no business logic)

### 3. Feature Components (`src/renderer/components/[Feature]/`)

**Purpose**: Application-specific components with business logic.

**Characteristics**:
- Implement specific features
- Connect to stores (Zustand)
- Handle IPC communication
- Complex state management
- Application-specific behavior

**Examples**: `NoteEditor`, `NotebookTree`, `TagList`, `SearchPanel`

**Rules**:
1. Can use any base or composite components
2. Can connect to Zustand stores
3. Can call IPC handlers
4. Should separate logic from presentation (hooks)
5. Should handle loading/error states
6. Should include prop validation

---

## Component Design Patterns

### Pattern 1: Base Component with Variants

**Use for**: Components with multiple visual variations (buttons, text, badges)

```typescript
// Define variant types
export type ButtonVariant = 'default' | 'secondary' | 'destructive' | 'ghost' | 'link';

// Map variants to classes
const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  // ...
};

// Use in component
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(variantClasses[variant], className)}
        {...props}
      />
    );
  }
);
```

**Benefits**: Type-safe, consistent, easy to extend

### Pattern 2: Convenience Components

**Use for**: Common configurations of flexible base components

```typescript
// Base component
export const Text = React.forwardRef<HTMLElement, TextProps>(/* ... */);

// Convenience components
export const Heading1 = React.forwardRef<HTMLHeadingElement, Omit<TextProps, 'as' | 'size' | 'weight'>>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} as="h1" size="4xl" weight="bold" className={cn('scroll-m-20', className)} {...props} />
  )
);

export const Body = React.forwardRef<HTMLParagraphElement, Omit<TextProps, 'as'>>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} as="p" className={cn('leading-7', className)} {...props} />
  )
);
```

**Benefits**: Reduces boilerplate, ensures consistency, maintains flexibility

### Pattern 3: Composite Component with Slots

**Use for**: Complex layouts with multiple content areas

```typescript
interface ActionCardProps {
  title: string;
  description: string;
  buttonText: string;
  buttonIcon?: React.ReactNode;  // Slot for custom icon
  onClick: () => void;
  loading?: boolean;
  variant?: 'default' | 'secondary' | 'destructive';
  className?: string;
}

export function ActionCard({ title, description, buttonIcon, ...props }: ActionCardProps) {
  return (
    <div className={cn('border rounded-lg p-4', props.className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Body weight="medium">{title}</Body>
          <Body size="sm" variant="muted">{description}</Body>
        </div>
        <Button onClick={props.onClick} variant={props.variant} disabled={props.loading}>
          {buttonIcon}  {/* Slot injection */}
          {props.buttonText}
        </Button>
      </div>
    </div>
  );
}
```

**Benefits**: Flexible content areas, clear API, type-safe

### Pattern 4: Container/Presenter Split

**Use for**: Feature components with complex logic

```typescript
// Presenter (pure UI)
interface NoteEditorViewProps {
  title: string;
  content: string;
  isLoading: boolean;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
}

function NoteEditorView({ title, content, isLoading, onTitleChange, onContentChange }: NoteEditorViewProps) {
  return (
    <div className="flex flex-col h-full">
      <Input value={title} onChange={e => onTitleChange(e.target.value)} />
      <Editor content={content} onChange={onContentChange} />
    </div>
  );
}

// Container (logic + state)
export function NoteEditor() {
  const { activeNote, updateNote } = useNoteStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleTitleChange = async (value: string) => {
    setIsLoading(true);
    await updateNote({ ...activeNote, title: value });
    setIsLoading(false);
  };

  if (!activeNote) return <EmptyState />;

  return (
    <NoteEditorView
      title={activeNote.title}
      content={activeNote.content}
      isLoading={isLoading}
      onTitleChange={handleTitleChange}
      onContentChange={handleContentChange}
    />
  );
}
```

**Benefits**: Testability, reusability, clear separation of concerns

---

## Naming Conventions

### Component Names

| Type | Pattern | Example |
|------|---------|---------|
| Base Component | PascalCase (noun) | `Button`, `Input`, `Dialog` |
| Composite Component | PascalCase (descriptive) | `ActionCard`, `SettingsSection` |
| Feature Component | PascalCase (feature name) | `NoteEditor`, `NotebookTree` |
| Convenience Component | PascalCase (semantic) | `Heading1`, `Body`, `Label` |

### File Names

| Type | Pattern | Example |
|------|---------|---------|
| Component | kebab-case.tsx | `action-card.tsx` |
| Index (barrel) | index.ts | `index.ts` |
| Types | same as component | `action-card.tsx` (types inline) |

### Prop Interfaces

```typescript
// Pattern: {ComponentName}Props
interface ActionCardProps { /* ... */ }
interface NoteEditorProps { /* ... */ }

// For specific variants
interface DialogTriggerProps { /* ... */ }
interface DialogContentProps { /* ... */ }
```

---

## File Structure

### Base Component File

```typescript
// button.tsx
import * as React from 'react';
import { cn } from '@renderer/lib/utils';

// 1. Type definitions
export type ButtonVariant = 'default' | 'secondary' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

// 2. Variant mappings
const variantClasses: Record<ButtonVariant, string> = {
  // ...
};

// 3. Component implementation
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'md', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(variantClasses[variant], sizeClasses[size], className)}
        {...props}
      />
    );
  }
);

// 4. Display name
Button.displayName = 'Button';
```

### Composite Component File

```typescript
// ActionCard.tsx
import React from 'react';
import { Button } from '@renderer/components/ui/button';
import { Body } from '@renderer/components/ui/text';
import { cn } from '@renderer/lib/utils';

// 1. Props interface
interface ActionCardProps {
  title: string;
  description: string;
  buttonText: string;
  buttonIcon?: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  variant?: 'default' | 'secondary' | 'destructive';
  className?: string;
}

// 2. Component implementation
export function ActionCard({
  title,
  description,
  buttonText,
  buttonIcon,
  onClick,
  loading = false,
  variant = 'default',
  className,
}: ActionCardProps) {
  return (
    <div className={cn('border border-border rounded-lg p-4', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Body weight="medium" className="mb-1">{title}</Body>
          <Body size="sm" variant="muted">{description}</Body>
        </div>
        <Button onClick={onClick} disabled={loading} variant={variant} className="ml-4 gap-2">
          {buttonIcon}
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
```

### Barrel Export (index.ts)

```typescript
// src/renderer/components/ui/index.ts
export { Button, type ButtonProps } from './button';
export { Input, type InputProps } from './input';
export { Text, Heading1, Heading2, Body, Label, type TextProps } from './text';
// ...

// src/renderer/components/Settings/index.ts
export { SettingsSection } from './SettingsSection';
export { ActionCard } from './ActionCard';
export { StatusCard } from './StatusCard';
export { Message } from './Message';
```

---

## Props Design

### Required vs Optional

**Guideline**: Make props required unless there's a sensible default.

```typescript
interface ActionCardProps {
  title: string;              // Required (no default)
  description: string;         // Required (no default)
  onClick: () => void;         // Required (no default)
  variant?: ButtonVariant;     // Optional (has default: 'default')
  loading?: boolean;           // Optional (has default: false)
  className?: string;          // Optional (has default: '')
}
```

### Prop Categories

Organize props in this order:

```typescript
interface ComponentProps {
  // 1. Content props (required)
  title: string;
  children: React.ReactNode;

  // 2. Behavior props (optional)
  onClick?: () => void;
  onChange?: (value: string) => void;

  // 3. State props (optional)
  loading?: boolean;
  disabled?: boolean;
  error?: string;

  // 4. Style props (optional)
  variant?: Variant;
  size?: Size;
  className?: string;

  // 5. HTML attributes (via extends)
  // extends React.HTMLAttributes<HTMLElement>
}
```

### Prop Naming

| Purpose | Pattern | Example |
|---------|---------|---------|
| Event handler | `on[Event]` | `onClick`, `onChange` |
| Boolean state | `is[State]` or adjective | `isLoading`, `disabled` |
| Content slot | noun | `icon`, `children` |
| Style variant | noun | `variant`, `size` |

---

## Styling Rules

### 1. Use Tailwind Classes

**Do**:
```typescript
<div className="flex items-center gap-2 p-4 border border-border rounded-lg">
```

**Don't**:
```typescript
<div style={{ display: 'flex', padding: '16px' }}>
```

### 2. Use Design Tokens

**Do**:
```typescript
<div className="bg-background text-foreground border-border">
```

**Don't**:
```typescript
<div className="bg-white text-black border-gray-200">
```

### 3. Use cn() for Conditional Classes

**Do**:
```typescript
import { cn } from '@renderer/lib/utils';

<div className={cn(
  'base-classes',
  isActive && 'active-classes',
  className
)}>
```

**Don't**:
```typescript
<div className={`base-classes ${isActive ? 'active-classes' : ''} ${className}`}>
```

### 4. macOS Design System Values

**Spacing**: Use 4px increments
```typescript
p-1   // 4px
p-2   // 8px
p-3   // 12px
p-4   // 16px
```

**Border Radius**: Use consistent values
```typescript
rounded-md   // 6px (small elements)
rounded-lg   // 10px (cards, modals - macOS standard)
rounded-xl   // 12px (large containers)
```

**Font Sizes**: Match macOS standards
```typescript
text-xs   // 11px
text-sm   // 13px (macOS standard)
text-base // 14px
text-lg   // 16px
```

---

## Composition Patterns

### Pattern: Children as Content

**Use for**: Flexible container components

```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('rounded-lg border p-4', className)}>
      {children}
    </div>
  );
}

// Usage
<Card>
  <Heading3>Title</Heading3>
  <Body>Content goes here</Body>
</Card>
```

### Pattern: Named Slots

**Use for**: Components with specific content areas

```typescript
interface ModalProps {
  header: React.ReactNode;
  content: React.ReactNode;
  footer: React.ReactNode;
}

export function Modal({ header, content, footer }: ModalProps) {
  return (
    <div className="modal">
      <div className="header">{header}</div>
      <div className="content">{content}</div>
      <div className="footer">{footer}</div>
    </div>
  );
}

// Usage
<Modal
  header={<Heading2>Title</Heading2>}
  content={<Body>Content</Body>}
  footer={<Button>Close</Button>}
/>
```

### Pattern: Compound Components

**Use for**: Related components that work together

```typescript
// Card.tsx
export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border">{children}</div>;
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b p-4">{children}</div>;
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>;
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="border-t p-4">{children}</div>;
}

// Usage
<Card>
  <CardHeader>
    <Heading3>Title</Heading3>
  </CardHeader>
  <CardContent>
    <Body>Content</Body>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

---

## Container Component System

Stone includes a comprehensive container system inspired by Every Layout patterns. These base components handle common layout needs across the application.

### Container Components Overview

| Component | Purpose | Common Use Cases |
|-----------|---------|------------------|
| `Container` | Width constraint + padding | Page content, sections |
| `ContainerSection` | Semantic sectioning | Page sections with vertical spacing |
| `ContainerStack` | Vertical layout | Form fields, card content |
| `ContainerCluster` | Horizontal wrap layout | Tags, buttons, inline items |
| `ContainerGrid` | CSS Grid layout | Card grids, data tables |
| `ContainerFlex` | Flexible layout | Toolbars, headers, complex layouts |
| `ContainerSplit` | Two-column responsive | Sidebar + main, form + preview |
| `ContainerCenter` | Centered content | Empty states, modals, landing |
| `ContainerScrollable` | Scroll container | Note lists, long content |

### Container - Basic Width Constraint

Constrains content width with horizontal padding and optional centering.

```typescript
import { Container } from '@renderer/components/ui';

// Default: lg size (1152px), md padding, centered
<Container>
  <Heading2>Page Title</Heading2>
  <Body>Content constrained to max-width</Body>
</Container>

// Custom configuration
<Container size="md" padding="lg" centered={false}>
  <Body>Narrower content, more padding, not centered</Body>
</Container>

// Sizes: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
// Padding: 'none' | 'sm' | 'md' | 'lg' | 'xl'
```

### ContainerSection - Semantic Sections

Semantic `<section>` element with consistent vertical spacing.

```typescript
import { ContainerSection, Container } from '@renderer/components/ui';

<ContainerSection spacing="lg" background="muted">
  <Container>
    <Heading2>Section Title</Heading2>
    <Body>Section content</Body>
  </Container>
</ContainerSection>

// Spacing: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
// Background: 'default' | 'muted' | 'accent'
```

### ContainerStack - Vertical Layouts

Vertical flex layout with consistent gap between children.

```typescript
import { ContainerStack } from '@renderer/components/ui';

// Form layout
<ContainerStack gap="md">
  <FormField label="Name">
    <Input />
  </FormField>
  <FormField label="Email">
    <Input type="email" />
  </FormField>
  <Button>Submit</Button>
</ContainerStack>

// Split layout (space-between)
<ContainerStack gap="md" split>
  <Heading2>Title</Heading2>
  <Button>Action</Button>
</ContainerStack>

// Gap: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
// Align: 'start' | 'center' | 'end' | 'stretch'
```

### ContainerCluster - Horizontal Wrap

Horizontal layout that wraps items to next line with consistent spacing.

```typescript
import { ContainerCluster } from '@renderer/components/ui';

// Tags layout
<ContainerCluster gap="sm" justify="start" wrap>
  <Badge>React</Badge>
  <Badge>TypeScript</Badge>
  <Badge>Electron</Badge>
</ContainerCluster>

// Toolbar buttons
<ContainerCluster gap="xs" justify="between" align="center">
  <Button variant="ghost">Edit</Button>
  <Button variant="ghost">Delete</Button>
  <Button>Save</Button>
</ContainerCluster>

// Justify: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
// Align: 'start' | 'center' | 'end' | 'baseline' | 'stretch'
```

### ContainerGrid - CSS Grid

Responsive grid layout with automatic responsive behavior.

```typescript
import { ContainerGrid } from '@renderer/components/ui';

// 3-column grid, 2 on tablet, 1 on mobile
<ContainerGrid cols={3} gap="lg" mobileCols={1} tabletCols={2}>
  <Card>Item 1</Card>
  <Card>Item 2</Card>
  <Card>Item 3</Card>
</ContainerGrid>

// Auto-fit (responsive columns based on min width)
<ContainerGrid cols="auto-fit" gap="md">
  <Card>Auto-sized card</Card>
  <Card>Auto-sized card</Card>
</ContainerGrid>

// Cols: 1 | 2 | 3 | 4 | 5 | 6 | 12 | 'auto-fit' | 'auto-fill'
```

### ContainerFlex - Flexible Layout

Full control over flexbox properties for complex layouts.

```typescript
import { ContainerFlex } from '@renderer/components/ui';

// Toolbar
<ContainerFlex direction="row" justify="between" align="center" gap="md">
  <Heading3>Document Title</Heading3>
  <ContainerCluster gap="xs">
    <Button variant="ghost">Share</Button>
    <Button>Save</Button>
  </ContainerCluster>
</ContainerFlex>

// Vertical sidebar
<ContainerFlex direction="col" justify="start" align="stretch" gap="sm">
  <Button variant="ghost">Home</Button>
  <Button variant="ghost">Settings</Button>
</ContainerFlex>

// Direction: 'row' | 'row-reverse' | 'col' | 'col-reverse'
// Wrap: 'nowrap' | 'wrap' | 'wrap-reverse'
```

### ContainerSplit - Two-Column Layout

Responsive two-column layout that stacks on mobile.

```typescript
import { ContainerSplit } from '@renderer/components/ui';

// 2:1 ratio (main content : sidebar)
<ContainerSplit ratio="2:1" gap="lg" breakpoint="md">
  <div>
    <Heading2>Main Content</Heading2>
    <Body>Article content here...</Body>
  </div>
  <aside>
    <Heading4>Related</Heading4>
    <Body>Sidebar content</Body>
  </aside>
</ContainerSplit>

// 1:1 ratio (equal columns)
<ContainerSplit ratio="1:1" gap="md">
  <div>Left column</div>
  <div>Right column</div>
</ContainerSplit>

// Ratio: '1:1' | '1:2' | '2:1' | '1:3' | '3:1'
// Breakpoint: 'sm' | 'md' | 'lg'
```

### ContainerCenter - Centered Content

Centers content horizontally and optionally vertically.

```typescript
import { ContainerCenter } from '@renderer/components/ui';

// Empty state
<ContainerCenter maxWidth="md" centerVertically minHeight="400px">
  <EmptyState
    icon={<FileX />}
    title="No notes yet"
    description="Create your first note to get started"
  />
</ContainerCenter>

// Login form
<ContainerCenter maxWidth="sm" centerVertically minHeight="100vh">
  <Card>
    <CardHeader>
      <Heading2>Welcome</Heading2>
    </CardHeader>
    <CardContent>
      <LoginForm />
    </CardContent>
  </Card>
</ContainerCenter>
```

### ContainerScrollable - Scroll Container

Customizable scrollable container.

```typescript
import { ContainerScrollable } from '@renderer/components/ui';

// Vertical scroll (default)
<ContainerScrollable direction="vertical" maxHeight="500px">
  {noteList.map(note => <NoteCard key={note.id} {...note} />)}
</ContainerScrollable>

// Hidden scrollbar
<ContainerScrollable direction="vertical" maxHeight="400px" hideScrollbar>
  <LongContent />
</ContainerScrollable>

// Horizontal scroll
<ContainerScrollable direction="horizontal" maxHeight="200px">
  <ContainerCluster wrap={false}>
    <Card>Item 1</Card>
    <Card>Item 2</Card>
    <Card>Item 3</Card>
  </ContainerCluster>
</ContainerScrollable>

// Direction: 'vertical' | 'horizontal' | 'both'
```

### Container Pattern Examples

#### Page Layout Pattern

```typescript
<Container size="lg" padding="md">
  <ContainerSection spacing="xl">
    <ContainerStack gap="lg">
      <Heading1>Page Title</Heading1>
      <Body>Introduction text</Body>
    </ContainerStack>
  </ContainerSection>

  <ContainerSection spacing="lg" background="muted">
    <ContainerGrid cols={3} gap="md" mobileCols={1} tabletCols={2}>
      <Card>Feature 1</Card>
      <Card>Feature 2</Card>
      <Card>Feature 3</Card>
    </ContainerGrid>
  </ContainerSection>
</Container>
```

#### Form Layout Pattern

```typescript
<Container size="md">
  <ContainerStack gap="lg">
    <Heading2>Settings</Heading2>

    <ContainerStack gap="md">
      <FormField label="Name">
        <Input />
      </FormField>
      <FormField label="Email">
        <Input type="email" />
      </FormField>
    </ContainerStack>

    <ContainerFlex justify="end" gap="sm">
      <Button variant="ghost">Cancel</Button>
      <Button>Save</Button>
    </ContainerFlex>
  </ContainerStack>
</Container>
```

#### Dashboard Layout Pattern

```typescript
<ContainerSplit ratio="1:3" gap="lg" breakpoint="lg">
  {/* Sidebar */}
  <aside>
    <ContainerStack gap="md">
      <Heading3>Navigation</Heading3>
      <ContainerScrollable direction="vertical" maxHeight="calc(100vh - 200px)">
        <NavItems />
      </ContainerScrollable>
    </ContainerStack>
  </aside>

  {/* Main Content */}
  <main>
    <ContainerStack gap="lg">
      <ContainerFlex justify="between" align="center">
        <Heading2>Dashboard</Heading2>
        <Button>New Item</Button>
      </ContainerFlex>

      <ContainerGrid cols="auto-fit" gap="md">
        <StatsCard title="Users" value="1,234" />
        <StatsCard title="Revenue" value="$56,789" />
        <StatsCard title="Orders" value="890" />
      </ContainerGrid>
    </ContainerStack>
  </main>
</ContainerSplit>
```

#### Card Content Pattern

```typescript
<Card>
  <CardHeader>
    <ContainerFlex justify="between" align="center">
      <Heading3>Card Title</Heading3>
      <Button variant="ghost">Edit</Button>
    </ContainerFlex>
  </CardHeader>

  <CardContent>
    <ContainerStack gap="md">
      <Body>Main content</Body>
      <ContainerCluster gap="sm">
        <Badge>Tag 1</Badge>
        <Badge>Tag 2</Badge>
      </ContainerCluster>
    </ContainerStack>
  </CardContent>

  <CardFooter>
    <ContainerFlex justify="end" gap="sm">
      <Button variant="ghost">Cancel</Button>
      <Button>Confirm</Button>
    </ContainerFlex>
  </CardFooter>
</Card>
```

### When to Use Each Container

- **Container**: Use for constraining page width and adding horizontal padding
- **ContainerSection**: Use for semantic page sections with vertical rhythm
- **ContainerStack**: Use for any vertical list of items (forms, cards, lists)
- **ContainerCluster**: Use for inline items that should wrap (tags, buttons)
- **ContainerGrid**: Use for card layouts, data tables, responsive columns
- **ContainerFlex**: Use for complex layouts with specific flex needs (toolbars, headers)
- **ContainerSplit**: Use for sidebar layouts, split views, two-column content
- **ContainerCenter**: Use for empty states, modals, centered content
- **ContainerScrollable**: Use for lists, long content, scrollable areas

### Additional shadcn Containers

Stone also includes these shadcn container components:

- **ScrollArea**: Enhanced scrollable areas with custom scrollbars
- **Accordion**: Collapsible sections with animation
- **Collapsible**: Simple show/hide container

```typescript
import { ScrollArea, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@renderer/components/ui';

// ScrollArea with custom scrollbars
<ScrollArea className="h-[400px]">
  <LongContentList />
</ScrollArea>

// Accordion for grouped content
<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>Section 1</AccordionTrigger>
    <AccordionContent>Content 1</AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Section 2</AccordionTrigger>
    <AccordionContent>Content 2</AccordionContent>
  </AccordionItem>
</Accordion>
```

---

## State Management

### Component State (useState)

**Use for**: UI-only state (dropdowns, modals, toggles)

```typescript
export function Dropdown() {
  const [isOpen, setIsOpen] = useState(false);
  // ...
}
```

### Zustand Store

**Use for**: Application state (notes, notebooks, settings)

```typescript
// In feature component
export function NoteEditor() {
  const { activeNote, updateNote } = useNoteStore();
  // ...
}
```

### Custom Hooks

**Use for**: Reusable logic

```typescript
// hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// In component
const debouncedSearch = useDebounce(searchQuery, 300);
```

---

## TypeScript Best Practices

### 1. Export All Types

```typescript
// button.tsx
export type ButtonVariant = 'default' | 'secondary';
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}
export const Button = /* ... */;
```

### 2. Use Interface for Props

**Do**:
```typescript
interface ActionCardProps {
  title: string;
}
```

**Don't**:
```typescript
type ActionCardProps = {
  title: string;
}
```

**Reason**: Interfaces can be extended and provide better error messages.

### 3. Extend HTML Attributes

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}
```

**Benefits**: Inherits `onClick`, `disabled`, `aria-*`, etc.

### 4. Use Discriminated Unions for Variants

```typescript
type Message =
  | { type: 'success'; message: string }
  | { type: 'error'; message: string; error: Error };

function Message({ type, message, ...props }: Message) {
  if (type === 'error') {
    // TypeScript knows 'error' prop exists here
    console.error(props.error);
  }
}
```

---

## Common Composite Components

Here are patterns for common composite components you should build:

### 1. EmptyState

```typescript
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 text-muted-foreground">{icon}</div>
      <Heading3 className="mb-2">{title}</Heading3>
      <Body variant="muted" className="mb-4">{description}</Body>
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}
```

### 2. LoadingState

```typescript
interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ message = 'Loading...', size = 'md' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <Spinner size={size} />
      <Body variant="muted" className="mt-4">{message}</Body>
    </div>
  );
}
```

### 3. ErrorState

```typescript
interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <Heading3 className="mb-2">{title}</Heading3>
      <Body variant="muted" className="mb-4">{message}</Body>
      {onRetry && (
        <Button onClick={onRetry}>Try Again</Button>
      )}
    </div>
  );
}
```

### 4. FormField

```typescript
interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ label, error, required, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
      {error && (
        <Text size="sm" variant="destructive">{error}</Text>
      )}
    </div>
  );
}

// Usage
<FormField label="Email" error={errors.email} required>
  <Input type="email" value={email} onChange={setEmail} />
</FormField>
```

### 5. StatusBadge

```typescript
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'error';
  label?: string;
}

const statusConfig = {
  active: { color: 'success', label: 'Active' },
  inactive: { color: 'muted', label: 'Inactive' },
  pending: { color: 'warning', label: 'Pending' },
  error: { color: 'destructive', label: 'Error' },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.color}>
      {label || config.label}
    </Badge>
  );
}
```

---

## Testing Guidelines

### Unit Testing Base Components

```typescript
// button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders with correct variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByText('Delete');
    expect(button).toHaveClass('bg-destructive');
  });

  it('handles click events', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    screen.getByText('Click').click();
    expect(onClick).toHaveBeenCalled();
  });
});
```

### Testing Composite Components

```typescript
// ActionCard.test.tsx
import { render, screen } from '@testing-library/react';
import { ActionCard } from './ActionCard';

describe('ActionCard', () => {
  it('renders all content', () => {
    render(
      <ActionCard
        title="Test Title"
        description="Test Description"
        buttonText="Test Button"
        onClick={() => {}}
      />
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('Test Button')).toBeInTheDocument();
  });
});
```

---

## Migration Strategy

When refactoring existing code to follow these patterns:

### Step 1: Identify Component Type

Determine if the component is Base, Composite, or Feature.

### Step 2: Move to Correct Directory

```
Base → src/renderer/components/ui/
Composite → src/renderer/components/[Domain]/
Feature → src/renderer/components/[Feature]/
```

### Step 3: Refactor Props

```typescript
// Before
function Card(props: any) { }

// After
interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}
function Card({ title, children, className }: CardProps) { }
```

### Step 4: Apply Styling Patterns

```typescript
// Before
<div className={`card ${props.className}`}>

// After
<div className={cn('rounded-lg border p-4', className)}>
```

### Step 5: Add Barrel Export

```typescript
// src/renderer/components/ui/index.ts
export { Card, type CardProps } from './card';
```

---

## Quick Reference

### Decision Tree: Which Component Type?

```
Is it a primitive UI element (button, input, text)?
├─ Yes → Base Component (ui/)
└─ No
    ├─ Does it combine multiple base components?
    │   ├─ Is it domain-specific to your app?
    │   │   ├─ Yes → Feature Component
    │   │   └─ No → Composite Component
    │   └─ [Continue evaluation]
    └─ [Reevaluate design]
```

### Import Patterns

```typescript
// Base components
import { Button, Input, Dialog } from '@renderer/components/ui';
import { Heading2, Body } from '@renderer/components/ui/text';

// Composite components
import { ActionCard, SettingsSection } from '@renderer/components/Settings';

// Feature components
import { NoteEditor } from '@renderer/components/Editor/NoteEditor';

// Utils
import { cn } from '@renderer/lib/utils';
```

### Props Checklist

- [ ] All props have explicit types
- [ ] Props interface is exported
- [ ] Required props have no defaults
- [ ] Optional props have sensible defaults
- [ ] `className` prop for style overrides
- [ ] Event handlers use `on[Event]` naming
- [ ] Boolean props use `is[State]` or adjective naming

### Component Checklist

- [ ] Uses `forwardRef` (if base component)
- [ ] Has `displayName` (if base component)
- [ ] Uses `cn()` for className merging
- [ ] Follows file naming convention
- [ ] Exported from barrel index
- [ ] Documented in this guide (if new pattern)

---

## Examples in Codebase

### Base Components
- `src/renderer/components/ui/text.tsx` - Comprehensive text system
- `src/renderer/components/ui/button.tsx` - Button with variants
- `src/renderer/components/ui/dialog.tsx` - Modal system

### Composite Components
- `src/renderer/components/Settings/ActionCard.tsx` - Action card pattern
- `src/renderer/components/Settings/SettingsSection.tsx` - Section wrapper
- `src/renderer/components/Settings/StatusCard.tsx` - Status display

### Feature Components
- `src/renderer/components/Editor/NoteEditor.tsx` - Note editing
- `src/renderer/components/Notebook/NotebookTree.tsx` - Notebook navigation
- `src/renderer/components/Tag/TagList.tsx` - Tag management

---

## Conclusion

Following these patterns ensures:

1. **Consistency**: All components follow the same structure
2. **Maintainability**: Easy to find and modify components
3. **Reusability**: Clear separation of concerns
4. **Type Safety**: Full TypeScript coverage
5. **Scalability**: Easy to add new components
6. **Testability**: Clear boundaries for testing

When in doubt, refer to existing components that follow these patterns (especially the Text component system) as examples.
