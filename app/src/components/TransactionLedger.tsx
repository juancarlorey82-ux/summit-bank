import type { Transaction } from "@contracts/types";
import { StatusPill } from "@/components/StatusPill";
import { formatDateTime, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { txLabel, isCredit } from "@/lib/transaction";

export function TransactionLedger({
  transactions,
  emptyMessage = "No transactions yet.",
  onExpediteDeposit,
}: {
  transactions: Transaction[];
  emptyMessage?: string;
  onExpediteDeposit?: (amount: number, txReference: string) => void;
}) {
  if (transactions.length === 0) {
    return (
      <div className="border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <th className="py-3 pr-4 font-medium">Date</th>
              <th className="py-3 pr-4 font-medium">Details & Schedule</th>
              <th className="py-3 pr-4 font-medium">Reference</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 pr-4 text-right font-medium">Balance</th>
              <th className="py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-border/60 last:border-0 hover:bg-navy-panel/40">
                <td className="whitespace-nowrap py-4 pr-4 text-muted-foreground">
                  {formatDateTime(tx.createdAt)}
                </td>
                <td className="py-4 pr-4">
                  <div className="font-medium text-foreground">{txLabel(tx)}</div>
                  <div className="mt-0.5 max-w-sm truncate text-xs text-muted-foreground">
                    {tx.counterparty ? `To/from ${tx.counterparty}` : ""}
                    {tx.counterparty && tx.note ? " · " : ""}
                    {tx.note ?? ""}
                  </div>

                  {/* Scheduled Clearance Note & Fast Track Deposit Requirement */}
                  {tx.status === "pending" && (tx.estimatedApproval || tx.adminNote) && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-mono text-gold">
                      <span>⏱ {tx.estimatedApproval || tx.adminNote}</span>
                    </div>
                  )}

                  {tx.status === "pending" && tx.expediteDepositRequired && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase font-mono font-bold text-amber-300">
                        ⚡ Expedite Available: Deposit ${formatMoney(tx.expediteDepositRequired)}
                      </span>
                      {onExpediteDeposit && (
                        <button
                          type="button"
                          onClick={() => onExpediteDeposit(Number(tx.expediteDepositRequired), tx.reference)}
                          className="bg-gold text-navy-deep px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider hover:bg-cream"
                        >
                          Expedite Now
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="tnum whitespace-nowrap py-4 pr-4 text-xs font-mono text-muted-foreground">
                  {tx.reference}
                </td>
                <td className="py-4 pr-4">
                  <StatusPill status={tx.status} />
                </td>
                <td className="tnum whitespace-nowrap py-4 pr-4 text-right text-muted-foreground">
                  {tx.balanceAfter ? formatMoney(tx.balanceAfter) : "—"}
                </td>
                <td
                  className={cn(
                    "tnum whitespace-nowrap py-4 text-right font-semibold",
                    isCredit(tx) ? "text-emerald-300" : "text-red-300",
                  )}
                >
                  {isCredit(tx) ? "+" : "−"}
                  {formatMoney(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-border/60 md:hidden">
        {transactions.map((tx) => (
          <div key={tx.id} className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {txLabel(tx)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(tx.createdAt)}
                </div>
              </div>
              <div
                className={cn(
                  "tnum text-right text-sm font-semibold",
                  isCredit(tx) ? "text-emerald-300" : "text-red-300",
                )}
              >
                {isCredit(tx) ? "+" : "−"}
                {formatMoney(tx.amount)}
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <span className="tnum text-[11px] font-mono text-muted-foreground">
                {tx.reference}
              </span>
              <StatusPill status={tx.status} />
            </div>

            {tx.status === "pending" && (tx.estimatedApproval || tx.adminNote) && (
              <div className="mt-2 text-[11px] font-mono text-gold border border-gold/30 bg-gold/10 p-1.5">
                ⏱ Clearance: {tx.estimatedApproval || tx.adminNote}
              </div>
            )}

            {tx.status === "pending" && tx.expediteDepositRequired && (
              <div className="mt-2 flex items-center justify-between border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                <span className="text-[11px] text-amber-300 font-mono">
                  Expedite with ${formatMoney(tx.expediteDepositRequired)} deposit
                </span>
                {onExpediteDeposit && (
                  <button
                    type="button"
                    onClick={() => onExpediteDeposit(Number(tx.expediteDepositRequired), tx.reference)}
                    className="bg-gold text-navy-deep px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider hover:bg-cream"
                  >
                    Expedite
                  </button>
                )}
              </div>
            )}

            {(tx.note || tx.counterparty) && (
              <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {tx.counterparty ? `To/from ${tx.counterparty}` : ""}
                {tx.counterparty && tx.note ? " · " : ""}
                {tx.note ?? ""}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
