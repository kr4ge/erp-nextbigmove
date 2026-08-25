/**
 * Shared charting contract for the ERP.
 *
 * Recharts renders SVG, so every colour can be a CSS custom property and dark
 * mode follows the theme with zero chart code. ERP tokens are stored as
 * space-separated RGB triples, so they must be wrapped in `rgb(...)` before
 * they reach an SVG attribute.
 *
 * A charting library is used only where a continuous axis earns it — calendars
 * stay CSS grids, score bars stay divs, and a single number stays a number.
 */

/** Wrap an ERP token so it is usable as an SVG paint value. */
export const token = (name: string) => `rgb(var(--${name}))`;

/**
 * Semantic series colours. Green is not "series 2" — it is the `success`
 * token and it means money that actually arrived, on every screen.
 */
export const CHART_COLORS = {
  /** Gross value placed — the ERP's primary accent. */
  primary: token('primary'),
  /** Delivered / paid money. */
  success: token('success'),
  /** Cost paid out. Literal because gradient stops cannot take a CSS variable. */
  spend: '#3B82F6',
  grid: token('border'),
  axisText: token('muted'),
  surface: token('surface'),
  border: token('border'),
  foreground: token('foreground'),
  muted: token('muted'),
  warning: token('warning'),
  destructive: token('destructive'),
} as const;

/** One draw-in on mount; no re-animation on filter change. */
export const CHART_ANIMATION_MS = 900;

/**
 * Plot margins. The negative left pulls the plot back after the axis reserves
 * its width, which would otherwise leave a visible gutter.
 */
export const CHART_MARGIN = { top: 14, right: 8, left: -8, bottom: 0 } as const;

/** Y-axis width that keeps ₱100k from clipping. */
export const CHART_Y_AXIS_WIDTH = 52;

/** The library drops X labels until they fit, so 44 days render as ~8 labels. */
export const CHART_X_MIN_TICK_GAP = 24;

/**
 * Peso axis formatter. The ERP stores money as Decimal pesos (not centavos),
 * so values arrive already in pesos — compress to k notation so the axis never
 * clips. The tooltip formatter must agree with this or gridlines and tooltips
 * would state different values for the same point.
 */
export function formatPesoAxis(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `₱${Math.round(value / 1_000)}k`;
  return `₱${Math.round(value)}`;
}

/** Full peso value for tooltips and header figures. */
export function formatPesoFull(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `₱${Math.round(value).toLocaleString('en-PH')}`;
}

/** Tooltip surface styling, bound to tokens so dark mode follows for free. */
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: CHART_COLORS.surface,
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: 10,
  fontSize: 12,
  padding: '8px 10px',
  boxShadow: 'var(--shadow-card)',
} as const;

/** A translucent column highlight reads better than a crosshair. */
export const CHART_CURSOR = { fill: CHART_COLORS.grid, fillOpacity: 0.25 } as const;
