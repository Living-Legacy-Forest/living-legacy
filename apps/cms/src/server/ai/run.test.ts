import { BRAND_RULES } from '@ll/content';
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AI_MODEL } from './fields';
import { type AiClient, SuggestError, runSuggestion } from './run';

const schema = z.object({ text: z.string() });

const reply = (text: string | null, stop_reason: string = 'end_turn') => ({
  parsed_output: text === null ? null : { text },
  stop_reason,
  usage: { input_tokens: 100, output_tokens: 20 },
});

function fakeClient(...replies: unknown[]) {
  const parse = vi.fn();
  for (const r of replies) {
    if (r instanceof Error) parse.mockRejectedValueOnce(r);
    else parse.mockResolvedValueOnce(r);
  }
  return { client: { messages: { parse } } as unknown as AiClient, parse };
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
    const { client, parse } = fakeClient(reply('A quiet walk among the trees.'));
    await expect(runSuggestion(client, request)).resolves.toEqual({
      text: 'A quiet walk among the trees.',
    });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('retries once, telling the model what was wrong, when the first reply breaks the guide', async () => {
    const { client, parse } = fakeClient(reply('Choose a plot today.'), reply('Choose a tree.'));
    await expect(runSuggestion(client, request)).resolves.toEqual({ text: 'Choose a tree.' });
    expect(parse).toHaveBeenCalledTimes(2);
    const messages = parse.mock.calls[1]![0].messages;
    const last = messages[messages.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toContain('Do not use "plot"');
  });

  it('gives up with a readable error after two replies that break the guide', async () => {
    const { client, parse } = fakeClient(reply('A plot for you.'), reply('Another plot.'));
    await expect(runSuggestion(client, request)).rejects.toThrow(
      "Couldn't write one that follows the brand guide. Try again or write it yourself."
    );
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('retries when the reply did not match the schema', async () => {
    const { client, parse } = fakeClient(reply(null), reply('A calm place to walk.'));
    await expect(runSuggestion(client, request)).resolves.toEqual({
      text: 'A calm place to walk.',
    });
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('does not retry a refusal', async () => {
    const { client, parse } = fakeClient(reply(null, 'refusal'));
    await expect(runSuggestion(client, request)).rejects.toThrow(
      "The writing assistant couldn't help with this one. Write it yourself."
    );
    expect(parse).toHaveBeenCalledTimes(1);
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
    const { client, parse } = fakeClient(reply('A calm place to walk.'));
    await runSuggestion(client, request);
    const sent = parse.mock.calls[0]![0];
    expect(sent.model).toBe(AI_MODEL);
    expect(sent.model).toBe('claude-haiku-5-5');
    expect(sent.max_tokens).toBe(1024);
    expect(sent.output_config.effort).toBe('low');
    expect(sent.output_config.format).toBeDefined();
    expect(sent.cache_control).toEqual({ type: 'ephemeral' });
    for (const key of ['temperature', 'top_p', 'top_k', 'thinking']) {
      expect(sent).not.toHaveProperty(key);
    }
  });

  it('puts the brand guide in the system prompt and never in the user message', async () => {
    const { client, parse } = fakeClient(reply('A calm place to walk.'));
    await runSuggestion(client, request);
    const sent = parse.mock.calls[0]![0];
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
});
