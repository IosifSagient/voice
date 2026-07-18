import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { ClarificationChips } from '../src/components/ClarificationChips';
import { colors } from '../src/config/theme';
import type { LiteralMatchCandidate } from '../src/types/agent';

function mkCandidate(overrides: Partial<LiteralMatchCandidate> = {}): LiteralMatchCandidate {
  return {
    noteId: 'n1',
    date: '2026-01-01',
    summary: 'κάτι σχετικό',
    field: 'transcript',
    snippet: 'abcHITxyz',
    matchOffset: 3,
    matchLength: 3,
    confidence: 'whole_word',
    ...overrides,
  };
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce((acc: Record<string, unknown>, s) => ({ ...acc, ...flattenStyle(s) }), {});
  }
  return style && typeof style === 'object' ? (style as Record<string, unknown>) : {};
}

function resolveStyle(styleProp: unknown): Record<string, unknown> {
  return flattenStyle(typeof styleProp === 'function' ? (styleProp as (s: { pressed: boolean }) => unknown)({ pressed: false }) : styleProp);
}

function renderChips(
  candidates: LiteralMatchCandidate[],
  handlers: Partial<{ onSelect: jest.Mock; onNone: jest.Mock; onRetry: jest.Mock }> = {},
) {
  const onSelect = handlers.onSelect ?? jest.fn();
  const onNone = handlers.onNone ?? jest.fn();
  const onRetry = handlers.onRetry ?? jest.fn();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(ClarificationChips, { candidates, onSelect, onNone, onRetry }));
  });
  return { renderer, onSelect, onNone, onRetry };
}

describe('ClarificationChips — highlight segmentation', () => {
  it('splits the snippet into separate before/highlight/after text runs at matchOffset/matchLength', () => {
    const { renderer } = renderChips([mkCandidate({ snippet: 'abcHITxyz', matchOffset: 3, matchLength: 3 })]);

    const card = renderer.root.findByProps({ testID: 'clarification-candidate-n1' });
    const texts = card.findAllByType(Text);

    // The highlighted span is its own Text node containing exactly the
    // matched substring — proves the split happens at matchOffset/matchLength,
    // not just that the full snippet text is present somewhere.
    const highlightNode = texts.find((t: any) => t.props.children === 'HIT');
    expect(highlightNode).toBeDefined();

    // The surrounding text is NOT bundled into the highlighted run.
    expect(texts.some((t: any) => t.props.children === 'abcHITxyz')).toBe(false);
  });

  it('keeps the highlighted run visually distinct (accent color) from the rest of the snippet', () => {
    const { renderer } = renderChips([mkCandidate({ snippet: 'abcHITxyz', matchOffset: 3, matchLength: 3 })]);
    const card = renderer.root.findByProps({ testID: 'clarification-candidate-n1' });
    const highlightNode = card.findAllByType(Text).find((t: any) => t.props.children === 'HIT')!;

    expect(resolveStyle(highlightNode.props.style).color).toBe(colors.accent);
  });
});

describe('ClarificationChips — confidence emphasis', () => {
  it('gives the first (strongest) candidate full emphasis and dims every candidate after it', () => {
    const { renderer } = renderChips([
      mkCandidate({ noteId: 'n1', confidence: 'whole_word' }),
      mkCandidate({ noteId: 'n2', confidence: 'word_prefix' }),
      mkCandidate({ noteId: 'n3', confidence: 'mid_word' }),
    ]);

    const first = resolveStyle(renderer.root.findByProps({ testID: 'clarification-candidate-n1' }).props.style);
    const second = resolveStyle(renderer.root.findByProps({ testID: 'clarification-candidate-n2' }).props.style);
    const third = resolveStyle(renderer.root.findByProps({ testID: 'clarification-candidate-n3' }).props.style);

    expect(first.opacity).toBeUndefined();
    expect(first.borderColor).toBe(colors.accent);

    expect(second.opacity).toBe(0.6);
    expect(second.borderColor).toBe(colors.borderFaint);
    expect(third.opacity).toBe(0.6);
    expect(third.borderColor).toBe(colors.borderFaint);
  });
});

describe('ClarificationChips — actions', () => {
  it('calls onSelect with the tapped candidate', () => {
    const candidate = mkCandidate({ noteId: 'n1' });
    const { renderer, onSelect } = renderChips([candidate]);

    act(() => {
      renderer.root.findByProps({ testID: 'clarification-candidate-n1' }).props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith(candidate);
  });

  it('calls onNone from the "Κανένα από αυτά" action', () => {
    const { renderer, onNone } = renderChips([mkCandidate()]);

    act(() => {
      renderer.root.findByProps({ testID: 'clarification-none' }).props.onPress();
    });

    expect(onNone).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry from the "Δοκίμασε αλλιώς" action', () => {
    const { renderer, onRetry } = renderChips([mkCandidate()]);

    act(() => {
      renderer.root.findByProps({ testID: 'clarification-retry' }).props.onPress();
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
