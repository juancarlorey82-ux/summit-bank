import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  decimal,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const accounts = mysqlTable("accounts", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .unique()
    .references(() => users.id),
  accountNumber: varchar("accountNumber", { length: 32 }).notNull().unique(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  balance: decimal("balance", { precision: 18, scale: 2 })
    .notNull()
    .default("0.00"),
  status: mysqlEnum("status", ["active", "frozen"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

export const transactions = mysqlTable("transactions", {
  id: serial("id").primaryKey(),
  accountId: bigint("accountId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => accounts.id),
  reference: varchar("reference", { length: 40 }).notNull().unique(),
  type: mysqlEnum("type", [
    "deposit",
    "withdrawal",
    "transfer_in",
    "transfer_out",
    "bill_payment",
    "card_spend",
  ]).notNull(),
  channel: mysqlEnum("channel", [
    "user_request",
    "admin_topup",
    "transfer",
    "wire_domestic",
    "wire_international",
    "bill_payment",
    "mobile_check",
    "crypto_settlement",
    "card_spend",
  ])
    .notNull()
    .default("user_request"),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 18, scale: 2 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"])
    .notNull()
    .default("pending"),
  note: varchar("note", { length: 500 }),
  counterparty: varchar("counterparty", { length: 255 }),
  beneficiaryBank: varchar("beneficiaryBank", { length: 255 }),
  beneficiaryAccount: varchar("beneficiaryAccount", { length: 255 }),
  estimatedApproval: varchar("estimatedApproval", { length: 255 }),
  adminNote: varchar("adminNote", { length: 500 }),
  expediteDepositRequired: decimal("expediteDepositRequired", { precision: 18, scale: 2 }),
  processedById: bigint("processedById", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
