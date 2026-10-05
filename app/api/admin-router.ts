import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery } from "./middleware";
import { dbStorage } from "./queries/storage";
import { fromCents, generateReference, setAccountBalance, toCents } from "./queries/banking";

const amountSchema = z
  .number()
  .positive("Amount must be greater than zero")
  .max(1_000_000_000, "Amount exceeds the allowed limit");

export const adminRouter = createRouter({
  overview: adminQuery.query(async () => {
    const users = dbStorage.getUsers().filter((u) => u.role === "user");
    const accounts = dbStorage.getAccounts();
    const transactions = dbStorage.getTransactions();

    const totalBalanceCents = accounts.reduce((acc, a) => acc + toCents(a.balance), 0);
    const pendingCount = transactions.filter((t) => t.status === "pending").length;

    const approvedDepositsCents = transactions
      .filter((t) => t.status === "approved" && (t.type === "deposit" || t.type === "transfer_in"))
      .reduce((acc, t) => acc + toCents(t.amount), 0);

    const approvedWithdrawalsCents = transactions
      .filter((t) => t.status === "approved" && (t.type === "withdrawal" || t.type === "transfer_out" || t.type === "bill_payment"))
      .reduce((acc, t) => acc + toCents(t.amount), 0);

    const totalCards = dbStorage.getCards().length;
    const totalVaultAssets = dbStorage.getVaults().reduce((acc, v) => acc + v.currentAmount, 0);

    return {
      totalUsers: users.length,
      totalBalance: fromCents(totalBalanceCents),
      pendingCount,
      totalDeposits: fromCents(approvedDepositsCents),
      totalWithdrawals: fromCents(approvedWithdrawalsCents),
      totalCards,
      totalVaultAssets: fromCents(Math.round(totalVaultAssets * 100)),
    };
  }),

  listUsers: adminQuery.query(async () => {
    const users = dbStorage.getUsers();
    const accounts = dbStorage.getAccounts();
    const transactions = dbStorage.getTransactions();

    return users.map((u) => {
      const acct = accounts.find((a) => a.userId === u.id);
      const pendingCount = acct
        ? transactions.filter((t) => t.accountId === acct.id && t.status === "pending").length
        : 0;

      return {
        user: { ...u, passwordHash: undefined },
        account: acct,
        pendingCount,
      };
    });
  }),

  userDetail: adminQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const user = dbStorage.findUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const account = dbStorage.findAccountByUserId(user.id);
      const txs = account ? dbStorage.listAccountTransactions(account.id, 100) : [];
      const cards = dbStorage.getCardsByUserId(user.id);
      const vaults = dbStorage.getVaultsByUserId(user.id);

      return {
        user: { ...user, passwordHash: undefined },
        account,
        transactions: txs,
        cards,
        vaults,
      };
    }),

  // Admin Top-Up
  topUp: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        amount: amountSchema,
        channel: z
          .enum([
            "admin_topup",
            "wire_domestic",
            "wire_international",
            "crypto_settlement",
          ])
          .default("admin_topup"),
        channelName: z.string().optional(),
        reference: z.string().optional(),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = dbStorage.findAccountByUserId(input.userId);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User account not found." });
      }
      if (account.status !== "active") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account is frozen. Unfreeze it before topping up.",
        });
      }

      const user = dbStorage.findUserById(input.userId);
      const amountCents = toCents(input.amount);
      const balanceCents = toCents(account.balance);
      const after = balanceCents + amountCents;
      const now = new Date().toISOString();
      const ref = input.reference?.trim() || generateReference("TOP");

      await setAccountBalance(account.id, after);

      const tx = dbStorage.addTransaction({
        accountId: account.id,
        reference: ref,
        type: "deposit",
        channel: input.channel,
        amount: fromCents(amountCents),
        balanceAfter: fromCents(after),
        status: "approved",
        note: input.note || input.channelName || "Administrative Capital Allocation",
        counterparty: "Summit Treasury Liquidity Desk",
        processedById: ctx.user.id,
        processedAt: now,
      });

      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: ctx.user.name || "Administrator",
        action: "Account Top-Up Executed",
        category: "admin_topup",
        details: `Credited $${input.amount.toLocaleString()} to ${user?.name || "Client"} (${account.accountNumber}) · Ref: ${ref}`,
      });

      return { success: true, transaction: tx };
    }),

  // Legacy Adjust Balance
  adjustBalance: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        direction: z.enum(["credit", "debit"]),
        amount: amountSchema,
        note: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = dbStorage.findAccountByUserId(input.userId);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      if (account.status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Account is frozen." });
      }

      const amountCents = toCents(input.amount);
      const balanceCents = toCents(account.balance);
      const isCredit = input.direction === "credit";

      if (!isCredit && amountCents > balanceCents) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debit exceeds the user's current balance.",
        });
      }

      const after = isCredit ? balanceCents + amountCents : balanceCents - amountCents;
      const now = new Date().toISOString();
      await setAccountBalance(account.id, after);

      dbStorage.addTransaction({
        accountId: account.id,
        reference: generateReference(isCredit ? "TOP" : "ADJ"),
        type: isCredit ? "deposit" : "withdrawal",
        channel: "admin_topup",
        amount: fromCents(amountCents),
        balanceAfter: fromCents(after),
        status: "approved",
        note: input.note || (isCredit ? "Admin top-up" : "Admin debit"),
        processedById: ctx.user.id,
        processedAt: now,
      });

      return { success: true };
    }),

  // Deposit History
  depositHistory: adminQuery
    .input(
      z.object({
        status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(200),
      }),
    )
    .query(async ({ input }) => {
      const allTx = dbStorage.getTransactions();
      const accounts = dbStorage.getAccounts();
      const users = dbStorage.getUsers();

      const deposits = allTx.filter((t) => t.type === "deposit" || t.type === "transfer_in");

      const enriched = deposits.map((t) => {
        const acct = accounts.find((a) => a.id === t.accountId);
        const user = acct ? users.find((u) => u.id === acct.userId) : undefined;
        return {
          transaction: t,
          accountNumber: acct?.accountNumber || "—",
          userName: user?.name || "—",
          userEmail: user?.email || "—",
        };
      });

      return enriched
        .filter((row) => {
          if (input.status !== "all" && row.transaction.status !== input.status) return false;
          if (input.search) {
            const q = input.search.toLowerCase();
            return (
              row.userName.toLowerCase().includes(q) ||
              row.userEmail.toLowerCase().includes(q) ||
              row.accountNumber.toLowerCase().includes(q) ||
              row.transaction.reference.toLowerCase().includes(q) ||
              (row.transaction.note && row.transaction.note.toLowerCase().includes(q))
            );
          }
          return true;
        })
        .slice(0, input.limit);
    }),

  // Payment History
  paymentHistory: adminQuery
    .input(
      z.object({
        status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(200),
      }),
    )
    .query(async ({ input }) => {
      const allTx = dbStorage.getTransactions();
      const accounts = dbStorage.getAccounts();
      const users = dbStorage.getUsers();

      const payments = allTx.filter(
        (t) =>
          t.type === "transfer_out" ||
          t.type === "bill_payment" ||
          (t.type === "withdrawal" &&
            (t.channel === "wire_domestic" || t.channel === "wire_international")),
      );

      const enriched = payments.map((t) => {
        const acct = accounts.find((a) => a.id === t.accountId);
        const user = acct ? users.find((u) => u.id === acct.userId) : undefined;
        return {
          transaction: t,
          accountNumber: acct?.accountNumber || "—",
          userName: user?.name || "—",
          userEmail: user?.email || "—",
        };
      });

      return enriched
        .filter((row) => {
          if (input.status !== "all" && row.transaction.status !== input.status) return false;
          if (input.search) {
            const q = input.search.toLowerCase();
            return (
              row.userName.toLowerCase().includes(q) ||
              row.userEmail.toLowerCase().includes(q) ||
              row.transaction.reference.toLowerCase().includes(q) ||
              (row.transaction.counterparty &&
                row.transaction.counterparty.toLowerCase().includes(q))
            );
          }
          return true;
        })
        .slice(0, input.limit);
    }),

  // Withdrawal History
  withdrawalHistory: adminQuery
    .input(
      z.object({
        status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(200),
      }),
    )
    .query(async ({ input }) => {
      const allTx = dbStorage.getTransactions();
      const accounts = dbStorage.getAccounts();
      const users = dbStorage.getUsers();

      const withdrawals = allTx.filter((t) => t.type === "withdrawal");

      const enriched = withdrawals.map((t) => {
        const acct = accounts.find((a) => a.id === t.accountId);
        const user = acct ? users.find((u) => u.id === acct.userId) : undefined;
        return {
          transaction: t,
          accountNumber: acct?.accountNumber || "—",
          userName: user?.name || "—",
          userEmail: user?.email || "—",
        };
      });

      return enriched
        .filter((row) => {
          if (input.status !== "all" && row.transaction.status !== input.status) return false;
          if (input.search) {
            const q = input.search.toLowerCase();
            return (
              row.userName.toLowerCase().includes(q) ||
              row.userEmail.toLowerCase().includes(q) ||
              row.transaction.reference.toLowerCase().includes(q) ||
              (row.transaction.beneficiaryBank &&
                row.transaction.beneficiaryBank.toLowerCase().includes(q))
            );
          }
          return true;
        })
        .slice(0, input.limit);
    }),

  // Decide (Approve / Reject)
  decide: adminQuery
    .input(
      z.object({
        transactionId: z.number().int().positive(),
        approve: z.boolean(),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tx = dbStorage.findTransactionById(input.transactionId);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      if (tx.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already processed." });
      }

      const now = new Date().toISOString();
      if (!input.approve) {
        dbStorage.updateTransaction(tx.id, {
          status: "rejected",
          note: input.note || tx.note,
          processedById: ctx.user.id,
          processedAt: now,
        });

        dbStorage.logActivity({
          actorId: ctx.user.id,
          actorName: ctx.user.name || "Administrator",
          action: "Request Rejected",
          category: "approval",
          details: `Rejected transaction #${tx.reference} (${tx.type}) for $${tx.amount}`,
        });

        return { success: true };
      }

      const account = dbStorage.findAccountById(tx.accountId);
      if (!account || account.status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Linked account is missing or frozen." });
      }

      const amountCents = toCents(tx.amount);
      const balanceCents = toCents(account.balance);
      const isCredit = tx.type === "deposit" || tx.type === "transfer_in";

      if (!isCredit && amountCents > balanceCents) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient balance to approve withdrawal. Reject it instead.",
        });
      }

      const after = isCredit ? balanceCents + amountCents : balanceCents - amountCents;
      await setAccountBalance(account.id, after);

      dbStorage.updateTransaction(tx.id, {
        status: "approved",
        balanceAfter: fromCents(after),
        note: input.note || tx.note,
        processedById: ctx.user.id,
        processedAt: now,
      });

      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: ctx.user.name || "Administrator",
        action: "Request Approved",
        category: "approval",
        details: `Approved transaction #${tx.reference} (${tx.type}) of $${tx.amount} — settled balance: $${fromCents(after)}`,
      });

      return { success: true };
    }),

  // Batch Decide
  batchDecide: adminQuery
    .input(
      z.object({
        transactionIds: z.array(z.number().int().positive()),
        approve: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let count = 0;
      for (const id of input.transactionIds) {
        const tx = dbStorage.findTransactionById(id);
        if (tx && tx.status === "pending") {
          const now = new Date().toISOString();
          if (input.approve) {
            const acct = dbStorage.findAccountById(tx.accountId);
            if (acct && acct.status === "active") {
              const amtCents = toCents(tx.amount);
              const balCents = toCents(acct.balance);
              const isCredit = tx.type === "deposit" || tx.type === "transfer_in";
              if (isCredit || balCents >= amtCents) {
                const after = isCredit ? balCents + amtCents : balCents - amtCents;
                await setAccountBalance(acct.id, after);
                dbStorage.updateTransaction(tx.id, {
                  status: "approved",
                  balanceAfter: fromCents(after),
                  processedById: ctx.user.id,
                  processedAt: now,
                });
                count++;
              }
            }
          } else {
            dbStorage.updateTransaction(tx.id, {
              status: "rejected",
              processedById: ctx.user.id,
              processedAt: now,
            });
            count++;
          }
        }
      }
      return { success: true, processedCount: count };
    }),

  // General Ledger
  listTransactions: adminQuery
    .input(
      z.object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      }),
    )
    .query(async ({ input }) => {
      const allTx = dbStorage.getTransactions();
      const accounts = dbStorage.getAccounts();
      const users = dbStorage.getUsers();

      return allTx
        .filter((t) => !input.status || t.status === input.status)
        .slice(0, input.limit)
        .map((t) => {
          const acct = accounts.find((a) => a.id === t.accountId);
          const user = acct ? users.find((u) => u.id === acct.userId) : undefined;
          return {
            transaction: t,
            accountNumber: acct?.accountNumber || "—",
            userName: user?.name || "—",
            userEmail: user?.email || "—",
          };
        });
    }),

  // Create Client
  createClient: adminQuery
    .input(
      z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        password: z.string().min(6).default("SummitClient!2026"),
        initialBalance: z.number().min(0).default(50000),
        tier: z
          .enum(["Standard", "Private Wealth", "Black Diamond", "Sovereign Reserve", "Institutional"])
          .default("Private Wealth"),
        country: z.string().default("Switzerland"),
        phone: z.string().default("+41 22 555 0100"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = dbStorage.findUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A client with this email already exists.",
        });
      }

      const user = dbStorage.createUser({
        name: input.name,
        email: input.email,
        password: input.password,
        role: "user",
        tier: input.tier,
        country: input.country,
        phone: input.phone,
      });

      const account = dbStorage.createAccount(user.id, fromCents(toCents(input.initialBalance)));

      if (input.initialBalance > 0) {
        dbStorage.addTransaction({
          accountId: account.id,
          reference: generateReference("INIT"),
          type: "deposit",
          channel: "admin_topup",
          amount: fromCents(toCents(input.initialBalance)),
          balanceAfter: fromCents(toCents(input.initialBalance)),
          status: "approved",
          note: "Opening Balance — Client Onboarding Capitalization",
          counterparty: "Summit Executive Board",
          processedById: ctx.user.id,
          processedAt: new Date().toISOString(),
        });
      }

      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: ctx.user.name || "Administrator",
        action: "Client Onboarded",
        category: "admin_topup",
        details: `Created new client ${input.name} (${input.email}) with initial balance of $${input.initialBalance.toLocaleString()}`,
      });

      return { success: true, user, account };
    }),

  // Update Tier
  updateClientTier: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        tier: z.enum(["Standard", "Private Wealth", "Black Diamond", "Sovereign Reserve", "Institutional"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = dbStorage.updateUser(input.userId, { tier: input.tier });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: ctx.user.name || "Administrator",
        action: "Tier Elevation",
        category: "status_change",
        details: `Updated ${user.name}'s tier to ${input.tier}`,
      });

      return user;
    }),

  setAccountStatus: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        status: z.enum(["active", "frozen"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = dbStorage.findAccountByUserId(input.userId);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });

      dbStorage.setAccountStatus(account.id, input.status);

      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: ctx.user.name || "Administrator",
        action: input.status === "frozen" ? "Account Frozen" : "Account Unfrozen",
        category: "status_change",
        details: `Set status of account #${account.accountNumber} to ${input.status}`,
      });

      return { success: true };
    }),

  // Activity Logs
  activityLogs: adminQuery.query(async () => {
    return dbStorage.getActivityLogs(50);
  }),

  // Update Clearance Schedule & Notes for Pending Transaction
  updateApprovalSchedule: adminQuery
    .input(
      z.object({
        transactionId: z.number().int().positive(),
        estimatedApproval: z.string().max(255).optional(),
        adminNote: z.string().max(500).optional(),
        expediteDepositRequired: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tx = dbStorage.findTransactionById(input.transactionId);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });

      const patch: any = {};
      if (input.estimatedApproval !== undefined) patch.estimatedApproval = input.estimatedApproval;
      if (input.adminNote !== undefined) patch.adminNote = input.adminNote;
      if (input.expediteDepositRequired !== undefined) patch.expediteDepositRequired = input.expediteDepositRequired.toFixed(2);

      const updated = dbStorage.updateTransaction(tx.id, patch);

      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: ctx.user.name || "Administrator",
        action: "Clearance Schedule Updated",
        category: "approval",
        details: `Updated clearance schedule for tx #${tx.reference}: ${input.estimatedApproval || input.adminNote || ""}`,
      });

      return updated;
    }),

  // Add Any Custom Transaction to Any Registered Account
  addCustomTransaction: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        type: z.enum(["deposit", "withdrawal", "transfer_in", "transfer_out", "bill_payment", "card_spend"]),
        channel: z.enum([
          "admin_topup",
          "wire_domestic",
          "wire_international",
          "mobile_check",
          "crypto_settlement",
          "transfer",
          "bill_payment",
          "card_spend",
          "user_request",
        ]).default("admin_topup"),
        amount: amountSchema,
        status: z.enum(["approved", "pending", "rejected"]).default("approved"),
        reference: z.string().max(40).optional(),
        note: z.string().max(500).optional(),
        counterparty: z.string().max(255).optional(),
        beneficiaryBank: z.string().max(255).optional(),
        beneficiaryAccount: z.string().max(255).optional(),
        createdAt: z.string().optional(),
        estimatedApproval: z.string().max(255).optional(),
        adminNote: z.string().max(500).optional(),
        expediteDepositRequired: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = dbStorage.findAccountByUserId(input.userId);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });

      const amountCents = toCents(input.amount);
      const balanceCents = toCents(account.balance);
      const isCredit = input.type === "deposit" || input.type === "transfer_in";
      let after = balanceCents;

      if (input.status === "approved") {
        if (!isCredit && amountCents > balanceCents) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Debit exceeds the user's available balance.",
          });
        }
        after = isCredit ? balanceCents + amountCents : balanceCents - amountCents;
        await setAccountBalance(account.id, after);
      }

      const ref = input.reference?.trim() || generateReference(input.type.toUpperCase().slice(0, 3));
      const now = input.createdAt || new Date().toISOString();

      const tx = dbStorage.addTransaction({
        accountId: account.id,
        reference: ref,
        type: input.type,
        channel: input.channel,
        amount: fromCents(amountCents),
        balanceAfter: input.status === "approved" ? fromCents(after) : null,
        status: input.status,
        note: input.note || null,
        counterparty: input.counterparty || (isCredit ? "Inbound Clearing" : "Disbursement Facility"),
        beneficiaryBank: input.beneficiaryBank || null,
        beneficiaryAccount: input.beneficiaryAccount || null,
        estimatedApproval: input.estimatedApproval || null,
        adminNote: input.adminNote || null,
        expediteDepositRequired: input.expediteDepositRequired ? input.expediteDepositRequired.toFixed(2) : null,
        processedById: ctx.user.id,
        createdAt: now,
        processedAt: input.status === "approved" ? new Date().toISOString() : null,
      });

      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: ctx.user.name || "Administrator",
        action: "Custom Ledger Transaction Added",
        category: "admin_topup",
        details: `Recorded ${input.type} of $${input.amount.toLocaleString()} for account #${account.accountNumber} · Status: ${input.status}`,
      });

      return { success: true, transaction: tx };
    }),
});
