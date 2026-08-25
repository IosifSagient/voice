import * as React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { TagFilterSheet } from "../src/components/TagFilterSheet";
import type { TagChip } from "../src/types/tags";

const chips: TagChip[] = [
  { kind: "person", key: "papadopoulos", label: "Παπαδόπουλος" },
  { kind: "topic", key: "φόρος εισοδήματος", label: "φόρος εισοδήματος" },
];

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === "object" && node !== null && "children" in node) {
    return collectText((node as { children: unknown }).children);
  }
  return [];
}

function renderedText(renderer: ReactTestRenderer): string {
  return collectText(renderer.toJSON()).join(" | ");
}

function renderSheet(overrides: Partial<React.ComponentProps<typeof TagFilterSheet>> = {}) {
  const onSelect = overrides.onSelect ?? jest.fn();
  const onCancel = overrides.onCancel ?? jest.fn();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      React.createElement(TagFilterSheet, {
        visible: true,
        chips,
        activeChip: null,
        ...overrides,
        onSelect,
        onCancel,
      }),
    );
  });
  return { renderer, onSelect, onCancel };
}

describe("TagFilterSheet — sections and pinned row", () => {
  it("renders Όλα, both section headers, and every chip from a mixed array", () => {
    const { renderer } = renderSheet();
    const text = renderedText(renderer);
    expect(text).toContain("Όλα");
    expect(text).toContain("Άτομα");
    expect(text).toContain("Παπαδόπουλος");
    expect(text).toContain("Θέματα");
    expect(text).toContain("φόρος εισοδήματος");
  });

  it("renders nothing when not visible", () => {
    const { renderer } = renderSheet({ visible: false });
    expect(renderer.toJSON()).toBeNull();
  });
});

describe("TagFilterSheet — internal filter field", () => {
  it("narrows rows via toKey (accent/case-insensitive substring match)", () => {
    const { renderer } = renderSheet();
    act(() => {
      renderer.root.findByProps({ placeholder: "Φιλτράρισμα…" }).props.onChangeText("ΠΑΠΑΔΟ");
    });

    const text = renderedText(renderer);
    expect(text).toContain("Παπαδόπουλος");
    expect(text).not.toContain("φόρος εισοδήματος");
    // Θέματα has no rows left after filtering, so its header must not render.
    expect(text).not.toContain("Θέματα");
    // Όλα is pinned above both sections and is never subject to the filter.
    expect(text).toContain("Όλα");
  });
});

describe("TagFilterSheet — row selection", () => {
  it("Όλα invokes onSelect(null)", () => {
    const { renderer, onSelect } = renderSheet();
    act(() => {
      renderer.root.findByProps({ label: "Όλα" }).props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("a chip row invokes onSelect with that exact chip", () => {
    const { renderer, onSelect } = renderSheet();
    act(() => {
      renderer.root.findByProps({ label: "Παπαδόπουλος" }).props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith(chips[0]);
  });

  it("the backdrop calls onCancel, not onSelect", () => {
    const { renderer, onSelect, onCancel } = renderSheet();
    act(() => {
      renderer.root.findByProps({ testID: "tag-filter-sheet-backdrop" }).props.onPress();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
