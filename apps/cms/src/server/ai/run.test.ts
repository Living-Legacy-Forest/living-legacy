import { BRAND_RULES } from '@ll/content';
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AI_MODEL } from './fields';
import { type AiClient, SuggestError, runSuggestion } from './run';

const schema = z.object({ text: z.string() });

/** A reply as the API sends it: the JSON as text, which the code parses itself. */
const raw = (text: string, stop_reason: string = 'end_turn') => ({
  content: [{ type: 'text', text }],
  stop_reason,
  usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0 },
});
const reply = (text: string, stop_reason?: string) => raw(JSON.stringify({ text }), stop_reason);

function fakeClient(...replies: unknown[]) {
  const create = vi.fn();
  for (const r of replies) {
    if (r instanceof Error) create.mockRejectedValueOnce(r);
    else create.mockResolvedValueOnce(r);
  }
  return { client: { messages: { create } } as unknown as AiClient, create };
}

const request = {
  field: 'seoDescription' as const,
  brandGuide: 'THE GUIDE',
  rules: BRAND_RULES,
  content: [{ type: 'text' as const, text: 'Post about a walk.' }],
  schema,
  texts: (out: z.infer<typeof schema>) => [out.text],
};

describe('runSuggestion', () => {
  it('returns the parsed reply when it passes the guard first time', async () => {
    const { client, create } = fakeClient(reply('A quiet walk among the trees.'));
    await expect(runSuggestion(client, request)).resolves.toEqual({
      text: 'A quiet walk among the trees.',
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('retries once, telling the model what was wrong, when the first reply breaks the guide', async () => {
    const { client, create } = fakeClient(reply('Choose a plot today.'), reply('Choose a tree.'));
    await expect(runSuggestion(client, request)).resolves.toEqual({ text: 'Choose a tree.' });
    expect(create).toHaveBeenCalledTimes(2);
    const messages = create.mock.calls[1]![0].messages;
    const last = messages[messages.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toContain('Do not use "plot"');
  });

  it('gives up with a readable error after two replies that break the guide', async () => {
    const { client, create } = fakeClient(reply('A plot for you.'), reply('Another plot.'));
    await expect(runSuggestion(client, request)).rejects.toThrow(
      "Couldn't write one that follows the brand guide. Try again or write it yourself."
    );
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('retries when the reply did not match the schema', async () => {
    const { client, create } = fakeClient(raw('{"words":"x"}'), reply('A calm place to walk.'));
    await expect(runSuggestion(client, request)).resolves.toEqual({
      text: 'A calm place to walk.',
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not retry a refusal', async () => {
    const { client, create } = fakeClient(raw('', 'refusal'));
    await expect(runSuggestion(client, request)).rejects.toThrow(
      "The writing assistant couldn't help with this one. Write it yourself."
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('says the assistant is busy on a rate limit', async () => {
    const limited = new Anthropic.RateLimitError(
      429,
      { type: 'error', error: { type: 'rate_limit_error', message: 'secret provider text' } },
      'secret provider text',
      new Headers()
    );
    const { client } = fakeClient(limited);
    const error = await runSuggestion(client, request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SuggestError);
    expect((error as Error).message).toBe('The writing assistant is busy. Try again in a moment.');
  });

  it('says the assistant is not answering on any other API failure, without the provider text', async () => {
    const down = new Anthropic.InternalServerError(
      500,
      { type: 'error', error: { type: 'api_error', message: 'secret provider text' } },
      'secret provider text',
      new Headers()
    );
    const { client } = fakeClient(down);
    const error = await runSuggestion(client, request).catch((e: unknown) => e);
    expect((error as Error).message).toBe("The writing assistant isn't answering. Try again soon.");
  });

  it('sends the model, a small token cap, low effort and no sampling or thinking settings', async () => {
    const { client, create } = fakeClient(reply('A calm place to walk.'));
    await runSuggestion(client, request);
    const sent = create.mock.calls[0]![0];
    expect(sent.model).toBe(AI_MODEL);
    expect(sent.model).toBe('claude-haiku-5-5');
    expect(sent.max_tokens).toBe(2048);
    expect(sent.output_config.effort).toBe('low');
    expect(sent.output_config.format).toBeDefined();
    expect(sent.output_config.format.type).toBe('json_schema');
    for (const key of ['temperature', 'top_p', 'top_k', 'thinking']) {
      expect(sent).not.toHaveProperty(key);
    }
  });

  it('puts the brand guide in the system prompt and never in the user message', async () => {
    const { client, create } = fakeClient(reply('A calm place to walk.'));
    await runSuggestion(client, request);
    const sent = create.mock.calls[0]![0];
    expect(JSON.stringify(sent.system)).toContain('THE GUIDE');
    expect(JSON.stringify(sent.messages)).not.toContain('THE GUIDE');
  });

  it('uses a limit it is given instead of the field default', async () => {
    const long = 'a'.repeat(300);
    const { client } = fakeClient(reply(long));
    await expect(runSuggestion(client, { ...request, limit: 2000 })).resolves.toEqual({
      text: long,
    });
  });

  it('logs the outcome without any of the content', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { client } = fakeClient(reply('A quiet walk among the trees.'));
    await runSuggestion(client, request);
    const [line] = info.mock.calls[0] as [string];
    expect(JSON.parse(line)).toMatchObject({ field: 'seoDescription', outcome: 'ok' });
    expect(line).not.toContain('quiet walk');
    expect(line).not.toContain('Post about a walk');
    info.mockRestore();
  });
  it('retries a reply that is not valid JSON', async () => {
    const { client, create } = fakeClient(raw('The summary is'), reply('A calm place to walk.'));
    await expect(runSuggestion(client, request)).resolves.toEqual({
      text: 'A calm place to walk.',
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('retries a reply cut off at the token limit', async () => {
    const { client, create } = fakeClient(
      raw('{"text":"A calm', 'max_tokens'),
      reply('A calm place to walk.')
    );
    await expect(runSuggestion(client, request)).resolves.toEqual({
      text: 'A calm place to walk.',
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('treats a refusal that carries some text as a refusal', async () => {
    const { client, create } = fakeClient(raw('{"text":"Sure', 'refusal'));
    await expect(runSuggestion(client, request)).rejects.toThrow(
      "The writing assistant couldn't help with this one. Write it yourself."
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('never shows the text of an unexpected error', async () => {
    const failed = new Anthropic.AnthropicError('Failed to parse: "The summar" is not valid JSON');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = fakeClient(failed);
    const thrown = await runSuggestion(client, request).catch((e: unknown) => e);
    expect((thrown as Error).message).toBe(
      "The writing assistant isn't answering. Try again soon."
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain('The summar');
    error.mockRestore();
  });

  it('caches the brand guide, not the post, so the guide is reused across posts', async () => {
    const { client, create } = fakeClient(reply('A calm place to walk.'));
    await runSuggestion(client, request);
    const sent = create.mock.calls[0]![0];
    expect(sent).not.toHaveProperty('cache_control');
    expect(sent.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(sent.system[0].text).toContain('THE GUIDE');
    expect(JSON.stringify(sent.messages)).not.toContain('cache_control');
  });

  it('logs cache use alongside the token counts', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { client } = fakeClient({
      ...reply('A quiet walk among the trees.'),
      usage: { input_tokens: 300, output_tokens: 20, cache_read_input_tokens: 2700 },
    });
    await runSuggestion(client, request);
    const [line] = info.mock.calls[0] as [string];
    expect(JSON.parse(line)).toMatchObject({ input_tokens: 300, cache_read_input_tokens: 2700 });
    info.mockRestore();
  });
});
