# Design Foundations

## Token strategy

Frontend foundations use CSS custom properties prefixed with `--ff-`.

Token names describe purpose rather than a page or raw color. Components should
prefer semantic tokens such as `--ff-color-action-primary` and
`--ff-color-text-secondary` instead of introducing page-specific values.

The initial token groups are:

- color
- spacing
- typography
- shape
- layout
- elevation

The canonical implementation is `frontend/src/styles/tokens.css`.

## Color

The palette uses warm neutral surfaces, dark green actions, and restrained
semantic state colors.

Required semantic roles:

- page background
- surface
- subtle surface
- primary, secondary, and muted text
- border and strong border
- primary action and hover
- calm, active, success, attention, and danger surfaces and text

Color alone must not be the only state indicator. Pair it with clear text.

## Spacing

Spacing begins at 4px and uses a consistent scale. Prefer the named scale over
one-off values. Related content should sit closer together than separate page
regions.

## Typography

The initial hierarchy includes caption, supporting text, body, section title,
page title, and display text. Display text is reserved for rare orientation or
summary moments and should not become the default page heading.

## Shape and elevation

Use small, medium, and large corner radii consistently. Surfaces are defined
primarily by background and border. Shadow is restrained and is not required for
ordinary cards.

## Layout

Pages use one shared maximum content width and responsive horizontal padding.
Components should adapt through flexible layouts rather than fixed dimensions.

## Migration

The tokens are introduced as a foundation. Existing hardcoded values are not
automatically replaced. Pages should migrate deliberately when they are next
redesigned or touched for scoped component work.
