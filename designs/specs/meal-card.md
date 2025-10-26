# Meal Editor Modal (meal-card.png)

**Purpose:**  
Full-screen modal for creating or editing a meal entry.

---

## Layout

- Modal background: `#1A1A1D` (`theme.color.bgDark`)
- Rounded corners only at top (if overlay)
- Padding: 16–20px all sides
- Vertical spacing between sections: 12–16px

---

## Typography & Color

| Element            | Font           | Color                                   |
| ------------------ | -------------- | --------------------------------------- |
| Title              | Bold 18–20pt   | White `#FFFFFF`                         |
| Section label      | Medium 14–16pt | Subtle gray `#A0A0A0`                   |
| Accent text / link | Medium 14pt    | Pink `#FF4B91`                          |
| Add Ingredient     | Medium 14pt    | Sky blue `#3ABEF0`                      |
| Input / chips      | Regular 14pt   | White on dark-gray background `#2A2A2E` |

---

## Elements

### Title Field

- Underlined divider below text input

### Link Field

- Link icon on left
- URL text colored pink (`#FF4B91`)
- Input background: dark gray `#2A2A2E`
- Rounded 8px corners

### Ingredients

- Label: “Key Ingredients”
- Action: “Add Ingredient” on right
- Ingredient chips:
  - Rounded pills, 8px radius
  - Background: dark-gray `#2A2A2E`
  - Text: white
  - Spacing: 8px horizontal, 4px vertical

### Difficulty & Expense

- Each section:
  - Label above slider
  - Labels on each side (“Easy/Hard”, “Cheap/Pricey”)
  - Slider:
    - Track color: dark gray
    - Active track: pink `#FF4B91`
    - Thumb: circular, pink fill

### Lock Toggle

- Label: “Lock every Tuesday?”
- Switch: iOS style, default off (gray), active pink

### Save Button

- Full-width pill shape
- Background: bright pink `#FF4B91`
- Text: white, bold
- Corner radius: 24px
- Vertical padding: 12–16px

---

## Interaction & Motion

- Modal enters from right (240 ms ease-out)
- Modal exits to right (180 ms ease-in)
- Input focus animates slight scale or glow
- Save tap triggers light haptic feedback
