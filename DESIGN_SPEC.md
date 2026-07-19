# VoiceNote — Design Spec for React Native Implementation

## Color Palette

```js
const colors = {
  // Primary accent
  accent: '#10B981',
  accentDark: '#059669',
  accentCyan: '#06B6D4',
  accentMint: '#34D399',
  accentLight: '#D1FAE5',
  accentLightCyan: '#CCFBF1',

  // Backgrounds
  bg: '#F0F4F3',
  bgCard: '#FFFFFF',
  bgAuth: '#0F172A', // login/register dark bg

  // Gradients (use LinearGradient)
  gradientHeader: ['#064E3B', '#134E4A', '#0F766E'],  // 135deg
  gradientButton: ['#10B981', '#06B6D4'],              // 135deg
  gradientUserBubble: ['#10B981', '#0D9488'],           // 135deg
  gradientRecord: ['#34D399', '#10B981', '#06B6D4'],    // 135deg
  gradientAuth: ['#0F172A', '#134E4A', '#064E3B'],      // 160deg
  gradientRecordScreen: ['#064E3B', '#0F172A'],         // 180deg

  // Text
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: 'rgba(255,255,255,0.5)',

  // Borders & separators
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderGlass: 'rgba(255,255,255,0.12)',
  borderGlassSubtle: 'rgba(255,255,255,0.08)',

  // Glass surfaces (on dark backgrounds)
  glass: 'rgba(255,255,255,0.08)',
  glassLight: 'rgba(255,255,255,0.12)',
  glassMedium: 'rgba(255,255,255,0.15)',
  glassInput: 'rgba(255,255,255,0.08)',

  // Status
  destructive: '#EF4444',
  blue: '#3B82F6',
};
```

## Typography (use DM Sans from Google Fonts, fallback system)

```js
const type = {
  largeTitle: { fontSize: 22, fontWeight: '700', fontFamily: 'DMSans-Bold' },
  title: { fontSize: 20, fontWeight: '700', fontFamily: 'DMSans-Bold' },
  headline: { fontSize: 18, fontWeight: '700', fontFamily: 'DMSans-Bold' },
  body: { fontSize: 15, fontWeight: '400', fontFamily: 'DMSans-Regular' },
  bodyMedium: { fontSize: 14, fontWeight: '500', fontFamily: 'DMSans-Medium' },
  subhead: { fontSize: 13, fontWeight: '600', fontFamily: 'DMSans-SemiBold' },
  footnote: { fontSize: 12, fontWeight: '400', fontFamily: 'DMSans-Regular' },
  caption: { fontSize: 11, fontWeight: '600', fontFamily: 'DMSans-SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  tabLabel: { fontSize: 10, fontWeight: '500', fontFamily: 'DMSans-Medium' },
  tabLabelActive: { fontSize: 10, fontWeight: '600', fontFamily: 'DMSans-SemiBold' },
};
```

## Spacing & Radii

```js
const spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32 };
const radii = { sm: 8, md: 12, lg: 14, xl: 16, pill: 20, bubble: 18, full: 9999 };
```

## Required Packages

- `react-native-linear-gradient` — gradient headers, buttons, bubbles, record button
- `react-native-reanimated` — pulse ring animations on record screen
- `@react-native-community/blur` (optional) — glass blur on iOS; fallback to semi-transparent bg on Android

## Shadows

```js
const shadows = {
  card: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  fab: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8 },
  button: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 6 },
  bubbleUser: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
};
```

---

## Screen-by-Screen Implementation Notes

### LOGIN / REGISTER
- Full-screen dark gradient background (gradientAuth, 160deg)
- Radial glow shapes: use absolute-positioned Views with large borderRadius and semi-transparent accent colors
- "VoiceNote" title uses gradient text — use `react-native-linear-gradient` + MaskedView or a gradient text component
- Title has a floating animation (translateY oscillation, 4s loop)
- Form container: glass card (rgba(255,255,255,0.08) background, border rgba(255,255,255,0.12), borderRadius 20)
- Inputs: glass-style (rgba(255,255,255,0.08) bg, rgba(255,255,255,0.15) border, white text, borderRadius 12)
- Submit button: LinearGradient ['#10B981','#06B6D4'] 135deg, borderRadius 12, colored shadow
- Toggle link at bottom: muted white text with accent-colored clickable text

### NOTES (HOME)
- **Gradient header**: LinearGradient ['#064E3B','#134E4A','#0F766E'] wraps greeting + search
  - Radial glow blob (absolute, top-right)
  - Profile avatar: glass circle (rgba(255,255,255,0.15) bg, blur, white icon)
  - "Hey Lisa" centered, white, 22px bold
  - "+ Εγγραφή" button: glass pill (rgba(255,255,255,0.15), blur, border rgba(255,255,255,0.1))
  - Search bar: glass style (rgba(255,255,255,0.12), blur, borderRadius 12)
- **Content area**: bg '#F0F4F3'
  - "Τίποτα για σήμερα 🎉" centered, muted text
  - Note cards: white, borderRadius 14, card shadow, **borderLeftWidth: 3, borderLeftColor: accent**
    - Date label: 11px, uppercase, accent green, letterSpacing 0.5
    - Note text: 14px, dark, lineHeight 1.5
    - Action badge: gradient bg (D1FAE5→CCFBF1), borderRadius 12, green text
- **FAB** (record button): bottom-right absolute, 56x56, gradient ['#10B981','#06B6D4'], borderRadius full, mic icon white, colored shadow
- **Tab bar**: white bg, borderTop rgba(0,0,0,0.04)
  - Active tab: accent-colored icon + label + gradient indicator line (32x3, borderRadius 2) positioned above icon
  - Inactive tab: #94A3B8 icon + label

### TASKS
- Same gradient header as Notes but with title "Εργασίες" and filter pills inside
- **Filter pills** (inside gradient header): glass style
  - Active: rgba(255,255,255,0.2) bg with blur, white text, border rgba(255,255,255,0.15)
  - Inactive: rgba(255,255,255,0.08) bg, rgba(255,255,255,0.6) text
  - Pill sizing: padding 6px 12px, fontSize 12, borderRadius 16
- **Task cards**: white, borderRadius 14, card shadow
  - Checkbox (pending): 24x24 circle, border 2px accent, subtle gradient fill (rgba accent 0.05)
  - Checkbox (completed): solid accent bg, white checkmark SVG
  - Task text: 14px, medium weight, dark (or line-through + muted when done)
  - Person name: 12px, muted
  - Date badge: bg #F1F5F9, borderRadius 8, 11px muted text

### CHAT
- Same gradient header with "Chat" title + "New Chat" link (accent mint #34D399)
- Content area bg: #F0F4F3
- **User bubbles**: LinearGradient ['#10B981','#0D9488'], borderRadius 18/18/4/18, white text, colored shadow
- **Assistant bubbles**: white bg, borderRadius 18/18/18/4, dark text, subtle shadow
- **Clarification cards** (when fuzzy match): white bg, border 1.5px solid accent, borderRadius 12
  - Matched text: accent color + bold
  - Date/detail: 12px muted below
  - Action links below: "Κανένα από αυτά" / "Δοκίμασε αλλιώς" — accent colored, 13px semibold
- **Input bar**: white bg, borderTop
  - Input field: bg #F0F4F3, borderRadius 22, 14px
  - Send button: 40x40, gradient, borderRadius full, arrow icon, colored shadow

### RECORD
- Full dark gradient background (gradientRecordScreen: ['#064E3B','#0F172A'], 180deg)
- Centered radial glow (large blurred accent circle behind button)
- Back button: glass pill (same as other screens)
- Title: "Νέα σημείωση" white, centered absolute
- Status text: "Έτοιμος" in muted white
- **Record button**: 140x140 circle, gradient ['#34D399','#10B981','#06B6D4']
  - Glow shadow: 0 0 40px rgba(accent,0.3)
  - **Animated rings**: 3 concentric circles expanding outward with fade (scale 1→1.6, opacity 0.5→0, 3s loop, staggered 0.5s apart)
  - Use Reanimated's withRepeat + withSequence for the ring animations
- Below: "ή γράψε τη σημείωση" muted text + glass text input

### SETTINGS
- Gradient header (same as other screens) with back button + "Ρυθμίσεις" title
- Content bg: #F0F4F3
- **Grouped cards**: white, borderRadius 14, card shadow
  - Face ID row: label + toggle (46x28, bg #E2E8F0 off / accent on, 24x24 white thumb)
  - Calendar section: section header (11px uppercase muted) + list rows with colored dots + checkmark for selected
  - Notifications: label + green dot with glow shadow
  - Logout: centered red text, separate card

---

## Tab Bar Structure (3 tabs)
- Σημειώσεις (Notes) — document icon
- Εργασίες (Tasks) — checkbox icon
- Chat — message bubble icon
- Active: accent color + gradient top indicator
- Inactive: #94A3B8

## Navigation
- Main app: 3-tab bottom nav
- Record: modal/push from FAB (no tab)
- Settings: push from profile icon on Notes screen (no tab)
- Login/Register: auth stack, toggle between them

## Animation Notes
- Record rings: scale 1→1.6, opacity 0.5→0, 3s duration, infinite loop, staggered starts
- Logo float: translateY 0→-6→0, 4s ease-in-out, infinite
- Tab indicator: animate width/position on tab change
- Task checkbox: scale bounce on toggle (0.8→1.1→1.0)
- Screen transitions: standard iOS push/modal
