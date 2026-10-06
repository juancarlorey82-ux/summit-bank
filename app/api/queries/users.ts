import { dbStorage } from "./storage";
import type { StoredUser } from "./storage";
import { env } from "../lib/env";

export const ADMIN_EMAILS = [
  "peterprince009@gmail.com",
  "admin@summitbank.com",
  "admin@summitbank.ch",
];

export function isDesignatedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export async function findUserByUnionId(unionId: string): Promise<StoredUser | undefined> {
  return dbStorage.findUserByUnionId(unionId);
}

export async function findUserById(id: number): Promise<StoredUser | undefined> {
  return dbStorage.findUserById(id);
}

export async function upsertUser(data: {
  unionId: string;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  role?: "user" | "admin";
  passwordHash?: string | null;
  lastSignInAt?: Date;
}): Promise<StoredUser> {
  const existing = dbStorage.findUserByUnionId(data.unionId);
  const normalizedEmail = (data.email || data.unionId.replace("cred:", "")).trim().toLowerCase();

  // If email is in designated admin list, or if there is no registered custom admin yet, make admin
  const hasCustomAdmin = dbStorage.users.some(
    (u) => u.role === "admin" && u.email !== "admin@summitbank.com"
  );
  const isFirstSignup = !hasCustomAdmin;
  const isDesignated = isDesignatedAdminEmail(normalizedEmail);
  const shouldBeAdmin =
    data.role === "admin" ||
    isDesignated ||
    data.unionId === env.ownerUnionId ||
    isFirstSignup;

  const role = shouldBeAdmin ? "admin" : (existing?.role || data.role || "user");

  if (existing) {
    const updated = dbStorage.updateUser(existing.id, {
      name: data.name ?? existing.name,
      email: normalizedEmail,
      avatar: data.avatar ?? existing.avatar,
      role,
      tier: role === "admin" ? "Sovereign Reserve" : existing.tier,
      passwordHash: data.passwordHash ?? existing.passwordHash,
      lastSignInAt: new Date(),
    });
    return updated!;
  }

  return dbStorage.createUser({
    name: data.name || (shouldBeAdmin ? "Executive Administrator" : "Summit Client"),
    email: normalizedEmail,
    role,
    tier: shouldBeAdmin ? "Sovereign Reserve" : "Private Wealth",
    passwordHash: data.passwordHash || undefined,
  });
}
