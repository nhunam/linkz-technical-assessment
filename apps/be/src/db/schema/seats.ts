import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const seatStatusEnum = pgEnum("seat_status", [
  "available",
  "held",
  "reserved",
]);

export const seats = pgTable("seats", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: varchar("label", { length: 50 }).notNull().unique(),
  price: integer("price").notNull(),
  status: seatStatusEnum("status").notNull().default("available"),
  heldBy: text("held_by"),
  heldUntil: timestamp("held_until", { withTimezone: true }),
  reservedBy: text("reserved_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
