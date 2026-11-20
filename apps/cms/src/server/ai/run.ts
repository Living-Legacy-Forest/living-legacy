import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { BrandRule } from '@ll/content';
import type { z } from 'zod';
import { AI_MODEL, FIELD_SPECS, type SuggestField, systemPrompt } from './fields';
import { guardProblems } from './guard';

/** The part of the SDK client this needs, so tests can hand in a fake. */
export type AiClient = Pick<Anthropic, 'messages'>;

/** An error whose message is a sentence an editor can read; shown as a toast as it is. */
export class SuggestError extends Error {
  override name = 'SuggestError';
}

const GUARD_FAILED =
  "Couldn't write one that follows the brand guide. Try again or write it yourself.";
const REFUSED = "The writing assistant couldn't help with this one. Write it yourself.";
const BUSY = 'The writing assistant is busy. Try again in a moment.';
const DOWN = "The writing assistant isn't answering. Try again soon.";

type Outcome = 'ok' | 'retried' | 'guard_failed' | 'refused' | 'error';

export type SuggestRequest<T extends z.ZodType> = {
  field: SuggestField;
  brandGuide: string;
  rules: readonly BrandRule[];
  /** The item's own text or image, nothing else. */
  content: Anthropic.ContentBlockParam[];
  schema: T;
  /** Every string in the reply that has to pass the guard. */
  texts: (out: z.infer<T>) => string[];
  /** For tags: the only names the reply may contain. */
  allowed?: readonly string[];
  /** Overrides the field's own limit (a brand fix is as long as the sentence it replaces). */
  limit?: number;
};

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
};

/**
 * Asks the model for one suggestion and holds it to the brand guide. A reply that is malformed or
 * breaks the guide gets one more go, told exactly what was wrong; after that it is an error, and
 * the text is never returned.
 */
export async function runSuggestion<T extends z.ZodType>(
  client: AiClient,
  req: SuggestRequest<T>
): Promise<z.infer<T>> {
  const limit = req.limit ?? FIELD_SPECS[req.field].limit;
  const usage: Usage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };
  // One usage line per call, so spend is visible in Workers Logs. Field, model, token counts and
  // outcome only: never the post, the image or the suggestion.
  const log = (outcome: Outcome) =>
    // eslint-disable-next-line no-console -- the only info-level line; it carries no content
    console.info(
      JSON.stringify({ event: 'ai_suggest', field: req.field, model: AI_MODEL, ...usage, outcome })
    );

  let feedback: string | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: req.content }];
    if (feedback) messages.push({ role: 'user', content: feedback });

    let response;
    try {
      // `create`, not `parse`: the SDK's parser throws its own error on malformed JSON (with a piece
      // of the reply in it) before the stop reason can be read. Reading the reply here lets a
      // refusal be a refusal, and a malformed or cut-off reply get its one more go.
      response = await client.messages.create({
        model: AI_MODEL,
        // A ceiling, not a charge: only what is written is paid for. Thinking counts towards it,
        // so it leaves room rather than cutting a reply off and paying for a second call.
        max_tokens: 2048,
        system: systemPrompt(req.brandGuide, req.field),
        messages,
        output_config: { effort: 'low', format: zodOutputFormat(req.schema) },
      });
    } catch (error) {
      log('error');
      throw toSuggestError(error);
    }
    usage.input_tokens += response.usage.input_tokens;
    usage.output_tokens += response.usage.output_tokens;
    usage.cache_read_input_tokens += response.usage.cache_read_input_tokens ?? 0;
    usage.cache_creation_input_tokens += response.usage.cache_creation_input_tokens ?? 0;

    if (response.stop_reason === 'refusal') {
      log('refused');
      throw new SuggestError(REFUSED);
    }

    const out = response.stop_reason === 'max_tokens' ? null : readReply(response, req.schema);
    const problems = out
      ? req
          .texts(out)
          .flatMap((text) => guardProblems(text, { limit, rules: req.rules, allowed: req.allowed }))
      : ['The reply was not in the required format.'];
    if (out && problems.length === 0) {
      log(attempt === 0 ? 'ok' : 'retried');
      return out;
    }
    feedback = `That reply cannot be used:\n- ${problems.join('\n- ')}\nWrite it again, fixing every problem.`;
  }
  log('guard_failed');
  throw new SuggestError(GUARD_FAILED);
}

/** The reply's JSON, checked against the schema; null when it is missing, malformed or the wrong shape. */
function readReply<T extends z.ZodType>(response: Anthropic.Message, schema: T): z.infer<T> | null {
  const text = response.content.find((block) => block.type === 'text')?.text;
  if (!text) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Never carries the provider's own message, which can echo what was sent or what came back. What
 * went wrong is logged by kind and status only.
 */
function toSuggestError(error: unknown): Error {
  if (error instanceof SuggestError) return error;
  console.error(
    JSON.stringify({
      event: 'ai_suggest_failed',
      kind: error instanceof Error ? error.constructor.name : typeof error,
      status: error instanceof Anthropic.APIError ? error.status : undefined,
    })
  );
  if (error instanceof Anthropic.RateLimitError) return new SuggestError(BUSY);
  return new SuggestError(DOWN);
}
