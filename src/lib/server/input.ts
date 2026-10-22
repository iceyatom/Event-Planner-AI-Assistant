import 'server-only';
import { requestSchema, type ChatRequest, type Message } from '../contracts';

export class InputError extends Error {}
export async function readInput(request: Request): Promise<ChatRequest> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new InputError();
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > 32768)) throw new InputError();
  if (!request.body) throw new InputError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) { await reader.cancel(); throw new InputError(); }
      chunks.push(value);
    }
    const parsed = requestSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (!parsed.success) throw new InputError();
    return parsed.data;
  } catch { throw new InputError(); }
  finally { reader.releaseLock(); }
}

// UTF-8 byte count is a deliberately conservative upper bound for byte-level
// tokenization, plus generous message/framing overhead. Includes output schema.
// This rejects some text that a precise tokenizer could fit; never undercounts
// ordinary text by estimating four characters per token.
export const INPUT_CEILING = 6000;
export const HISTORY_LIMIT = 12; // Matches requestSchema and the client's messages.slice(-12).
const baseSize = (instructions: string, schema: unknown) => 512 + Buffer.byteLength(instructions + JSON.stringify(schema), 'utf8');
const messagesSize = (messages: Message[]) => messages.reduce((n, m) => n + Buffer.byteLength(m.content, 'utf8') + 64, 0);

export function prepareInput(request: ChatRequest, instructions: string, schema: unknown) {
  const history = [...request.history];
  const count = (messages: Message[]) => baseSize(instructions, schema) + messagesSize(messages);
  const latest: Message = { role: 'user', content: request.message };
  let trimmed = false;
  while (history.length && count([...history, latest]) > INPUT_CEILING) {
    history.shift();
    while (history[0]?.role === 'assistant') history.shift();
    trimmed = true;
  }
  if (count([...history, latest]) > INPUT_CEILING) throw new InputError();
  return { messages: [...history, latest], trimmed, inputUpperBound: count([...history, latest]) };
}

// Percent (0-100) of the conversation's room in use, for the meter in the chat UI.
// Room is what is left of the input ceiling after the fixed instructions and schema.
// Uses whichever limit is closer: that room, or the 12-message history cap.
export function contextUsage(messages: Message[], instructions: string, schema: unknown) {
  const room = INPUT_CEILING - baseSize(instructions, schema);
  const bySize = room > 0 ? messagesSize(messages) / room : 1;
  const byCount = Math.min(messages.length, HISTORY_LIMIT) / HISTORY_LIMIT;
  return Math.min(100, Math.round(100 * Math.max(bySize, byCount)));
}
