import { eq, and } from "drizzle-orm";
import { db, payments, seats, reservations, webhookEvents } from "../../db";
import { stripe } from "../../lib/stripe";
import type Stripe from "stripe";

export async function handleStripeWebhook(rawBody: string, signature: string) {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return { error: "Invalid signature" as const };
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id));

    if (existing?.status === "processed") {
      return { received: true, duplicate: true };
    }

    if (!existing) {
      await tx.insert(webhookEvents).values({
        provider: "stripe",
        eventId: event.id,
        eventType: event.type,
        payload: rawBody,
        status: "processing",
      });
    } else {
      await tx
        .update(webhookEvents)
        .set({ status: "processing" })
        .where(eq(webhookEvents.eventId, event.id));
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded":
          await handlePaymentSuccess(tx, event.data.object as Stripe.PaymentIntent);
          break;
        case "payment_intent.payment_failed":
          await handlePaymentFailure(tx, event.data.object as Stripe.PaymentIntent);
          break;
      }

      await tx
        .update(webhookEvents)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(webhookEvents.eventId, event.id));

      return { received: true };
    } catch (err) {
      await tx
        .update(webhookEvents)
        .set({
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        })
        .where(eq(webhookEvents.eventId, event.id));

      throw err;
    }
  });
}

async function handlePaymentSuccess(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  paymentIntent: Stripe.PaymentIntent
) {
  const [payment] = await tx
    .select()
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

  if (!payment || payment.status === "completed") return;

  const [seat] = await tx
    .select()
    .from(seats)
    .where(eq(seats.id, payment.seatId));

  if (!seat || seat.status !== "held" || seat.heldBy !== payment.userId) {
    await tx
      .update(payments)
      .set({ status: "refunded" })
      .where(eq(payments.id, payment.id));
    return;
  }

  await tx
    .update(payments)
    .set({ status: "completed" })
    .where(eq(payments.id, payment.id));

  await tx
    .update(seats)
    .set({
      status: "reserved",
      reservedBy: payment.userId,
      heldBy: null,
      heldUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(seats.id, payment.seatId));

  await tx
    .insert(reservations)
    .values({
      seatId: payment.seatId,
      userId: payment.userId,
      paymentId: payment.id,
    });
}

async function handlePaymentFailure(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  paymentIntent: Stripe.PaymentIntent
) {
  const [payment] = await tx
    .select()
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

  if (!payment || payment.status !== "pending") return;

  await tx
    .update(payments)
    .set({ status: "failed" })
    .where(eq(payments.id, payment.id));
}
