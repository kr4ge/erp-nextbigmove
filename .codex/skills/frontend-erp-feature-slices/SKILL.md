---
name: frontend-erp-feature-slices
description: Build or refactor ERP frontend features using the repo's route-local slice pattern with `_components`, `_hooks`, `_services`, `_types`, and `_utils`, thin page files, typed service calls, permission-aware UI, and DRY filter/query mapping. Use when adding or refactoring dashboard, admin, analytics, KPI, integrations, or operations screens in this ERP.
---

# Frontend ERP Feature Slices

## Goal
Implement ERP frontend work as small feature slices that are typed, permission-aware, resilient, and consistent with the repo's dashboard and admin structure.

## Workflow
1. Map the feature slice before editing.
- Check whether the route already has `_components`, `_hooks`, `_services`, `_types`, `_utils`, or `_constants`.
- Reuse the existing route-local structure instead of inventing a new one.

2. Keep pages thin.
- Page files should compose sections and call hooks/services.
- Avoid putting long data transforms, large modal orchestration, and API logic directly in page JSX.

3. Standardize data flow.
- `services/`: API calls and payload/query builders.
- `types/`: API response types, view models, and form types.
- `hooks/`: orchestration, derived state, filter state, modal state, and effects.
- `components/`: presentational rendering only.
- `utils/`: pure formatters, mappers, and reusable calculations.

4. Reuse ERP UI patterns first.
- Prefer existing `components/ui` primitives.
- Reuse dashboard cards, section shells, tables, tabs, filters, and date controls before creating new patterns.
- Preserve the current orange/slate visual language unless the request explicitly changes it.

4b. Keep interface writing minimal.
- Default to low-text screens with concise labels, helper copy, and section intros.
- Prefer hierarchy, metadata, badges, and clear data presentation over long explanatory paragraphs.
- If a page feels text-heavy, reduce wording before adding more visual wrappers.

5. Make UI permission-aware and state-aware.
- Gate navigation, tabs, actions, and forms from effective permissions.
- Always provide loading, empty, error, and partial-data states for async screens.
- Keep optimistic UX limited to flows that are safe to reconcile.

6. Keep filter/query logic DRY.
- Build params in one place.
- Reuse date-range and picker patterns already used in analytics/dashboard flows.
- Avoid duplicating the same exclusion/filter semantics across multiple components.

7. Use the standard ERP table structure for data-heavy screens.
- Default to a **toolbar-first, grid-dominant** layout.
- Prefer one section shell that contains:
  - section header
  - compact filter toolbar
  - table
  - footer pagination
- Avoid separate tall "filters" cards above the table unless the workflow truly needs a form.
- Make search the widest control in the toolbar.
- Keep partner/store/date/status selectors inline and compact.
- Prefer placeholders or inline context over stacked top labels when it reduces vertical waste.
- Keep the first column information-rich:
  - image if useful
  - primary name
  - one short badge or secondary identifier if truly needed
- Do not expose raw internal IDs in the primary table cell unless operators explicitly need them.
- Keep numeric/status columns narrow, fixed, and right-aligned where appropriate.
- Use short column labels.
- Keep rows compact and scannable; reduce vertical padding before adding more helper text.
- Use a shared footer pagination pattern for all WMS/ERP tables.
- When a table action belongs to the dataset, prefer placing it in the table section header or toolbar instead of the page header.
- Treat the forecast/products table pattern as the default WMS standard unless a module has a stronger operational reason to differ.

8. Keep components compact and reusable.
- Extract repeated metric cards, panels, rows, and toolbar controls.
- Group related props into typed objects when it reduces prop sprawl.
- Keep utilities pure and hooks action-oriented.

9. Verify before finishing.
- Run focused web type/lint checks.
- Watch for visual regressions, permission regressions, and duplicated behavior.

## Refactor Triggers
- A page mixes fetch logic, transforms, view state, and rendering in one file.
- The same filter/query/formatter logic appears 2+ times.
- The same card, table row, or action strip appears 2+ times.
- A component grows beyond one clear responsibility.

## Required Output
- List extracted or added modules and why.
- State any API contract changes that affect the UI.
- State any permission gating added or changed.
- State verification commands run.

## References
- Use [references/frontend-erp-checklist.md](references/frontend-erp-checklist.md) before finalizing.
- Use [references/frontend-erp-table-standard.md](references/frontend-erp-table-standard.md) when building or refactoring table-heavy WMS/ERP screens.
