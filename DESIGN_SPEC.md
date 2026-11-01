# Ask Lisa design spec: Direction B2, paper and ink

This file is the single source of truth for the redesign. It targets iOS in light mode. Android must not break, but it is not a design target.

Precedence: `AGENTS.md`, then `src/ANIMATION_SPEC.md` for motion, then this file, then any vendored skill. `src/config/theme.ts` remains the only token source in code. The tokens below are proposed and reach code in a later increment.

---

## 1. Direction

"Paper and ink": a light paper ground, near-black ink, and about 95% neutral. The app should feel calm and editorial, with tasks first.

Color appears only for meaning:

| Color | Meaning | Where it appears |
|---|---|---|
| Red | Overdue | Text, checkbox ring, chip |
| Amber | Today | Dot, chip |
| Green | Done | Checkbox fill only, and only from the moment of completion |

Rules:

- No cards for lists.
- No gradients.
- No emoji.
- No all-caps labels. Sentence case everywhere.
- Native iOS 26 posture: a floating pill tab bar with a separate trailing capture button. This is a custom approximation with no blur, not real Liquid Glass.

One bold move per screen. On Home it is the large Literata date header, and everything around it stays quiet.

---

## 2. Color tokens

### Light surfaces

| Token | Value | Role |
|---|---|---|
| `paper` | `#FAFAF8` | Screen ground |
| `surface` | `#FFFFFF` | Tab pill, sheets |
| `fill` | `#EEEEEA` | Chips, avatar, active tab, secondary button |
| `ink` | `#16181B` | Primary text, capture button, primary button |
| `ink2` | `#3F444A` | Secondary text, total chip text |
| `muted` | `#6A7077` | Meta text, inactive tab |
| `faint` | `#8A8F96` | Display second line and completed-task text only |
| `hairline` | `rgba(0,0,0,0.08)` | Row dividers |
| `checkRing` | `#8A8F96` | Open checkbox stroke |
| `overdue` | `#B42318` | Overdue text and ring |
| `overdueFill` | `#FDECEA` | Overdue chip ground |
| `today` | `#F2B227` | Decorative dots only, never text |
| `todayText` | `#7A4A00` | Today chip text |
| `todayFill` | `#FFF4D6` | Today chip ground |
| `done` | `#2F9E5B` | Checkbox fill only |
| `danger` | Reuses `overdue` `#B42318` | Destructive text |

### Inverse surfaces (Record, Auth, Lock)

These screens use an ink ground with paper text, replacing the current green.

The first three tokens below are additions to the proposed palette, needed because those screens have secondary text, inputs and errors. The existing light tokens fail on ink: `muted` is 3.55:1 and `overdue` is 2.71:1. `faint` passes at 5.46:1, but it is reserved for two other roles.

| Token | Value | Role |
|---|---|---|
| `inverseMuted` | `#A9ACB0` | Secondary text on ink |
| `inverseFill` | `rgba(255,255,255,0.10)` | Input ground on ink |
| `inverseHairline` | `rgba(255,255,255,0.15)` | Input border, secondary button border |
| `inverseError` | `#FCA5A5` | Error text on ink (existing token, value kept) |
| `inverseBg` | `#16181B` (`ink`) | Ground (existing token, new value) |
| `inverseText` | `#FAFAF8` (`paper`) | Primary text (existing token, new value) |

### Contrast, WCAG 2.x

Ratios are computed from the hex values with the WCAG relative-luminance formula. The bar is 4.5:1 for text under 24px and 3:1 for larger text.

| Text | Background | Ratio | Use | Result |
|---|---|---|---|---|
| `ink` | `paper` | 17.02 | Titles, body | Pass |
| `ink` | `surface` | 17.79 | Text on sheets | Pass |
| `ink` | `fill` | 15.29 | Active tab label, avatar initial | Pass |
| `ink2` | `paper` | 9.40 | Section labels, links | Pass |
| `ink2` | `surface` | 9.83 | Sheet secondary text | Pass |
| `ink2` | `fill` | 8.45 | Total chip | Pass |
| `muted` | `paper` | 4.79 | Meta line | Pass |
| `muted` | `surface` | 5.00 | Inactive tab label | Pass |
| `overdue` | `paper` | 6.29 | Overdue meta, section label, destructive text | Pass |
| `overdue` | `surface` | 6.57 | Destructive text on sheets | Pass |
| `overdue` | `overdueFill` | 5.75 | Overdue chip | Pass |
| `todayText` | `paper` | 7.16 | Reserved | Pass |
| `todayText` | `todayFill` | 6.83 | Today chip | Pass |
| `surface` | `ink` | 17.79 | Primary button label, snackbar | Pass |
| `paper` | `ink` | 17.02 | Text on inverse screens | Pass |
| `ink` | `paper` | 17.02 | Inverse primary button label | Pass |
| `inverseMuted` | `ink` | 7.81 | Inverse secondary text | Pass |
| `paper` | `inverseFill` over `ink` | 12.85 | Input text on ink | Pass |
| `inverseMuted` | `inverseFill` over `ink` | 5.89 | Input placeholder on ink | Pass |
| `inverseError` | `ink` | 9.37 | Error on ink | Pass |
| `inverseError` | `inverseFill` over `ink` | 7.07 | Error inside an input group | Pass |
| `faint` | `paper` | 3.12 | Home date line at 44pt | Pass (large text) |
| `faint` | `paper` | 3.12 | Completed-task text at 16pt | Exempt (disabled state) |

No proposed shade was adjusted, because every permitted pair passes. Three pairs fail and are therefore forbidden, rather than changing a shade:

| Forbidden pair | Ratio | Use instead |
|---|---|---|
| `muted` on `fill` | 4.30 | `ink2` on `fill` |
| `muted` on `ink` | 3.55 | `inverseMuted` on `ink` |
| `overdue` on `ink` | 2.71 | `inverseError` on `ink` |

Non-text elements, measured against the 3:1 bar of WCAG 1.4.11:

| Element | Background | Ratio | Result |
|---|---|---|---|
| `overdue` ring | `paper` | 6.29 | Pass |
| `done` fill | `paper` | 3.26 | Pass |
| White check | `done` | 3.41 | Pass |
| `checkRing` open ring | `paper` | 3.12 | Pass |
| `today` dot | `paper` | 1.80 | Decorative: the word "Σήμερα" carries the meaning |
| `today` dot | `todayFill` | 1.72 | Decorative: the chip text carries the meaning |

---

## 3. Typography

Weight is expressed through font family, per the existing theme convention. No token sets `fontWeight`.

**Literata** appears only in the Home date header and the Record and Lock screen titles.

| Token | Family | Size/line | Use |
|---|---|---|---|
| `display` | `Literata_400Regular` | 44/48 | Home date header: weekday in `ink`, date line in `faint` |
| `displaySmall` | `Literata_400Regular` | 28/34 | Record and Lock titles, in `paper` on ink |

The brief does not give a size for the Record and Lock titles. 28/34 is a decision made for this spec: large enough to read as display type, and small enough to leave Record's central control dominant.

**Inter** is used for everything else.

| Token | Family | Size/line | Use |
|---|---|---|---|
| `title` | `Inter_600SemiBold` | 17/22 | Screen and sheet titles |
| `task` | `Inter_500Medium` | 16/22 | Task title |
| `body` | `Inter_400Regular` | 16/24 | Note text, chat, empty-state text |
| `meta` | `Inter_400Regular` | 13/18 | Task meta line, timestamps |
| `section` | `Inter_600SemiBold` | 12/16 | Section labels, sentence case, no tracking |
| `chip` | `Inter_500Medium` | 13/18 | Chip label |
| `chipCount` | `Inter_600SemiBold` | 13/18 | Chip count |
| `tabLabel` | `Inter_500Medium` | 10/12 | Inactive tab |
| `tabLabelActive` | `Inter_600SemiBold` | 10/12 | Active tab |
| `button` | `Inter_600SemiBold` | 16/22 | Buttons and the snackbar action (added: the brief gives no button style) |

Dynamic Type: body, task and meta text scale without a cap. Custom chrome text (tab labels, chips, buttons, snackbar) uses `maxFontSizeMultiplier` 1.3. The date header uses `maxFontSizeMultiplier` 1.2, `numberOfLines={1}` and `adjustsFontSizeToFit`, because long Greek dates such as "28 Σεπτεμβρίου" have not been measured at 44pt on narrow devices.

---

## 4. Spacing and radii

Spacing is a 4pt scale: 4, 8, 12, 16, 20, 24. The screen gutter is 24.

| Radius token | Value | Element |
|---|---|---|
| `checkbox` | 11 | Checkbox, a circle at 22pt |
| `chip` | 16 | Chip at 32pt high |
| `activeTab` | 25 | Active tab inner pill at 50pt high, primary and secondary buttons |
| `tabPill` | 31 | Tab pill at 62pt high |
| `capture` | 31 | Capture button, a circle at 62pt |
| `avatar` | 22 | Avatar, a circle at 44pt |

Buttons sharing `activeTab` is a decision made for this spec, because the brief lists no button radius.

Floating shadow, shared by the tab pill and capture button:

```
shadowColor: ink, shadowOffset: { width: 0, height: 4 },
shadowOpacity: 0.10, shadowRadius: 16, elevation: 6
```

---

## 5. Components

All touch targets are at least 44pt. Components stay presentational per the `AGENTS.md` layer rules. Every custom pressable sets `accessibilityRole` and `accessibilityLabel`, and pressable elements use the press scale from section 7.

### TaskRow

```
(o)  Να πάρω τον γιατρό
     ● Σήμερα · Μαρία · 14:30
─────────────────────────────
```

- **Anatomy:** checkbox, title, one meta line, hairline divider. There is no card, ground or shadow.
- **Sizes:** 12 vertical padding, 12 between checkbox and text, `StyleSheet.hairlineWidth` divider. The divider starts at the text edge.
- **Checkbox:** a 22pt circle with a 1.5pt stroke, inside a 44pt touch target.
- **Title:** `task` in `ink`, at most 2 lines.
- **Meta line:** `meta` in `muted`, 1 line, in the order date · person · time. Missing parts are omitted along with their separator, and the line is dropped if nothing remains. Nothing is guessed or backfilled, including from the note summary.
- **Press:** tapping the row opens `NoteDetail`. Long press keeps the existing delete confirmation.

| State | Checkbox | Title | Meta |
|---|---|---|---|
| Open | `checkRing` stroke | `ink` | `muted` |
| Today | `checkRing` stroke | `ink` | 6pt `today` dot before "Σήμερα" |
| Overdue | `overdue` stroke | `ink` | Date in `overdue`, the rest `muted` |
| Completed | `done` fill, white check | `faint` | `faint` |

Date labels are "Σήμερα", "Αύριο", or a short date such as "4 Νοε". A year is added only when it differs from the current one. Time appears only on timed items, as 24-hour `14:30`.

### Summary chips row

| Chip | Ground | Text | Example |
|---|---|---|---|
| Overdue | `overdueFill` | `overdue` | "2 εκπρόθεσμες" |
| Today | `todayFill` | `todayText`, with a 6pt `today` dot | "3 σήμερα" |
| Total | `fill` | `ink2` | "12 εργασίες" |

- 32pt high, radius 16, 12 horizontal padding, 8 between chips.
- A chip whose count is 0 is hidden. The row is removed when all are hidden.
- Singular forms: "1 εκπρόθεσμη", "1 εργασία".
- Total counts all open tasks.
- Chips are read-only, so the 44pt rule does not apply. The row is one accessibility element that reads all its counts.

### Section label

`section` in `ink2`, sentence case, 24 above and 4 below, `accessibilityRole="header"`. "Εκπρόθεσμες" uses `overdue`. Other labels stay neutral.

### FloatingTabBar

```
┌─────────────────────────────────┐  ╭───╮
│ ╭───────╮                       │  │   │
│ │  [✓]  │    [▤]        [◌]     │  │ ● │
│ │Εργασίες│ Σημειώσεις   Chat    │  │   │
│ ╰───────╯                       │  ╰───╯
└─────────────────────────────────┘
 ← 16                       12 gap    16 →
```

- **Anatomy:** a `surface` pill 62 high, radius 31, with the floating shadow, 16 from the left edge. It stretches to leave a 12 gap before the capture button.
- **Vertical position:** `barBottom = Math.max(insets.bottom, 16)`, which sits the bar directly above the home indicator area and keeps a 16 margin on devices with no inset.
- **Tabs, in this order:** Εργασίες, Σημειώσεις, Chat. Icon over label, equal widths, using the existing Ionicons (`checkmark-done-outline`, `document-text-outline`, `chatbubble-outline`).
- **States:** the active tab has a `fill` inner pill 50 high, radius 25, inset 6, with `ink` icon and `tabLabelActive`. An inactive tab has a `muted` icon and `tabLabel`.
- **Touch target:** at least 50pt high across each tab's full width.
- **Accessibility:** `accessibilityRole="tab"` with `accessibilityState={{ selected }}`.
- **Build:** React Navigation's custom `tabBar` prop, absolutely positioned by the component itself. No new packages and no blur.
- **Keyboard:** the bar and capture button hide while the keyboard is open, and return when it closes. Otherwise they would cover the Chat input and Notes search.

### CaptureButton

- A 62pt `ink` circle, radius 31, with a white Ionicons `mic` at 26pt and the floating shadow.
- It sits 16 from the right edge, trailing the tab pill by 12, with the same `barBottom`.
- It is visible on every tab and never hides on scroll. The only exception is the keyboard rule above.
- `accessibilityLabel="Ηχογράφηση"`, `accessibilityRole="button"`. No idle pulse.
- It navigates to the existing `Record` route.

### Scroll clearance

Every scrollable under the bar uses `paddingBottom = barBottom + 62 + 16`, so the last row clears the floating bar. On a device with a 34 inset that comes to 112. The Chat input docks at `barBottom + 62 + 8` while the keyboard is closed, and sits on the keyboard while it is open.

### Avatar button

A 44pt `fill` circle, radius 22, with the user's initial in `title` and `ink`. The initial is the first letter of the account email, uppercased, because the app stores no display name. With no email it shows Ionicons `person-outline`. It sits at the trailing end of the Home header and opens Settings. `accessibilityLabel="Ρυθμίσεις"`.

### Snackbar (undo)

- `ink` ground, radius 16, at least 48 high, 16 horizontal padding, 8 above the floating bar.
- Message in `meta` with `surface` text. Action in `button` with `surface` text and a 44pt target.
- Copy: "Η εργασία ολοκληρώθηκε", action "Αναίρεση".
- Keeps the existing 4000ms default and the existing behavior where a new completion restarts the timer.

### Empty state

Text only: no emoji and no illustration. Title in `body` and `ink2`, hint in `meta` and `muted`, centered, with 8 between them. An empty screen says what fills it.

### Buttons

| Variant | Ground | Label | Height / radius |
|---|---|---|---|
| Primary | `ink` | `button`, `surface` | 50 / 25 |
| Secondary | `fill` | `button`, `ink` | 50 / 25 |
| Destructive text | None | `button`, `overdue` | 44 minimum |
| Inverse primary | `paper` | `button`, `ink` | 50 / 25 |
| Inverse secondary | None, `inverseHairline` border | `button`, `paper` | 50 / 25 |

Disabled buttons render at 0.4 opacity and are exempt from the contrast bar. Loading replaces the label with a small `ActivityIndicator` and keeps the button's width.

---

## 6. Home screen

Home is the Εργασίες tab and the app's initial route.

```
Κυριακή                       (Ι)
1 Νοεμβρίου

[2 εκπρόθεσμες] [● 3 σήμερα] [12 εργασίες]

Εκπρόθεσμες
Σήμερα
Αύριο
Τετάρτη 4 Νοεμβρίου
Αργότερα
Χωρίς ημερομηνία

Ολοκληρωμένες  8
```

### Grouping

Sections appear in this order, and an empty section is not rendered.

| Section | Contents | Order within |
|---|---|---|
| Εκπρόθεσμες | Open, `due_date` before today | Oldest first |
| Σήμερα | Open, due today | Timed by time, then all-day |
| Αύριο | Open, due tomorrow | Timed by time, then all-day |
| One section per day, such as "Τετάρτη 4 Νοεμβρίου" | Open, due after tomorrow through Sunday of the current week | Timed by time, then all-day |
| Αργότερα | Open, due after that Sunday | Date ascending |
| Χωρίς ημερομηνία | Open, no `due_date` | Newest first |

- The week runs Monday to Sunday.
- On Saturday and Sunday no day sections appear.
- **Overdue uses device-local time.** It is a day boundary, compared with `toLocalDateString`. A timed task from earlier today stays in Σήμερα rather than turning overdue.
- Date buckets are recomputed when the app returns to the foreground, so they do not go stale across midnight.

### Completed tasks

"Ολοκληρωμένες" is a link at the bottom of the list, in `body` and `ink2`, followed by its count in `muted`, with a 44pt target. It expands the completed rows in place with no new route, sorted by `createdAt` descending, because `TaskWithContext` has no completion timestamp. It is hidden when the count is 0. Tapping a completed checkbox reopens the task.

### Layout

The list is a virtualized `SectionList` with the header and chips as its list header, so they scroll with the content. Side gutter 24, chips 16 below the date, pull-to-refresh via `RefreshControl`.

### Greek copy

Copy uses the informal singular throughout and calls these items "εργασίες".

| State | Title | Hint or action |
|---|---|---|
| No tasks yet | "Ακόμα δεν υπάρχουν εργασίες" | "Πάτα το μικρόφωνο και πες τι έχεις να κάνεις." |
| No open tasks, some completed | "Δεν έχεις ανοιχτές εργασίες" | "Οι ολοκληρωμένες είναι πιο κάτω." |
| Nothing due today, others exist | No message | Other sections render normally |
| Completed list empty | Not applicable | The link is hidden |
| Load failure | "Δεν φορτώθηκαν οι εργασίες" | Secondary button "Δοκίμασε ξανά" |
| Completion failure | Snackbar "Η εργασία δεν ολοκληρώθηκε" | The row returns to open |
| Undo failure | Snackbar "Η αναίρεση απέτυχε" | No action |

While data loads, the date header renders at once and the list stays empty, with no full-screen spinner. Reads are local and fast, so a skeleton would only flash.

---

## 7. Motion

`src/ANIMATION_SPEC.md` wins on conflict.

Adopted into src/ANIMATION_SPEC.md on 2026-11-01.

### Completion sequence

| Time | Event |
|---|---|
| 0ms | Tap: write to the database, light haptic, ring starts filling |
| 0–200ms | Ring fills `done` green |
| 200ms | Check springs in, scale 0 to 1 |
| 200–600ms | Row holds |
| 600–800ms | Row height and opacity collapse, rows below move up |
| 600ms | Undo snackbar appears |

- **Haptic:** `expo-haptics` is already installed (`~15.0.8`) and `TaskCheckbox` already fires `ImpactFeedbackStyle.Light`, so this is included, not deferred. It fires on completion only.
- **Undo:** "Αναίρεση" reopens the task and the row returns to its section.
- **Reduced motion:** all of this becomes instant, through the existing `useReducedMotionPreference`.

### Other motion

- Press scale is 0.97 on every pressable, with a spring back.
- There is no tab-switch animation, neither content nor indicator.
- The capture button has no idle animation.

---

## 8. Patterns borrowed

These borrow the approach only, not the look.

| Source | Pattern |
|---|---|
| Things 3 | Color only for meaning, the circle-checkbox completion sequence, the date-led today view |
| iOS 26 | Floating pill tab bar with a trailing primary action |
| Todoist | Overdue-first grouping |
| Apple Reminders | Hairline rows, count chips |
| Voicenotes | One dominant capture control |

---

## 9. Migration notes

Reference counts come from a grep of `src/` and `App.tsx`, excluding `theme.ts` itself. They count `token.name` references and can miss dynamic access.

### Tokens tests depend on

Keep these until the component and its test change together.

| Dependency | Test | Rule |
|---|---|---|
| `Inter_600SemiBold` for assistant bold text, with no `fontWeight` | `__tests__/ChatBubble.test.tsx:86` | Family stays loaded and in use |
| `colors.accent` | `__tests__/ClarificationChips.test.tsx:69,86` | Name stays, value changes to `ink` |
| `colors.border` | `__tests__/ClarificationChips.test.tsx:89,91` | Name stays, value changes to `hairline` |

### Colors

| Current | Refs | Action | New |
|---|---|---|---|
| `bg` | 7 | Rename, change value | `paper` |
| `bgCard` | 19 | Rename, change value | `surface` |
| `text` | 21 | Rename, change value | `ink` |
| `textSecondary` | 7 | Rename, change value | `ink2` |
| `textMuted` | 38 | Rename, change value | `muted` |
| `white` | 29 | Stays | Glyphs on `ink` and `done` |
| `accent` **(test)** | 34 | Stays, change value | `#16181B` |
| `border` **(test)** | 20 | Stays, change value | `rgba(0,0,0,0.08)` |
| `borderLight` | 8 | Remove | `hairline` |
| `accentVivid` | 14 | Remove | By role: `done` for completion, `ink` otherwise |
| `accentSoft` | 1 | Remove | `fill` |
| `accentFaint` | 4 | Remove | Transparent or `fill` |
| `destructive` | 17 | Remove | `danger` on light, `inverseError` on ink |
| `inverseBg` | 3 | Stays, change value | `#16181B` |
| `inverseText` | Via `type` | Stays, change value | `#FAFAF8` |
| `inverseTextSecondary` | Via `type` | Remove | `inverseMuted` |
| `inverseTextMuted` | 8 | Remove | `inverseMuted` |
| `inverseGlass` | 7 | Rename, change value | `inverseFill` |
| `glassLight` | 2 | Remove | `inverseFill` |
| `inverseBorderGlass` | 7 | Rename | `inverseHairline` |
| `borderGlass` | 3 | Remove | `inverseHairline` |
| `inverseError` | 0 | Stays | Now used |
| `scrim` | 1 | Stays, change value | `rgba(22,24,27,0.45)` |
| `filterPillBg`, `filterPillBgActive` | 1 each | Remove | Removed with `TaskFilterBar` |
| `gradientHeader` | 3 | Remove | `paper` |
| `gradientButton` | 2 | Remove | `ink` |
| `gradientUserBubble` | 1 | Remove | `ink` |
| `gradients.recordScreen`, `gradients.auth` | 1 each | Remove | `inverseBg` |
| `gradients.recordButton`, `gradients.authButton` | 1 each | Remove | `paper` |
| `inverseBgCard`, `inverseBgElevated`, `inverseAccentMuted`, `inverseRecordingMuted`, `inversePersonText`, `inversePersonBg`, `inverseTopicText`, `inverseTopicBg`, `inverseDueText`, `inverseDueBg`, `inverseBorder`, `inverseBorderFaint` | 0 | Remove | None |

Added: `fill`, `faint`, `checkRing`, `overdue`, `overdueFill`, `today`, `todayText`, `todayFill`, `done`, `inverseMuted`.

### Typography

| Current | Refs | New |
|---|---|---|
| `displaySerif` | 2, in the `App.tsx` header | `title`: this header moves to Inter |
| `titleSerif` | 0 | `displaySmall` |
| `bodyReading` | 0 | Remove: note bodies use `body` |
| `headline` | 3 | `title` |
| `bodyLarge` | 3 | `body` |
| `body` | 18 | `body`, 15/22 becomes 16/24 |
| `bodyMedium`, `subhead`, `footnote` | 0 | Remove |
| `label` | 8 | `section`: uppercase and tracking removed |
| `caption` | 0 | Remove: it is all-caps |
| `meta`, `metaLarge` | 33, 3 | `meta` 13/18 |
| `tabLabel` | 0 | `tabLabel`, `tabLabelActive` |
| `buttonHero`, `buttonSmall` | 1, 6 | `button` |

Also:

- Every current `type` token defaults to an inverse text color. New tokens default to `ink`, so Record, Auth and Lock must set their colors explicitly.
- `NoteListRow.tsx:135` hardcodes `Literata_500Medium`. It moves to Inter.
- `Literata_500Medium` and `Literata_600SemiBold` can stop loading in `App.tsx` after that.

### Spacing, radii, shadows

| Current | Refs | Action |
|---|---|---|
| `spacing.xs` to `spacing.xl` | 212 total | Stay, matching 4 to 24 |
| `spacing.xxl`, `spacing.xxxl` | 9, 2 | Outside the new scale: replace with 24 per call site, then remove |
| `spacing.listBottomInset` | 4 | Remove: replaced by the scroll clearance in section 5 |
| **`radii.pill` = 8** | 15 | **Removed or renamed.** The name now misleads, since pills are 25 or 31. Rename the call sites that need 8, and move real pills to `chip` or `activeTab` |
| `radii.sm`, `radii.lg`, `radii.cardSm`, `radii.cardLg`, `radii.card` | 4, 16, 4, 3, 0 | Outside the new scale: resolve per call site as those screens migrate, and remove `card` now |
| `radii.full` | 14 | Replace with the named circle radii where they apply |
| `radii.bubble`, `radii.bubbleTail`, `radii.inputPill` | 2, 2, 1 | Stay until Chat has its own spec |
| `shadows.light.card` | 7 | Remove: list rows have no shadow |
| `shadows.light.button`, `shadows.light.bubbleUser` | 8, 1 | Remove. `motion.ts` reads the button value for `authButtonShadow`, so update it together |
| `shadows.dark.fab` | 3 | Remove: replaced by the floating shadow. `fabShadow` in `motion.ts` goes with the idle pulse |
| `recordButton` | 19 | Stays. Colors become `paper` and `ink` |

### Behavior that must change

| Where | Today | Required |
|---|---|---|
| `App.tsx` tabs | Σημειώσεις, Εργασίες, Chat; opens on Notes | Εργασίες first and initial. Route names stay |
| `App.tsx` Notes header | Person icon opens Settings | Moves to the Home avatar. Notes and Chat have no Settings entry |
| `TaskRow.tsx:101` | Overdue computed from `todayAthens()` | Device-local via `toLocalDateString` |
| `TaskRow.tsx` | Falls back to `noteSummary` when there is no person | Omit it |
| `TaskCheckbox.tsx` | `hitSlop` 8 on 24pt, giving 40pt | 44pt target on 22pt |
| `taskBuckets.ts` | Overdue, today, next 7 days; later dates dropped | The six Home sections |
| `getTasksWithDueDates` | Dated tasks only | Home also needs undated tasks |
| `NotesListScreen.tsx` | Hosts `TodaySection` and `RecordFab` | `TodaySection` moves to Home; `RecordFab` is replaced by `CaptureButton` |
| `TasksScreen.tsx` | `TaskFilterBar` | Removed from Home |
| `TodaySection.tsx:19` | Snackbar copy with an em dash | "Η εργασία ολοκληρώθηκε" |
| `TodaySection.tsx:104` | "Τίποτα για σήμερα" with emoji | The section 6 copy |
| `TasksEmptyState.tsx` | Formal "σας", "ενέργειες" | The section 6 copy |
| Five files in `src/` import `LinearGradient`, plus `App.tsx` | Gradients | Solid tokens. `expo-linear-gradient` stays installed until a task asks to remove it |

`__tests__/TodaySection.test.tsx` covers moved code and copy, so it needs updating in that increment.

The agent's `overdue` filter stays on Europe/Athens, per `AGENTS.md`. Home uses device-local time, so outside the Athens timezone the two can disagree near midnight. That difference is accepted in this spec.

### Screens without a spec here

This spec fully defines Home and the shared components. Notes, NoteDetail, Chat, Settings, Record, Auth and Lock have no layout spec yet. Their earlier layout notes described the old green design and are retired. Until each is specified, they get the token mapping above and nothing else.

---

## 10. Deferred

- Dark mode
- Android design
- Swipe actions (needs gesture-handler)
- Blur or real Liquid Glass (needs expo-blur or native tabs)
- Record as modal
- Widget target
- Record auto-start
- Tab bar collapse on scroll
