# Developer Tools

# Purpose

Developer Tools provide local demo, regression, edge-case, and performance data
without requiring developers to manually complete the full production workflow.
The page is not part of the production user experience.

# Availability

The navigation item and page appear only in frontend development builds. The
supporting API exists only in backend development and test environments.

# Layout

The page groups actions by intent:

* Database: Reset Database and Seed Empty Database
* Demo Scenarios: Basic Demo, Busy Production Day, Inventory, Packaging, and
  Weight History
* Stress and Edge Cases: 100 Random Batches and Edge Cases
* Existing Data: Randomize Dates and Randomize Weights

Each action includes a short description of its effect. Destructive actions
require confirmation. While an action runs, its button is disabled. The result
area reports success, the action performed, and current entity counts.

# Interaction Rules

* Scenario seeds replace existing development data.
* Randomize actions mutate the existing development dataset.
* The page must explain that it acts on the currently configured local database.
* Errors remain visible and do not appear as successful seeds.
* The Basic Demo creates enough connected history to browse Production,
  Weight Tracking, Packaging, and Inventory immediately.
