import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { seats } from "./seats";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "completed",
  "failed",
  "expired",
  "refunded",
]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  seatId: uuid("seat_id")
    .notNull()
    .references(() => seats.id),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
