# Sliding toolbar mode

## Goal

`toolbarMode: 'sliding'` keeps the editor toolbar to one primary row while it is
collapsed. Complete toolbar groups that do not fit are placed in an inline
drawer beneath that row and revealed by a disclosure button.

The existing modes retain their current behavior:

- `wrap` displays every group across as many rows as necessary.
- `more` places overflow groups in a floating panel.
- `sliding` places overflow groups in an expandable inline drawer.

## DOM and layout

Sliding mode introduces two internal regions inside the toolbar:

```text
.rly-toolbar
├── .rly-toolbar-primary
│   ├── groups that fit
│   └── disclosure button
└── .rly-toolbar-sliding-drawer
    └── .rly-toolbar-sliding-content
        └── overflow groups in source order
```

The toolbar retains `role="toolbar"`. The drawer is a labelled `role="group"`
controlled by a button with `aria-expanded` and `aria-controls`. It is an
inline disclosure, not a popup menu, so the button does not use
`aria-haspopup`.

Toolbar groups are the indivisible unit of overflow. On every relevant width
change, all groups are restored to source order and trailing groups are moved
to the drawer until the primary row fits with the disclosure button included.
The drawer stays open across a resize while overflow remains. If all groups
fit, the drawer closes and its button is hidden.

## Interaction

- Pointer or Enter/Space on the disclosure button toggles the drawer.
- Escape from the open drawer collapses it and returns focus to the button.
- Arrow-key toolbar navigation excludes controls in a closed drawer and uses
  DOM order when the drawer is open.
- Collapsing the drawer closes any toolbar dropdown within it so focus cannot
  remain inside hidden content.
- Toolbar button `mousedown` behavior continues to preserve the editor
  selection.

## Animation and resizing

The drawer animates a CSS grid row from `0fr` to `1fr` over 260ms with a soft
ease-out curve, together with a slightly shorter opacity fade and a small
vertical translation. `prefers-reduced-motion: reduce` disables the transition.

Resize observation is gated by the available inline width. The drawer's
animated height must not cause repeated DOM redistribution or a
`ResizeObserver` feedback loop. Window resize remains a fallback for
environments without `ResizeObserver`.

Drawer content stays clipped while the height transition runs so it cannot
paint over the editor. Once expansion completes, it allows visible overflow so
toolbar dropdowns (color, table, and similar panels) are not clipped. Overflow
groups may wrap internally at exceptionally narrow widths to remain inside the
editor boundary.

## Compatibility

`toolbarOverflow: true` remains an alias for `toolbarMode: 'more'`; it does not
map to sliding mode. Explicit `toolbarMode` continues to take precedence over
the deprecated boolean alias.
