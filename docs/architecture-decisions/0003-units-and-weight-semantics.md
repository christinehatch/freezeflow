# ADR-0003 - Units and Weight Semantics

# Status

Accepted

---

# Context

Weight is one of the core measurements in Freezeflow.

Users record weights throughout the production process to determine drying progress, package finished products, compare Freeze Dryer performance, and generate historical reports.

Without clearly defined weight semantics, different parts of the application could interpret the same values differently, leading to inconsistent reporting, inaccurate calculations, and confusing user experiences.

This ADR establishes the canonical meaning of every weight recorded in the system.

---

# Decision

## Canonical Unit

All weights are stored internally in **grams**.

Grams provide a precise, universally recognized measurement and avoid cumulative rounding errors during calculations.

All calculations, comparisons, and reports use the stored gram values.

---

## Display Units

Display units are a user preference.

Version 1 supports:

* Grams (g)
* Ounces (oz)
* Pounds (lb)

Changing the preferred display unit affects presentation only.

Stored values are never converted or modified.

Fluid ounces are a volume unit, not a weight unit. Freezeflow does not convert fluid ounces to weight without product-specific density rules.

---

## Precision

Internally:

* Store weights as decimal values in grams.

Display:

* Grams: whole numbers by default.
* Ounces: one decimal place by default.

Future versions may allow user-configurable precision.

---

# Weight Types

Freezeflow records several different kinds of weights.

Each has a distinct meaning.

---

## Starting Weight

The Starting Weight is the weight of the prepared food placed on a Tray before freeze drying begins.

This weight represents the food only.

It does **not** include:

* Tray weight
* Containers
* Packaging materials

Each Tray has exactly one Starting Weight.

---

## Weight Check

A Weight Check is an observation recorded while a Tray is drying.

Each Weight Check represents the current weight of the food on the Tray.

Weight Checks:

* belong to one Tray
* belong to one Drying Run
* are chronological
* are historical observations
* do not replace previous Weight Checks

Weight Checks are used to determine when drying has stabilized.

---

## Final Dry Weight

The Final Dry Weight is the last recorded food weight before a Tray is marked Complete.

Each Tray has exactly one Final Dry Weight.

The preferred user-facing label is Finished Product Weight.

Final Dry Weight remains the persisted production concept for yield and historical calculations.

This value represents only the dried food.

It does **not** include:

* Bags
* Oxygen absorbers
* Labels
* Storage containers

---

## Package Weight

Package Weight represents the weight of the finished sealed Package.

It includes:

* Dried food
* Bag
* Oxygen absorber
* Label (if present)

Package Weight reflects the physical item placed into storage.

The user-facing term is **Sealed Package Weight**.

## Package Finished Product Weight

Package Finished Product Weight is the weight of freeze-dried food placed into
one Package. It excludes the Package, oxygen absorber, label, and other
packaging material. It is stored separately from Sealed Package Weight.

Historical Package Weight values remain Sealed Package Weights and must never
be reinterpreted as Package Finished Product Weights.

## Package Fresh Equivalent

Package Fresh Equivalent is derived, never persisted independently:

`sum(source Tray Starting Weights) * (Package Finished Product Weight / sum(source Tray Final Dry Weights))`

All inputs use canonical grams. For multi-Tray operations, both source sums use
every Tray in the Packaging Operation. Each Package receives its own derived
equivalent. Missing source weights or a zero combined Final Dry Weight produce
`Fresh equivalent unavailable` without blocking label printing.

---

# Source Weight

Source Weight is calculated automatically.

It is the sum of the Final Dry Weight of every Tray included in a Packaging Operation.

Users never enter Source Weight manually.

---

# Weight Difference

During Packaging, Freezeflow compares:

Source Weight

vs

Total Package Weight

The purpose of this comparison is to help users identify potential mistakes.

Examples include:

* Incorrect Package Weight
* Missing Package
* Recording error

Weight differences generate warnings.

They do **not** prevent Packaging.

---

# Weight Tolerance

Version 1 does not enforce a fixed acceptable weight tolerance.

Users remain responsible for determining whether a difference is acceptable.

Future versions may support configurable warning thresholds.

---

# Weight Entry Guidelines

Users are responsible for recording the weight of the product being tracked.

The application assumes that:

* Tray weights have already been tared or excluded.
* Package weights are recorded after the Package has been completely sealed.
* Measurements represent the user's best available observation.

The application records observations as entered and does not attempt to automatically adjust or infer measurements.

---

# Observation Time

Each Weight Check records two timestamps.

## Observation Time

The time the weight was actually measured.

This represents the real production timeline and should be used by reports and drying history whenever possible.

---

## Recorded Time

The time the Weight Check was entered into Freezeflow.

This exists for audit purposes and allows users to enter observations later without changing the historical production timeline.

---

# Weight Calculations

Whenever practical, calculated values should be derived rather than stored.

Examples include:

* Source Weight
* Total Package Weight
* Weight Difference
* Weight Loss
* Drying Percentage
* Total Drying Time from non-voided Drying Run durations
* Package Fresh Equivalent

Derived values should always be recalculated from historical records.

The application should avoid storing calculated values that can become inconsistent with historical data.

---

# Historical Integrity

Recorded weights represent historical observations.

Changing display units must never modify stored historical values.

Reports and calculations should always use the canonical stored values.

Historical weight records remain valid regardless of how users choose to display measurements.

---

# Future Considerations

Future versions may support:

* Bluetooth scale integration
* Automatic weight capture
* Additional display units
* User-configurable precision
* User-configurable warning tolerances

These features must preserve the canonical storage model defined by this ADR.

Future integrations should record the source of each Weight Check (for example, manual entry or connected scale) without changing the meaning of the recorded weight.

---

# Consequences

## Benefits

* Consistent calculations throughout the application.
* Reliable historical reporting.
* Simpler future hardware integration.
* Elimination of rounding inconsistencies.
* Clear distinction between food weight and package weight.
* Supports late data entry without corrupting production history.

---

## Tradeoffs

* Unit conversion is required when displaying values.
* Users working primarily in ounces may occasionally see small rounding differences caused by display conversion.
* Slightly more implementation complexity due to maintaining separate observation and recorded timestamps.

These tradeoffs are acceptable because historical accuracy and mathematical consistency are prioritized over storing values in multiple units.
