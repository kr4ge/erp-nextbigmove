---
name: frontend-modular-dry
description: Build or refactor frontend features into reusable, modular, DRY architecture for Next.js/React codebases. Use when adding new UI screens, improving large page files, extracting reusable components/hooks/utilities, standardizing API/view-model logic, or reducing duplicated frontend code.
---

# Frontend Modular DRY

## Goal
Implement frontend work with small reusable units instead of large page files. Keep behavior identical unless the request explicitly changes behavior.

## Workflow
1. Audit current code before editing.
- Identify duplicated JSX blocks, repeated data transforms, repeated API payload mapping, and mixed concerns in one file.
- Prefer extraction when a file mixes 2 or more concerns: data fetching, derived state, form state, table rendering, modal orchestration.

2. Reuse existing primitives first.
- Search existing shared components/hooks/utils before adding new ones.
- Prefer existing `components/ui` primitives and shared helpers under `src/lib`.

3. Split by responsibility.
- `components/`: Presentational units, no business logic.
- `hooks/`: Screen behavior, effects, derived state, orchestration.
- `services/`: API calls and payload builders.
- `types/`: API DTOs, view models, form types.
- `utils/`: Pure reusable helpers and formatters.
- `constants/`: Static mappings, labels, options.

4. Keep pages thin.
- Page files should compose sections and call hooks.
- Avoid embedding large data transforms and long callback chains directly in page components.

5. Standardize data flow.
- API response -> mapper -> typed view model -> UI.
- UI submit -> form state -> payload builder -> API.
- Keep mapping logic outside JSX.

5b. Keep interface writing minimal.
- Default to concise labels, helper text, and short section intros.
- Avoid text-heavy modules unless the workflow depends on detailed explanation.
- When a screen feels noisy, reduce copy before adding more structure.

6. Validate before finishing.
- Run relevant build/lint checks.
- Confirm no visual regressions and no behavior regressions.

## Refactor Triggers
Apply extraction when one or more conditions are true:
- File exceeds ~400 lines.
- Same JSX pattern appears 2+ times.
- Same transform/formatter appears 2+ times.
- Component has 8+ independent state values.
- Component contains 3+ modal/popover/dialog branches.

## Conventions
- Keep components focused and typed.
- Keep utilities pure (no side effects, no hooks).
- Keep hook names action-oriented (`useOrderDetailState`, `useHistoryTableData`).
- Keep service function names API-oriented (`fetchX`, `updateX`, `syncX`).
- Do not create one-off helpers if logic is only used once and already clear.

## Output Requirements
For every frontend implementation/refactor:
- List extracted modules and why they were extracted.
- Preserve existing API contracts unless user requests contract changes.
- Minimize prop-drilling by grouping related props into typed objects when appropriate.
- Keep styles/theme consistent with existing design system.

## References
- Use [references/frontend-dry-checklist.md](references/frontend-dry-checklist.md) as a pre-merge checklist.
