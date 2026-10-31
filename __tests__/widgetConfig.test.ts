function loadConfig(extra: Record<string, unknown> | undefined) {
  jest.resetModules();
  jest.doMock("expo-constants", () => ({
    __esModule: true,
    default: { expoConfig: extra ? { extra } : null },
  }));
  return require("../src/config/widget");
}

describe("widget config", () => {
  it("uses the dev App Group for the dev variant", () => {
    expect(loadConfig({ appVariant: "dev" }).WIDGET_APP_GROUP).toBe(
      "group.com.iosifsagient.heylisa.dev",
    );
  });

  it("uses the prod App Group for the prod variant", () => {
    expect(loadConfig({ appVariant: "prod" }).WIDGET_APP_GROUP).toBe(
      "group.com.iosifsagient.heylisa",
    );
  });

  it("defaults to the prod App Group when the variant is missing", () => {
    expect(loadConfig(undefined).WIDGET_APP_GROUP).toBe(
      "group.com.iosifsagient.heylisa",
    );
  });

  it("matches the identifiers the Swift widget reads", () => {
    const config = loadConfig({ appVariant: "prod" });
    expect(config.WIDGET_KIND).toBe("TasksWidget");
    expect(config.WIDGET_SNAPSHOT_KEY).toBe("widgetSnapshot");
  });
});
