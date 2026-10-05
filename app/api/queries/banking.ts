import { dbStorage } from "./storage";
import type { StoredAccount, StoredTransaction } from "./storage";

/** Money helpers — all arithmetic in integer cents to avoid float drift. */
export function toCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function generateAccountNumber(): string {
  let digits = "";
  for (let i = 0; i < 10; i += 1) {
    digits += Math.floor(Math.random() * 10).toString();
  }
  return `10${digits}`;
}

export function generateReference(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${rand}`;
}

export async function findAccountByUserId(userId: number): Promise<StoredAccount | undefined> {
  return dbStorage.findAccountByUserId(userId);
}

export async function findAccountByNumber(accountNumber: string): Promise<StoredAccount | undefined> {
  return dbStorage.findAccountByNumber(accountNumber);
}

export async function findAccountById(accountId: number): Promise<StoredAccount | undefined> {
  return dbStorage.findAccountById(accountId);
}

export async function getOrCreateAccount(userId: number): Promise<StoredAccount> {
  return dbStorage.getOrCreateAccount(userId);
}

export async function listAccountTransactions(
  accountId: number,
  limit = 100,
): Promise<StoredTransaction[]> {
  return dbStorage.listAccountTransactions(accountId, limit);
}

export async function setAccountBalance(
  accountId: number,
  balanceCents: number,
): Promise<void> {
  dbStorage.setAccountBalance(accountId, fromCents(balanceCents));
}
