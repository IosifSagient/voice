const mockSet = jest.fn();
const mockReloadWidget = jest.fn();
const mockConstructed: string[] = [];

function loadBridge(storageFactory: () => unknown) {
  jest.resetModules();
  jest.doMock("@bacons/apple-targets", storageFactory);
  return require("../src/lib/widgetBridge");
}

function workingStorage() {
  return {
    ExtensionStorage: class {
      static reloadWidget = mockReloadWidget;
      constructor(group: string) {
        mockConstructed.push(group);
      }
      set = mockSet;
    },
  };
}

describe("widgetBridge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConstructed.length = 0;
  });

  it("writes the JSON string to the snapshot key in the variant's App Group", () => {
    const { WIDGET_APP_GROUP } = require("../src/config/widget");
    loadBridge(workingStorage).writeSnapshotString('{"version":1}');

    expect(mockConstructed).toEqual([WIDGET_APP_GROUP]);
    expect(mockSet).toHaveBeenCalledWith("widgetSnapshot", '{"version":1}');
  });

  it("reloads the TasksWidget kind", () => {
    loadBridge(workingStorage).reloadTasksWidget();
    expect(mockReloadWidget).toHaveBeenCalledWith("TasksWidget");
  });

  it("no-ops when the package can't load", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const bridge = loadBridge(() => {
      throw new ReferenceError("expo is not defined");
    });

    expect(() => bridge.writeSnapshotString("{}")).not.toThrow();
    expect(() => bridge.reloadTasksWidget()).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("logs and swallows a native failure", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const boom = new Error("native boom");
    const bridge = loadBridge(() => ({
      ExtensionStorage: class {
        static reloadWidget() {
          throw boom;
        }
        set() {
          throw boom;
        }
      },
    }));

    expect(() => bridge.writeSnapshotString("{}")).not.toThrow();
    expect(() => bridge.reloadTasksWidget()).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      "[widgetBridge:writeSnapshotString] write failed",
      boom,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "[widgetBridge:reloadTasksWidget] reload failed",
      boom,
    );
    errorSpy.mockRestore();
  });

  it("doesn't throw against the real package with no native module", () => {
    jest.resetModules();
    jest.dontMock("@bacons/apple-targets");
    const bridge = require("../src/lib/widgetBridge");

    expect(() => bridge.writeSnapshotString("{}")).not.toThrow();
    expect(() => bridge.reloadTasksWidget()).not.toThrow();
  });
});
