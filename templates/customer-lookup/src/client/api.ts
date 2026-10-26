// All API calls go through here. Paths are relative (/api/...), so they work locally and live.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string' && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
