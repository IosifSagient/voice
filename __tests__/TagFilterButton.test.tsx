import * as React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { TagFilterButton } from "../src/components/TagFilterButton";
import type { TagChip } from "../src/types/tags";

// Reads the label Text directly by its own testID rather than walking the
// whole render tree — the funnel icon (Ionicons) renders its own Text node
// with a glyph string, and its presence/timing is font-load-dependent, so a
// tree-wide text collector is unreliable once an icon sits next to the label.
function labelText(renderer: ReactTestRenderer): string {
  return renderer.root.findByProps({ testID: "tag-filter-button-label" }).props
    .children as string;
}

function renderButton(overrides: Partial<React.ComponentProps<typeof TagFilterButton>> = {}) {
  const onPress = overrides.onPress ?? jest.fn();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      React.createElement(TagFilterButton, { activeChip: null, ...overrides, onPress }),
    );
  });
  return { renderer, onPress };
}

describe("TagFilterButton", () => {
  it('shows "Φίλτρα" when no filter is active', () => {
    const { renderer } = renderButton({ activeChip: null });
    expect(labelText(renderer)).toBe("Φίλτρα");
  });

  it("shows the active chip's label when a filter is active", () => {
    const chip: TagChip = { kind: "person", key: "papadopoulos", label: "Παπαδόπουλος" };
    const { renderer } = renderButton({ activeChip: chip });
    expect(labelText(renderer)).toBe("Παπαδόπουλος");
  });

  it("calls onPress when tapped", () => {
    const { renderer, onPress } = renderButton();
    act(() => {
      renderer.root.findByProps({ testID: "tag-filter-button" }).props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("TagFilterButton — funnel icon", () => {
  it("renders the outline funnel when no filter is active", () => {
    const { renderer } = renderButton({ activeChip: null });
    expect(renderer.root.findByProps({ testID: "tag-filter-button-icon" }).props.name).toBe(
      "funnel-outline",
    );
  });

  it("renders the filled funnel when a filter is active", () => {
    const chip: TagChip = { kind: "topic", key: "φόρος", label: "φόρος" };
    const { renderer } = renderButton({ activeChip: chip });
    expect(renderer.root.findByProps({ testID: "tag-filter-button-icon" }).props.name).toBe(
      "funnel",
    );
  });
});
