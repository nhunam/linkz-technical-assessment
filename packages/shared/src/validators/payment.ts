import { z } from "zod";

export const createPaymentSchema = z.object({
  seatId: z.string().uuid("Invalid seat ID"),
});

export const confirmPaymentSchema = z.object({
  paymentId: z.string().uuid("Invalid payment ID"),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
