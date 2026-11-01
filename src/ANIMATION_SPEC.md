# VoiceNote — Animation Spec for React Native

Use `react-native-reanimated` for all animations. All timings in ms.

Colors now follow the `DESIGN_SPEC.md` tokens. Any older color values below (greens, gradients) are superseded.

---

## GLOBAL (All Screens)

### Screen Transitions
- **Tab switch**: none
- **Push screen** (Settings, Record): standard iOS slide-from-right
- **Record modal**: slide-up from bottom, 350ms spring (damping: 20, stiffness: 200)

### Tab Bar
- **Active tab**: `fill` inner pill changes instantly, no animation

---

## TOAST / SNACKBAR

Shared component (`Snackbar`), used by both TASKS (`TodaySection`) and CHAT.

### Appear / Dismiss
- **Appear**: fade `opacity` 0→1 + `translateY`, `duration.base` (200ms), `easing.out`
- **Dismiss**: fade `opacity` 1→0 + `translateY`, `duration.base`, `easing.out`
- Component stays mounted for the exit duration, then unmounts — not removed instantly on dismiss
- Note: call sites that remount via `key` (e.g. TodaySection) bypass both transitions by design — the timer restart depends on that remount

---

## LOGIN / REGISTER

### Logo Float
- `translateY`: 0 → -6 → 0
- Duration: 4000ms, ease-in-out
- Loop: infinite, `withRepeat(withSequence(...))`

### Button Press
- `scale`: 1.0 → 0.97 on press-in, spring back on release
- Shadow intensity decreases on press

### Input Focus
- Border color: animate from `rgba(255,255,255,0.15)` → `paper`, 200ms

---

## NOTES (HOME)

### Note Cards — Staggered Entry
- On first load / pull-to-refresh, cards animate in sequentially
- Each card: `opacity` 0→1, `translateY` 12→0
- Duration: 300ms per card, stagger: 60ms delay between each
- Easing: ease-out

### Note Row Press
- `scale`: 1.0 → 0.97 on press-in, spring back
- Background: slight darken (opacity overlay)

### FAB (Record Button)
- **Press**: `scale` 0.97, spring back

### Search Bar Focus
- Container: `borderColor` transition to accent, 200ms
- Inner glow: subtle shadow appears, 200ms

### Pull to Refresh
- Custom refresh indicator using accent color spinner

---

## TASKS

### Checkbox Toggle (Pending → Complete)
- **Circle fill**: `done` fills from center outward, 200ms
- **Checkmark**: spring `scale` 0→1, starts at 200ms

### Checkbox Toggle (Complete → Pending)
- Reverse fill: shrink to center, 200ms
- Checkmark fades out: opacity 1→0, 150ms

### Row Exit on Completion
- **0ms**: tap; light haptic (completion only), circle fill starts
- **200ms**: circle fill ends, checkmark spring starts
- **200–600ms**: row holds, 400ms
- **600–800ms**: `height` and `opacity` collapse, 200ms; rows below move up
- **600ms**: undo snackbar appears
- **Reduced motion**: all of the above is instant

### Task Card Swipe (deferred: needs gesture-handler)
- Swipe left: reveals red "Delete" action, spring snap
- Swipe right: reveals green "Complete" action

### Task Row Deletion (delete only)
- `height` collapses to 0, `opacity` → 0, `scale` → 0.95, 300ms
- Rows below slide up to fill gap, 250ms spring

---

## CHAT

### Message Appear
- New message (user): slides in from right, `translateX` 40→0, `opacity` 0→1, 300ms ease-out
- New message (assistant): slides in from left, `translateX` -40→0, `opacity` 0→1, 300ms ease-out

### Thinking Indicator
- Three dots pulsing sequentially
- Each dot: `scale` 1.0→1.4→1.0, `opacity` 0.4→1.0→0.4
- Duration: 600ms per dot, stagger: 200ms between dots
- Loop: infinite while `isThinking === true`
- Container: slight `opacity` pulse 0.8→1.0, 1000ms

### Clarification Cards Appear
- Staggered entry: each card `opacity` 0→1, `translateY` 8→0
- Duration: 250ms, stagger: 100ms
- Border: `borderColor` accent pulses once (opacity 0.5→1.0→0.7), 500ms, to draw attention

### Clarification Card Press
- `scale`: 0.97, `backgroundColor` shifts to `fill` tint, 150ms
- On select: card `scale` 1.0→1.02→1.0 bounce, border becomes solid accent, other cards fade out (`opacity` → 0.3), 300ms

### Send Button
- **Disabled→Enabled**: `opacity` 0.35→1.0, `scale` 0.9→1.0, 200ms spring
- **Press**: `scale` 0.97, spring back, arrow icon `translateY` -3→0 (shoots up briefly)
- **After send**: input text fades, message appears (see Message Appear above)

### Action Links ("Κανένα από αυτά" / "Δοκίμασε αλλιώς")
- Press: text `opacity` 0.5 briefly, spring back

---

## RECORD

### Pulse Rings (3 concentric)
- Ring 1: `scale` 1.0→1.6, `opacity` 0.5→0, duration 3000ms, loop infinite
- Ring 2: same, but starts 500ms delayed
- Ring 3: same, but starts 1000ms delayed
- All use `withRepeat(withTiming(...))`

### Record Button Press
- `scale`: 1.0→0.97 on press-in
- On press: rings STOP pulsing, button morphs to a rounded square (borderRadius 140→40), 300ms spring
- Icon: mic icon crossfades to stop icon (square), 200ms

### Recording State
- Rings replaced by: solid ring that rotates 360deg continuously, 2000ms linear loop
- Timer text appears above button: `opacity` 0→1, `translateY` -8→0, 200ms

### Stop Recording
- Button morphs back to circle (borderRadius 40→140), 300ms spring
- Rings resume pulsing
- Icon: stop → mic crossfade, 200ms

### Write Input Expand
- On focus: input `height` expands 44→120, 250ms spring
- Keyboard-aware: entire bottom section slides up with keyboard

---

## SETTINGS

### Toggle Switch
- Thumb `translateX`: 2→22 (on) or 22→2 (off), 200ms spring (damping: 15)
- Track color: `fill` → `ink` crossfade, 200ms
- Haptic feedback: light impact on toggle

### Section Cards
- Staggered entry on screen load: `opacity` 0→1, `translateY` 8→0, 250ms, stagger 80ms

### Logout Button Press
- `backgroundColor` flashes to `overdueFill`, 150ms, then back
- `scale`: 0.97 → 1.0, spring

### Calendar Row Selection
- Checkmark: `scale` 0→1.2→1.0, 300ms spring
- Row background: brief `fill` tint, 200ms fade in/out

### Notification Dot
- No glow, no animation

---

## Implementation Pattern (Reanimated)

```jsx
// Example: Staggered card entry
const CardList = ({ items }) => {
  return items.map((item, i) => (
    <Animated.View
      key={item.id}
      entering={FadeInDown.delay(i * 60).duration(300).easing(Easing.out(Easing.ease))}
    >
      <TaskCard {...item} />
    </Animated.View>
  ));
};

// Example: Pulse ring
const PulseRing = ({ delay = 0 }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    // 3rd arg (reverse) must be true — without it withRepeat snaps back to
    // the starting value at each cycle boundary instead of animating back
    // through it, so the described smooth pulse only works with reversal.
    scale.value = withDelay(delay,
      withRepeat(withTiming(1.6, { duration: 3000 }), -1, true)
    );
    opacity.value = withDelay(delay,
      withRepeat(withTiming(0, { duration: 3000 }), -1, true)
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.ring, style]} />;
};
```

---

## Priority Order
1. Record pulse rings (hero interaction)
2. Chat message appear + thinking dots
3. Checkbox completion sequence
4. Staggered card entry (notes + tasks)
5. Logo float on login
6. Everything else
