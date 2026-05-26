import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import seatRoutes from "./features/seats/routes";
import paymentRoutes from "./features/payments/routes";
import generalRoutes from "./features/general/routes";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3031",
    credentials: true,
  })
);

app.use("*", logger());

app.route("/api", generalRoutes);
app.route("/api/seats", seatRoutes);
app.route("/api/payments", paymentRoutes);

export default app;
