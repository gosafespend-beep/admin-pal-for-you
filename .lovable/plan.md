

# Fix Blog Article Styling (For Real This Time)

## Root Cause

The `typography` configuration was placed at the wrong level in the Tailwind config. It is currently at `theme.typography` (a sibling of `extend`), which **completely replaces** the default typography plugin styles. This means all base prose styles (heading sizes, list bullets, spacing, margins, font weights) are gone -- only the color overrides remain.

## Fix

Move the `typography` block from `theme.typography` into `theme.extend.typography`. This preserves all the default prose base styles while layering the dark theme color customizations on top.

## Technical Details

### File: `tailwind.config.ts`

Current (broken) structure:
```
theme: {
  extend: {
    colors: { ... },
    ...boxShadow
  },            // <-- extend ends here
  typography: { // <-- WRONG: this replaces defaults
    invert: { css: { ... } }
  }
}
```

Fixed structure:
```
theme: {
  extend: {
    colors: { ... },
    ...boxShadow,
    typography: { // <-- CORRECT: inside extend, merges with defaults
      invert: { css: { ... } }
    }
  }
}
```

### Files Changed

| File | Change |
|------|--------|
| `tailwind.config.ts` | Move `typography` config from `theme` level into `theme.extend` |

No other files need changes. The `prose prose-invert` classes on line 503 of `BlogEditor.tsx` will work correctly once the default styles are preserved.

