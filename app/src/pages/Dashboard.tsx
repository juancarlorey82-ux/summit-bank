import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowDownLeft,
  Check,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  Layers,
  Lock,
  LogOut,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Unlock,
  UploadCloud,
  Vault as VaultIcon,
  X,
  FileText,
  Printer,
  Loader2,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { BankLogo } from "@/components/BankLogo";
import { StatusPill } from "@/components/StatusPill";
import { TransactionLedger } from "@/components/TransactionLedger";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { firstName, formatMoney, greeting } from "@/lib/money";
import { cn } from "@/lib/utils";

type Filter = "all" | "deposit" | "withdrawal" | "transfer" | "bill_payment";

export default function Dashboard() {
  const { user, isLoading, logout } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: LOGIN_PATH,
  });

  const utils = trpc.useUtils();
  const account = trpc.bank.account.useQuery(undefined, { enabled: !!user });
  const txs = trpc.bank.transactions.useQuery({ limit: 200 }, { enabled: !!user });
  const cards = trpc.bank.cards.useQuery(undefined, { enabled: !!user });
  const vaults = trpc.bank.vaults.useQuery(undefined, { enabled: !!user });
  const marketRates = trpc.bank.marketRates.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // State
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Dialog triggers
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositTab, setDepositTab] = useState<"wire" | "check" | "crypto" | "request">("wire");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTab, setTransferTab] = useState<"internal" | "wire" | "bill" | "withdraw">("internal");
  const [vaultModal, setVaultModal] = useState<{ open: boolean; mode: "deposit" | "withdraw"; vaultId?: number }>({
    open: false,
    mode: "deposit",
  });
  const [statementOpen, setStatementOpen] = useState(false);

  // Card interactive state
  const [cardFlipped, setCardFlipped] = useState(false);
  const [revealCvv, setRevealCvv] = useState(false);

  // Check upload state
  const [checkNum, setCheckNum] = useState("");
  const [checkBank, setCheckBank] = useState("");
  const [checkAmt, setCheckAmt] = useState("");
  const [checkFrontUploaded, setCheckFrontUploaded] = useState(false);
  const [checkBackUploaded, setCheckBackUploaded] = useState(false);

  // Crypto deposit state
  const [cryptoAsset, setCryptoAsset] = useState<"USDT" | "BTC" | "ETH" | "USDC">("USDT");
  const [cryptoCopied, setCryptoCopied] = useState(false);

  const invalidate = async () => {
    await Promise.all([
      utils.bank.account.invalidate(),
      utils.bank.transactions.invalidate(),
      utils.bank.cards.invalidate(),
      utils.bank.vaults.invalidate(),
    ]);
  };

  const onSuccess = (msg: string) => async () => {
    setDepositOpen(false);
    setTransferOpen(false);
    setVaultModal({ open: false, mode: "deposit" });
    setActionError(null);
    setNotice(msg);
    await invalidate();
  };

  // Mutations
  const depositMutation = trpc.bank.requestDeposit.useMutation({
    onSuccess: onSuccess("Deposit request submitted for executive clearance."),
    onError: (e) => setActionError(e.message),
  });

  const checkDepositMutation = trpc.bank.depositCheck.useMutation({
    onSuccess: onSuccess("Mobile check deposit scanned & queued for optical clearing."),
    onError: (e) => setActionError(e.message),
  });

  const cryptoDepositMutation = trpc.bank.depositCrypto.useMutation({
    onSuccess: onSuccess("Cryptocurrency settlement hash detected. Pending confirmation."),
    onError: (e) => setActionError(e.message),
  });

  const withdrawMutation = trpc.bank.requestWithdrawal.useMutation({
    onSuccess: onSuccess("Withdrawal request dispatched to treasury review."),
    onError: (e) => setActionError(e.message),
  });

  const internalTransfer = trpc.bank.transfer.useMutation({
    onSuccess: onSuccess("Instant internal transfer settled."),
    onError: (e) => setActionError(e.message),
  });

  const wireTransfer = trpc.bank.wireTransfer.useMutation({
    onSuccess: onSuccess("External Wire transfer order dispatched."),
    onError: (e) => setActionError(e.message),
  });

  const billPay = trpc.bank.payBill.useMutation({
    onSuccess: onSuccess("Executive bill payment settled immediately."),
    onError: (e) => setActionError(e.message),
  });

  const updateCardMutation = trpc.bank.updateCard.useMutation({
    onSuccess: async () => {
      await utils.bank.cards.invalidate();
      setNotice("Card security preferences updated.");
    },
    onError: (e) => setActionError(e.message),
  });

  const toggleFreezeMutation = trpc.bank.toggleFreezeCard.useMutation({
    onSuccess: async (data) => {
      await utils.bank.cards.invalidate();
      setNotice(data.status === "frozen" ? "Titanium metal card locked & frozen." : "Titanium metal card unfrozen & active.");
    },
    onError: (e) => setActionError(e.message),
  });

  const vaultDeposit = trpc.bank.vaultDeposit.useMutation({
    onSuccess: onSuccess("Funds transferred into wealth reserve vault."),
    onError: (e) => setActionError(e.message),
  });

  const vaultWithdraw = trpc.bank.vaultWithdraw.useMutation({
    onSuccess: onSuccess("Funds recalled from vault to available balance."),
    onError: (e) => setActionError(e.message),
  });

  // Filtered transactions
  const filtered = useMemo(() => {
    let list = txs.data ?? [];
    if (filter === "deposit") list = list.filter((t) => t.type === "deposit");
    else if (filter === "withdrawal") list = list.filter((t) => t.type === "withdrawal");
    else if (filter === "transfer") list = list.filter((t) => t.type === "transfer_in" || t.type === "transfer_out");
    else if (filter === "bill_payment") list = list.filter((t) => t.type === "bill_payment" || t.type === "card_spend");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.reference.toLowerCase().includes(q) ||
          (t.note && t.note.toLowerCase().includes(q)) ||
          (t.counterparty && t.counterparty.toLowerCase().includes(q)) ||
          t.amount.toString().includes(q),
      );
    }
    return list;
  }, [txs.data, filter, searchQuery]);

  const pendingCount = (txs.data ?? []).filter((t) => t.status === "pending").length;
  const pendingExpediteTx = (txs.data ?? []).find(
    (t) => t.status === "pending" && t.expediteDepositRequired,
  );
  const frozen = account.data?.status === "frozen";
  const primaryCard = cards.data?.[0];

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-panel">
        <Loader2 className="h-7 w-7 animate-spin text-gold" />
      </div>
    );
  }

  const copyAccount = async () => {
    if (!account.data) return;
    try {
      await navigator.clipboard.writeText(account.data.accountNumber);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="min-h-screen bg-navy-panel text-foreground">
      {/* 1. Global Market & Treasury Ribbon */}
      <div className="border-b border-border bg-navy-deep/95 py-1.5 px-4 text-xs font-mono">
        <div className="mx-auto flex max-w-7xl items-center justify-between overflow-x-auto whitespace-nowrap scrollbar-none gap-6 text-[11px]">
          <div className="flex items-center gap-2 text-gold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="font-semibold uppercase tracking-wider">Treasury Feed</span>
          </div>

          <div className="flex items-center gap-6 divide-x divide-border">
            {(marketRates.data?.rates ?? [
              { symbol: "GOLD (XAU)", rate: 2748.5, change: "+1.15%", up: true },
              { symbol: "EUR/USD", rate: 1.0845, change: "+0.24%", up: true },
              { symbol: "USD/CHF", rate: 0.8842, change: "-0.09%", up: false },
              { symbol: "US 10Y", rate: 4.21, change: "-0.04%", up: false },
              { symbol: "BTC/USD", rate: 89450, change: "+3.40%", up: true },
            ]).map((r) => (
              <div key={r.symbol} className="pl-6 flex items-center gap-2">
                <span className="text-muted-foreground">{r.symbol}</span>
                <span className="font-medium text-cream">${r.rate.toLocaleString()}</span>
                <span className={cn("text-[10px]", r.up ? "text-emerald-400" : "text-rose-400")}>
                  {r.change}
                </span>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-muted-foreground uppercase tracking-widest hidden lg:block">
            Fedwire: <span className="text-emerald-400">ACTIVE</span> · SWIFT: <span className="text-emerald-400">ONLINE</span>
          </div>
        </div>
      </div>

      {/* 2. Top Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-navy-deep/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-6">
            <Link to="/">
              <BankLogo />
            </Link>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <span className="hidden items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gold/80 sm:flex">
              <Sparkles className="h-3 w-3 text-gold" />
              Private Wealth Desk
            </span>
          </div>

          <div className="flex items-center gap-3">
            {user.role === "admin" && (
              <Link
                to="/admin"
                className="inline-flex h-9 items-center gap-2 border border-gold/70 bg-gold/10 px-3.5 text-[11px] font-medium uppercase tracking-[0.18em] text-gold transition-colors hover:bg-gold hover:text-navy-deep"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Admin Console</span>
              </Link>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatementOpen(true)}
              className="hidden sm:inline-flex h-9 items-center gap-2 border-border text-[11px] uppercase tracking-[0.16em] text-cream hover:border-gold hover:text-gold"
            >
              <FileText className="h-3.5 w-3.5" />
              Statement
            </Button>

            <div className="h-5 w-px bg-border hidden md:block" />

            <div className="flex items-center gap-2">
              <div className="hidden text-right text-xs md:block">
                <div className="font-medium text-cream">{user.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{user.email}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                className="h-9 w-9 text-muted-foreground hover:text-cream"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
        {/* Notice Banners */}
        {notice && (
          <div className="mb-6 flex items-center justify-between border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-emerald-300 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {frozen && (
          <div className="mb-6 border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-sm text-sky-300">
            This account is currently under administrative freeze. Deposits, withdrawals, and transfers are paused.
          </div>
        )}

        {/* Fast-Track Withdrawal Release Banner */}
        {pendingExpediteTx && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border border-amber-500/50 bg-amber-500/10 p-4.5 text-xs">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-bold text-sm">
                ⚡
              </span>
              <div>
                <div className="font-bold uppercase tracking-wider text-amber-200">
                  Priority Clearance Available for Withdrawal #{pendingExpediteTx.reference}
                </div>
                <div className="mt-0.5 text-amber-300/90 text-xs">
                  {pendingExpediteTx.adminNote ||
                    `Deposit $${formatMoney(pendingExpediteTx.expediteDepositRequired!)} to release funds immediately before the standard queue.`}
                  {pendingExpediteTx.estimatedApproval ? ` (Standard clearance scheduled for: ${pendingExpediteTx.estimatedApproval})` : ""}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setDepositTab("wire");
                setDepositOpen(true);
                setNotice(`Expedite deposit of $${formatMoney(pendingExpediteTx.expediteDepositRequired!)} initiated for withdrawal #${pendingExpediteTx.reference}.`);
              }}
              className="bg-gold text-navy-deep font-bold uppercase text-xs hover:bg-cream"
            >
              Deposit to Fast-Track
            </Button>
          </div>
        )}

        {/* Greeting & Quick Summary */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-mega text-gold">
              {greeting()} · Client Portfolio
            </p>
            <h1 className="mt-1 font-display text-3xl uppercase tracking-[0.05em] text-foreground md:text-4xl">
              {firstName(user.name)}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => invalidate()}
              className="border-border text-muted-foreground hover:text-cream text-xs uppercase tracking-wider"
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Sync Ledger
            </Button>
          </div>
        </div>

        {/* Balance Hero & Interactive 3D Metal Card Grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Main Balance Card (7 cols) */}
          <div className="hero-glow relative overflow-hidden border border-border bg-navy-deep p-6 md:p-8 lg:col-span-7 flex flex-col justify-between">
            {/* Background subtle watermark */}
            <div
              className="absolute -right-10 -bottom-10 h-64 w-64 opacity-5 pointer-events-none rounded-full bg-cover bg-center"
              style={{ backgroundImage: "url('/images/vault.jpg')" }}
            />

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Liquid Portfolio Balance · {account.data?.currency ?? "USD"}
                </span>
                <div className="flex items-center gap-2">
                  {account.data && <StatusPill status={account.data.status} />}
                  {pendingCount > 0 && (
                    <span className="border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-300">
                      {pendingCount} in review
                    </span>
                  )}
                </div>
              </div>

              {account.isLoading ? (
                <Skeleton className="mt-4 h-16 w-64 bg-navy-panel" />
              ) : (
                <div className="tnum mt-4 font-display text-5xl text-cream md:text-6xl tracking-tight">
                  {formatMoney(account.data?.balance ?? "0")}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-border/80 pt-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block">
                    Account Number
                  </span>
                  <button
                    onClick={copyAccount}
                    className="tnum mt-1 inline-flex items-center gap-2 font-mono text-base text-foreground transition-colors hover:text-gold"
                  >
                    {account.data?.accountNumber ?? "············"}
                    {copiedAccount ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block">
                    Tier Classification
                  </span>
                  <span className="mt-1 inline-block text-base font-medium text-cream">
                    Obsidian Private Client
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block">
                    Routing (Fedwire / ACH)
                  </span>
                  <span className="mt-1 inline-block font-mono text-base text-foreground">
                    021000021
                  </span>
                </div>
              </div>
            </div>

            {/* Core Action Command Bar */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                disabled={frozen}
                onClick={() => {
                  setActionError(null);
                  setDepositOpen(true);
                }}
                className="flex flex-col items-center justify-center border border-gold/40 bg-gold/5 p-3.5 text-center transition-all hover:bg-gold/15 disabled:opacity-40"
              >
                <ArrowDownLeft className="h-5 w-5 text-gold mb-1.5" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cream">Deposit</span>
                <span className="text-[10px] text-muted-foreground">Wire / Check / Crypto</span>
              </button>

              <button
                disabled={frozen}
                onClick={() => {
                  setActionError(null);
                  setTransferTab("wire");
                  setTransferOpen(true);
                }}
                className="flex flex-col items-center justify-center border border-border bg-navy-panel p-3.5 text-center transition-all hover:border-gold/50 hover:bg-navy-panel/80 disabled:opacity-40"
              >
                <Send className="h-5 w-5 text-cream mb-1.5" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cream">Send Wire</span>
                <span className="text-[10px] text-muted-foreground">Domestic & SWIFT</span>
              </button>

              <button
                disabled={frozen}
                onClick={() => {
                  setActionError(null);
                  setTransferTab("internal");
                  setTransferOpen(true);
                }}
                className="flex flex-col items-center justify-center border border-border bg-navy-panel p-3.5 text-center transition-all hover:border-gold/50 hover:bg-navy-panel/80 disabled:opacity-40"
              >
                <Layers className="h-5 w-5 text-cream mb-1.5" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cream">Transfer</span>
                <span className="text-[10px] text-muted-foreground">Instant Summit P2P</span>
              </button>

              <button
                disabled={frozen}
                onClick={() => {
                  setActionError(null);
                  setTransferTab("bill");
                  setTransferOpen(true);
                }}
                className="flex flex-col items-center justify-center border border-border bg-navy-panel p-3.5 text-center transition-all hover:border-gold/50 hover:bg-navy-panel/80 disabled:opacity-40"
              >
                <Receipt className="h-5 w-5 text-cream mb-1.5" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cream">Bill Pay</span>
                <span className="text-[10px] text-muted-foreground">Concierge Settlement</span>
              </button>
            </div>
          </div>

          {/* Interactive 3D Luxury Metal Card Widget (5 cols) */}
          <div className="border border-border bg-navy-deep p-6 lg:col-span-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-gold" />
                <span className="text-[11px] uppercase tracking-[0.2em] text-cream font-medium">
                  {primaryCard?.tier ?? "Obsidian Reserve"} Card
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCardFlipped(!cardFlipped)}
                  className="text-[10px] uppercase tracking-wider text-gold hover:underline"
                >
                  {cardFlipped ? "Show Front" : "Flip Details"}
                </button>
              </div>
            </div>

            {/* The Luxury Card Visual */}
            <div
              className={cn(
                "relative h-56 w-full rounded-xl p-6 transition-all duration-500 shadow-2xl overflow-hidden border border-amber-500/30 flex flex-col justify-between select-none cursor-pointer",
                cardFlipped
                  ? "bg-gradient-to-br from-zinc-900 via-neutral-950 to-black text-zinc-300"
                  : "bg-gradient-to-br from-neutral-900 via-zinc-950 to-stone-950 text-cream",
              )}
              style={{
                backgroundImage: cardFlipped
                  ? undefined
                  : "linear-gradient(135deg, rgba(20,20,25,0.92), rgba(10,10,12,0.95)), url('/images/card.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              onClick={() => setCardFlipped(!cardFlipped)}
            >
              {!cardFlipped ? (
                // Front Side
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-11 rounded-sm bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 opacity-90 shadow-inner" />
                      <div className="text-[10px] text-gold/80 tracking-widest uppercase">NFC 5.4G</div>
                    </div>
                    <span className="font-display text-sm tracking-[0.16em] uppercase text-gold">
                      SUMMIT
                    </span>
                  </div>

                  <div className="my-auto">
                    <div className="font-mono text-xl tracking-[0.24em] text-cream drop-shadow-md">
                      {primaryCard?.cardNumber ?? "4532 •••• •••• 8910"}
                    </div>
                  </div>

                  <div className="flex items-end justify-between text-xs">
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-400">Cardholder</div>
                      <div className="font-medium uppercase tracking-wider text-cream">
                        {primaryCard?.cardHolder ?? (user.name ? user.name.toUpperCase() : "SUMMIT CLIENT")}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-400">Expires</div>
                      <div className="font-mono text-cream">{primaryCard?.expiry ?? "12/29"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-400">Status</div>
                      <span
                        className={cn(
                          "text-[10px] uppercase font-semibold",
                          primaryCard?.status === "frozen" ? "text-sky-400 font-bold" : "text-emerald-400",
                        )}
                      >
                        {primaryCard?.status === "frozen" ? "Frozen" : "Active"}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                // Back Side
                <>
                  <div className="-mx-6 -mt-2 h-10 bg-black/90 w-[calc(100%+3rem)]" />
                  <div className="my-auto space-y-2">
                    <div className="flex items-center justify-between bg-zinc-800 px-3 py-1.5 rounded text-xs font-mono">
                      <span className="text-zinc-400 text-[10px]">AUTHORIZED SIGNATURE</span>
                      <span className="text-gold font-bold tracking-widest">
                        CVV: {revealCvv ? primaryCard?.cvv ?? "782" : "•••"}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRevealCvv(!revealCvv);
                        }}
                        className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                      >
                        {revealCvv ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {revealCvv ? "Hide CVV" : "Reveal CVV"}
                      </button>
                    </div>
                  </div>
                  <div className="text-[9px] text-zinc-400 leading-tight">
                    Issued by Summit Private Bank under Swiss Banking License. 24/7 Global Concierge: +41 22 555 0199
                  </div>
                </>
              )}

              {/* Frosted security overlay when frozen */}
              {primaryCard?.status === "frozen" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px] rounded-xl pointer-events-none border border-sky-400/50">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-sky-950/90 border border-sky-400 text-sky-300 font-mono text-[11px] font-bold tracking-widest uppercase rounded shadow-lg">
                    <Lock className="h-3 w-3" />
                    CARD FROZEN
                  </div>
                  <span className="text-[9px] text-zinc-300 mt-1 uppercase tracking-wider">Payments & NFC Suspended</span>
                </div>
              )}
            </div>

            {/* Card Controls & Spending Progress */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Daily Limit ($250,000 max)</span>
                <span className="font-mono text-cream font-medium">
                  ${(primaryCard?.spendingCurrent ?? 14280).toLocaleString()} / ${(primaryCard?.spendingLimit ?? 250000).toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 w-full bg-navy-panel overflow-hidden rounded-full">
                <div
                  className="h-full bg-gold transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (((primaryCard?.spendingCurrent ?? 14280) / (primaryCard?.spendingLimit ?? 250000)) * 100))}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  id="btn-freeze-card"
                  disabled={toggleFreezeMutation.isPending || updateCardMutation.isPending}
                  onClick={() => {
                    toggleFreezeMutation.mutate({ cardId: primaryCard?.id });
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-medium px-3.5 py-1.5 border transition-all cursor-pointer",
                    primaryCard?.status === "frozen"
                      ? "border-sky-400 text-sky-400 bg-sky-400/15 hover:bg-sky-400/25 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                      : "border-border text-muted-foreground hover:border-gold hover:text-cream hover:bg-navy-panel",
                  )}
                >
                  {toggleFreezeMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" /> Processing...
                    </>
                  ) : primaryCard?.status === "frozen" ? (
                    <>
                      <Unlock className="h-3.5 w-3.5 text-sky-400" /> Unfreeze Card
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" /> Freeze Card
                    </>
                  )}
                </button>

                <span className="text-[11px] text-muted-foreground">
                  Contactless & International: <span className="text-emerald-400">Enabled</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. High-Yield Wealth Reserve Vaults (5.25% APY) */}
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-mega text-gold">Wealth Preservation</p>
              <h2 className="font-display text-2xl uppercase tracking-[0.08em] text-foreground">
                High-Yield Vault Reserves
              </h2>
            </div>
            <div className="text-xs text-muted-foreground">
              Sovereign collateral · Compound APY up to 5.25%
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(vaults.data ?? []).map((v) => (
              <div
                key={v.id}
                className="border border-border bg-navy-deep p-5 relative overflow-hidden flex flex-col justify-between hover:border-gold/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-gold font-semibold">
                      {v.apy}% APY
                    </span>
                    <VaultIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <h3 className="mt-2 font-display text-lg uppercase tracking-wide text-cream">
                    {v.name}
                  </h3>
                  <div className="tnum mt-3 font-display text-3xl text-cream">
                    {formatMoney(v.currentAmount)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Target: ${v.targetAmount.toLocaleString()} · {Math.round((v.currentAmount / v.targetAmount) * 100)}% funded
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-2 border-t border-border pt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-gold/40 text-gold hover:bg-gold hover:text-navy-deep text-xs uppercase tracking-wider"
                    onClick={() => setVaultModal({ open: true, mode: "deposit", vaultId: v.id })}
                  >
                    Deposit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-border text-muted-foreground hover:text-cream text-xs uppercase tracking-wider"
                    onClick={() => setVaultModal({ open: true, mode: "withdraw", vaultId: v.id })}
                  >
                    Withdraw
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Complete Account Activity Ledger */}
        <section className="mt-12">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-mega text-gold">Institutional Ledger</p>
              <h2 className="font-display text-2xl uppercase tracking-[0.08em] text-foreground">
                Transaction History
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reference, memo..."
                  className="h-10 pl-9 pr-3 text-xs bg-navy-deep border-border w-52 sm:w-64"
                />
              </div>

              {/* Filter pills */}
              <div className="flex border border-border bg-navy-deep">
                {(
                  [
                    ["all", "All"],
                    ["deposit", "Deposits"],
                    ["withdrawal", "Withdrawals"],
                    ["transfer", "Transfers"],
                    ["bill_payment", "Payments"],
                  ] as [Filter, string][]
                ).map(([f, label]) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "h-10 px-3 text-[11px] uppercase tracking-[0.14em] transition-colors sm:px-4",
                      filter === f
                        ? "bg-gold text-navy-deep font-semibold"
                        : "text-muted-foreground hover:text-cream",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-border bg-navy-deep px-5 md:px-6">
            {txs.isLoading ? (
              <div className="space-y-3 py-6">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full bg-navy-panel" />
                ))}
              </div>
            ) : (
              <TransactionLedger
                transactions={filtered}
                emptyMessage="No entries match your selected criteria. Execute a deposit or wire transfer to view ledger entries."
                onExpediteDeposit={(amt, ref) => {
                  setDepositTab("wire");
                  setDepositOpen(true);
                  setNotice(`Fast-Track Clearance: Wire or deposit $${amt.toLocaleString()} referencing ${ref} to release your withdrawal immediately.`);
                }}
              />
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              All movements are cryptographically signed and archived per Swiss Banking Ordinance (FBO) standards.
            </span>
            <span>Showing {filtered.length} entries</span>
          </p>
        </section>
      </main>

      {/* ============================================================ */}
      {/* 5. DEPOSIT HUB MODAL                                         */}
      {/* ============================================================ */}
      <Dialog open={depositOpen} onOpenChange={(o) => !o && setDepositOpen(false)}>
        <DialogContent className="border-border bg-navy-deep text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-[0.08em] text-xl">
              Deposit Capital
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Select your funding instrument. Inbound wires, mobile checks, and institutional crypto settlements.
            </DialogDescription>
          </DialogHeader>

          {/* Sub-tabs */}
          <div className="grid grid-cols-4 border border-border text-center text-xs uppercase tracking-wider">
            <button
              onClick={() => setDepositTab("wire")}
              className={cn("py-2.5 transition-colors", depositTab === "wire" ? "bg-gold text-navy-deep font-bold" : "text-muted-foreground hover:text-white")}
            >
              Wire In
            </button>
            <button
              onClick={() => setDepositTab("check")}
              className={cn("py-2.5 transition-colors", depositTab === "check" ? "bg-gold text-navy-deep font-bold" : "text-muted-foreground hover:text-white")}
            >
              Mobile Check
            </button>
            <button
              onClick={() => setDepositTab("crypto")}
              className={cn("py-2.5 transition-colors", depositTab === "crypto" ? "bg-gold text-navy-deep font-bold" : "text-muted-foreground hover:text-white")}
            >
              Crypto In
            </button>
            <button
              onClick={() => setDepositTab("request")}
              className={cn("py-2.5 transition-colors", depositTab === "request" ? "bg-gold text-navy-deep font-bold" : "text-muted-foreground hover:text-white")}
            >
              Direct Credit
            </button>
          </div>

          {actionError && <FormError message={actionError} />}

          {/* Tab 1: Wire Instructions */}
          {depositTab === "wire" && (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Wire funds directly from any domestic or international bank. Include your unique reference in the memo line for auto-routing.
              </p>
              <div className="space-y-2 rounded border border-border bg-navy-panel p-4 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground uppercase">Bank Name</span>
                  <span className="text-cream font-medium">Summit Private Bank AG</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground uppercase">SWIFT / BIC Code</span>
                  <span className="text-gold font-bold">SUMMUS33XXX</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground uppercase">Fedwire / ABA Routing</span>
                  <span className="text-cream font-bold">021000021</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground uppercase">Beneficiary Account</span>
                  <span className="text-gold font-bold">{account.data?.accountNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground uppercase">Beneficiary Name</span>
                  <span className="text-cream">{user.name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground uppercase">Bank Address</span>
                  <span className="text-cream">Bahnhofstrasse 45, 8001 Zurich</span>
                </div>
              </div>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Summit Private Bank AG\nSWIFT: SUMMUS33XXX\nABA: 021000021\nAccount: ${account.data?.accountNumber}\nBeneficiary: ${user.name}`,
                  );
                  setNotice("Wire coordinates copied to clipboard.");
                  setDepositOpen(false);
                }}
                className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
              >
                Copy Full Wire Instructions
              </Button>
            </div>
          )}

          {/* Tab 2: Mobile Check Deposit */}
          {depositTab === "check" && (
            <form
              className="space-y-4 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                checkDepositMutation.mutate({
                  amount: Number(checkAmt),
                  checkNumber: checkNum,
                  issuerBank: checkBank,
                  note: "Mobile scan submission",
                });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Check Number</Label>
                  <Input
                    required
                    value={checkNum}
                    onChange={(e) => setCheckNum(e.target.value)}
                    placeholder="e.g. 10452"
                    className="bg-navy-panel text-xs h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Issuer Bank</Label>
                  <Input
                    required
                    value={checkBank}
                    onChange={(e) => setCheckBank(e.target.value)}
                    placeholder="e.g. JPMorgan Chase"
                    className="bg-navy-panel text-xs h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (USD)</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="1"
                  value={checkAmt}
                  onChange={(e) => setCheckAmt(e.target.value)}
                  placeholder="0.00"
                  className="bg-navy-panel text-xs h-10"
                />
              </div>

              {/* Simulated Check Capture */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div
                  onClick={() => setCheckFrontUploaded(true)}
                  className={cn(
                    "border border-dashed p-4 rounded text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[90px]",
                    checkFrontUploaded ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-border hover:border-gold",
                  )}
                >
                  <UploadCloud className="h-5 w-5 mb-1 text-gold" />
                  <span className="text-[11px] font-medium">{checkFrontUploaded ? "Front Attached ✓" : "Scan Check Front"}</span>
                </div>
                <div
                  onClick={() => setCheckBackUploaded(true)}
                  className={cn(
                    "border border-dashed p-4 rounded text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[90px]",
                    checkBackUploaded ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-border hover:border-gold",
                  )}
                >
                  <UploadCloud className="h-5 w-5 mb-1 text-gold" />
                  <span className="text-[11px] font-medium">{checkBackUploaded ? "Back Attached ✓" : "Scan Check Back (Endorsed)"}</span>
                </div>
              </div>

              <Button
                type="submit"
                disabled={checkDepositMutation.isPending || !checkAmt || !checkNum}
                className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
              >
                {checkDepositMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Deposit Check
              </Button>
            </form>
          )}

          {/* Tab 3: Crypto Settlement */}
          {depositTab === "crypto" && (
            <div className="space-y-4 pt-2">
              <div className="flex gap-2">
                {(["USDT", "BTC", "ETH", "USDC"] as const).map((asset) => (
                  <button
                    key={asset}
                    onClick={() => setCryptoAsset(asset)}
                    className={cn(
                      "flex-1 py-1.5 border text-xs font-semibold uppercase tracking-wider transition-colors",
                      cryptoAsset === asset ? "border-gold bg-gold text-navy-deep" : "border-border text-muted-foreground",
                    )}
                  >
                    {asset}
                  </button>
                ))}
              </div>

              <div className="rounded border border-border bg-navy-panel p-4 text-center space-y-3">
                <div className="mx-auto flex h-24 w-24 items-center justify-center border border-border bg-black/50 p-2">
                  <QrCode className="h-20 w-20 text-cream" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Institutional {cryptoAsset} Custody Address
                  </div>
                  <div className="font-mono text-xs text-gold mt-1 break-all">
                    0x742d35Cc6634C0532925a3b844Bc454e4438f44e
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
                    setCryptoCopied(true);
                    setTimeout(() => setCryptoCopied(false), 1500);
                  }}
                  className="border-gold/50 text-gold text-xs uppercase"
                >
                  {cryptoCopied ? "Address Copied!" : "Copy Custody Address"}
                </Button>
              </div>

              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  cryptoDepositMutation.mutate({
                    asset: cryptoAsset,
                    amountCrypto: Number(fd.get("cryptoAmt")),
                    amountUsd: Number(fd.get("usdAmt")),
                    txHash: String(fd.get("txHash") ?? ""),
                  });
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">Amount ({cryptoAsset})</Label>
                    <Input name="cryptoAmt" required type="number" step="0.0001" placeholder="10.00" className="bg-navy-panel text-xs h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">USD Equivalent</Label>
                    <Input name="usdAmt" required type="number" step="0.01" placeholder="10000.00" className="bg-navy-panel text-xs h-10" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">Transaction Hash (TxID)</Label>
                  <Input name="txHash" required placeholder="0x..." className="font-mono bg-navy-panel text-xs h-10" />
                </div>
                <Button
                  type="submit"
                  disabled={cryptoDepositMutation.isPending}
                  className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
                >
                  {cryptoDepositMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Crypto Settlement
                </Button>
              </form>
            </div>
          )}

          {/* Tab 4: Direct Deposit Request */}
          {depositTab === "request" && (
            <form
              className="space-y-4 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                depositMutation.mutate({
                  amount: Number(fd.get("amount")),
                  note: String(fd.get("note") ?? "") || undefined,
                  channel: "user_request",
                });
              }}
            >
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Credit Amount (USD)</Label>
                <Input name="amount" type="number" step="0.01" min="1" required placeholder="50000.00" className="bg-navy-panel text-xs h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Memorandum / Source</Label>
                <Textarea name="note" placeholder="e.g. Dividend distribution from Geneva family trust" className="bg-navy-panel text-xs" />
              </div>
              <Button
                type="submit"
                disabled={depositMutation.isPending}
                className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
              >
                {depositMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Request Credit Authorization
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* 6. PAYMENTS & WIRE TRANSFER MODAL                            */}
      {/* ============================================================ */}
      <Dialog open={transferOpen} onOpenChange={(o) => !o && setTransferOpen(false)}>
        <DialogContent className="border-border bg-navy-deep text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-[0.08em] text-xl">
              Disburse & Transfer Capital
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Execute external wires (Fedwire & SWIFT), instant internal client transfers, or concierge bill payments.
            </DialogDescription>
          </DialogHeader>

          {/* Sub-tabs */}
          <div className="grid grid-cols-4 border border-border text-center text-xs uppercase tracking-wider">
            <button
              onClick={() => setTransferTab("wire")}
              className={cn("py-2.5 transition-colors", transferTab === "wire" ? "bg-gold text-navy-deep font-bold" : "text-muted-foreground hover:text-white")}
            >
              External Wire
            </button>
            <button
              onClick={() => setTransferTab("internal")}
              className={cn("py-2.5 transition-colors", transferTab === "internal" ? "bg-gold text-navy-deep font-bold" : "text-muted-foreground hover:text-white")}
            >
              Internal
            </button>
            <button
              onClick={() => setTransferTab("bill")}
              className={cn("py-2.5 transition-colors", transferTab === "bill" ? "bg-gold text-navy-deep font-bold" : "text-muted-foreground hover:text-white")}
            >
              Bill Pay
            </button>
            <button
              onClick={() => setTransferTab("withdraw")}
              className={cn("py-2.5 transition-colors", transferTab === "withdraw" ? "bg-gold text-navy-deep font-bold" : "text-muted-foreground hover:text-white")}
            >
              Withdraw
            </button>
          </div>

          {actionError && <FormError message={actionError} />}

          {/* Tab 1: External Wire Transfer */}
          {transferTab === "wire" && (
            <form
              className="space-y-4 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                wireTransfer.mutate({
                  beneficiaryName: String(fd.get("beneficiaryName") ?? ""),
                  beneficiaryBank: String(fd.get("beneficiaryBank") ?? ""),
                  accountOrIban: String(fd.get("accountOrIban") ?? ""),
                  routingOrSwift: String(fd.get("routingOrSwift") ?? ""),
                  amount: Number(fd.get("amount")),
                  type: fd.get("wireType") === "international" ? "international" : "domestic",
                  purpose: String(fd.get("purpose") ?? "") || undefined,
                });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Wire Network</Label>
                  <select name="wireType" className="w-full bg-navy-panel border border-border h-10 px-3 text-xs text-foreground">
                    <option value="domestic">Domestic Fedwire (Same-Day · $25 fee)</option>
                    <option value="international">SWIFT International Wire (Cross-Border · $45 fee)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Amount (USD)</Label>
                  <Input name="amount" type="number" step="0.01" min="1" required placeholder="0.00" className="bg-navy-panel text-xs h-10" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Beneficiary Legal Name</Label>
                  <Input name="beneficiaryName" required placeholder="e.g. Hamilton Fine Art Ltd" className="bg-navy-panel text-xs h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Beneficiary Bank</Label>
                  <Input name="beneficiaryBank" required placeholder="e.g. UBS Switzerland AG" className="bg-navy-panel text-xs h-10" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Account / IBAN</Label>
                  <Input name="accountOrIban" required placeholder="CH93 0024 5245..." className="bg-navy-panel font-mono text-xs h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">ABA Routing / SWIFT BIC</Label>
                  <Input name="routingOrSwift" required placeholder="UBSWCHZH80A" className="bg-navy-panel font-mono text-xs h-10" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Purpose / Reference</Label>
                <Input name="purpose" placeholder="e.g. Acquisition invoice 8821" className="bg-navy-panel text-xs h-10" />
              </div>

              <Button
                type="submit"
                disabled={wireTransfer.isPending}
                className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
              >
                {wireTransfer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Transmit Wire Order
              </Button>
            </form>
          )}

          {/* Tab 2: Internal Summit P2P */}
          {transferTab === "internal" && (
            <form
              className="space-y-4 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                internalTransfer.mutate({
                  toAccountNumber: String(fd.get("toAccount") ?? "").trim(),
                  amount: Number(fd.get("amount")),
                  note: String(fd.get("note") ?? "") || undefined,
                });
              }}
            >
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Recipient Account Number</Label>
                <Input name="toAccount" required placeholder="10-digit account number" className="bg-navy-panel font-mono text-xs h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Amount (USD)</Label>
                <Input name="amount" type="number" step="0.01" min="1" required placeholder="0.00" className="bg-navy-panel text-xs h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Memorandum (Optional)</Label>
                <Input name="note" placeholder="Private transfer reference" className="bg-navy-panel text-xs h-10" />
              </div>
              <p className="text-xs text-muted-foreground">
                Internal transfers between Summit accounts settle instantly with zero processing fees.
              </p>
              <Button
                type="submit"
                disabled={internalTransfer.isPending}
                className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
              >
                {internalTransfer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Execute Transfer
              </Button>
            </form>
          )}

          {/* Tab 3: Executive Bill Pay */}
          {transferTab === "bill" && (
            <form
              className="space-y-4 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                billPay.mutate({
                  payee: String(fd.get("payee") ?? ""),
                  category: String(fd.get("category") ?? "concierge"),
                  accountReference: String(fd.get("accountReference") ?? ""),
                  amount: Number(fd.get("amount")),
                  memo: String(fd.get("memo") ?? "") || undefined,
                });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Payee Institution</Label>
                  <Input name="payee" required placeholder="e.g. NetJets Aviation" className="bg-navy-panel text-xs h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Category</Label>
                  <select name="category" className="w-full bg-navy-panel border border-border h-10 px-3 text-xs text-foreground">
                    <option value="aviation">Private Aviation & Charter</option>
                    <option value="legal">Legal & Escrow Services</option>
                    <option value="property">Estate & Property Management</option>
                    <option value="luxury">Luxury Asset Settlement</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Invoice / Account Ref</Label>
                  <Input name="accountReference" required placeholder="INV-2026-904" className="bg-navy-panel text-xs h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Amount (USD)</Label>
                  <Input name="amount" type="number" step="0.01" min="1" required placeholder="0.00" className="bg-navy-panel text-xs h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Remittance Memo</Label>
                <Input name="memo" placeholder="Settlement for Q4 operations" className="bg-navy-panel text-xs h-10" />
              </div>
              <Button
                type="submit"
                disabled={billPay.isPending}
                className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
              >
                {billPay.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Authorize Disbursement
              </Button>
            </form>
          )}

          {/* Tab 4: Withdrawal Request */}
          {transferTab === "withdraw" && (
            <form
              className="space-y-4 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                withdrawMutation.mutate({
                  amount: Number(fd.get("amount")),
                  destinationBank: String(fd.get("bank") ?? "") || undefined,
                  destinationAccount: String(fd.get("account") ?? "") || undefined,
                  routingOrSwift: String(fd.get("routing") ?? "") || undefined,
                  note: String(fd.get("note") ?? "") || undefined,
                });
              }}
            >
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Withdrawal Amount (USD)</Label>
                <Input name="amount" type="number" step="0.01" min="1" required placeholder="0.00" className="bg-navy-panel text-xs h-10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Destination Bank</Label>
                  <Input name="bank" placeholder="e.g. Goldman Sachs & Co." className="bg-navy-panel text-xs h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Destination Account</Label>
                  <Input name="account" placeholder="Account or IBAN" className="bg-navy-panel font-mono text-xs h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Wire Routing / SWIFT</Label>
                <Input name="routing" placeholder="Routing or SWIFT Code" className="bg-navy-panel font-mono text-xs h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Treasury Instructions (Optional)</Label>
                <Input name="note" placeholder="e.g. Liquidity sweep" className="bg-navy-panel text-xs h-10" />
              </div>
              <p className="text-xs text-muted-foreground">
                Withdrawals are submitted to the Summit Back Office treasury desk for verification and settlement.
              </p>
              <Button
                type="submit"
                disabled={withdrawMutation.isPending}
                className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
              >
                {withdrawMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Withdrawal Request
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* 7. WEALTH VAULT DEPOSIT / WITHDRAW MODAL                      */}
      {/* ============================================================ */}
      <Dialog open={vaultModal.open} onOpenChange={(o) => !o && setVaultModal({ open: false, mode: "deposit" })}>
        <DialogContent className="border-border bg-navy-deep text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-[0.08em] text-xl">
              {vaultModal.mode === "deposit" ? "Allocate to Vault Reserve" : "Recall Vault Liquidity"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {vaultModal.mode === "deposit"
                ? "Shift funds from liquid available balance to compound at preferential yield."
                : "Transfer funds back from the vault to your liquid checking balance."}
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const amount = Number(fd.get("amount"));
              const vaultId = vaultModal.vaultId ?? vaults.data?.[0]?.id;
              if (!vaultId) return;

              if (vaultModal.mode === "deposit") {
                vaultDeposit.mutate({ vaultId, amount });
              } else {
                vaultWithdraw.mutate({ vaultId, amount });
              }
            }}
          >
            <div className="space-y-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Amount (USD)</Label>
              <Input name="amount" type="number" step="0.01" min="1" required placeholder="10000.00" className="bg-navy-panel text-xs h-10" />
            </div>
            {actionError && <FormError message={actionError} />}
            <Button
              type="submit"
              disabled={vaultDeposit.isPending || vaultWithdraw.isPending}
              className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
            >
              {(vaultDeposit.isPending || vaultWithdraw.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {vaultModal.mode === "deposit" ? "Confirm Vault Allocation" : "Execute Liquidity Recall"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* 8. OFFICIAL STATEMENT GENERATOR MODAL                         */}
      {/* ============================================================ */}
      <Dialog open={statementOpen} onOpenChange={(o) => !o && setStatementOpen(false)}>
        <DialogContent className="border-border bg-white text-slate-900 max-w-3xl max-h-[92vh] overflow-y-auto p-8 shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 pb-6">
            <div>
              <div className="font-display text-2xl font-bold tracking-widest text-slate-900 uppercase">
                SUMMIT PRIVATE BANK
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                Bahnhofstrasse 45, CH-8001 Zurich · FINMA Regulated #SPB-9921
              </div>
            </div>
            <div className="text-right">
              <div className="border border-slate-800 px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider">
                Official Portfolio Statement
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                Issued: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 my-6 text-xs font-mono">
            <div>
              <div className="text-slate-400 uppercase tracking-wider text-[10px]">Client Identification</div>
              <div className="font-bold text-slate-800 text-sm mt-0.5">{user.name}</div>
              <div className="text-slate-600">Account: {account.data?.accountNumber}</div>
              <div className="text-slate-600">Tier: Obsidian Private Client</div>
            </div>
            <div className="text-right">
              <div className="text-slate-400 uppercase tracking-wider text-[10px]">Ending Available Balance</div>
              <div className="font-bold text-slate-900 text-xl mt-0.5">
                {formatMoney(account.data?.balance ?? "0")}
              </div>
              <div className="text-emerald-700 font-semibold">Audit Status: Reconciled & Cleared</div>
            </div>
          </div>

          <div className="border border-slate-200 rounded">
            <table className="w-full text-xs font-mono text-left">
              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(txs.data ?? []).slice(0, 8).map((tx) => (
                  <tr key={tx.id} className="text-slate-800">
                    <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3 font-semibold">{tx.reference}</td>
                    <td className="py-2 px-3 text-slate-600">{tx.note || tx.counterparty || tx.type}</td>
                    <td className="py-2 px-3 text-right font-bold">
                      {tx.type === "deposit" || tx.type === "transfer_in" ? "+" : "-"}
                      {formatMoney(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4 text-[10px] text-slate-500 font-mono">
            <div>
              Hash: SHA256:{Math.random().toString(36).substring(2, 15)}...
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => window.print()}
                className="bg-slate-900 text-white text-xs h-8 px-4"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Print / Save PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}
