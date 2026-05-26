import { eq, and } from "drizzle-orm";
import { db, payments, seats, reservations } from "../../db";
import { stripe } from "../../lib/stripe";

export async function createPayment(seatId: string, userId: string) {
  const [seat] = await db.select().from(seats).where(eq(seats.id, seatId));

  if (!seat) {
    return { error: "Seat not found" as const };
  }

  if (seat.status !== "held" || seat.heldBy !== userId) {
    return { error: "You must hold this seat before paying" as const };
  }

  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: seat.price,
      currency: "usd",
      metadata: {
        seatId,
        userId,
        idempotencyKey,
      },
    },
    { idempotencyKey }
  );

  const [payment] = await db
    .insert(payments)
    .values({
      seatId,
      userId,
      amount: seat.price,
      status: "pending",
      stripePaymentIntentId: paymentIntent.id,
      idempotencyKey,
      expiresAt,
    })
    .returning();

  return { payment, clientSecret: paymentIntent.client_secret };
}

export async function getPaymentStatus(paymentId: string, userId: string) {
  let [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.userId, userId)));

  if (!payment) {
    return { error: "Payment not found" as const };
  }

  if (payment.status === "pending" && payment.stripePaymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
    if (pi.status === "succeeded") {
      await completePayment(payment);
      [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId));
    }
  }

  const [reservation] = payment.status === "completed"
    ? await db
        .select()
        .from(reservations)
        .where(eq(reservations.paymentId, payment.id))
    : [null];

  return { payment, reservation };
}

async function completePayment(payment: typeof payments.$inferSelect) {
  await db.transaction(async (tx) => {
    const [fresh] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id));

    if (!fresh || fresh.status !== "pending") return;

    const [seat] = await tx
      .select()
      .from(seats)
      .where(eq(seats.id, fresh.seatId));

    if (!seat || seat.status !== "held" || seat.heldBy !== fresh.userId) {
      await tx
        .update(payments)
        .set({ status: "refunded" })
        .where(eq(payments.id, fresh.id));
      return;
    }

    await tx
      .update(payments)
      .set({ status: "completed" })
      .where(eq(payments.id, fresh.id));

    await tx
      .update(seats)
      .set({
        status: "reserved",
        reservedBy: fresh.userId,
        heldBy: null,
        heldUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(seats.id, fresh.seatId));

    await tx
      .insert(reservations)
      .values({
        seatId: fresh.seatId,
        userId: fresh.userId,
        paymentId: fresh.id,
      });
  });
}

export async function getUserPayments(userId: string) {
  return db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(payments.createdAt);
}
