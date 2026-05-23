import { eq, and, lt } from "drizzle-orm";
import { db, seats } from "../../db";

export async function listSeats() {
  await releaseExpiredHolds();

  return db.select().from(seats).orderBy(seats.label);
}

export async function holdSeat(seatId: string, userId: string) {
  await releaseExpiredHolds();

  const [seat] = await db.select().from(seats).where(eq(seats.id, seatId));

  if (!seat) {
    return { error: "Seat not found" as const };
  }

  if (seat.status === "reserved") {
    return { error: "Seat already reserved" as const };
  }

  if (seat.status === "held" && seat.heldBy !== userId) {
    return { error: "Seat is being held by another user" as const };
  }

  // Hold expires in 10 minutes
  const heldUntil = new Date(Date.now() + 10 * 60 * 1000);

  const [updated] = await db
    .update(seats)
    .set({
      status: "held",
      heldBy: userId,
      heldUntil,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(seats.id, seatId),
        // Optimistic concurrency: only update if still available or held by same user
        eq(seats.status, seat.status)
      )
    )
    .returning();

  if (!updated) {
    return { error: "Seat was taken by another user" as const };
  }

  return { seat: updated };
}

export async function releaseSeat(seatId: string, userId: string) {
  const [updated] = await db
    .update(seats)
    .set({
      status: "available",
      heldBy: null,
      heldUntil: null,
      updatedAt: new Date(),
    })
    .where(and(eq(seats.id, seatId), eq(seats.heldBy, userId)))
    .returning();

  return updated ?? null;
}

export async function reserveSeat(seatId: string, userId: string) {
  const [updated] = await db
    .update(seats)
    .set({
      status: "reserved",
      reservedBy: userId,
      heldBy: null,
      heldUntil: null,
      updatedAt: new Date(),
    })
    .where(and(eq(seats.id, seatId), eq(seats.heldBy, userId)))
    .returning();

  return updated ?? null;
}

async function releaseExpiredHolds() {
  await db
    .update(seats)
    .set({
      status: "available",
      heldBy: null,
      heldUntil: null,
      updatedAt: new Date(),
    })
    .where(and(eq(seats.status, "held"), lt(seats.heldUntil, new Date())));
}
