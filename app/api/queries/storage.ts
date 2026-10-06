import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

import type { Transaction, Account, User } from "@contracts/types";

export type StoredTransaction = Transaction;

export type StoredAccount = Account & {
  routingNumber?: string;
  swiftBic?: string;
  iban?: string;
};

export type StoredUser = User & {
  tier?: "Standard" | "Private Wealth" | "Black Diamond" | "Sovereign Reserve" | "Institutional";
  phone?: string;
  country?: string;
  kycStatus?: "verified" | "pending" | "tier2";
};

export interface StoredCard {
  id: number;
  userId: number;
  accountId: number;
  cardNumber: string; // e.g. "4532 •••• •••• 8892"
  fullNumber: string; // "4532890123458892"
  cardHolder: string;
  expiry: string; // "09/29"
  cvv: string; // "742"
  tier: "Titanium Black" | "Sovereign Gold" | "Obsidian Reserve";
  type: "virtual" | "physical";
  status: "active" | "frozen" | "cancelled";
  spendingLimit: number; // e.g. 50000
  spendingCurrent: number; // e.g. 12450
  isContactless: boolean;
  isInternational: boolean;
  createdAt: Date;
}

export interface StoredVault {
  id: number;
  userId: number;
  name: string;
  category: "yield" | "property" | "bullion" | "reserve";
  currentAmount: number;
  targetAmount: number;
  currency: string;
  apy: number; // e.g. 5.25
  accruedInterest: number;
  createdAt: Date;
}

export interface StoredActivityLog {
  id: number;
  actorId?: number;
  actorName: string;
  action: string;
  category: "admin_topup" | "security" | "transfer" | "approval" | "card_management" | "status_change";
  details: string;
  timestamp: Date;
}

interface SerializedData {
  users: Array<Omit<StoredUser, "createdAt" | "updatedAt" | "lastSignInAt"> & { createdAt: string; updatedAt: string; lastSignInAt: string }>;
  accounts: Array<Omit<StoredAccount, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string }>;
  transactions: Array<Omit<StoredTransaction, "createdAt" | "processedAt"> & { createdAt: string; processedAt?: string | null }>;
  cards: Array<Omit<StoredCard, "createdAt"> & { createdAt: string }>;
  vaults: Array<Omit<StoredVault, "createdAt"> & { createdAt: string }>;
  activityLogs: Array<Omit<StoredActivityLog, "timestamp"> & { timestamp: string }>;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "bank-storage.json");

function getInitialData(): {
  users: StoredUser[];
  accounts: StoredAccount[];
  transactions: StoredTransaction[];
  cards: StoredCard[];
  vaults: StoredVault[];
  activityLogs: StoredActivityLog[];
} {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const adminUser: StoredUser = {
    id: 1,
    unionId: "cred:admin@summitbank.com",
    name: "Summit Administrator",
    email: "admin@summitbank.com",
    avatar: null,
    role: "admin",
    tier: "Sovereign Reserve",
    phone: "+41 22 819 0001",
    country: "Switzerland",
    kycStatus: "verified",
    passwordHash: hashPassword("SummitAdmin!2026"),
    createdAt: new Date(now.getTime() - 90 * day),
    updatedAt: now,
    lastSignInAt: now,
  };

  const demoUser: StoredUser = {
    id: 2,
    unionId: "cred:demo@summitbank.com",
    name: "Ava Whitfield",
    email: "demo@summitbank.com",
    avatar: null,
    role: "user",
    tier: "Private Wealth",
    phone: "+1 (212) 555-0198",
    country: "United States",
    kycStatus: "verified",
    passwordHash: hashPassword("DemoUser!2026"),
    createdAt: new Date(now.getTime() - 30 * day),
    updatedAt: now,
    lastSignInAt: now,
  };

  const user3: StoredUser = {
    id: 3,
    unionId: "cred:marcus.v@sterling.ch",
    name: "Marcus Vance",
    email: "marcus.v@sterling.ch",
    avatar: null,
    role: "user",
    tier: "Sovereign Reserve",
    phone: "+41 44 215 8890",
    country: "Switzerland",
    kycStatus: "verified",
    passwordHash: hashPassword("Sterling!2026"),
    createdAt: new Date(now.getTime() - 45 * day),
    updatedAt: now,
    lastSignInAt: new Date(now.getTime() - 1 * day),
  };

  const user4: StoredUser = {
    id: 4,
    unionId: "cred:elena.rostova@geneva-cap.com",
    name: "Elena Rostova",
    email: "elena.rostova@geneva-cap.com",
    avatar: null,
    role: "user",
    tier: "Black Diamond",
    phone: "+44 20 7946 0912",
    country: "United Kingdom",
    kycStatus: "tier2",
    passwordHash: hashPassword("Geneva!2026"),
    createdAt: new Date(now.getTime() - 20 * day),
    updatedAt: now,
    lastSignInAt: new Date(now.getTime() - 2 * day),
  };

  const peterAdminUser: StoredUser = {
    id: 5,
    unionId: "cred:peterprince009@gmail.com",
    name: "Peter Prince (Executive Admin)",
    email: "peterprince009@gmail.com",
    avatar: null,
    role: "admin",
    tier: "Sovereign Reserve",
    phone: "+41 22 819 0088",
    country: "Switzerland",
    kycStatus: "verified",
    passwordHash: hashPassword("Admin2026!"),
    createdAt: new Date(now.getTime() - 10 * day),
    updatedAt: now,
    lastSignInAt: now,
  };

  const adminAccount: StoredAccount = {
    id: 1,
    userId: 1,
    accountNumber: "109900118822",
    currency: "USD",
    balance: "5000000.00",
    status: "active",
    routingNumber: "021000021",
    swiftBic: "SUMMITUS33XXX",
    iban: "CH9300762011623852957",
    createdAt: new Date(now.getTime() - 90 * day),
    updatedAt: now,
  };

  const demoAccount: StoredAccount = {
    id: 2,
    userId: 2,
    accountNumber: "104820193744",
    currency: "USD",
    balance: "148500.00",
    status: "active",
    routingNumber: "021000021",
    swiftBic: "SUMMITUS33XXX",
    iban: "CH9300762011623852958",
    createdAt: new Date(now.getTime() - 30 * day),
    updatedAt: now,
  };

  const acct3: StoredAccount = {
    id: 3,
    userId: 3,
    accountNumber: "108923419082",
    currency: "USD",
    balance: "1250000.00",
    status: "active",
    routingNumber: "021000021",
    swiftBic: "SUMMITUS33XXX",
    iban: "CH9300762011623852959",
    createdAt: new Date(now.getTime() - 45 * day),
    updatedAt: now,
  };

  const acct4: StoredAccount = {
    id: 4,
    userId: 4,
    accountNumber: "107712398451",
    currency: "USD",
    balance: "485000.00",
    status: "active",
    routingNumber: "021000021",
    swiftBic: "SUMMITUS33XXX",
    iban: "CH9300762011623852960",
    createdAt: new Date(now.getTime() - 20 * day),
    updatedAt: now,
  };

  const peterAdminAccount: StoredAccount = {
    id: 5,
    userId: 5,
    accountNumber: "109847291038",
    currency: "USD",
    balance: "5500000.00",
    status: "active",
    routingNumber: "021000021",
    swiftBic: "SUMMITUS33XXX",
    iban: "CH93007620119847291038",
    createdAt: new Date(now.getTime() - 10 * day),
    updatedAt: now,
  };

  const rawTransactions = [
    {
      id: 1,
      accountId: 2,
      reference: "TOP-90812A",
      type: "deposit" as const,
      channel: "admin_topup" as const,
      amount: "100000.00",
      balanceAfter: "100000.00",
      status: "approved" as const,
      note: "Institutional Private Wealth Onboarding Allocation",
      counterparty: "Summit Treasury Liquidity Desk",
      processedById: 1,
      createdAt: new Date(now.getTime() - 28 * day),
      processedAt: new Date(now.getTime() - 28 * day),
    },
    {
      id: 2,
      accountId: 2,
      reference: "DEP-WIRE-4821",
      type: "deposit" as const,
      channel: "wire_domestic" as const,
      amount: "65000.00",
      balanceAfter: "165000.00",
      status: "approved" as const,
      note: "Fedwire incoming settlement from Goldman Sachs Escrow",
      counterparty: "Goldman Sachs Institutional",
      processedById: 1,
      createdAt: new Date(now.getTime() - 20 * day),
      processedAt: new Date(now.getTime() - 20 * day),
    },
    {
      id: 3,
      accountId: 2,
      reference: "WDR-SWIFT-9912",
      type: "withdrawal" as const,
      channel: "wire_international" as const,
      amount: "12500.00",
      balanceAfter: "152500.00",
      status: "approved" as const,
      note: "SWIFT wire to Lombard Odier Geneva",
      counterparty: "Lombard Odier & Cie (Geneva)",
      beneficiaryBank: "Lombard Odier Geneva",
      beneficiaryAccount: "CH8800762011623888888",
      processedById: 1,
      createdAt: new Date(now.getTime() - 14 * day),
      processedAt: new Date(now.getTime() - 14 * day),
    },
    {
      id: 4,
      accountId: 2,
      reference: "BILL-CONCIERGE-01",
      type: "bill_payment" as const,
      channel: "bill_payment" as const,
      amount: "4000.00",
      balanceAfter: "148500.00",
      status: "approved" as const,
      note: "Aviation Partners — Sovereign Jet Charter 482",
      counterparty: "NetJets Luxury Aviation",
      processedById: 1,
      createdAt: new Date(now.getTime() - 6 * day),
      processedAt: new Date(now.getTime() - 6 * day),
    },
    {
      id: 5,
      accountId: 2,
      reference: "DEP-CHK-8812",
      type: "deposit" as const,
      channel: "mobile_check" as const,
      amount: "18500.00",
      status: "pending" as const,
      note: "Mobile Check Deposit — Cashier's Check #009182",
      counterparty: "JPMorgan Private Bank",
      createdAt: new Date(now.getTime() - 1 * day),
      processedAt: null,
    },
    {
      id: 6,
      accountId: 2,
      reference: "WDR-OUT-3391",
      type: "withdrawal" as const,
      channel: "user_request" as const,
      amount: "7200.00",
      status: "pending" as const,
      note: "External wire to linked personal account at UBS Zurich",
      counterparty: "UBS Zurich Private Clients",
      beneficiaryBank: "UBS AG",
      beneficiaryAccount: "CH5500234011623899999",
      createdAt: new Date(now.getTime() - 12 * 3600 * 1000),
      processedAt: null,
    },
    {
      id: 7,
      accountId: 3,
      reference: "TOP-STERLING-01",
      type: "deposit" as const,
      channel: "admin_topup" as const,
      amount: "1250000.00",
      balanceAfter: "1250000.00",
      status: "approved" as const,
      note: "Sovereign Tier Capital Endowment",
      counterparty: "Summit Executive Board",
      processedById: 1,
      createdAt: new Date(now.getTime() - 40 * day),
      processedAt: new Date(now.getTime() - 40 * day),
    },
    {
      id: 8,
      accountId: 4,
      reference: "DEP-CRYPTO-552",
      type: "deposit" as const,
      channel: "crypto_settlement" as const,
      amount: "485000.00",
      balanceAfter: "485000.00",
      status: "approved" as const,
      note: "USDT Institutional Treasury Settlement (1:1 Peg)",
      counterparty: "Tether Institutional Custody",
      processedById: 1,
      createdAt: new Date(now.getTime() - 18 * day),
      processedAt: new Date(now.getTime() - 18 * day),
    },
  ];

  const transactions: StoredTransaction[] = rawTransactions.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    reference: t.reference,
    type: t.type,
    channel: t.channel,
    amount: t.amount,
    status: t.status,
    createdAt: t.createdAt,
    balanceAfter: (t as any).balanceAfter ?? null,
    note: (t as any).note ?? null,
    counterparty: (t as any).counterparty ?? null,
    beneficiaryBank: (t as any).beneficiaryBank ?? null,
    beneficiaryAccount: (t as any).beneficiaryAccount ?? null,
    estimatedApproval: (t as any).estimatedApproval ?? null,
    adminNote: (t as any).adminNote ?? null,
    expediteDepositRequired: (t as any).expediteDepositRequired ?? null,
    processedById: (t as any).processedById ?? null,
    processedAt: (t as any).processedAt ?? null,
  }));

  const cards: StoredCard[] = [
    {
      id: 1,
      userId: 2,
      accountId: 2,
      cardNumber: "4892 •••• •••• 9210",
      fullNumber: "4892410982349210",
      cardHolder: "AVA WHITFIELD",
      expiry: "09/30",
      cvv: "894",
      tier: "Titanium Black",
      type: "physical",
      status: "active",
      spendingLimit: 100000,
      spendingCurrent: 14250,
      isContactless: true,
      isInternational: true,
      createdAt: new Date(now.getTime() - 25 * day),
    },
    {
      id: 2,
      userId: 2,
      accountId: 2,
      cardNumber: "5421 •••• •••• 3341",
      fullNumber: "5421770291453341",
      cardHolder: "AVA WHITFIELD",
      expiry: "11/28",
      cvv: "321",
      tier: "Obsidian Reserve",
      type: "virtual",
      status: "active",
      spendingLimit: 25000,
      spendingCurrent: 4300,
      isContactless: true,
      isInternational: true,
      createdAt: new Date(now.getTime() - 15 * day),
    },
  ];

  const vaults: StoredVault[] = [
    {
      id: 1,
      userId: 2,
      name: "High-Yield Sovereign Vault",
      category: "yield",
      currentAmount: 85000,
      targetAmount: 150000,
      currency: "USD",
      apy: 5.25,
      accruedInterest: 1845.2,
      createdAt: new Date(now.getTime() - 28 * day),
    },
    {
      id: 2,
      userId: 2,
      name: "Swiss Gold Bullion Custody",
      category: "bullion",
      currentAmount: 45000,
      targetAmount: 100000,
      currency: "USD",
      apy: 4.1,
      accruedInterest: 712.5,
      createdAt: new Date(now.getTime() - 14 * day),
    },
    {
      id: 3,
      userId: 2,
      name: "Geneva Luxury Chalet Escrow",
      category: "property",
      currentAmount: 18500,
      targetAmount: 50000,
      currency: "USD",
      apy: 3.8,
      accruedInterest: 198.0,
      createdAt: new Date(now.getTime() - 10 * day),
    },
  ];

  const activityLogs: StoredActivityLog[] = [
    {
      id: 1,
      actorId: 1,
      actorName: "Summit Administrator",
      action: "Admin Account Top-Up",
      category: "admin_topup",
      details: "Credited $100,000.00 to Ava Whitfield (#104820193744)",
      timestamp: new Date(now.getTime() - 28 * day),
    },
    {
      id: 2,
      actorId: 1,
      actorName: "System Liquidity Desk",
      action: "Fedwire Inbound Clearing",
      category: "transfer",
      details: "Settled $65,000.00 inbound Fedwire for account #104820193744",
      timestamp: new Date(now.getTime() - 20 * day),
    },
    {
      id: 3,
      actorId: 2,
      actorName: "Ava Whitfield",
      action: "International SWIFT Initiated",
      category: "transfer",
      details: "Outgoing wire of $12,500.00 to Lombard Odier Geneva",
      timestamp: new Date(now.getTime() - 14 * day),
    },
    {
      id: 4,
      actorId: 1,
      actorName: "Summit Administrator",
      action: "Wire Verification & Release",
      category: "approval",
      details: "Approved SWIFT-9912 withdrawal to Lombard Odier Geneva",
      timestamp: new Date(now.getTime() - 14 * day),
    },
  ];

  return {
    users: [adminUser, demoUser, user3, user4, peterAdminUser],
    accounts: [adminAccount, demoAccount, acct3, acct4, peterAdminAccount],
    transactions,
    cards,
    vaults,
    activityLogs,
  };
}

export class StorageEngine {
  public users: StoredUser[] = [];
  public accounts: StoredAccount[] = [];
  public transactions: StoredTransaction[] = [];
  public cards: StoredCard[] = [];
  public vaults: StoredVault[] = [];
  public activityLogs: StoredActivityLog[] = [];

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        const parsed: SerializedData = JSON.parse(raw);
        if (parsed.users && parsed.accounts && parsed.transactions) {
          this.users = parsed.users.map((u) => ({
            ...u,
            createdAt: new Date(u.createdAt),
            updatedAt: new Date(u.updatedAt),
            lastSignInAt: new Date(u.lastSignInAt),
          }));
          this.accounts = parsed.accounts.map((a) => ({
            ...a,
            createdAt: new Date(a.createdAt),
            updatedAt: new Date(a.updatedAt),
          }));
          this.transactions = parsed.transactions.map((t) => ({
            ...t,
            createdAt: new Date(t.createdAt),
            processedAt: t.processedAt ? new Date(t.processedAt) : null,
          }));
          this.cards = (parsed.cards || []).map((c) => ({
            ...c,
            createdAt: new Date(c.createdAt),
          }));
          this.vaults = (parsed.vaults || []).map((v) => ({
            ...v,
            createdAt: new Date(v.createdAt),
          }));
          this.activityLogs = (parsed.activityLogs || []).map((l) => ({
            ...l,
            timestamp: new Date(l.timestamp),
          }));
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load existing bank storage, initializing clean dataset:", e);
    }
    const initial = getInitialData();
    this.users = initial.users;
    this.accounts = initial.accounts;
    this.transactions = initial.transactions;
    this.cards = initial.cards;
    this.vaults = initial.vaults;
    this.activityLogs = initial.activityLogs;
    this.persist();
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const serialized: SerializedData = {
        users: this.users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
          lastSignInAt: u.lastSignInAt.toISOString(),
        })),
        accounts: this.accounts.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        })),
        transactions: this.transactions.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          processedAt: t.processedAt ? t.processedAt.toISOString() : null,
        })),
        cards: this.cards.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        })),
        vaults: this.vaults.map((v) => ({
          ...v,
          createdAt: v.createdAt.toISOString(),
        })),
        activityLogs: this.activityLogs.map((l) => ({
          ...l,
          timestamp: l.timestamp.toISOString(),
        })),
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(serialized, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write bank storage file:", e);
    }
  }

  // --- Users ---
  getUsers(): StoredUser[] {
    return [...this.users];
  }

  findUserById(id: number): StoredUser | undefined {
    return this.users.find((u) => u.id === id);
  }

  findUserByUnionId(unionId: string): StoredUser | undefined {
    return this.users.find((u) => u.unionId.toLowerCase() === unionId.toLowerCase());
  }

  findUserByEmail(email: string): StoredUser | undefined {
    const unionId = `cred:${email.trim().toLowerCase()}`;
    return this.findUserByUnionId(unionId);
  }

  createUser(userData: {
    name: string;
    email: string;
    password?: string;
    passwordHash?: string;
    role?: "user" | "admin";
    tier?: StoredUser["tier"];
    phone?: string;
    country?: string;
  }): StoredUser {
    const id = (this.users.reduce((max, u) => Math.max(max, u.id), 0) || 0) + 1;
    const now = new Date();
    const newUser: StoredUser = {
      id,
      unionId: `cred:${userData.email.trim().toLowerCase()}`,
      name: userData.name,
      email: userData.email.trim().toLowerCase(),
      avatar: null,
      role: userData.role || "user",
      tier: userData.tier || "Private Wealth",
      phone: userData.phone || "+1 (555) 000-0000",
      country: userData.country || "United States",
      kycStatus: "verified",
      passwordHash: userData.passwordHash || (userData.password ? hashPassword(userData.password) : null),
      createdAt: now,
      updatedAt: now,
      lastSignInAt: now,
    };
    this.users.push(newUser);
    this.persist();
    return newUser;
  }

  updateUser(
    id: number,
    patch: Partial<Omit<StoredUser, "lastSignInAt" | "updatedAt">> & {
      lastSignInAt?: Date | string;
      updatedAt?: Date | string;
    },
  ): StoredUser | undefined {
    const user = this.users.find((u) => u.id === id);
    if (!user) return undefined;
    const lastSignInAt = patch.lastSignInAt !== undefined
      ? patch.lastSignInAt instanceof Date ? patch.lastSignInAt : new Date(patch.lastSignInAt)
      : user.lastSignInAt;
    const updatedAt = patch.updatedAt !== undefined
      ? patch.updatedAt instanceof Date ? patch.updatedAt : new Date(patch.updatedAt)
      : new Date();
    Object.assign(user, patch, { lastSignInAt, updatedAt });
    this.persist();
    return user;
  }

  // --- Accounts ---
  getAccounts(): StoredAccount[] {
    return [...this.accounts];
  }

  findAccountByUserId(userId: number): StoredAccount | undefined {
    return this.accounts.find((a) => a.userId === userId);
  }

  findAccountByNumber(accountNumber: string): StoredAccount | undefined {
    return this.accounts.find((a) => a.accountNumber === accountNumber.trim());
  }

  findAccountById(id: number): StoredAccount | undefined {
    return this.accounts.find((a) => a.id === id);
  }

  createAccount(userId: number, initialBalance = "0.00"): StoredAccount {
    const id = (this.accounts.reduce((max, a) => Math.max(max, a.id), 0) || 0) + 1;
    let digits = "";
    for (let i = 0; i < 10; i++) digits += Math.floor(Math.random() * 10).toString();
    const accountNumber = `10${digits}`;
    const now = new Date();
    const newAccount: StoredAccount = {
      id,
      userId,
      accountNumber,
      currency: "USD",
      balance: initialBalance,
      status: "active",
      routingNumber: "021000021",
      swiftBic: "SUMMITUS33XXX",
      iban: `CH9300762011${digits.slice(0, 11)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.push(newAccount);
    this.persist();
    return newAccount;
  }

  getOrCreateAccount(userId: number): StoredAccount {
    const existing = this.findAccountByUserId(userId);
    if (existing) return existing;
    return this.createAccount(userId);
  }

  setAccountBalance(accountId: number, balanceStr: string) {
    const acct = this.accounts.find((a) => a.id === accountId);
    if (acct) {
      acct.balance = balanceStr;
      acct.updatedAt = new Date();
      this.persist();
    }
  }

  setAccountStatus(accountId: number, status: "active" | "frozen") {
    const acct = this.accounts.find((a) => a.id === accountId);
    if (acct) {
      acct.status = status;
      acct.updatedAt = new Date();
      this.persist();
    }
  }

  // --- Transactions ---
  getTransactions(): StoredTransaction[] {
    return [...this.transactions].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  listAccountTransactions(accountId: number, limit = 200): StoredTransaction[] {
    return this.transactions
      .filter((t) => t.accountId === accountId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  findTransactionById(id: number): StoredTransaction | undefined {
    return this.transactions.find((t) => t.id === id);
  }

  addTransaction(
    tx: Omit<StoredTransaction, "id" | "createdAt" | "processedAt" | "balanceAfter" | "note" | "counterparty" | "beneficiaryBank" | "beneficiaryAccount" | "processedById" | "estimatedApproval" | "adminNote" | "expediteDepositRequired"> & {
      createdAt?: Date | string;
      processedAt?: Date | string | null;
      balanceAfter?: string | null;
      note?: string | null;
      counterparty?: string | null;
      beneficiaryBank?: string | null;
      beneficiaryAccount?: string | null;
      estimatedApproval?: string | null;
      adminNote?: string | null;
      expediteDepositRequired?: string | null;
      processedById?: number | null;
    },
  ): StoredTransaction {
    const id = (this.transactions.reduce((max, t) => Math.max(max, t.id), 0) || 0) + 1;
    const createdAt = tx.createdAt ? (tx.createdAt instanceof Date ? tx.createdAt : new Date(tx.createdAt)) : new Date();
    const processedAt = tx.processedAt ? (tx.processedAt instanceof Date ? tx.processedAt : new Date(tx.processedAt)) : null;

    const newTx: StoredTransaction = {
      ...tx,
      id,
      balanceAfter: tx.balanceAfter ?? null,
      note: tx.note ?? null,
      counterparty: tx.counterparty ?? null,
      beneficiaryBank: tx.beneficiaryBank ?? null,
      beneficiaryAccount: tx.beneficiaryAccount ?? null,
      estimatedApproval: tx.estimatedApproval ?? null,
      adminNote: tx.adminNote ?? null,
      expediteDepositRequired: tx.expediteDepositRequired ?? null,
      processedById: tx.processedById ?? null,
      createdAt,
      processedAt,
    };
    this.transactions.unshift(newTx);
    this.persist();
    return newTx;
  }

  updateTransaction(
    id: number,
    patch: Partial<Omit<StoredTransaction, "processedAt">> & { processedAt?: Date | string | null },
  ): StoredTransaction | undefined {
    const tx = this.transactions.find((t) => t.id === id);
    if (!tx) return undefined;
    const processedAt = patch.processedAt !== undefined
      ? patch.processedAt ? (patch.processedAt instanceof Date ? patch.processedAt : new Date(patch.processedAt)) : null
      : tx.processedAt;

    Object.assign(tx, { ...patch, processedAt });
    this.persist();
    return tx;
  }

  // --- Cards ---
  getCards(): StoredCard[] {
    return [...this.cards];
  }

  getCardsByUserId(userId: number): StoredCard[] {
    return this.cards.filter((c) => c.userId === userId);
  }

  findCardById(id: number): StoredCard | undefined {
    return this.cards.find((c) => c.id === id);
  }

  addCard(card: Omit<StoredCard, "id" | "createdAt">): StoredCard {
    const id = (this.cards.reduce((max, c) => Math.max(max, c.id), 0) || 0) + 1;
    const newCard: StoredCard = {
      ...card,
      id,
      createdAt: new Date(),
    };
    this.cards.push(newCard);
    this.persist();
    return newCard;
  }

  updateCard(id: number, patch: Partial<StoredCard>): StoredCard | undefined {
    const card = this.cards.find((c) => c.id === id);
    if (!card) return undefined;
    Object.assign(card, patch);
    this.persist();
    return card;
  }

  // --- Vaults ---
  getVaults(): StoredVault[] {
    return [...this.vaults];
  }

  getVaultsByUserId(userId: number): StoredVault[] {
    return this.vaults.filter((v) => v.userId === userId);
  }

  findVaultById(id: number): StoredVault | undefined {
    return this.vaults.find((v) => v.id === id);
  }

  addVault(vault: Omit<StoredVault, "id" | "createdAt" | "accruedInterest">): StoredVault {
    const id = (this.vaults.reduce((max, v) => Math.max(max, v.id), 0) || 0) + 1;
    const newVault: StoredVault = {
      ...vault,
      id,
      accruedInterest: 0,
      createdAt: new Date(),
    };
    this.vaults.push(newVault);
    this.persist();
    return newVault;
  }

  updateVault(id: number, patch: Partial<StoredVault>): StoredVault | undefined {
    const vault = this.vaults.find((v) => v.id === id);
    if (!vault) return undefined;
    Object.assign(vault, patch);
    this.persist();
    return vault;
  }

  // --- Activity Logs ---
  getActivityLogs(limit = 100): StoredActivityLog[] {
    return [...this.activityLogs]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  logActivity(log: Omit<StoredActivityLog, "id" | "timestamp">): StoredActivityLog {
    const id = (this.activityLogs.reduce((max, l) => Math.max(max, l.id), 0) || 0) + 1;
    const newLog: StoredActivityLog = {
      ...log,
      id,
      timestamp: new Date(),
    };
    this.activityLogs.unshift(newLog);
    this.persist();
    return newLog;
  }
}

export const dbStorage = new StorageEngine();
