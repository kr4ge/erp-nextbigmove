# Frontend ERP Table Standard

Use this as the default table structure for WMS and ERP data screens unless the workflow clearly requires something else.

## Standard layout

1. Page header
- Keep it short.
- Do not overload it with dataset actions if those actions belong to the table itself.

2. Section shell
- Put the table inside one section card/shell.
- The section should contain:
  - section header
  - compact toolbar
  - table
  - footer pagination

3. Toolbar
- Use one compact horizontal toolbar row.
- Search should be the widest control.
- Filters should be inline and short.
- Avoid stacked labels above each control when placeholders or inline context are enough.
- Avoid a separate tall filter card above the grid unless it is a true form workflow.

4. Table
- First column is the richest cell.
- Use the first column for:
  - image if useful
  - main item name
  - one short badge or secondary identifier
- Do not show raw internal IDs by default.
- Keep numeric columns narrow and right-aligned.
- Use short, scannable headers.
- Prefer fixed column proportions for predictable dense layouts.
- Row height should be compact before adding extra helper text.

5. Footer
- Use shared pagination/footer controls.
- Show:
  - current range
  - total items
  - page size
  - page controls

## Preferred interaction pattern

- Toolbar-first, grid-dominant.
- Operators should reach the table quickly.
- Filters should refine the data, not visually dominate the page.
- Empty/loading/error states should live inside the table section, not as detached blocks elsewhere.

## Good defaults

- Search input: widest control in the toolbar
- Selects/date filters: medium width, inline
- Reset button: compact and right-aligned in the toolbar
- Product/name column: visually dominant but not oversized
- Numeric values: `tabular-nums`
- Status indicators: short badges, not paragraphs

## Avoid

- Tall filter forms above simple tables
- Repeating explanatory copy around every dataset
- Raw UUIDs in visible rows unless operationally required
- Oversized product columns that starve the numeric columns
- Floating actions that should belong to the table header
- Different pagination/footer structures on each module
