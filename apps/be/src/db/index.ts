import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "./schema/auth";
import * as seatSchema from "./schema/seats";
import * as paymentSchema from "./schema/payments";
import * as reservationSchema from "./schema/reservations";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString);

export const db = drizzle(client, {
  schema: { ...authSchema, ...seatSchema, ...paymentSchema, ...reservationSchema },
});

export const { seats } = seatSchema;
export const { payments } = paymentSchema;
export const { reservations } = reservationSchema;
