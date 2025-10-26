# Meals Tab List (meal-tab.png)

**Purpose:**  
Primary dark-mode list showing all meals and favorites.

---

## Layout

- Background: `#1A1A1D` (app base)
- Each card:
  - Background: `#2A2A2E`
  - Border: 1 px solid rgba(255, 75, 145, 0.2)
  - Corner radius: 8–12 px
  - Vertical gap: 8–12 px
  - Padding: 12 px
- Top tabs (“Meals”, “Favorites”) directly below header
- Filter icon on right aligned with tab underline

---

## Typography & Color

| Element                     | Font           | Color                                                    |
| --------------------------- | -------------- | -------------------------------------------------------- |
| App title                   | Bold 28 pt     | White `#FFFFFF`                                          |
| Tabs                        | Medium 16 pt   | Inactive gray `#A0A0A0`; active underline pink `#FF4B91` |
| Meal title                  | Semibold 18 pt | White                                                    |
| Subtext (stars, lock)       | Regular 14 pt  | Gray `#A0A0A0`                                           |
| Cost symbols `$` `$$` `$$$` | Regular 14 pt  | Bright green `#00FF9C`                                   |

---

## Components

### Meal Card Row

- Left: emoji (≈ 28 dp)
- Middle: title + rating
- Right: cost indicator + optional lock icon
- Rating: 1–5 stars; filled stars in soft pink or mint accent
- Locked meals: gray lock icon
- Favorite meals (future): subtle glow or star overlay

### Tabs Row

- Pink underline animation on active tab
- Light horizontal slide transition between tabs

---

## Interaction & Motion

- Tap meal → opens **Meal Editor Modal**
- Long press → quick actions (Lock/Unlock, Favorite, Delete)
- Pull down → refresh list
- Card press → scale 0.98 × for 80 ms
- Tab switch → fade + horizontal slide

---

## Notes

- Use consistent emoji sizes
- Maintain uniform left padding and equal card width
- Keep dark mode contrast ADA-compliant (ratio ≥ 4.5 : 1)
