import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { seats } from "./seats";
import { payments } from "./payments";

export const reservations = pgTable("reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  seatId: uuid("seat_id")
    .notNull()
    .references(() => seats.id)
    .unique(),
  userId: text("user_id").notNull(),
  paymentId: uuid("payment_id")
    .notNull()
    .references(() => payments.id)
    .unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
