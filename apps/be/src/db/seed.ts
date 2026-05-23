import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { seats } from "./schema/seats";
import { sql } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

const SEED_SEATS = [
  { label: "Seat A1", price: 5000 },
  { label: "Seat A2", price: 7500 },
  { label: "Seat A3", price: 10000 },
];

async function main() {
  console.log("Seeding seats...");

  for (const seat of SEED_SEATS) {
    await db
      .insert(seats)
      .values(seat)
      .onConflictDoUpdate({
        target: seats.label,
        set: { price: sql`excluded.price` },
      });
  }

  console.log(`Seeded ${SEED_SEATS.length} seats.`);
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
