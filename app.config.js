const IS_DEV = process.env.APP_VARIANT === "development";

export default {
  expo: {
    name: IS_DEV ? "Ask Lisa Dev" : "Ask Lisa",
    slug: "heylisa",
    version: "1.0.0",
    scheme: IS_DEV ? "asklisa-dev" : "asklisa",
    orientation: "portrait",
    icon: "./assets/branding/icon.png",
    userInterfaceStyle: "light",

    ios: {
      supportsTablet: true,
      appleTeamId: "T58M6DT8J5",

      // Dev and TestFlight are now separate iOS apps.
      bundleIdentifier: IS_DEV
        ? "com.iosifsagient.heylisa.dev"
        : "com.iosifsagient.heylisa",

      associatedDomains: ["applinks:iosifsagient.github.io"],

      // Shared with the widget target (targets/widget), which inherits it.
      entitlements: {
        "com.apple.security.application-groups": [
          IS_DEV
            ? "group.com.iosifsagient.heylisa.dev"
            : "group.com.iosifsagient.heylisa",
        ],
      },

      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.READ_CALENDAR",
        "android.permission.WRITE_CALENDAR",
      ],
    },

    web: {
      favicon: "./assets/favicon.png",
    },

    plugins: [
      [
        "expo-audio",
        {
          microphonePermission:
            "Allow VoiceNote to access your microphone to record voice notes.",
        },
      ],
      "expo-sqlite",
      [
        "expo-calendar",
        {
          calendarPermission:
            "Το VoiceNote χρειάζεται πρόσβαση στο ημερολόγιό σας για να προσθέτει υπενθυμίσεις από τις ενέργειές σας.",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/branding/splash-icon.png",
          imageWidth: 180,
          backgroundColor: "#14141B",
        },
      ],
      "expo-secure-store",
      "expo-font",
      "expo-asset",
      "expo-notifications",
      "@bacons/apple-targets",
    ],

    extra: {
      // Runtime-readable mirror of the build-time IS_DEV flag above (same
      // APP_VARIANT source, not a second source of truth) — src/config/shareLink.ts
      // reads this via expo-constants to pick the dev vs. prod share-link prefix,
      // since app.config.js itself only runs at build/config time, not in the app bundle.
      appVariant: IS_DEV ? "dev" : "prod",
      eas: {
        projectId: "58f32cb5-f98c-42a9-bcdc-720df30af0fa",
      },
    },
  },
};
