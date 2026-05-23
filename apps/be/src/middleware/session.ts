import { createMiddleware } from "hono/factory";
import { auth } from "../auth";

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
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });

  await next();
});
