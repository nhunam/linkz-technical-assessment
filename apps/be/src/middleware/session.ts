import { createMiddleware } from "hono/factory";
import { verifyToken, createClerkClient } from "@clerk/backend";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

type SessionEnv = {
  Variables: {
    user: SessionUser;
  };
};

export const requireSession = createMiddleware<SessionEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
      authorizedParties: [
        process.env.FRONTEND_URL || "http://localhost:3031",
      ],
    });

    const user = await clerk.users.getUser(payload.sub);

    c.set("user", {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress ?? "",
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
    });

    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
});
