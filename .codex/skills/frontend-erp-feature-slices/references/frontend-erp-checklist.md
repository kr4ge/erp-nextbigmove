# Frontend ERP Feature Slice Checklist

## Structure
- Route-local files use `_components`, `_hooks`, `_services`, `_types`, `_utils`, or `_constants` when appropriate.
- Page file is mostly composition, not business logic.

## DRY
- Repeated query param building is centralized.
- Repeated formatters or view-model mapping are extracted.
- Repeated JSX blocks are componentized when reused.

## State and async UX
- Loading state exists.
- Error state exists.
- Empty state exists where the dataset can be empty.
- Async actions surface success/failure clearly.

## Permissions
- Sensitive actions and tabs are hidden or disabled based on effective permissions.
- Frontend gating matches backend expectations.

## UI consistency
- Existing `components/ui` primitives are reused.
- Existing dashboard/admin layout language is preserved.
- Typography, spacing, and tables follow current ERP conventions.
- Page copy is concise and not overly explanatory.
- Labels, helper text, and section intros stay minimal unless the workflow truly needs more guidance.
- Table-heavy screens follow the shared toolbar + table + footer pagination standard.
- Filters do not consume unnecessary vertical space when the screen is primarily a grid.
- First table column is information-rich; raw internal IDs are hidden unless operationally necessary.
- Numeric columns are compact and right-aligned where appropriate.

## Verification
- Run focused `tsc` and/or lint checks for the web app.
- Note any residual risks such as dense state logic or coupling that still needs future extraction.
