/**
 * AI client with streaming support.
 * Uses OpenAI-compatible API.
 * No mock fallbacks — requires OPENAI_API_KEY or returns a clear error.
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIStreamOptions {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

/**
 * Stream a chat completion. Returns the full response text.
 * Calls onToken for each streamed token (for real-time UI updates).
 */
export async function streamChatCompletion(options: AIStreamOptions): Promise<string> {
  const { messages, temperature = 0.7, maxTokens = 1500, onToken, signal } = options;

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Add it in Vercel project settings.');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text().catch(() => '');
    throw new Error(`AI API error ${response.status}: ${error.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) {
          fullText += token;
          onToken?.(token);
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }

  return fullText;
}

/**
 * Non-streaming completion.
 */
export async function chatCompletion(messages: AIMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o';

  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 1500,
    }),
  });

  if (!response.ok) throw new Error(`AI API error ${response.status}`);
  const json = await response.json();
  return json.choices[0]?.message?.content ?? '';
}

/**
 * Create a ReadableStream for SSE responses.
 */
export function createSSEStream(
  messages: AIMessage[],
  opts?: { temperature?: number; maxTokens?: number }
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        await streamChatCompletion({
          messages,
          temperature: opts?.temperature,
          maxTokens: opts?.maxTokens,
          onToken: (token) => {
            const data = JSON.stringify({ token, done: false });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          },
        });

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Stream error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg, done: true })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}
