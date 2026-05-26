import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const webhookEventStatusEnum = pgEnum("webhook_event_status", [
  "received",
  "processing",
  "processed",
  "failed",
]);

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: varchar("provider", { length: 50 }).notNull(),
  eventId: text("event_id").notNull().unique(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: text("payload").notNull(),
  status: webhookEventStatusEnum("status").notNull().default("received"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
