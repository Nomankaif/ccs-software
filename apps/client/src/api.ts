export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(message: string, public status: number, public payload?: unknown) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...options, credentials: "include", headers: { "Content-Type": "application/json", ...options.headers } });
  const payload = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw new ApiError(payload?.error ?? "Request failed", response.status, payload);
  return payload as T;
}
