import { useReducedMotion } from "react-native-reanimated";

// Thin re-export of Reanimated's OS-level reduced-motion preference, kept
// under lib/ (not hooks/) so presentational components can read it directly
// — components may import lib but never hooks (AGENTS.md layer rule).
// Callers: disable infinite loops (pulse rings, glows) and fall back
// entering animations to a plain fade when this is true.
export function useReducedMotionPreference(): boolean {
  return useReducedMotion();
}
