import type { Transaction } from "@contracts/types";

export function txLabel(tx: Transaction): string {
  switch (tx.type) {
    case "deposit":
      if (tx.channel === "admin_topup") return "Deposit · Admin Top-Up";
      if (tx.channel === "wire_domestic") return "Deposit · Fedwire Settlement";
      if (tx.channel === "wire_international") return "Deposit · SWIFT International";
      if (tx.channel === "mobile_check") return "Deposit · Mobile Check";
      if (tx.channel === "crypto_settlement") return "Deposit · Crypto Asset Settlement";
      return "Deposit";
    case "withdrawal":
      if (tx.channel === "admin_topup") return "Withdrawal · Admin Adjustment";
      if (tx.channel === "wire_domestic") return "Wire · Domestic Fedwire";
      if (tx.channel === "wire_international") return "Wire · SWIFT International";
      return "Withdrawal";
    case "transfer_in":
      return "Transfer received";
    case "transfer_out":
      return "Transfer sent";
    case "bill_payment":
      return "Bill Payment";
    case "card_spend":
      return "Card Disbursement";
    default:
      return tx.type;
  }
}

export function isCredit(tx: Transaction): boolean {
  return tx.type === "deposit" || tx.type === "transfer_in";
}
