import { eq, and } from "drizzle-orm";
import { db, payments, seats, reservations } from "../../db";
import { reserveSeat } from "../seats/service";

export async function createPayment(seatId: string, userId: string) {
  const [seat] = await db.select().from(seats).where(eq(seats.id, seatId));

  if (!seat) {
    return { error: "Seat not found" as const };
  }

  if (seat.status !== "held" || seat.heldBy !== userId) {
    return { error: "You must hold this seat before paying" as const };
  }

  // Payment expires in 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const [payment] = await db
    .insert(payments)
    .values({
      seatId,
      userId,
      amount: seat.price,
      status: "pending",
      expiresAt,
    })
    .returning();

  return { payment };
}

export async function confirmPayment(paymentId: string, userId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.userId, userId)));

  if (!payment) {
    return { error: "Payment not found" as const };
  }

  if (payment.status !== "pending") {
    return { error: `Payment is already ${payment.status}` as const };
  }

  if (new Date(payment.expiresAt) < new Date()) {
    await db
      .update(payments)
      .set({ status: "expired" })
      .where(eq(payments.id, paymentId));
    return { error: "Payment has expired" as const };
  }

  // Mark payment as completed
  const [updated] = await db
    .update(payments)
    .set({ status: "completed" })
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.status, "pending") // optimistic concurrency
      )
    )
    .returning();

  if (!updated) {
    return { error: "Payment could not be processed" as const };
  }

  // Reserve the seat
  const reserved = await reserveSeat(payment.seatId, userId);
  if (!reserved) {
    // Rollback payment if seat reservation fails
    await db
      .update(payments)
      .set({ status: "failed" })
      .where(eq(payments.id, paymentId));
    return { error: "Seat reservation failed — payment has been reversed" as const };
  }

  // Create reservation record
  const [reservation] = await db
    .insert(reservations)
    .values({
      seatId: payment.seatId,
      userId,
      paymentId: payment.id,
    })
    .returning();

  return { payment: updated, reservation };
}

export async function getUserPayments(userId: string) {
  return db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(payments.createdAt);
}
