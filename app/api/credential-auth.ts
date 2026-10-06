import * as crypto from "node:crypto";
import * as cookie from "cookie";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { createRouter, publicQuery } from "./middleware";
import { signSessionToken } from "./kimi/session";
import { getSessionCookieOptions } from "./lib/cookies";
import { findUserByUnionId, upsertUser, isDesignatedAdminEmail } from "./queries/users";
import { getOrCreateAccount } from "./queries/banking";
import { dbStorage } from "./queries/storage";
import { env } from "./lib/env";

const CRED_PREFIX = "cred:";

export function credentialUnionId(email: string): string {
  return `${CRED_PREFIX}${email.trim().toLowerCase()}`;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

function setSessionCookie(
  resHeaders: Headers,
  reqHeaders: Headers,
  token: string,
) {
  const opts = getSessionCookieOptions(reqHeaders);
  resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128);

export const credentialAuthRouter = createRouter({
  signup: publicQuery
    .input(
      z.object({
        name: z.string().trim().min(2, "Enter your full name").max(120),
        email: emailSchema,
        password: passwordSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const unionId = credentialUnionId(input.email);
      const existing = await findUserByUnionId(unionId);
      if (existing) {
        if (isDesignatedAdminEmail(input.email) && !existing.passwordHash) {
          dbStorage.updateUser(existing.id, {
            name: input.name || existing.name,
            passwordHash: hashPassword(input.password),
            role: "admin",
            tier: "Sovereign Reserve",
            lastSignInAt: new Date(),
          });
          const token = await signSessionToken({ unionId, clientId: env.appId });
          setSessionCookie(ctx.resHeaders, ctx.req.headers, token);
          return { success: true };
        }
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists. Sign in instead.",
        });
      }

      await upsertUser({
        unionId,
        name: input.name,
        email: input.email,
        passwordHash: hashPassword(input.password),
        lastSignInAt: new Date(),
      });

      const user = await findUserByUnionId(unionId);
      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create your account. Please try again.",
        });
      }
      await getOrCreateAccount(user.id);

      const token = await signSessionToken({ unionId, clientId: env.appId });
      setSessionCookie(ctx.resHeaders, ctx.req.headers, token);
      return { success: true };
    }),

  login: publicQuery
    .input(z.object({ email: emailSchema, password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const unionId = credentialUnionId(input.email);
      const user = await findUserByUnionId(unionId);
      if (
        !user ||
        !user.passwordHash ||
        !verifyPassword(input.password, user.passwordHash)
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Incorrect email or password.",
        });
      }

      // Automatically promote to admin if email is in designated admin list
      if (isDesignatedAdminEmail(user.email) && user.role !== "admin") {
        dbStorage.updateUser(user.id, { role: "admin", tier: "Sovereign Reserve", lastSignInAt: new Date().toISOString() });
        user.role = "admin";
      } else {
        dbStorage.updateUser(user.id, { lastSignInAt: new Date().toISOString() });
      }

      const token = await signSessionToken({ unionId, clientId: env.appId });
      setSessionCookie(ctx.resHeaders, ctx.req.headers, token);
      return { success: true };
    }),
});
