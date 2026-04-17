import { dauboBffUrl, detailFromApiJson } from "@/lib/daubo-api";

export class ApiClientError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(dauboBffUrl(path), {
    credentials: "same-origin",
    ...init,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiClientError(
      response.status,
      detailFromApiJson(payload, `Request failed (${response.status})`),
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
