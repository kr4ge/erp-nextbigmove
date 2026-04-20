## Rules

#### CORE
- NEVER use raw Tailwind colors (e.g. text-blue-500)
- ALWAYS use design tokens (e.g. text-primary)
- ALWAYS use aliases (never raw utilities)
- Avoid arbitrary values unless necessary

#### COLORS
- Do not use primary for body text
- Use muted for secondary text
- Use secondary for subtle backgrounds
- Use destructive for delete actions only
- Gradients only for surfaces (cards, panels)
- Use primary color for submit and main buttons, ghost buttons for cancel and neutral buttons, destructive colors for delete buttons

#### TYPOGRAPHY

- Do not use arbitrary values (text-[...])
- Always use defined scale
- Use text-xs for labels/eyebrows only
- Use text-sm for secondary/supporting text
- Use text-base for default content
- Use text-xl for KPIs and main headings

## Color System
#### Light Mode Colors
    Small note: color hexcodes will be moved over to CSS variables will be removed in the style guide

    TOKENS:
    background: #f1f5f9 (app background)
    foreground: #0f172a (main text)
    surface: #ffffff (cards)

    primary: #ff6900 (actions)
    primary-soft: #fff7ed
    primary-foreground: #ffffff (text in actions)
    primary-soft-foreground: #c2410c

    secondary: #e2e8f0
    muted: #64748b

    success: #16a34a
    success-soft: #a7f3d0
    destructive: #d91414 (delete buttons, close popup modals)
    destructive-soft: 
    warning: #d97706
    warning-soft: #fef3c7

    border: #bfc4c9

    STATES
        hover:
            - slightly darker (for light backgrounds)
            - slightly lighter (for dark backgrounds)
        active:
            - more contrast than hover
        focus:
            - visible ring using primary
        disabled:
            - reduced opacity and muted colors

    GRADIENT TOKENS:
        - use only for panels
        - keep subtle (low contrast)

        surface-gradient:
            from: surface
            via: surface-warm 
            to: surface-warm-soft

        surface-warm:
            = warm tint of surface (very subtle)
            = rgba(255, 237, 213, 0.35)

        surface-warm-soft:
            = even softer warm tint
            = rgba(255, 247, 237, 0.25)

## Planned Tailwind Config and Aliases
#### TYPOGRAPHY

    text-xs: 10px
    text-sm:  12px
    text-base: 15px
    text-2xl: 28px

#### DENSITY
    density-compact:
        scope: parent class (.wms-density-compact)
        overrides:
            h-11 → 2.5rem
            h-12 → 2.75rem

    RULES:
        - Only affects spacing/sizing (not colors)
        - Applied at layout/container level
        - Do not redefine inside components

#### ALIASES
    BUTTONS

    btn:
        inline-flex items-center justify-center
        font-semibold
        rounded-xl
        transition
        focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed
    btn-sm:
        h-9
        px-3
        text-xs
    btn-md:
        h-10
        px-4
        text-xs
    btn-lg:
        h-11
        px-5
        text-base
    
    btn-primary:
        bg-primary
        text-primary-foreground
        hover:bg-primary/90
        active:bg-primary/80
        focus:ring-primary
    btn-primary-soft:
        bg-primary-soft
        text-primary-soft-foreground
        hover:bg-primary-soft/85
        active:bg-primary-soft/95
        focus:ring-primary
    btn-secondary:
        bg-secondary
        text-foreground
        hover:bg-secondary/90
        active:bg-secondary/80
        focus:ring-secondary
    btn-ghost:
        bg-transparent
        text-foreground
        hover:bg-secondary/50
        active:bg-secondary/40
        focus:ring-secondary
    btn-destructive:
        bg-destructive
        text-primary-foreground
        hover:bg-destructive/90
        active:bg-destructive/80
        focus:ring-destructive

    PANELS

    panel:
        overflow-hidden
        rounded-lg
        border border-border
        bg-surface
        shadow-sm
    panel-header:
        flex items-center gap-2
        border-b border-border
        bg-background/60
        px-3 py-2
    panel-title:
        text-sm font-semibold uppercase tracking-[0.18em]
        text-foreground
    panel-content:
        min-w-0
        text-xs text-foreground
        bg-surface-gradient
        p-3

    KPI Cards
    
    card:
        rounded-xl
        border border-border
        bg-surface
        p-3
        shadow-sm
    card-label:
        text-sm font-semibold uppercase tracking-[0.18em]
        text-slate-500
    card-value:
        text-2xl
        font-semibold
        tracking-tight
        text-slate-950 tabular-nums

    INPUTS AND LABELS

    label:
        space-y-2
    label-span:
        text-xs
        font-semibold uppercase tracking-[0.16em]
        text-foreground
    input-base:
        w-full
        rounded-2xl
        border border-border
        bg-surface
        px-4 py-3
        text-sm text-foreground
        outline-none
        transition
        placeholder:text-foreground
        focus:border-primary/30

    ICONS

    icon:
        h-3.5 w-3.5

    card-icon:
        inline-flex
        h-9 w-9
        items-center justify-center
        rounded-xl
        ring-1


## Components and Layout

### Main Content Layout (layout.tsx)
```
<!-- The main layout as seen in layout.tsx -->
<main className="flex-1 overflow-y-auto bg-slate-100 lg:rounded-tl-[1.75rem]">
    <div class="mx-auto h-full w-full max-w-[1560px] px-3 py-4 sm:px-4 lg:px-5">
      {children}
    </div>
</main>
```

### Icons
```
<!-- Focus on only the class -->

<!-- Sidebar and panel icons -->
<svg className="h-3.5 w-3.5 text-primary"></svg>

<!-- ** Executive Card Icons ** -->

<!-- Default -->
<div className="inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 bg-primary-soft text-primary">
    {icon}
</div>

<!-- Success -->
<div className="inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 bg-success-soft text-success">
    {icon}
</div>

<!-- Warning -->
<div className="inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 bg-warning-soft text-warning">
    {icon}
</div>

```

### Buttons
```
<button className="btn btn-sm btn-primary-soft">
    <span>Submit</span>
</button>

<button className="btn btn-sm btn-ghost">
    <span>Cancel</span>
</button>

<button className="btn btn-sm btn-destructive">
    <span>Delete</span>
</button>
```

### KPI Stat Cards
```
<!-- Executive Dashboard -->
<div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
        </div>
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${EXECUTIVE_CARD_TONE_MAP[tone]}`}>
            {icon}
        </div>
    </div>
</div>

<!-- Analytics Card: sales, sales performance, marketing -->
<div className={`rounded-lg border border-border bg-surface px-3 py-2.5 ${className ?? ''}`.trim()}>
    <div className="text-xs text-muted flex items-center gap-1">
        {label}
        {tooltip ? <TooltipIcon label={label} content={tooltip} mode={tooltipMode} /> : null}
    </div>

    <div className="mt-1 flex items-center justify-between">
        <p className="text-lg font-semibold text-foreground">
          {formatMetricValue(value, format, valuePrecision)}
        </p>
        <p className={`text-[11px] ${getDeltaColor(delta)}`}>{formatDeltaLabel(delta)}</p>
    </div>

    {count ? (
        <div className="mt-1 flex items-center justify-between">
            <span className="text-sm text-foreground">
                <span className="font-normal text-foreground">{count.label ?? 'ord'}:</span>{' '}
                <span className="font-semibold text-foreground/75">{formatCountValue(count.value)}</span>
            </span>
            <span className={`text-xs ${getDeltaColor(count.delta)}`}>
                {formatDeltaLabel(count.delta)}
            </span>
    </div>
    ) : null}
</div>
```