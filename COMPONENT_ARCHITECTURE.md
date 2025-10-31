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
