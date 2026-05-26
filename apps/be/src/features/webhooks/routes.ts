import { Hono } from "hono";
import { handleStripeWebhook } from "./service";

const app = new Hono().post("/stripe", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("stripe-signature") || "";

  const result = await handleStripeWebhook(rawBody, signature);

  if ("error" in result) {
    if (result.error === "Invalid signature") {
      return c.json({ error: result.error }, 401);
    }
    return c.json({ error: result.error }, 200);
  }

  return c.json({ received: true }, 200);
});

export default app;
