const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
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
