const BASE = "/api";

type GetToken = () => Promise<string | null>;

let _getToken: GetToken = async () => null;

export function setAuthTokenGetter(getToken: GetToken) {
  _getToken = getToken;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await _getToken();

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

export const api = {
  getSeats: () => request<{ seats: any[] }>("/seats"),

  holdSeat: (seatId: string) =>
    request<{ seat: any }>(`/seats/${seatId}/hold`, { method: "POST" }),

  releaseSeat: (seatId: string) =>
    request<{ seat: any }>(`/seats/${seatId}/release`, { method: "POST" }),

  createPayment: (seatId: string) =>
    request<{ payment: any }>("/payments", {
      method: "POST",
      body: JSON.stringify({ seatId }),
    }),

  confirmPayment: (paymentId: string) =>
    request<{ payment: any; reservation: any }>(
      `/payments/${paymentId}/confirm`,
      { method: "POST" }
    ),
};
