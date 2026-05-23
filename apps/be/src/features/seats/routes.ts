import { Hono } from "hono";
import { requireSession } from "../../middleware/session";
import { listSeats, holdSeat, releaseSeat } from "./service";

const app = new Hono()
  .get("/", async (c) => {
    const allSeats = await listSeats();
    return c.json({ seats: allSeats });
  })
  .post("/:id/hold", requireSession, async (c) => {
    const seatId = c.req.param("id");
    const user = c.get("user");
    const result = await holdSeat(seatId, user.id);

    if ("error" in result) {
      return c.json({ error: result.error }, 409);
    }

    return c.json({ seat: result.seat });
  })
  .post("/:id/release", requireSession, async (c) => {
    const seatId = c.req.param("id");
    const user = c.get("user");
    const released = await releaseSeat(seatId, user.id);

    if (!released) {
      return c.json({ error: "Cannot release this seat" }, 400);
    }

    return c.json({ seat: released });
  });

export default app;
