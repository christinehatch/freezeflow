# Accessibility Debt

Findings from adding `eslint-plugin-jsx-a11y` (Milestone 9, Phase 6) that are
real issues but not fixed inline because the correct fix is a larger design
change, not a one-line correction. Small, unambiguous findings from the same
pass (redundant `role="list"` false positives, the Modal overlay's
mouse-only dismiss) were resolved inline instead of listed here.

## `WeightInput`'s wrapping `<label>` covers two controls

- **Where**: `frontend/src/pages/FreezeDryersPage.tsx:177` and `:521` (the
  `WeightInput` component defined at `:596`)
- **Rule**: `jsx-a11y/label-has-associated-control`
- **Issue**: A single `<label>` (e.g. "Tare Weight") wraps `WeightInput`,
  which itself renders two native controls — a number `<input>` and a unit
  `<select>`. The label only associates with the first control by default,
  so it's ambiguous which field "Tare Weight" describes, and a screen reader
  user clicking the label text won't reliably reach the unit selector.
- **Why deferred**: Fixing this properly means giving the number input and
  the unit select independent accessible names (e.g. `aria-label` on each,
  or splitting into two labeled fields) across every `WeightInput` call
  site, not just the two flagged here — `ProductionBatchPage.tsx` has its
  own local `WeightInput` and a separate `DesignSystemWeightInput` with the
  same two-control shape that weren't flagged only because their current
  call sites happen not to trip this specific rule. Worth doing as one pass
  across all weight-input usages rather than patching two lines.
