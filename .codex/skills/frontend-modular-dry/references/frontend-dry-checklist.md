# Frontend DRY Checklist

## Reuse First
- Search for existing components in `src/components` and feature folders.
- Search for existing hooks in `src/hooks` and feature hooks.
- Search for existing helpers in `src/lib` and feature `utils`.

## File Shape
- Keep page/container mostly composition + wiring.
- Keep rendering chunks in isolated presentational components.
- Keep API request and payload mapping in `services`.
- Keep shared typing in `types`.

## Duplication Rules
- Extract repeated JSX that appears 2+ times.
- Extract repeated transform/formatter logic that appears 2+ times.
- Extract repeated button/table/filter patterns into local reusable components.

## Minimal UI Writing
- Labels and helper copy are concise and functional.
- Pages are not overloaded with descriptive paragraphs by default.
- Additional explanatory text exists only where it materially improves task success.

## State Rules
- Keep local UI state local.
- Use custom hooks for screen orchestration (modal + filter + table + submit state).
- Avoid giant monolithic `useState` blocks in a single page when concerns are unrelated.

## Data Rules
- Keep API contract mapping outside JSX.
- Keep form-to-request payload mapping in one utility/service function.
- Ensure empty/null handling is centralized, not scattered in render blocks.

## Delivery Rules
- Preserve behavior unless user requests behavior change.
- Run project build/lint validation.
- Document extracted modules in the final response.
