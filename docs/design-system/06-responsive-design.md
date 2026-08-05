# Responsive Design

## Principle

Responsive design preserves the page's story and action priority at every
width. Mobile is not a reduced product; it is the same workflow arranged for a
smaller surface.

## Page adaptation

- Use the mobile page-padding token below tablet width.
- Use tablet padding for medium screens and desktop padding for wide screens.
- Keep the page title, purpose, and primary action in reading order.
- Stack header actions below the title when horizontal space is limited.
- Let cards become a single column before content becomes cramped.
- Avoid fixed heights for text-bearing surfaces.

## Navigation

Navigation may wrap during the foundation phase. A future TopNavigation
component may introduce a documented compact pattern, but destinations and
labels must remain unchanged.

## Forms and actions

- Keep form controls at least 40px high.
- Allow primary and secondary actions to become full width when helpful.
- Keep labels visible; do not rely on placeholders as labels.
- Preserve entered values and structured error context.

## Tables and dense history

Prefer semantic tables when comparison across columns is important. On small
screens, use safe horizontal scrolling or a documented row adaptation rather
than hiding traceability.

## Touch and readability

- Maintain comfortable touch targets.
- Avoid hover-only interactions.
- Preserve logical keyboard and screen-reader order.
- Do not reduce supporting text below the documented typography tokens.
