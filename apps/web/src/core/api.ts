export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch('/api' + path, { credentials: 'same-origin', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body: unknown = await response.json();
  if (!response.ok) {
    const detail = typeof body === 'object' && body !== null && 'error' in body ? body.error : null;
    const message = typeof detail === 'object' && detail !== null && 'message' in detail && typeof detail.message === 'string' ? detail.message : `Request failed (${response.status}).`;
    throw new ApiError(response.status, message);
  }
  return body;
}
export function post(path: string, body: unknown) { return request(path, { method: 'POST', body: JSON.stringify(body) }); }
