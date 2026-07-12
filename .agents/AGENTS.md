# Richly Project Rules & Instructions

This workspace contains the source code for the `@richly/core` and `@richly/react` editor packages.

## Toolbar Mode Migration Guidelines

When making changes to the toolbar layout or options, follow these instructions:

1. **Explicit toolbarMode Configuration**:
   - Prefer using `toolbarMode: 'wrap' | 'more'` instead of the deprecated `toolbarOverflow?: boolean`.
   - `'more'`: Collapses groups at narrow widths and restores them when space returns.
   - `'wrap'`: Standard layout wrapping.

2. **Backward Compatibility**:
   - Always map the deprecated `toolbarOverflow` property if present and `toolbarMode` is undefined:
     ```typescript
     const toolbarMode = config.toolbarMode ?? (config.toolbarOverflow ? 'more' : 'wrap');
     ```

3. **Updating Components**:
   - **Editor.ts**: Accept both properties and pass resolved `toolbarMode` to the `Toolbar` component.
   - **Toolbar.ts**: Update the constructor to expect `toolbarMode` instead of `overflow` boolean.
   - **Editor.tsx (React)**: Update props and configuration mapping.
