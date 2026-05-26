import { z } from "zod";

export const createPaymentSchema = z.object({
  seatId: z.string().uuid("Invalid seat ID"),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
