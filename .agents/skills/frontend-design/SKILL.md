---
name: frontend-design
description: Apply the ERP frontend style guide for apps/admin and apps/web. Use when Codex edits frontend UI, builds pages or components, refactors styling, adjusts layout, updates design primitives, or needs to choose tokens, aliases, Tailwind classes, buttons, cards, panels, forms, typography, spacing, status states, or shared UI patterns.
---

# Frontend Style Guide

## Purpose

- Use this for frontend work in `apps/admin` and `apps/web`.
- Shared semantics. Per-app values live in each app's token files.
- Prefer shared primitives over raw utility strings.
- Keep this doc skill-friendly: rules, references, sample structure.

## Source Of Truth

- Tokens + aliases:
  - `apps/admin/src/app/globals.css`
  - `apps/web/src/app/globals.css`
  - `apps/admin/tailwind.config.ts`
  - `apps/web/tailwind.config.ts`
- Button reference:
  - `apps/web/src/components/ui/button.tsx`
- Card reference:
  - `ExecutiveOverviewCard` in `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- Panel references:
  - `apps/admin/src/app/(admin)/_components/wms-compact-panel.tsx`
  - `apps/admin/src/app/(admin)/_components/wms-workspace-card.tsx`

## Core Rules

- Prefer semantic tokens for shared UI primitives and heavily repeated styles.
- Raw Tailwind colors are allowed when the styling is local/contextual and not worth promoting to a shared token yet.
- In practice: buttons, panels, cards, inputs, and shared states should favor tokens; one-screen accents, dense table/detail states, and local data viz framing may use raw Tailwind colors.
- Never use specific or arbitrary values for color, font size, radius, spacing, border, shadow, tracking, or height unless explicitly told.
- Avoid `text-[...]`, `bg-[#...]`, `rounded-[...]`, `border-[#...]`, `tracking-[...]` unless:
    - Required by a product requirement.
    - Matching an external asset or image dimension.
    - Solving a layout issue that cannot be expressed through the existing scale.
- Use semantic tokens, named scale values, and shared aliases/components.
- Cards and panels default to `rounded-xl`.
- Gradients only for surfaces.
- Body text uses `foreground`.
- Secondary/supporting text uses `muted`.
- Do not use `primary` for normal body copy.
- Primary buttons for main actions.
- Ghost buttons for cancel and neutral actions.
- Destructive styles only for destructive actions.

## Token Rules

- Foundation tokens:
  - `background`
  - `background-secondary`
  - `surface`
  - `foreground`
  - `border`
- Action/status tokens:
  - `primary`
  - `secondary`
  - `muted`
  - `info`
  - `success`
  - `warning`
  - `destructive`
- Soft variants and surface tints:
  - `primary-soft`
  - `info-soft`
  - `success-soft`
  - `warning-soft`
  - `destructive-soft`
  - `surface-warm`
  - `surface-warm-soft`
- Do not update both apps' `globals.css` by default.
- Add to `globals.css` + `tailwind.config.ts` only when the token/alias is genuinely reusable, cross-component, or repeated enough to become a design primitive.
- Do not add one-off colors or one-off styles to `globals.css`.
- If the need is local and isolated, keep it in feature code with raw Tailwind classes.

## Typography Rules

- Use the configured scale:
  - `text-xs-tight`
  - `text-xs`
  - `text-sm`
  - `text-sm-custom`
  - `text-base`
  - `text-lg-loose`
  - `text-xl-loose`
- `text-xs-tight` and `text-xs`: labels, eyebrows, dense meta.
- `text-sm` and `text-sm-custom`: support text, table meta, helper copy.
- `text-base`: default content.
- `text-lg-loose` and `text-xl-loose`: KPI values, large numeric emphasis.
- Do not introduce `text-[...]` unless explicitly requested.

## Aliases

- Do not maintain a giant "one alias = full utility dump" list in this doc.
- This doc should define alias intent and usage, not reprint implementation.
- Current shared alias families:
  - Buttons: `btn`, `btn-sm`, `btn-md`, `btn-lg`, `btn-primary`, `btn-primary-soft`, `btn-secondary`, `btn-outline`, `btn-ghost`, `btn-destructive`
  - Panels: `panel`, `panel-header`, `panel-title`, `panel-content`, `panel-icon`
  - Cards: `card`, `card-label`, `card-value`
  - Forms: `form-label`, `input`, `read-only-input`
  - Pills: `pill` and tone variants
- If a pattern repeats, extract or adjust the alias in `globals.css`.
- Alias classes may be extended or selectively overridden in local context when needed.
- Override for composition or local layout/state adjustments, not to fight the base primitive on every use.
- If the same override pattern repeats, move it into the alias/component instead of copying it around.

## Component Defaults

- Buttons:
  - Use `Button` first.
  - `className` can adjust layout, density, and local context styling when needed.
  - If you keep overriding the same button behavior, promote that into the component or alias.
- Cards:
  - Match `ExecutiveOverviewCard` structure.
  - Use `card`, `card-label`, `card-value`.
  - Keep the icon/action block compact and `rounded-xl`.
- Panels:
  - Match `DashboardSection` or `WmsWorkspaceCard` based on context.
  - Use `panel`, `panel-header`, `panel-title`, `panel-content`.
- Panel headers may include right-side meta, actions, filters, or utility controls.
- If the header needs extra controls, follow the `WmsCompactPanel` `headerActions` pattern instead of inventing a new header layout.

## Table Rules

- For WMS admin data tables, match the visual language of:
  - `apps/admin/src/app/(admin)/inventory/_components/inventory-units-table.tsx`
  - `apps/admin/src/app/(admin)/inventory/_components/inventory-transfer-history-table.tsx`
  - `apps/admin/src/app/(admin)/shipments/_components/dispatch-table.tsx`
- Use `overflow-x-auto` around dense tables.
- Prefer flat rows over card rows for WMS records.
- Default structure:
  - `table`: `min-w-full border-separate border-spacing-0` or `min-w-full text-left`
  - `thead`: soft slate/secondary surface with a clear bottom border when needed
  - `th`: `px-5 py-3` or `px-5 py-4`, uppercase, dense label type, muted text
  - `tbody`: white surface
  - `tr`: bottom border, subtle hover state for selectable rows
  - `td`: `px-5 py-3.5` or `px-5 py-4`, `text-sm-custom` or `text-sm`
- Keep status values as compact pills.
- Right-align action columns.
- Use table-specific helper components such as `HeaderCell` and `BodyCell` when a table has more than a few columns.
- Do not use rounded card rows, large row gaps, or heavy shadows for WMS list tables unless explicitly requested.

## Sample Structure

### Button

```tsx
<Button variant="primary" size="md">
  Save changes
</Button>

<Button variant="ghost" size="md">
  Cancel
</Button>

<Button variant="danger" size="md">
  Delete
</Button>

<Button
  variant="primary"
  size="md"
  iconLeft={<RefreshCcw className="h-4 w-4" />}
>
  Refresh
</Button>
```

### KPI Card

```tsx
<div className="card">
  <div className="flex items-start justify-between">
    <div>
      <p className="card-label">Open orders</p>
      <p className="card-value">128</p>
      <p className="text-sm text-muted">
        ord: <span className="font-semibold text-foreground">37</span>
      </p>
    </div>

    {iconSlot}
  </div>
</div>
```

### Panel: DashboardSection shape

```tsx
<section className="panel panel-content">
  <div className="panel-header">
    <ChartBar className="panel-icon" />
    <h4 className="panel-title">Sales performance</h4>
    <span className="ml-auto hidden min-w-0 text-xs-tight text-slate-500 sm:inline">
      Last 7 days
    </span>
  </div>

  <div className="p-3">
    {children}
  </div>
</section>
```

### Panel: WmsCompactPanel with headerActions

```tsx
<section className="panel panel-content">
  <div className="panel-header flex items-start justify-between gap-4">
    <div className="flex min-w-0 items-center gap-2">
      <Container className="panel-icon" />
      <h4 className="panel-title">Section Overview (12)</h4>
    </div>

    <div className="ml-auto shrink-0">
      <div className="flex items-center gap-2">
        <button type="button" className="pill pill-ghost flex gap-1.5 rounded-lg">
          <Edit3 className="h-3.5 w-3.5" />
          Edit
        </button>
        <button type="button" className="pill pill-ghost flex gap-2 rounded-lg">
          <Plus className="h-3.5 w-3.5" />
          Add section
        </button>
      </div>
    </div>
  </div>

  <div className="p-3">
    {children}
  </div>
</section>
```

### Panel: WmsWorkspaceCard shape

```tsx
<section className="panel panel-content">
  <div className="panel-header flex items-center justify-between gap-3">
    <div className="flex min-w-0 items-center gap-3">
      <PackageCheck className="panel-icon" />
      <h2 className="panel-title">Pick Queue</h2>
    </div>

    <div className="flex shrink-0 items-center gap-2">
      <Button variant="ghost" size="sm" iconLeft={<RefreshCcw className="h-4 w-4" />}>
        Refresh
      </Button>
    </div>
  </div>

  <div className="w-full min-w-0 border-b border-border/10 bg-secondary/20 px-4 py-3">
    {filters}
  </div>

  <div className="panel-content">
    {children}
  </div>

  <div className="border-t border-border/10 bg-surface px-4 py-3">
    <div className="text-sm text-muted">Showing 1-20 of 54</div>
  </div>
</section>
```

## Raw Tailwind: Allowed Cases

- Supported by current dashboard usage in `apps/web/src/app/(dashboard)/dashboard/page.tsx`.
- Good uses:
  - local accent tones like `orange`, `emerald`, `amber`
  - dense neutral text hierarchy like `slate-*`
  - local borders/backgrounds for tables, popovers, filters, mini-stats
  - one-screen emphasis states not yet shared elsewhere
- Avoid:
  - replacing shared button/panel/card semantics with raw colors by default
  - adding raw arbitrary hex/rgb values when a Tailwind scale or token already covers the need
  - promoting a one-off dashboard color into `globals.css`

## Codex Rules

- Before editing frontend UI, inspect:
  - `globals.css`
  - `tailwind.config.ts`
  - shared UI/component references
- During overhaul, replace repeated/shared hardcoded values with tokens, aliases, or shared components.
- Do not create new globals unless the style is clearly reusable beyond the local feature.
- If the same raw pattern appears more than once in the touched area, extract it.
- Prefer updating the shared primitive over patching many screens.
- If a screen needs a new look, add semantics first, then apply them.
