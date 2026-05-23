export type SeatStatus = "available" | "held" | "reserved";

export interface Seat {
  id: string;
  label: string;
  price: number;
  status: SeatStatus;
  heldBy?: string | null;
  heldUntil?: string | null;
  reservedBy?: string | null;
}

export type PaymentStatus = "pending" | "completed" | "failed" | "expired";

export interface Payment {
  id: string;
  seatId: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
  expiresAt: string;
}

export interface Reservation {
  id: string;
  seatId: string;
  userId: string;
  paymentId: string;
  createdAt: string;
}
