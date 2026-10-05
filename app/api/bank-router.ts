import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import {
  fromCents,
  generateReference,
  getOrCreateAccount,
  listAccountTransactions,
  setAccountBalance,
  toCents,
} from "./queries/banking";
import { dbStorage } from "./queries/storage";

const amountSchema = z
  .number()
  .positive("Amount must be greater than zero")
  .max(1_000_000_000, "Amount exceeds the allowed limit")
  .refine((v) => Math.round(v * 100) === v * 100, {
    message: "Amount can have at most 2 decimal places",
  });

function assertActive(status: string) {
  if (status !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This account is currently frozen. Please contact your private banking officer.",
    });
  }
}

export const bankRouter = createRouter({
  account: authedQuery.query(async ({ ctx }) => {
    const acct = await getOrCreateAccount(ctx.user.id);
    const user = dbStorage.findUserById(ctx.user.id);
    return {
      ...acct,
      tier: user?.tier || "Private Wealth",
      kycStatus: user?.kycStatus || "verified",
      routingNumber: acct.routingNumber || "021000021",
      swiftBic: acct.swiftBic || "SUMMITUS33XXX",
      iban: acct.iban || `CH9300762011${acct.accountNumber.slice(0, 11)}`,
    };
  }),

  transactions: authedQuery
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
    .query(async ({ ctx, input }) => {
      const account = await getOrCreateAccount(ctx.user.id);
      return listAccountTransactions(account.id, input.limit);
    }),

  // Standard Deposit Request
  requestDeposit: authedQuery
    .input(
      z.object({
        amount: amountSchema,
        note: z.string().max(300).optional(),
        channel: z
          .enum(["user_request", "wire_domestic", "wire_international", "mobile_check", "crypto_settlement"])
          .default("user_request"),
        counterparty: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = await getOrCreateAccount(ctx.user.id);
      assertActive(account.status);

      dbStorage.addTransaction({
        accountId: account.id,
        reference: generateReference("DEP"),
        type: "deposit",
        channel: input.channel,
        amount: fromCents(toCents(input.amount)),
        status: "pending",
        note: input.note || "Direct deposit notification",
        counterparty: input.counterparty || "Summit Liquidity Clearance",
      });

      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: ctx.user.name || ctx.user.email || "Client",
        action: "Deposit Requested",
        category: "transfer",
        details: `Requested deposit of $${input.amount.toLocaleString()} via ${input.channel}`,
      });

      return { success: true };
    }),

  // Mobile Check Deposit
  depositCheck: authedQuery
    .input(
      z.object({
        amount: amountSchema,
        checkNumber: z.string().min(3).max(20),
        issuerBank: z.string().min(2).max(100),
        frontImage: z.string().optional(),
        backImage: z.string().optional(),
        note: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = await getOrCreateAccount(ctx.user.id);
      assertActive(account.status);

      dbStorage.addTransaction({
        accountId: account.id,
        reference: generateReference("CHK"),
        type: "deposit",
        channel: "mobile_check",
        amount: fromCents(toCents(input.amount)),
        status: "pending",
        note: `Check #${input.checkNumber} · ${input.issuerBank}${input.note ? ` (${input.note})` : ""}`,
        counterparty: input.issuerBank,
      });

      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: ctx.user.name || ctx.user.email || "Client",
        action: "Mobile Check Submitted",
        category: "transfer",
        details: `Submitted check #${input.checkNumber} for $${input.amount.toLocaleString()} from ${input.issuerBank}`,
      });

      return { success: true, reference: generateReference("CHK") };
    }),

  // Crypto Asset Settlement
  depositCrypto: authedQuery
    .input(
      z.object({
        asset: z.enum(["USDT", "BTC", "ETH", "USDC"]),
        amountCrypto: z.number().positive(),
        amountUsd: amountSchema,
        txHash: z.string().min(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = await getOrCreateAccount(ctx.user.id);
      assertActive(account.status);

      dbStorage.addTransaction({
        accountId: account.id,
        reference: generateReference("CRYPTO"),
        type: "deposit",
        channel: "crypto_settlement",
        amount: fromCents(toCents(input.amountUsd)),
        status: "pending",
        note: `${input.asset} Settlement: ${input.amountCrypto} ${input.asset} (Tx: ${input.txHash.slice(0, 10)}...)`,
        counterparty: `${input.asset} Institutional Custody`,
      });

      return { success: true };
    }),

  // Withdrawal Request
  requestWithdrawal: authedQuery
    .input(
      z.object({
        amount: amountSchema,
        destinationBank: z.string().min(2).max(100).optional(),
        destinationAccount: z.string().min(4).max(50).optional(),
        routingOrSwift: z.string().min(4).max(30).optional(),
        note: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = await getOrCreateAccount(ctx.user.id);
      assertActive(account.status);

      const balanceCents = toCents(account.balance);
      const amountCents = toCents(input.amount);
      if (amountCents > balanceCents) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient available balance for this withdrawal.",
        });
      }

      dbStorage.addTransaction({
        accountId: account.id,
        reference: generateReference("WDR"),
        type: "withdrawal",
        channel: "user_request",
        amount: fromCents(amountCents),
        status: "pending",
        note: input.note || "Client wire withdrawal request",
        beneficiaryBank: input.destinationBank || "External Financial Institution",
        beneficiaryAccount: input.destinationAccount || null,
        counterparty: input.destinationBank || "Linked Destination Account",
      });

      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: ctx.user.name || ctx.user.email || "Client",
        action: "Withdrawal Requested",
        category: "transfer",
        details: `Requested withdrawal of $${input.amount.toLocaleString()} to ${input.destinationBank || "external bank"}`,
      });

      return { success: true };
    }),

  // Internal P2P Summit Transfer
  transfer: authedQuery
    .input(
      z.object({
        toAccountNumber: z.string().trim().min(6).max(32),
        amount: amountSchema,
        note: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sender = await getOrCreateAccount(ctx.user.id);
      assertActive(sender.status);

      const recipient = dbStorage.findAccountByNumber(input.toAccountNumber);
      if (!recipient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No account found with that account number.",
        });
      }
      if (recipient.id === sender.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot transfer to your own account.",
        });
      }
      assertActive(recipient.status);

      const amountCents = toCents(input.amount);
      const senderCents = toCents(sender.balance);
      if (amountCents > senderCents) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient available balance for this transfer.",
        });
      }

      const recipientCents = toCents(recipient.balance);
      const senderAfter = senderCents - amountCents;
      const recipientAfter = recipientCents + amountCents;
      const now = new Date().toISOString();
      const ref = generateReference("TRF");

      const recipientUser = dbStorage.findUserById(recipient.userId);
      const senderName = ctx.user.name || ctx.user.email || "Summit Client";
      const recipientName = recipientUser?.name || recipient.accountNumber;

      await setAccountBalance(sender.id, senderAfter);
      await setAccountBalance(recipient.id, recipientAfter);

      dbStorage.addTransaction({
        accountId: sender.id,
        reference: `${ref}-OUT`,
        type: "transfer_out",
        channel: "transfer",
        amount: fromCents(amountCents),
        balanceAfter: fromCents(senderAfter),
        status: "approved",
        note: input.note || `Internal transfer to ${recipientName}`,
        counterparty: recipientName,
        processedAt: now,
      });

      dbStorage.addTransaction({
        accountId: recipient.id,
        reference: `${ref}-IN`,
        type: "transfer_in",
        channel: "transfer",
        amount: fromCents(amountCents),
        balanceAfter: fromCents(recipientAfter),
        status: "approved",
        note: input.note || `Internal transfer from ${senderName}`,
        counterparty: senderName,
        processedAt: now,
      });

      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: senderName,
        action: "P2P Transfer Completed",
        category: "transfer",
        details: `Transferred $${input.amount.toLocaleString()} to ${recipientName} (${recipient.accountNumber})`,
      });

      return { success: true, reference: ref };
    }),

  // External Wire Transfer (Fedwire / SWIFT)
  wireTransfer: authedQuery
    .input(
      z.object({
        beneficiaryName: z.string().min(2).max(100),
        beneficiaryBank: z.string().min(2).max(100),
        accountOrIban: z.string().min(5).max(40),
        routingOrSwift: z.string().min(4).max(30),
        amount: amountSchema,
        currency: z.string().default("USD"),
        type: z.enum(["domestic", "international"]),
        purpose: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sender = await getOrCreateAccount(ctx.user.id);
      assertActive(sender.status);

      const fee = input.type === "international" ? 45 : 25;
      const totalCents = toCents(input.amount + fee);
      const senderCents = toCents(sender.balance);

      if (totalCents > senderCents) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient balance including the $${fee}.00 wire processing fee.`,
        });
      }

      const senderAfter = senderCents - totalCents;
      const now = new Date().toISOString();
      const ref = generateReference(input.type === "international" ? "SWIFT" : "WIRE");

      await setAccountBalance(sender.id, senderAfter);

      dbStorage.addTransaction({
        accountId: sender.id,
        reference: ref,
        type: "withdrawal",
        channel: input.type === "international" ? "wire_international" : "wire_domestic",
        amount: fromCents(totalCents),
        balanceAfter: fromCents(senderAfter),
        status: "approved",
        note: `${input.type === "international" ? "SWIFT Wire" : "Fedwire"} to ${input.beneficiaryName} · ${input.beneficiaryBank} (${input.purpose || "Settlement"})`,
        counterparty: `${input.beneficiaryName} · ${input.beneficiaryBank}`,
        beneficiaryBank: input.beneficiaryBank,
        beneficiaryAccount: input.accountOrIban,
        processedAt: now,
      });

      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: ctx.user.name || ctx.user.email || "Client",
        action: "Wire Transfer Executed",
        category: "transfer",
        details: `Sent $${input.amount.toLocaleString()} wire to ${input.beneficiaryName} (${input.beneficiaryBank})`,
      });

      return { success: true, reference: ref, fee };
    }),

  // Bill Pay
  payBill: authedQuery
    .input(
      z.object({
        payee: z.string().min(2).max(100),
        category: z.string(),
        accountReference: z.string().min(4).max(50),
        amount: amountSchema,
        memo: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = await getOrCreateAccount(ctx.user.id);
      assertActive(account.status);

      const amountCents = toCents(input.amount);
      const balanceCents = toCents(account.balance);
      if (amountCents > balanceCents) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient funds for bill payment.",
        });
      }

      const after = balanceCents - amountCents;
      const now = new Date().toISOString();
      const ref = generateReference("BILL");

      await setAccountBalance(account.id, after);

      dbStorage.addTransaction({
        accountId: account.id,
        reference: ref,
        type: "bill_payment",
        channel: "bill_payment",
        amount: fromCents(amountCents),
        balanceAfter: fromCents(after),
        status: "approved",
        note: `Bill Payment to ${input.payee} (Ref: ${input.accountReference})${input.memo ? ` · ${input.memo}` : ""}`,
        counterparty: input.payee,
        processedAt: now,
      });

      return { success: true, reference: ref };
    }),

  // Cards
  cards: authedQuery.query(async ({ ctx }) => {
    return dbStorage.getCardsByUserId(ctx.user.id);
  }),

  updateCard: authedQuery
    .input(
      z.object({
        cardId: z.number().int().positive(),
        status: z.enum(["active", "frozen"]).optional(),
        isContactless: z.boolean().optional(),
        isInternational: z.boolean().optional(),
        spendingLimit: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const card = dbStorage.findCardById(input.cardId);
      if (!card || card.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      }

      const patch: any = {};
      if (input.status !== undefined) patch.status = input.status;
      if (input.isContactless !== undefined) patch.isContactless = input.isContactless;
      if (input.isInternational !== undefined) patch.isInternational = input.isInternational;
      if (input.spendingLimit !== undefined) patch.spendingLimit = input.spendingLimit;

      const updated = dbStorage.updateCard(card.id, patch);
      dbStorage.logActivity({
        actorId: ctx.user.id,
        actorName: ctx.user.name || ctx.user.email || "Client",
        action: "Card Settings Updated",
        category: "card_management",
        details: `Updated settings for card ending in ${card.cardNumber.slice(-4)}`,
      });

      return updated;
    }),

  issueCard: authedQuery
    .input(
      z.object({
        type: z.enum(["virtual", "physical"]),
        tier: z.enum(["Titanium Black", "Sovereign Gold", "Obsidian Reserve"]),
        spendingLimit: z.number().positive().default(25000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = await getOrCreateAccount(ctx.user.id);
      const user = dbStorage.findUserById(ctx.user.id);
      const name = user?.name?.toUpperCase() || "SUMMIT CLIENT";

      let fullDigits = "4532";
      for (let i = 0; i < 12; i++) fullDigits += Math.floor(Math.random() * 10).toString();
      const masked = `${fullDigits.slice(0, 4)} •••• •••• ${fullDigits.slice(-4)}`;
      const cvv = Math.floor(100 + Math.random() * 900).toString();

      const newCard = dbStorage.addCard({
        userId: ctx.user.id,
        accountId: account.id,
        cardNumber: masked,
        fullNumber: fullDigits,
        cardHolder: name,
        expiry: "12/29",
        cvv,
        tier: input.tier,
        type: input.type,
        status: "active",
        spendingLimit: input.spendingLimit,
        spendingCurrent: 0,
        isContactless: true,
        isInternational: true,
      });

      return newCard;
    }),

  // Vaults
  vaults: authedQuery.query(async ({ ctx }) => {
    return dbStorage.getVaultsByUserId(ctx.user.id);
  }),

  createVault: authedQuery
    .input(
      z.object({
        name: z.string().min(2).max(60),
        category: z.enum(["yield", "property", "bullion", "reserve"]),
        targetAmount: z.number().positive(),
        initialDeposit: z.number().min(0).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = await getOrCreateAccount(ctx.user.id);
      let initialAmt = 0;

      if (input.initialDeposit > 0) {
        const balCents = toCents(account.balance);
        const depCents = toCents(input.initialDeposit);
        if (depCents > balCents) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Insufficient account balance for initial vault deposit.",
          });
        }
        await setAccountBalance(account.id, balCents - depCents);
        initialAmt = input.initialDeposit;
      }

      const apyMap = {
        yield: 5.25,
        bullion: 4.1,
        property: 3.8,
        reserve: 4.5,
      };

      const vault = dbStorage.addVault({
        userId: ctx.user.id,
        name: input.name,
        category: input.category,
        currentAmount: initialAmt,
        targetAmount: input.targetAmount,
        currency: "USD",
        apy: apyMap[input.category] || 5.0,
      });

      return vault;
    }),

  vaultDeposit: authedQuery
    .input(
      z.object({
        vaultId: z.number().int().positive(),
        amount: amountSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const vault = dbStorage.findVaultById(input.vaultId);
      if (!vault || vault.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Vault not found" });

      const account = await getOrCreateAccount(ctx.user.id);
      const balCents = toCents(account.balance);
      const depCents = toCents(input.amount);
      if (depCents > balCents) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient account balance." });
      }

      await setAccountBalance(account.id, balCents - depCents);
      dbStorage.updateVault(vault.id, { currentAmount: vault.currentAmount + input.amount });

      dbStorage.addTransaction({
        accountId: account.id,
        reference: generateReference("VLT-DEP"),
        type: "withdrawal",
        channel: "user_request",
        amount: fromCents(depCents),
        balanceAfter: fromCents(balCents - depCents),
        status: "approved",
        note: `Transfer to ${vault.name} (APY ${vault.apy}%)`,
        counterparty: vault.name,
        processedAt: new Date().toISOString(),
      });

      return { success: true };
    }),

  vaultWithdraw: authedQuery
    .input(
      z.object({
        vaultId: z.number().int().positive(),
        amount: amountSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const vault = dbStorage.findVaultById(input.vaultId);
      if (!vault || vault.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Vault not found" });

      if (input.amount > vault.currentAmount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient funds in vault." });
      }

      const account = await getOrCreateAccount(ctx.user.id);
      const balCents = toCents(account.balance);
      const wdrCents = toCents(input.amount);

      await setAccountBalance(account.id, balCents + wdrCents);
      dbStorage.updateVault(vault.id, { currentAmount: vault.currentAmount - input.amount });

      dbStorage.addTransaction({
        accountId: account.id,
        reference: generateReference("VLT-WDR"),
        type: "deposit",
        channel: "user_request",
        amount: fromCents(wdrCents),
        balanceAfter: fromCents(balCents + wdrCents),
        status: "approved",
        note: `Withdrawal from ${vault.name}`,
        counterparty: vault.name,
        processedAt: new Date().toISOString(),
      });

      return { success: true };
    }),

  // Live Market Rates
  marketRates: authedQuery.query(async () => {
    return {
      rates: [
        { symbol: "EUR/USD", rate: 1.0845, change: "+0.24%", up: true },
        { symbol: "GBP/USD", rate: 1.2980, change: "+0.18%", up: true },
        { symbol: "USD/CHF", rate: 0.8842, change: "-0.09%", up: false },
        { symbol: "USD/JPY", rate: 154.22, change: "-0.31%", up: false },
        { symbol: "GOLD (XAU)", rate: 2748.5, change: "+1.15%", up: true },
        { symbol: "US 10Y", rate: 4.21, change: "-0.04%", up: false },
        { symbol: "BTC/USD", rate: 89450, change: "+3.40%", up: true },
      ],
      updatedAt: new Date().toISOString(),
    };
  }),
});
