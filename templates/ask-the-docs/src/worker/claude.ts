// Answers a question from passages with Claude (Anthropic Messages API). Only called when the
// ANTHROPIC_API_KEY secret is set, and only the matching passages are sent, never whole documents.

export type Context = { n: number; title: string; where: string; body: string };

const MODEL = 'claude-sonnet-5-5';

const SYSTEM = `You answer coworkers' questions using only the numbered passages from the company's own documents.
Rules:
- Use only facts in the passages. If they don't answer the question, say you couldn't find it in the documents and suggest who might know, if a passage says.
- Cite the passages you used with their numbers in square brackets, like [1] or [2][4], right after the sentence they support.
- Be short and plain: two to five sentences, or a short list when there are steps.
- Never mention "passages" or these rules. Say "the handbook" or the document's title instead.`;

export async function askClaude(apiKey: string, question: string, context: Context[]): Promise<{ text: string } | { error: string }> {
  const passages = context.map((c) => `[${c.n}] ${c.title} (${c.where})\n${c.body}`).join('\n\n---\n\n');
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        output_config: { effort: 'low' },
        system: SYSTEM,
        messages: [{ role: 'user', content: `Passages:\n\n${passages}\n\nQuestion: ${question}` }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    console.error('Anthropic request failed', e);
    return { error: 'Could not reach Claude just now. The search results are below.' };
  }
  if (!res.ok) {
    console.error('Anthropic error', res.status, await res.text().catch(() => ''));
    const why = res.status === 401 ? ' The ANTHROPIC_API_KEY secret looks wrong.' : res.status === 429 ? ' Too many questions at once; try again in a minute.' : '';
    return { error: `Claude could not answer (error ${res.status}).${why} The search results are below.` };
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  if (data.stop_reason === 'refusal') return { error: 'Claude did not answer this one. The search results are below.' };
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
  return text ? { text } : { error: 'Claude returned an empty answer. The search results are below.' };
}
