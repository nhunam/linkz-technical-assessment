import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireSession } from "../../middleware/session";
import { createPaymentSchema } from "@seat-reservation/shared";
import { createPayment, getPaymentStatus, getUserPayments } from "./service";

const app = new Hono()
  .post(
    "/",
    requireSession,
    zValidator("json", createPaymentSchema),
    async (c) => {
      const { seatId } = c.req.valid("json");
      const user = c.get("user");
      const result = await createPayment(seatId, user.id);

      if ("error" in result) {
        return c.json({ error: result.error }, 400);
      }

      return c.json(
        { payment: result.payment, clientSecret: result.clientSecret },
        201
      );
    }
  )
  .get(
    "/:id/status",
    requireSession,
    async (c) => {
      const paymentId = c.req.param("id");
      const user = c.get("user");
      const result = await getPaymentStatus(paymentId, user.id);

      if ("error" in result) {
        return c.json({ error: result.error }, 400);
      }

      return c.json({
        payment: result.payment,
        reservation: result.reservation,
      });
    }
  )
  .get("/mine", requireSession, async (c) => {
    const user = c.get("user");
    const userPayments = await getUserPayments(user.id);
    return c.json({ payments: userPayments });
  });

export default app;
