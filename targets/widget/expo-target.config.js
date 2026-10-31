const fs = require("fs");
const path = require("path");

const APP_GROUP_KEY = "com.apple.security.application-groups";

const plistString = (key, value) =>
  `  <key>${key}</key>\n  <string>${value}</string>`;

// The plugin has no Info.plist option, but it points INFOPLIST_FILE at this
// directory's Info.plist and only creates one if it's missing. So the variant's
// values are written here, read from the resolved main config (app.config.js's
// IS_DEV stays the single source) — Swift reads them back, with nothing
// variant-specific in the Swift itself. Generated on every config evaluation,
// including on EAS, so the file is gitignored.
function writeInfoPlist(appGroup, scheme) {
  const contents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
${plistString("AskLisaAppGroup", appGroup)}
${plistString("AskLisaURLScheme", scheme)}
</dict>
</plist>
`;
  fs.writeFileSync(path.join(__dirname, "Info.plist"), contents);
}

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => {
  const [appGroup] = config.ios.entitlements[APP_GROUP_KEY];
  writeInfoPlist(appGroup, config.scheme);

  return {
    type: "widget",
    name: "TasksWidget",
    bundleIdentifier: ".widget",
    deploymentTarget: "16.0",
    // Empty on purpose: the plugin only mirrors the main app's App Group into
    // the target when this key is present. It writes generated.entitlements.
    entitlements: {},
  };
};
