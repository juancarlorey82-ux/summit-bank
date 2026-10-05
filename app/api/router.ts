import { authRouter } from "./auth-router";
import { credentialAuthRouter } from "./credential-auth";
import { bankRouter } from "./bank-router";
import { adminRouter } from "./admin-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  credentialAuth: credentialAuthRouter,
  bank: bankRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
