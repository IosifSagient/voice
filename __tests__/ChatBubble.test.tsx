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
});
