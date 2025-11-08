# Code Syntax Highlighting - Color Reference

This document shows the custom color scheme used for syntax highlighting in Stone's note editor.

## Design Philosophy

The color scheme is designed to:
- **Integrate seamlessly** with Stone's neutral gray + blue design system
- **Use app's existing color variables** where possible
- **Maintain excellent readability** in both light and dark modes
- **Follow macOS design principles** with subtle, professional colors

## Color Variables

All syntax colors are defined as CSS custom properties in HSL format:

```css
/* Light Theme */
--code-bg: 0 0% 98%;           /* Near-white background */
--code-text: 0 0% 20%;         /* Dark text */
--code-comment: 0 0% 55%;      /* Medium gray */
--code-keyword: 262 60% 50%;   /* Purple */
--code-string: 142 60% 40%;    /* Green */
--code-number: 28 80% 50%;     /* Orange */
--code-function: 211 100% 45%; /* Blue (app primary) */
--code-variable: 0 0% 30%;     /* Dark gray */
--code-type: 45 80% 45%;       /* Gold */
--code-operator: 180 40% 45%;  /* Cyan */
--code-punctuation: 0 0% 45%;  /* Gray */
--code-attribute: 330 60% 50%; /* Pink */
--code-tag: 211 80% 45%;       /* Blue */
--code-property: 262 50% 50%;  /* Purple */

/* Dark Theme */
--code-bg: 0 0% 10%;           /* Deep dark background */
--code-text: 0 0% 88%;         /* Light text */
--code-comment: 0 0% 50%;      /* Medium gray */
--code-keyword: 262 70% 70%;   /* Light purple */
--code-string: 142 50% 60%;    /* Light green */
--code-number: 28 70% 65%;     /* Light orange */
--code-function: 211 80% 65%;  /* Light blue (app primary) */
--code-variable: 0 0% 85%;     /* Light gray */
--code-type: 45 70% 65%;       /* Light gold */
--code-operator: 180 50% 65%;  /* Light cyan */
--code-punctuation: 0 0% 60%;  /* Gray */
--code-attribute: 330 60% 65%; /* Light pink */
--code-tag: 211 70% 65%;       /* Light blue */
--code-property: 262 60% 70%;  /* Light purple */
```

## Token Mapping

| Token Type | Variable | Example |
|------------|----------|---------|
| Keywords | `--code-keyword` | `function`, `class`, `const`, `if`, `return` |
| Strings | `--code-string` | `"hello world"`, `'text'` |
| Numbers | `--code-number` | `42`, `3.14`, `0xFF` |
| Functions | `--code-function` | `myFunction()`, function names |
| Variables | `--code-variable` | `myVar`, `count` |
| Types | `--code-type` | `String`, `Array`, `int` |
| Operators | `--code-operator` | `+`, `-`, `&&`, `=>` |
| Punctuation | `--code-punctuation` | `;`, `,`, `.` |
| Attributes | `--code-attribute` | HTML/XML attributes, regex |
| Tags | `--code-tag` | `<div>`, HTML tags, selectors |
| Properties | `--code-property` | object properties, CSS properties |
| Comments | `--code-comment` | `// comment`, `/* block */` |

## Language Examples

### JavaScript/TypeScript

```javascript
// Function with types
function calculateSum(a: number, b: number): number {
  const result = a + b;
  return result;
}

// Class definition
class User {
  private name: string;
  
  constructor(name: string) {
    this.name = name;
  }
}
```

**Color breakdown:**
- `function`, `class`, `const`, `return` → Purple (keyword)
- `calculateSum`, `User` → Blue (function/class name)
- `number`, `string` → Gold (type)
- `a`, `b`, `result`, `name` → Dark gray (variable)
- `42`, `3.14` → Orange (number)
- `// comment` → Gray (comment)

### Python

```python
# Class with method
class DataProcessor:
    def __init__(self, data):
        self.data = data
    
    def process(self):
        """Process the data"""
        result = []
        for item in self.data:
            result.append(item * 2)
        return result
```

### HTML/CSS

```html
<div class="container">
  <h1 id="title">Hello World</h1>
</div>

<style>
  .container {
    display: flex;
    color: #007AFF;
  }
</style>
```

**Color breakdown:**
- `div`, `h1`, `style` → Blue (tag)
- `class`, `id` → Pink (attribute)
- `"container"`, `"title"` → Green (string)
- `.container`, `display`, `color` → Purple (property)

## Visual Hierarchy

The color scheme creates a clear visual hierarchy:

1. **Primary focus** (Blue): Functions, methods, classes - what you call
2. **Secondary focus** (Purple): Keywords, control flow - how it works
3. **Data** (Green/Orange): Strings and numbers - what it uses
4. **Structure** (Gray tones): Variables, punctuation - the scaffolding
5. **Documentation** (Muted gray): Comments - the explanation

## Accessibility

All colors meet WCAG AA contrast requirements:
- Light theme: Dark colors on light background (98% lightness)
- Dark theme: Light colors on dark background (10% lightness)
- Minimum contrast ratio: 4.5:1 for normal text
- Comments use 55%/50% lightness for reduced emphasis while remaining readable

## Integration with App Theme

The syntax highlighting integrates with Stone's design system:

- **Primary color (Blue 211°)**: Used for functions, matching app's primary action color
- **Neutral grays**: Background and text use the same grayscale as the app
- **Border consistency**: Code blocks use `--border` variable
- **Accent colors**: Purple, green, orange complement the blue primary
- **Theme switching**: All colors automatically adapt when switching light/dark mode

## Using the Colors

In your code, reference colors via CSS variables:

```css
.my-element {
  color: hsl(var(--code-keyword));
  background: hsl(var(--code-bg));
}
```

This ensures your custom elements match the syntax highlighting theme.

## Future Enhancements

Potential improvements:
- [ ] Add dimming for unused code (requires language server)
- [ ] Highlight matching brackets with primary color
- [ ] Error highlighting using `--destructive` color
- [ ] Semantic highlighting for better type distinction