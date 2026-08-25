import * as React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import Animated from "react-native-reanimated";
import { FilterChip } from "../src/components/FilterChip";
import { colors } from "../src/config/theme";

const mockUseReducedMotionPreference = jest.fn(() => false);
jest.mock("../src/lib/useReducedMotionPreference", () => ({
  useReducedMotionPreference: () => mockUseReducedMotionPreference(),
}));

jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return { __esModule: true, ...actual, withTiming: jest.fn(actual.withTiming) };
});

// interpolateColor always re-serializes to "rgba(r, g, b, a)", regardless of
// whether the input token was hex or rgba() — so assertions compare parsed
// components, not raw token strings. RGB proves the right variant's palette
// was picked; alpha proves unselected (tint) vs selected (solid) state,
// since a variant's faint/solid tokens share the same RGB and differ only
// in alpha.
function parseRgba(value: string): { r: number; g: number; b: number; a: number } {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) throw new Error(`Not an rgba() color: ${value}`);
  const [r, g, b, a] = match[1].split(",").map((n) => parseFloat(n.trim()));
  return { r, g, b, a: a ?? 1 };
}

function getAnimatedBackgroundColor(component: ReturnType<ReactTestRenderer["root"]["findAllByType"]>[number]): string {
  const style = component.props.style as unknown[];
  const animated = style.find(
    (s): s is { initial: { value: { backgroundColor: string } } } =>
      !!s && typeof s === "object" && "initial" in s
  );
  if (!animated) throw new Error("No animated style found");
  return animated.initial.value.backgroundColor;
}

function renderChip(props: Partial<React.ComponentProps<typeof FilterChip>> = {}) {
  const onPress = props.onPress ?? jest.fn();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      React.createElement(FilterChip, {
        label: "Γιάννης",
        variant: "person",
        selected: false,
        ...props,
        onPress,
      })
    );
  });
  return { renderer, onPress };
}

beforeEach(() => {
  mockUseReducedMotionPreference.mockReturnValue(false);
  (require("react-native-reanimated").withTiming as jest.Mock).mockClear();
});

describe("FilterChip — person variant", () => {
  it("picks the green tint fill when unselected", () => {
    const { renderer } = renderChip({ variant: "person", selected: false });
    const pill = renderer.root.findByProps({ testID: "filter-chip-person" }).findAllByType(Animated.View)[0];
    const { r, g, b, a } = parseRgba(getAnimatedBackgroundColor(pill));
    expect({ r, g, b }).toEqual({ r: 16, g: 185, b: 129 });
    expect(a).toBeCloseTo(0.05, 1);
  });

  it("picks the solid green fill when selected", () => {
    const { renderer } = renderChip({ variant: "person", selected: true });
    const pill = renderer.root.findByProps({ testID: "filter-chip-person" }).findAllByType(Animated.View)[0];
    const { r, g, b, a } = parseRgba(getAnimatedBackgroundColor(pill));
    expect({ r, g, b }).toEqual({ r: 16, g: 185, b: 129 });
    expect(a).toBeCloseTo(1, 1);
  });
});

describe("FilterChip — topic variant", () => {
  it("picks the terracotta tint fill when unselected", () => {
    const { renderer } = renderChip({ variant: "topic", selected: false });
    const pill = renderer.root.findByProps({ testID: "filter-chip-topic" }).findAllByType(Animated.View)[0];
    const { r, g, b, a } = parseRgba(getAnimatedBackgroundColor(pill));
    expect({ r, g, b }).toEqual({ r: 224, g: 122, b: 95 });
    expect(a).toBeCloseTo(0.12, 1);
  });

  it("picks the solid terracotta fill when selected", () => {
    const { renderer } = renderChip({ variant: "topic", selected: true });
    const pill = renderer.root.findByProps({ testID: "filter-chip-topic" }).findAllByType(Animated.View)[0];
    const { r, g, b, a } = parseRgba(getAnimatedBackgroundColor(pill));
    expect({ r, g, b }).toEqual({ r: 224, g: 122, b: 95 });
    expect(a).toBeCloseTo(1, 1);
  });
});

describe("FilterChip — tap", () => {
  it("calls onPress when tapped", () => {
    const { renderer, onPress } = renderChip();
    act(() => {
      renderer.root.findByProps({ testID: "filter-chip-person" }).props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("FilterChip — reduced motion", () => {
  it("animates the fill with withTiming when reduced motion is off", () => {
    mockUseReducedMotionPreference.mockReturnValue(false);
    const { renderer } = renderChip({ selected: false });
    act(() => {
      renderer.update(
        React.createElement(FilterChip, {
          label: "Γιάννης",
          variant: "person",
          selected: true,
          onPress: jest.fn(),
        })
      );
    });
    expect(require("react-native-reanimated").withTiming).toHaveBeenCalled();
  });

  it("snaps the fill instantly, with no withTiming call, when reduced motion is on", () => {
    mockUseReducedMotionPreference.mockReturnValue(true);
    const { renderer } = renderChip({ selected: false });
    act(() => {
      renderer.update(
        React.createElement(FilterChip, {
          label: "Γιάννης",
          variant: "person",
          selected: true,
          onPress: jest.fn(),
        })
      );
    });
    expect(require("react-native-reanimated").withTiming).not.toHaveBeenCalled();
  });
});
