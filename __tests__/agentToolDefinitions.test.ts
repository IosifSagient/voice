jest.mock('../src/services/openaiClient', () => ({
  openaiPost: jest.fn(),
}));

import { openaiPost } from '../src/services/openaiClient';
import { runAgent } from '../src/services/agent';

function stubReply() {
  return {
    choices: [{ message: { role: 'assistant', content: 'stub answer' }, finish_reason: 'stop' }],
  };
}

describe('agent TOOL_DEFINITIONS — search_notes_in_range', () => {
  it('is registered with terms/from/to, all required', async () => {
    (openaiPost as jest.Mock).mockResolvedValue(stubReply());
    await runAgent('ping');

    const { tools } = (openaiPost as jest.Mock).mock.calls[0][1] as { tools: any[] };
    const tool = tools.find((t) => t.function.name === 'search_notes_in_range');

    expect(tool).toBeDefined();
    expect(tool.function.parameters.required).toEqual(['terms', 'from', 'to']);
    expect(tool.function.parameters.properties.terms).toMatchObject({
      type: 'array',
      minItems: 1,
      maxItems: 4,
    });
    expect(tool.function.parameters.properties.from.type).toBe('string');
    expect(tool.function.parameters.properties.to.type).toBe('string');
  });

  it('sits between search_notes and get_notes_by_date_range', async () => {
    (openaiPost as jest.Mock).mockResolvedValue(stubReply());
    await runAgent('ping');

    const { tools } = (openaiPost as jest.Mock).mock.calls[0][1] as { tools: any[] };
    const names = tools.map((t) => t.function.name);
    expect(names.indexOf('search_notes')).toBeLessThan(names.indexOf('search_notes_in_range'));
    expect(names.indexOf('search_notes_in_range')).toBeLessThan(names.indexOf('get_notes_by_date_range'));
  });
});
