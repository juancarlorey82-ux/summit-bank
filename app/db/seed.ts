import * as crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import * as schema from "./schema";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function findUserByUnionId(unionId: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.unionId, unionId))
    .limit(1);
  return rows.at(0);
}

async function ensureUser(opts: {
  email: string;
  name: string;
  password: string;
  role: "user" | "admin";
}) {
  const unionId = `cred:${opts.email}`;
  const existing = await findUserByUnionId(unionId);
  if (existing) return existing;

  await getDb().insert(schema.users).values({
    unionId,
    name: opts.name,
    email: opts.email,
    role: opts.role,
    passwordHash: hashPassword(opts.password),
    lastSignInAt: new Date(),
  });
  const created = await findUserByUnionId(unionId);
  if (!created) throw new Error(`Failed to create ${opts.email}`);
  return created;
}

async function ensureAccount(userId: number, accountNumber: string) {
  const rows = await getDb()
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId))
    .limit(1);
  if (rows.at(0)) return rows.at(0)!;

  await getDb().insert(schema.accounts).values({ userId, accountNumber });
  const created = await getDb()
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId))
    .limit(1);
  return created.at(0)!;
}

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  const admin = await ensureUser({
    email: "admin@summitbank.com",
    name: "Summit Administrator",
    password: "SummitAdmin!2026",
    role: "admin",
  });
  console.log("Admin ready:", admin.email);

  const demo = await ensureUser({
    email: "demo@summitbank.com",
    name: "Ava Whitfield",
    password: "DemoUser!2026",
    role: "user",
  });
  const account = await ensureAccount(demo.id, "104820193744");
  console.log("Demo user ready:", demo.email, account.accountNumber);

  const txCount = await db
    .select({ id: schema.transactions.id })
    .from(schema.transactions)
    .where(eq(schema.transactions.accountId, account.id))
    .limit(1);

  if (txCount.length === 0) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    await db.insert(schema.transactions).values([
      {
        accountId: account.id,
        reference: "TOP-SEED0001A",
        type: "deposit",
        channel: "admin_topup",
        amount: "25000.00",
        balanceAfter: "25000.00",
        status: "approved",
        note: "Opening balance — private client onboarding",
        processedById: admin.id,
        createdAt: new Date(now - 12 * day),
        processedAt: new Date(now - 12 * day),
      },
      {
        accountId: account.id,
        reference: "DEP-SEED0002B",
        type: "deposit",
        channel: "user_request",
        amount: "4200.00",
        balanceAfter: "29200.00",
        status: "approved",
        note: "Wire deposit — monthly allocation",
        createdAt: new Date(now - 9 * day),
        processedAt: new Date(now - 9 * day + 3600_000),
      },
      {
        accountId: account.id,
        reference: "WDR-SEED0003C",
        type: "withdrawal",
        channel: "user_request",
        amount: "1500.00",
        balanceAfter: "27700.00",
        status: "approved",
        note: "External transfer to linked account",
        createdAt: new Date(now - 5 * day),
        processedAt: new Date(now - 5 * day + 7200_000),
      },
      {
        accountId: account.id,
        reference: "DEP-SEED0004D",
        type: "deposit",
        channel: "user_request",
        amount: "6800.00",
        status: "pending",
        note: "Cheque deposit — awaiting clearing",
        createdAt: new Date(now - 1 * day),
      },
      {
        accountId: account.id,
        reference: "WDR-SEED0005E",
        type: "withdrawal",
        channel: "user_request",
        amount: "900.00",
        status: "rejected",
        note: "Rejected — beneficiary details incomplete",
        createdAt: new Date(now - 3 * day),
        processedAt: new Date(now - 3 * day + 5400_000),
      },
    ]);
    await db
      .update(schema.accounts)
      .set({ balance: "27700.00" })
      .where(eq(schema.accounts.id, account.id));
    console.log("Demo transactions seeded.");
  }

  console.log("Done.");
  process.exit(0);
}

seed();
