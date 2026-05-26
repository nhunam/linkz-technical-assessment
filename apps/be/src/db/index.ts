import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "./schema/auth";
import * as seatSchema from "./schema/seats";
import * as paymentSchema from "./schema/payments";
import * as reservationSchema from "./schema/reservations";
import * as webhookEventSchema from "./schema/webhook-events";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, {
  schema: {
    ...authSchema,
    ...seatSchema,
    ...paymentSchema,
    ...reservationSchema,
    ...webhookEventSchema,
  },
});

export const { seats } = seatSchema;
export const { payments } = paymentSchema;
export const { reservations } = reservationSchema;
export const { webhookEvents } = webhookEventSchema;
