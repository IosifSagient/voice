# VoiceNote — Animation Spec for React Native

Use `react-native-reanimated` for all animations. All timings in ms.

---

## GLOBAL (All Screens)

### Screen Transitions
- **Tab switch**: crossfade content, 200ms ease-out
- **Push screen** (Settings, Record): standard iOS slide-from-right
- **Record modal**: slide-up from bottom, 350ms spring (damping: 20, stiffness: 200)

### Tab Bar
- **Active indicator line**: slides horizontally to active tab, 250ms ease-in-out (use `withTiming` + shared value for translateX)
- **Icon**: active icon scales 1.0→1.1→1.0 on tap, 200ms spring

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

### Background Glow Blobs
- Slow drift: `translateX/Y` oscillating ±10px, 8000ms loop
- Opacity pulse: 0.1→0.2→0.1, 6000ms loop

### Button Press
- `scale`: 1.0 → 0.96 on press-in, spring back on release
- Shadow intensity decreases on press

### Input Focus
- Border color: animate from `rgba(255,255,255,0.15)` → `rgba(52,211,153,0.5)`, 200ms

---

## NOTES (HOME)

### Note Cards — Staggered Entry
- On first load / pull-to-refresh, cards animate in sequentially
- Each card: `opacity` 0→1, `translateY` 12→0
- Duration: 300ms per card, stagger: 60ms delay between each
- Easing: ease-out

### Note Card Press
- `scale`: 1.0 → 0.98 on press-in, spring back
- Background: slight darken (opacity overlay)

### FAB (Record Button)
- **Idle pulse**: shadow radius 20→28→20, opacity 0.4→0.2→0.4, 2000ms loop
- **Press**: `scale` 0.9, spring back
- **Appear on scroll up**: `translateY` 80→0 + `opacity` 0→1, 250ms; hide on scroll down (reverse)

### Search Bar Focus
- Container: `borderColor` transition to accent, 200ms
- Inner glow: subtle shadow appears, 200ms

### Pull to Refresh
- Custom refresh indicator using accent color spinner

---

## TASKS

### Filter Pills
- **Active pill switch**: background color crossfade 200ms
- On dark header: `rgba(255,255,255,0.08)` → `rgba(255,255,255,0.2)`, 200ms

### Checkbox Toggle (Pending → Complete)
- **Circle fill**: accent color fills from center outward, 250ms
- **Scale bounce**: 1.0 → 0.85 → 1.15 → 1.0, 400ms spring
- **Checkmark draw**: stroke-dashoffset animation (SVG path draws in), 300ms, starts after fill completes
- Use `react-native-svg` + reanimated for the stroke animation

### Checkbox Toggle (Complete → Pending)
- Reverse fill: shrink to center, 200ms
- Checkmark fades out: opacity 1→0, 150ms

### Task Text on Complete
- `opacity`: 1.0 → 0.5, 200ms
- `textDecorationLine`: appears with fade (wrap in Animated.Text)
- `translateX`: subtle 0→2→0 nudge, 200ms

### Task Card Swipe (optional, nice-to-have)
- Swipe left: reveals red "Delete" action, spring snap
- Swipe right: reveals green "Complete" action

### Task Card Deletion
- `height` collapses to 0, `opacity` → 0, `scale` → 0.95, 300ms
- Cards below slide up to fill gap, 250ms spring

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
- `scale`: 0.98, `backgroundColor` shifts to light accent tint, 150ms
- On select: card `scale` 1.0→1.02→1.0 bounce, border becomes solid accent, other cards fade out (`opacity` → 0.3), 300ms

### Send Button
- **Disabled→Enabled**: `opacity` 0.35→1.0, `scale` 0.9→1.0, 200ms spring
- **Press**: `scale` 0.85, spring back, arrow icon `translateY` -3→0 (shoots up briefly)
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
- `scale`: 1.0→0.9 on press-in
- On press: rings STOP pulsing, button morphs to a rounded square (borderRadius 140→40), 300ms spring
- Color shift: gradient rotates (animate gradient positions or swap colors), 200ms
- Icon: mic icon crossfades to stop icon (square), 200ms

### Recording State
- Rings replaced by: solid ring that rotates 360deg continuously, 2000ms linear loop
- Timer text appears above button: `opacity` 0→1, `translateY` -8→0, 200ms
- Background glow intensifies: radial gradient opacity 0.12→0.25, 500ms

### Stop Recording
- Button morphs back to circle (borderRadius 40→140), 300ms spring
- Rings resume pulsing
- Icon: stop → mic crossfade, 200ms

### Write Input Expand
- On focus: input `height` expands 44→120, 250ms spring
- Keyboard-aware: entire bottom section slides up with keyboard

### Background Glow
- Slow breathing: radial gradient `opacity` 0.08→0.15→0.08, 4000ms loop, ease-in-out

---

## SETTINGS

### Toggle Switch
- Thumb `translateX`: 2→22 (on) or 22→2 (off), 200ms spring (damping: 15)
- Track color: `#E2E8F0` → `#10B981` crossfade, 200ms
- Haptic feedback: light impact on toggle

### Section Cards
- Staggered entry on screen load: `opacity` 0→1, `translateY` 8→0, 250ms, stagger 80ms

### Logout Button Press
- `backgroundColor` flashes to `rgba(239,68,68,0.1)`, 150ms, then back
- `scale`: 0.98 → 1.0, spring

### Calendar Row Selection
- Checkmark: `scale` 0→1.2→1.0, 300ms spring
- Row background: brief tint `rgba(16,185,129,0.05)`, 200ms fade in/out

### Notification Dot
- Subtle glow pulse: `shadowRadius` 4→8→4, `shadowOpacity` 0.2→0.5→0.2, 2000ms loop

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

// Example: Checkbox bounce
const toggleTask = () => {
  scale.value = withSequence(
    withTiming(0.85, { duration: 100 }),
    withSpring(1.15, { damping: 10 }),
    withSpring(1.0, { damping: 15 }),
  );
};
```

---

## Priority Order
1. Record pulse rings (hero interaction)
2. Chat message appear + thinking dots
3. Checkbox toggle bounce + stroke draw
4. Staggered card entry (notes + tasks)
5. FAB pulse + scroll show/hide
6. Logo float on login
7. Everything else
