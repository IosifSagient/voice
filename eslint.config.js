const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

// LOCKED font rule (see theme.ts type.* and AGENTS.md): only named-weight
// Inter_*/Literata_* font files are loaded, so a numeric fontWeight forces
// RN to synthesize a wrong-looking weight on Android instead of picking the
// loaded file. Weight must always come from choosing the right fontFamily.
module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Property[key.name='fontWeight']",
          message:
            "No fontWeight — use a named-weight Inter_/Literata_ family (theme.ts). Numeric weight faux-synthesizes on Android.",
        },
      ],
      // This is the first ESLint config this repo has had. eslint-config-expo's
      // default set includes newer React Compiler-style rules that flag
      // pre-existing, unrelated patterns written before any lint gate existed:
      // - set-state-in-effect fires on the routine "load data in useEffect"
      //   shape used throughout src/hooks/ (useTasks, useRecorder, etc.).
      // - immutability false-positives on Reanimated's `sharedValue.value = …`
      //   idiom (ChatScreen.tsx and others assign to shared values by design).
      // Turned off here rather than mass-editing unrelated files as a side
      // effect of adding the fontWeight guard; revisit as its own cleanup.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
]);
