

# Fix Blog Article Styling

## Problem

The markdown preview in the blog editor looks unstyled because the `prose` CSS classes have no effect. The `@tailwindcss/typography` plugin is installed as a dependency but is **not registered** in `tailwind.config.ts`. Without it, `prose prose-invert` classes are ignored and all markdown renders as plain unstyled text -- no heading sizes, no list bullets, no link colors, no spacing.

## Solution

### 1. Register the typography plugin in Tailwind config

Add `require("@tailwindcss/typography")` to the `plugins` array in `tailwind.config.ts`.

### 2. Customize prose colors for the dark theme

Override the default typography theme colors to match the dark admin design system. This ensures headings, links, bold text, code blocks, and blockquotes all look consistent with the emerald/teal premium aesthetic.

## Technical Details

### File: `tailwind.config.ts`

Add the typography plugin and customize prose colors:

```typescript
plugins: [
  require("tailwindcss-animate"),
  require("@tailwindcss/typography"),
],
```

Add typography theme overrides inside `theme.extend`:

```typescript
typography: {
  invert: {
    css: {
      '--tw-prose-body': 'hsl(210 40% 90%)',
      '--tw-prose-headings': 'hsl(210 40% 98%)',
      '--tw-prose-links': 'hsl(160 84% 39%)',
      '--tw-prose-bold': 'hsl(210 40% 98%)',
      '--tw-prose-code': 'hsl(160 84% 39%)',
      '--tw-prose-pre-bg': 'hsl(222 47% 7%)',
      '--tw-prose-pre-code': 'hsl(210 40% 90%)',
      '--tw-prose-quotes': 'hsl(215 20% 55%)',
      '--tw-prose-quote-borders': 'hsl(160 84% 39%)',
      '--tw-prose-counters': 'hsl(215 20% 55%)',
      '--tw-prose-bullets': 'hsl(160 84% 39%)',
      '--tw-prose-hr': 'hsl(217 33% 17%)',
      '--tw-prose-th-borders': 'hsl(217 33% 17%)',
      '--tw-prose-td-borders': 'hsl(217 33% 17%)',
    },
  },
},
```

### Files Changed

| File | Change |
|------|--------|
| `tailwind.config.ts` | Add `@tailwindcss/typography` to plugins, add prose color overrides for dark theme |

No other files need changes -- the `prose prose-invert` classes already exist in `BlogEditor.tsx` and will work once the plugin is active.

