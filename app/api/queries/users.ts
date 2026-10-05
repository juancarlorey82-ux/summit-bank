import { dbStorage } from "./storage";
import type { StoredUser } from "./storage";
import { env } from "../lib/env";

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
  const role =
    data.role ||
    (data.unionId === env.ownerUnionId ? "admin" : existing?.role || "user");

  if (existing) {
    const updated = dbStorage.updateUser(existing.id, {
      name: data.name ?? existing.name,
      email: data.email ?? existing.email,
      avatar: data.avatar ?? existing.avatar,
      role,
      passwordHash: data.passwordHash ?? existing.passwordHash,
      lastSignInAt: new Date(),
    });
    return updated!;
  }

  return dbStorage.createUser({
    name: data.name || "Summit Client",
    email: data.email || data.unionId.replace("cred:", ""),
    role,
    passwordHash: data.passwordHash || undefined,
  });
}
