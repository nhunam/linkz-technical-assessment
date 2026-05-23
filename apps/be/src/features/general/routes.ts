import { Hono } from "hono";

const app = new Hono().get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
