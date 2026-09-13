# Weekly Eats Datadog analytics

Weekly Eats sends content-free product events as Datadog RUM custom actions.
Every event includes `analytics_schema_version: 1`, Datadog's `env` tag, and a
random local installation ID as the RUM user ID. Names, email addresses, meal
names, ingredient names, family-member names, and recipe content are not sent.

## Core loop

| Action name | Important attributes | Dashboard use |
| --- | --- | --- |
| `week_dashboard_opened` | — | Dashboard adoption and returning users |
| `week_plan_started` | `planning_scope`, `is_first_full_week` | Planning funnel start |
| `week_plan_milestone_reached` | `milestone`, `planned_day_count`, `available_day_count` | First meal, three meals, and full-week steps |
| `week_plan_completed` | `planned_day_count`, `is_complete_week`, `ready_before_grocery_day`, `days_before_grocery_day`, `used_auto_plan` | Weekly Active Planners, successful weeks, Week Ready Before Grocery Day |
| `grocery_list_opened` | `planned_day_count`, `generated_item_count`, `manual_item_count`, `checked_item_count` | Grocery-list adoption and Plan → Shop funnel |
| `grocery_list_completed` | `item_count`, `manual_item_count` | Shopping completion proxy |
| `grocery_manual_item_added` | `manual_item_count_after` | Forgotten-item/edit proxy |
| `planned_meal_resolved` | `outcome`, `day_of_week`, `is_special_meal` | Served, alternative, ate-out, and skipped rates |

## Activation and monetization

| Action name | Important attributes |
| --- | --- |
| `onboarding_started` | — |
| `onboarding_completed` | `grocery_day_set`, `grocery_day`, `family_member_count`, `meal_library_size` |
| `paywall_viewed` | `trigger` |
| `subscription_purchase_started` | `package_type` |
| `subscription_purchase_completed` | `package_type` |
| `subscription_purchase_cancelled` | `package_type`, `error_code` |
| `subscription_purchase_failed` | `package_type`, `error_code` |
| `subscription_restore_started` | — |
| `subscription_restore_completed` | `entitlement_active` |
| `subscription_restore_failed` | `error_code` |

## Product depth

| Action name | Important attributes |
| --- | --- |
| `meal_created` | `library_size_after`, completeness booleans and counts |
| `auto_plan_used` | `generated_day_count`, `planning_scope` |
| `auto_plan_try_another` | `generated_day_count`, `mode` |
| `meal_rating_submitted` | `rating_mode`, `rating_value` |

## Initial dashboard definitions

- **Weekly Active Planners:** unique RUM users with `week_plan_completed`.
- **Weeks Successfully Planned:** count of `week_plan_completed` where
  `is_complete_week:true`.
- **Week Ready Before Grocery Day:** percentage of full-scope
  `week_plan_completed` actions where `ready_before_grocery_day:true`.
- **Grocery List Adoption:** users with `grocery_list_opened` divided by users
  with `week_plan_completed`.
- **Planned Meals Served:** `planned_meal_resolved` with `outcome:served`
  divided by all `planned_meal_resolved` actions.
- **Planning Success Rate:** users reaching `week_plan_completed` divided by
  users reaching `week_plan_started`.
- **Four-week planner retention:** weekly cohort of the anonymous RUM user ID,
  using `week_plan_completed` as the return event.

Filter every production widget by `env:prod`; use `env:test` for local,
development, preview, and TestFlight validation.
