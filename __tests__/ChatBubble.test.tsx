import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { ChatBubble } from '../src/components/ChatBubble';

function renderBubble(role: 'user' | 'assistant', content: string, onLongPress?: (text: string) => void) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(ChatBubble, { role, content, onLongPress }));
  });
  return renderer;
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce((acc: Record<string, unknown>, s) => ({ ...acc, ...flattenStyle(s) }), {});
  }
  return style && typeof style === 'object' ? (style as Record<string, unknown>) : {};
}

// Every rendered Text node's own (string) children, concatenated — used to
// assert on the fully-rendered output regardless of how markdown-display
// splits a message across nested Text/textgroup/paragraph nodes.
function renderedText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAllByType(Text)
    .map((t: any) => (typeof t.props.children === 'string' ? t.props.children : ''))
    .join('');
}

describe('ChatBubble', () => {
  it('renders a user message', () => {
    const renderer = renderBubble('user', 'Γεια σου');
    const texts = renderer.root.findAllByType(Text);
    expect(texts.some((t: any) => t.props.children === 'Γεια σου')).toBe(true);
  });

  it('renders an assistant message', () => {
    const renderer = renderBubble('assistant', 'Πώς μπορώ να βοηθήσω;');
    const texts = renderer.root.findAllByType(Text);
    expect(texts.some((t: any) => t.props.children === 'Πώς μπορώ να βοηθήσω;')).toBe(true);
  });

  it('long-press invokes onLongPress with the user message content', () => {
    const onLongPress = jest.fn();
    const renderer = renderBubble('user', 'Γεια σου', onLongPress);

    act(() => {
      renderer.root.findByProps({ testID: 'chat-bubble-pressable' }).props.onLongPress();
    });

    expect(onLongPress).toHaveBeenCalledWith('Γεια σου');
  });

  it('long-press invokes onLongPress with the assistant message content', () => {
    const onLongPress = jest.fn();
    const renderer = renderBubble('assistant', 'Πώς μπορώ να βοηθήσω;', onLongPress);

    act(() => {
      renderer.root.findByProps({ testID: 'chat-bubble-pressable' }).props.onLongPress();
    });

    expect(onLongPress).toHaveBeenCalledWith('Πώς μπορώ να βοηθήσω;');
  });

  it('renders assistant **bold**/- list markdown as formatted output, with no literal ** or leading -', () => {
    // Real block-level list syntax (marker at the start of its own line) —
    // "- a - b" inline on one line is not list syntax under CommonMark and
    // would just render as literal dashes, which is not what this asserts.
    const renderer = renderBubble('assistant', '**Άννα** mentioned:\n- γάλα\n- ψωμί');

    const all = renderedText(renderer);
    expect(all).not.toContain('**');
    expect(all).not.toMatch(/^-\s|\n-\s/);
    expect(all).toContain('Άννα');
    expect(all).toContain('γάλα');
    expect(all).toContain('ψωμί');
  });

  it('renders assistant bold text with the named-weight font family and no fontWeight override', () => {
    const renderer = renderBubble('assistant', '**Άννα**');
    const boldNode = renderer.root.findAllByType(Text).find((t: any) => t.props.children === 'Άννα');
    expect(boldNode).toBeTruthy();

    const style = flattenStyle(boldNode!.props.style);
    expect(style.fontFamily).toBe('Inter_600SemiBold');
    expect(style.fontWeight).toBeUndefined();
  });

  it('does not parse markdown in a user message — literal * and ** stay literal', () => {
    const renderer = renderBubble('user', 'buy milk * bread **now**');
    const texts = renderer.root.findAllByType(Text);
    expect(texts.some((t: any) => t.props.children === 'buy milk * bread **now**')).toBe(true);
  });
});
