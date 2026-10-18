import { useMemo, useState, useRef, useCallback } from "react";
import { Link } from "react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Check,
  Clock,
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
  ShieldAlert,
  Sparkles,
  Unlock,
  Vault as VaultIcon,
  X,
  FileText,
  Printer,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Key,
  PlusCircle,
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
  const depositSettings = trpc.bank.depositSettings.useQuery();

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
  const [cardDossierOpen, setCardDossierOpen] = useState(false);
  const [cardDossierTab, setCardDossierTab] = useState<"details" | "activate" | "apply">("details");
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [activationPinInput, setActivationPinInput] = useState("");
  const [copiedCardNumber, setCopiedCardNumber] = useState(false);

  // Card Application Form State
  const [applyCardTier, setApplyCardTier] = useState<
    "Titanium Black" | "Sovereign Gold" | "Obsidian Reserve" | "24k Sovereign Gold" | "Virtual Stealth Ghost"
  >("Obsidian Reserve");
  const [applyCardType, setApplyCardType] = useState<"physical" | "virtual">("physical");
  const [applyCardLimit, setApplyCardLimit] = useState(150000);
  const [applyCardHolder, setApplyCardHolder] = useState("");
  const [applyCardDelivery, setApplyCardDelivery] = useState("Zurich Segregated Vault Custody");
  const [applyCardNote, setApplyCardNote] = useState("Executive collateral allocation");

  // Check camera capture state
  const [checkNum, setCheckNum] = useState("");
  const [checkBank, setCheckBank] = useState("");
  const [checkAmt, setCheckAmt] = useState("");
  const [checkFrontImage, setCheckFrontImage] = useState<string | null>(null);
  const [checkBackImage, setCheckBackImage] = useState<string | null>(null);
  const [checkCameraMode, setCheckCameraMode] = useState<"front" | "back" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Crypto deposit state
  const [cryptoAsset, setCryptoAsset] = useState<"USDT" | "BTC" | "ETH" | "USDC">("USDT");
  const [cryptoCopied, setCryptoCopied] = useState(false);

  // Withdrawal Interception & Directive Modals
  const [withdrawalAmountInput, setWithdrawalAmountInput] = useState<string>("");
  const [withdrawalConfirmModal, setWithdrawalConfirmModal] = useState<{
    open: boolean;
    amount: number;
    bank: string;
    account: string;
    routing: string;
    note: string;
  }>({
    open: false,
    amount: 0,
    bank: "",
    account: "",
    routing: "",
    note: "",
  });
  const [withdrawalResultModal, setWithdrawalResultModal] = useState<{
    open: boolean;
    ref: string;
    amount: number;
    bank: string;
    estimatedApproval?: string;
  }>({
    open: false,
    ref: "",
    amount: 0,
    bank: "",
  });

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
    onSuccess: async () => {
      setDepositOpen(false);
      setTransferOpen(false);
      setVaultModal({ open: false, mode: "deposit" });
      setActionError(null);
      setNotice("Mobile check scanned & submitted to admin for image verification. Funds credited upon approval.");
      // Reset check state
      setCheckNum(""); setCheckBank(""); setCheckAmt("");
      setCheckFrontImage(null); setCheckBackImage(null); setCheckCameraMode(null);
      stopCamera();
      await invalidate();
    },
    onError: (e) => setActionError(e.message),
  });

  const cryptoDepositMutation = trpc.bank.depositCrypto.useMutation({
    onSuccess: onSuccess("Cryptocurrency settlement hash detected. Pending confirmation."),
    onError: (e) => setActionError(e.message),
  });

  const withdrawMutation = trpc.bank.requestWithdrawal.useMutation({
    onSuccess: async (res) => {
      setWithdrawalConfirmModal((prev) => ({ ...prev, open: false }));
      setTransferOpen(false);
      setWithdrawalAmountInput("");
      setWithdrawalResultModal({
        open: true,
        ref: res.reference,
        amount: res.amount,
        bank: res.destinationBank,
        estimatedApproval: res.estimatedApproval,
      });
      setActionError(null);
      await invalidate();
    },
    onError: (e) => {
      setWithdrawalConfirmModal((prev) => ({ ...prev, open: false }));
      setActionError(e.message);
    },
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
      setNotice(data.status === "frozen" ? "Luxury card locked & frozen." : "Luxury card unfrozen & active.");
    },
    onError: (e) => setActionError(e.message),
  });

  const applyCardMutation = trpc.bank.applyCard.useMutation({
    onSuccess: async (newCard) => {
      setCardDossierTab("details");
      setSelectedCardIndex((cards.data?.length ?? 1));
      setActionError(null);
      setNotice(`Application for ${newCard.tier} submitted to Sovereign Underwriting Desk for clearance.`);
      await utils.bank.cards.invalidate();
    },
    onError: (e) => setActionError(e.message),
  });

  const activateCardMutation = trpc.bank.activateCard.useMutation({
    onSuccess: async (actCard) => {
      setActivationPinInput("");
      setCardDossierTab("details");
      setActionError(null);
      setNotice(`Card ending in ${actCard.cardNumber.slice(-4)} has been successfully activated and brought online!`);
      await utils.bank.cards.invalidate();
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

  // Camera helpers
  const startCamera = useCallback(async (side: "front" | "back") => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setCheckCameraMode(side);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      setActionError("Camera access denied. Please allow camera permissions and try again.");
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (checkCameraMode === "front") setCheckFrontImage(dataUrl);
    else if (checkCameraMode === "back") setCheckBackImage(dataUrl);
    stopCamera();
  }, [checkCameraMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCheckCameraMode(null);
  }, []);

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
  const pendingWithdrawals = useMemo(
    () => (txs.data ?? []).filter((t) => t.status === "pending" && (t.type === "withdrawal" || t.channel === "user_request")),
    [txs.data],
  );
  const frozen = account.data?.status === "frozen";
  const primaryCard = cards.data?.[selectedCardIndex] ?? cards.data?.[0];

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

        {(account.data as any)?.withdrawalHold && (
          <div className="mb-6 border border-rose-500/50 bg-rose-500/10 p-4 text-xs text-rose-200 flex items-start gap-3 rounded">
            <Lock className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold uppercase tracking-wider text-rose-300 text-xs block">
                Security Hold Active on Withdrawals & Outward Disbursements
              </strong>
              <p className="text-rose-200/90 leading-relaxed">
                {(account.data as any)?.withdrawalHoldReason ||
                  "A temporary security hold has been placed on outward disbursements for compliance verification. Contact your Executive Wealth Officer to review or lift this restriction."}
              </p>
            </div>
          </div>
        )}

        {/* Active Outbound Liquidity Clearance Directives Banner */}
        {pendingWithdrawals.map((w) => (
          <div
            key={w.id}
            className="mb-6 border border-amber-500/40 bg-navy-deep p-5 text-xs shadow-xl space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-bold text-sm">
                  🛡️
                </span>
                <div>
                  <div className="font-bold uppercase tracking-wider text-amber-200 text-sm">
                    Outbound Clearance Directive · Ref #{w.reference}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Destination: <span className="text-cream font-medium">{w.beneficiaryBank || w.counterparty || "External Wire Destination"}</span>
                    {w.beneficiaryAccount ? ` · Acct: ${w.beneficiaryAccount}` : ""}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending Outflow</div>
                <div className="tnum font-display text-xl font-bold text-cream">
                  {formatMoney(w.amount)}
                </div>
              </div>
            </div>

            {/* Officer Instructions / Requirements */}
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-gold font-bold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-gold" />
                <span>Executive Officer Directive & Clearance Steps:</span>
              </div>
              <p className="text-xs text-cream font-mono leading-relaxed">
                {w.adminNote || "Awaiting Executive Account Officer to review and assign specific clearance protocol."}
              </p>
              {w.estimatedApproval && (
                <div className="text-[11px] text-amber-300 font-mono pt-1 border-t border-amber-500/20 flex items-center gap-1">
                  <span>📅 Target Clearance Window:</span>
                  <span className="font-bold text-cream">{w.estimatedApproval}</span>
                </div>
              )}
            </div>

            {/* Optional Fast-Track Expedite Option */}
            {w.expediteDepositRequired && (
              <div className="flex flex-wrap items-center justify-between gap-3 border border-gold/40 bg-gold/10 p-3 rounded">
                <div>
                  <div className="text-xs font-bold text-gold uppercase tracking-wider">
                    ⚡ Priority Expedited Liquidity Available
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Deposit ${formatMoney(w.expediteDepositRequired)} to bypass standard queue and trigger immediate priority clearing.
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setDepositTab("wire");
                    setDepositOpen(true);
                    setNotice(`Expedite deposit of $${formatMoney(w.expediteDepositRequired!)} initiated for withdrawal #${w.reference}.`);
                  }}
                  className="bg-gold text-navy-deep font-bold uppercase text-xs hover:bg-cream h-8"
                >
                  Deposit Expedite Fee
                </Button>
              </div>
            )}
          </div>
        ))}

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
            <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
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
                  setTransferTab("withdraw");
                  setTransferOpen(true);
                }}
                className={cn(
                  "flex flex-col items-center justify-center border p-3.5 text-center transition-all disabled:opacity-40",
                  (account.data as any)?.withdrawalHold
                    ? "border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20"
                    : "border-amber-500/40 bg-amber-500/5 hover:border-gold hover:bg-amber-500/15",
                )}
              >
                {(account.data as any)?.withdrawalHold ? (
                  <Lock className="h-5 w-5 text-rose-400 mb-1.5" />
                ) : (
                  <ArrowUpRight className="h-5 w-5 text-amber-300 mb-1.5" />
                )}
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cream">Withdraw</span>
                <span className="text-[10px] text-muted-foreground">
                  {(account.data as any)?.withdrawalHold ? "Security Hold" : "Disburse Capital"}
                </span>
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
                {primaryCard?.status === "pending_approval" && (
                  <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold px-1.5 py-0.5 rounded uppercase">
                    Underwriting
                  </span>
                )}
                {primaryCard?.status === "pending_activation" && (
                  <span className="text-[9px] bg-gold/20 border border-gold/50 text-gold font-bold px-1.5 py-0.5 rounded uppercase animate-pulse">
                    Activation Directive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                {cards.data && cards.data.length > 1 && (
                  <div className="flex items-center gap-1 bg-navy-panel px-2 py-0.5 rounded border border-border">
                    {cards.data.map((c, idx) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCardIndex(idx)}
                        className={cn(
                          "h-2 w-2 rounded-full transition-all",
                          idx === selectedCardIndex ? "bg-gold scale-125" : "bg-muted-foreground/40 hover:bg-white",
                        )}
                        title={`${c.tier} (${c.cardNumber.slice(-4)}) - ${c.status}`}
                      />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setCardFlipped(!cardFlipped)}
                  className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-white"
                >
                  {cardFlipped ? "Show Front" : "Flip Details"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    if (primaryCard?.status === "pending_activation") {
                      setCardDossierTab("activate");
                    } else {
                      setCardDossierTab("details");
                    }
                    setCardDossierOpen(true);
                  }}
                  className="text-[10px] uppercase tracking-wider text-gold hover:underline font-bold"
                >
                  Manage / Apply
                </button>
              </div>
            </div>

            {/* The Luxury Card Visual */}
            <div
              className={cn(
                "relative h-56 w-full rounded-xl p-6 transition-all duration-500 shadow-2xl overflow-hidden border border-amber-500/30 flex flex-col justify-between select-none cursor-pointer group",
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
              onClick={() => {
                if (primaryCard?.status === "pending_activation") {
                  setCardDossierTab("activate");
                  setCardDossierOpen(true);
                } else if (primaryCard?.status === "pending_approval") {
                  setCardDossierTab("details");
                  setCardDossierOpen(true);
                } else {
                  setCardFlipped(!cardFlipped);
                }
              }}
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

                  <div
                    className="my-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionError(null);
                      if (primaryCard?.status === "pending_activation") {
                        setCardDossierTab("activate");
                      } else {
                        setCardDossierTab("details");
                      }
                      setCardDossierOpen(true);
                    }}
                    title="Click to open card dossier or apply"
                  >
                    <div className="font-mono text-xl tracking-[0.24em] text-cream drop-shadow-md group-hover:text-gold transition-colors flex items-center justify-between">
                      <span>{primaryCard?.cardNumber ?? "4532 •••• •••• 8910"}</span>
                      <span className="text-[9px] text-gold/70 font-sans tracking-normal opacity-0 group-hover:opacity-100 transition-opacity">
                        [Click to Open / Apply]
                      </span>
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
                          primaryCard?.status === "frozen"
                            ? "text-sky-400 font-bold"
                            : primaryCard?.status === "pending_approval"
                              ? "text-amber-400 font-bold"
                              : primaryCard?.status === "pending_activation"
                                ? "text-gold font-bold"
                                : "text-emerald-400",
                        )}
                      >
                        {primaryCard?.status === "frozen"
                          ? "Frozen"
                          : primaryCard?.status === "pending_approval"
                            ? "Underwriting"
                            : primaryCard?.status === "pending_activation"
                              ? "Directive Pending"
                              : "Active"}
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

              {/* Security overlay when frozen */}
              {primaryCard?.status === "frozen" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px] rounded-xl pointer-events-none border border-sky-400/50">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-sky-950/90 border border-sky-400 text-sky-300 font-mono text-[11px] font-bold tracking-widest uppercase rounded shadow-lg">
                    <Lock className="h-3 w-3" />
                    CARD FROZEN
                  </div>
                  <span className="text-[9px] text-zinc-300 mt-1 uppercase tracking-wider">Payments & NFC Suspended</span>
                </div>
              )}

              {/* Overlay when pending approval */}
              {primaryCard?.status === "pending_approval" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/85 backdrop-blur-[2px] rounded-xl p-4 text-center border border-amber-500/50">
                  <ShieldAlert className="h-6 w-6 text-amber-400 mb-1" />
                  <div className="text-xs font-bold text-amber-300 uppercase tracking-widest">
                    UNDERWRITING IN PROGRESS
                  </div>
                  <p className="text-[10px] text-zinc-300 mt-1 max-w-xs">
                    Treasury Underwriters reviewing portfolio history standing
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCardDossierTab("details");
                      setCardDossierOpen(true);
                    }}
                    className="mt-2.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-[10px] text-amber-200 font-bold uppercase tracking-wider rounded"
                  >
                    View Application Standing
                  </button>
                </div>
              )}

              {/* Overlay when pending activation */}
              {primaryCard?.status === "pending_activation" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/85 backdrop-blur-[2px] rounded-xl p-4 text-center border border-gold/70">
                  <Sparkles className="h-6 w-6 text-gold mb-1 animate-pulse" />
                  <div className="text-xs font-bold text-gold uppercase tracking-widest">
                    APPROVAL GRANTED · ACTIVATION REQUIRED
                  </div>
                  <p className="text-[10px] text-zinc-300 mt-1 max-w-xs">
                    Executive clearance issued. Complete activation directive to start card.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCardDossierTab("activate");
                      setCardDossierOpen(true);
                    }}
                    className="mt-2.5 px-4 py-1.5 bg-gold hover:bg-cream text-navy-deep text-xs font-bold uppercase tracking-wider rounded transition-colors shadow-lg"
                  >
                    ⚡ Complete Activation Directive
                  </button>
                </div>
              )}
            </div>

            {/* Card Controls & Spending Progress */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Daily Limit (${formatMoney(primaryCard?.spendingLimit ?? 250000)} max)</span>
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
                  disabled={toggleFreezeMutation.isPending || updateCardMutation.isPending || primaryCard?.status === "pending_approval" || primaryCard?.status === "pending_activation"}
                  onClick={() => {
                    toggleFreezeMutation.mutate({ cardId: primaryCard?.id });
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-medium px-3.5 py-1.5 border transition-all cursor-pointer disabled:opacity-40",
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
                  Contactless & International:{" "}
                  <span className={primaryCard?.status === "active" ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                    {primaryCard?.status === "active" ? "Enabled" : "Pending Activation"}
                  </span>
                </span>
              </div>

              {/* Quick Link to Apply for Card */}
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionError(null);
                    setCardDossierTab("apply");
                    setCardDossierOpen(true);
                  }}
                  className="w-full border-gold/40 text-gold hover:bg-gold hover:text-navy-deep text-[11px] uppercase tracking-wider font-semibold h-8"
                >
                  <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Apply for Additional Metal or Virtual Card
                </Button>
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
                {depositSettings.data?.wireInstructions ||
                  "Wire funds directly from any domestic or international bank. Include your unique reference in the memo line for auto-routing."}
              </p>
              <div className="space-y-2 rounded border border-border bg-navy-panel p-4 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground uppercase">Bank Name</span>
                  <span className="text-cream font-medium">
                    {depositSettings.data?.bankName || "Summit Private Bank AG"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground uppercase">SWIFT / BIC Code</span>
                  <span className="text-gold font-bold">
                    {depositSettings.data?.swiftBic || "SUMMUS33XXX"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground uppercase">Fedwire / ABA Routing</span>
                  <span className="text-cream font-bold">
                    {depositSettings.data?.routingNumber || "021000021"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground uppercase">Beneficiary Account</span>
                  <span className="text-gold font-bold">{account.data?.accountNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground uppercase">Beneficiary Name</span>
                  <span className="text-cream">
                    {depositSettings.data?.beneficiaryName || user.name}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground uppercase">Bank Address</span>
                  <span className="text-cream">
                    {depositSettings.data?.bankAddress || "Bahnhofstrasse 45, 8001 Zurich"}
                  </span>
                </div>
              </div>
              <Button
                onClick={() => {
                  const bName = depositSettings.data?.bankName || "Summit Private Bank AG";
                  const swift = depositSettings.data?.swiftBic || "SUMMUS33XXX";
                  const routing = depositSettings.data?.routingNumber || "021000021";
                  const benef = depositSettings.data?.beneficiaryName || user.name;
                  navigator.clipboard.writeText(
                    `${bName}\nSWIFT: ${swift}\nABA: ${routing}\nAccount: ${account.data?.accountNumber}\nBeneficiary: ${benef}`,
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
            <div className="space-y-4 pt-2">
              {/* Camera Live View */}
              {checkCameraMode && (
                <div className="relative border border-gold/50 bg-black rounded overflow-hidden">
                  <div className="absolute top-2 left-2 z-10 bg-black/70 text-gold text-[10px] uppercase tracking-widest px-2 py-0.5 rounded">
                    {checkCameraMode === "front" ? "Check Front" : "Check Back (Endorsed)"}
                  </div>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-h-48 object-cover"
                  />
                  <div className="flex gap-2 p-2 bg-navy-deep">
                    <Button
                      type="button"
                      onClick={capturePhoto}
                      className="flex-1 bg-gold text-navy-deep text-xs uppercase tracking-wider font-bold h-9"
                    >
                      <Camera className="h-3.5 w-3.5 mr-1.5" /> Snap Photo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={stopCamera}
                      className="border-border text-muted-foreground h-9 px-3 text-xs"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  checkDepositMutation.mutate({
                    amount: Number(checkAmt),
                    checkNumber: checkNum,
                    issuerBank: checkBank,
                    frontImage: checkFrontImage || undefined,
                    backImage: checkBackImage || undefined,
                    note: "Mobile camera capture submission",
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

                {/* Camera Capture Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {checkFrontImage ? (
                    <div className="relative border border-emerald-500 bg-emerald-500/10 rounded overflow-hidden">
                      <img src={checkFrontImage} alt="Check front" className="w-full h-20 object-cover" />
                      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 bg-black/30">
                        <span className="text-emerald-300 text-[10px] font-bold uppercase flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Front Captured
                        </span>
                        <button
                          type="button"
                          onClick={() => { setCheckFrontImage(null); startCamera("front"); }}
                          className="text-[9px] text-zinc-300 underline"
                        >
                          Retake
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startCamera("front")}
                      className={cn(
                        "border border-dashed p-4 rounded text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[80px] hover:border-gold",
                        checkCameraMode === "front" ? "border-gold bg-gold/10" : "border-border",
                      )}
                    >
                      <Camera className="h-5 w-5 mb-1 text-gold" />
                      <span className="text-[11px] font-medium text-muted-foreground">Scan Check Front</span>
                    </button>
                  )}

                  {checkBackImage ? (
                    <div className="relative border border-emerald-500 bg-emerald-500/10 rounded overflow-hidden">
                      <img src={checkBackImage} alt="Check back" className="w-full h-20 object-cover" />
                      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 bg-black/30">
                        <span className="text-emerald-300 text-[10px] font-bold uppercase flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Back Captured
                        </span>
                        <button
                          type="button"
                          onClick={() => { setCheckBackImage(null); startCamera("back"); }}
                          className="text-[9px] text-zinc-300 underline"
                        >
                          Retake
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startCamera("back")}
                      className={cn(
                        "border border-dashed p-4 rounded text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[80px] hover:border-gold",
                        checkCameraMode === "back" ? "border-gold bg-gold/10" : "border-border",
                      )}
                    >
                      <Camera className="h-5 w-5 mb-1 text-gold" />
                      <span className="text-[11px] font-medium text-muted-foreground">Scan Check Back</span>
                    </button>
                  )}
                </div>

                {(!checkFrontImage || !checkBackImage) && (
                  <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Both check sides required for admin verification.
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={checkDepositMutation.isPending || !checkAmt || !checkNum || !checkBank || !checkFrontImage || !checkBackImage}
                  className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
                >
                  {checkDepositMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Check for Admin Verification
                </Button>
              </form>
            </div>
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
                    {cryptoAsset === "USDT"
                      ? depositSettings.data?.usdtAddress || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
                      : cryptoAsset === "BTC"
                        ? depositSettings.data?.btcAddress || "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                        : cryptoAsset === "ETH"
                          ? depositSettings.data?.ethAddress || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
                          : depositSettings.data?.usdcAddress || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const addr =
                      cryptoAsset === "USDT"
                        ? depositSettings.data?.usdtAddress || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
                        : cryptoAsset === "BTC"
                          ? depositSettings.data?.btcAddress || "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                          : cryptoAsset === "ETH"
                            ? depositSettings.data?.ethAddress || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
                            : depositSettings.data?.usdcAddress || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
                    navigator.clipboard.writeText(addr);
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
                const amt = Number(fd.get("amount"));
                const b = String(fd.get("bank") ?? "");
                const acc = String(fd.get("account") ?? "");
                const r = String(fd.get("routing") ?? "");
                const n = String(fd.get("note") ?? "");

                // Intercept with significant amount confirmation modal
                setWithdrawalConfirmModal({
                  open: true,
                  amount: amt,
                  bank: b,
                  account: acc,
                  routing: r,
                  note: n,
                });
              }}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase text-muted-foreground">Withdrawal Amount (USD)</Label>
                  {Number(withdrawalAmountInput) >= 10000 && (
                    <span className="text-[10px] text-amber-300 font-mono font-bold flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Significant Outflow
                    </span>
                  )}
                </div>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="0.00"
                  value={withdrawalAmountInput}
                  onChange={(e) => setWithdrawalAmountInput(e.target.value)}
                  className="bg-navy-panel text-xs h-10 font-mono"
                />
                {Number(withdrawalAmountInput) >= 10000 && (
                  <div className="border border-amber-500/40 bg-amber-500/10 p-2.5 rounded text-[11px] text-amber-200 leading-tight">
                    ⚠️ <strong>Notice:</strong> Outbound disbursements of $10,000 or greater require Treasury Officer clearance. A designated officer will assign your release directive upon confirmation.
                  </div>
                )}
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
              {(account.data as any)?.withdrawalHold ? (
                <div className="border border-rose-500/50 bg-rose-500/10 p-3.5 rounded text-xs text-rose-200 leading-relaxed flex items-start gap-2.5">
                  <Lock className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <strong className="font-bold text-rose-300 block uppercase text-[10px] tracking-wider">
                      Account Under Withdrawal Restriction
                    </strong>
                    <span>
                      {(account.data as any)?.withdrawalHoldReason ||
                        "An administrative compliance hold is active. Outward disbursements cannot be dispatched until authorized by your assigned officer."}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Withdrawals are submitted to the Summit Back Office treasury desk for verification and settlement.
                </p>
              )}
              <Button
                type="submit"
                disabled={withdrawMutation.isPending || !withdrawalAmountInput || !!(account.data as any)?.withdrawalHold}
                className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
              >
                {withdrawMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Withdrawal Order
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* WITHDRAWAL INTERCEPTION & CONFIRMATION POP-UP                */}
      {/* ============================================================ */}
      <Dialog
        open={withdrawalConfirmModal.open}
        onOpenChange={(o) => !o && setWithdrawalConfirmModal((prev) => ({ ...prev, open: false }))}
      >
        <DialogContent className="border-border bg-navy-deep text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-[0.06em] text-xl flex items-center gap-2 text-amber-300">
              <ShieldCheck className="h-5 w-5 text-gold" />
              Institutional Security Review · Outflow Interception
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Swiss FINMA regulatory protocols require dual-officer executive review for capital disbursements.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-4 space-y-2 text-xs">
              <div className="flex justify-between items-baseline border-b border-amber-500/30 pb-2">
                <span className="text-muted-foreground uppercase text-[10px] tracking-wider">Outflow Capital</span>
                <span className="tnum font-display text-2xl font-bold text-cream">
                  {formatMoney(withdrawalConfirmModal.amount)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-muted-foreground uppercase text-[9px]">Destination Institution:</span>
                  <div className="font-semibold text-cream">{withdrawalConfirmModal.bank || "Designated Linked Bank"}</div>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase text-[9px]">Account / IBAN:</span>
                  <div className="font-mono text-gold">{withdrawalConfirmModal.account || "On-file Liquidity Account"}</div>
                </div>
              </div>
              {withdrawalConfirmModal.routing && (
                <div className="text-[11px]">
                  <span className="text-muted-foreground uppercase text-[9px]">Routing / SWIFT:</span>
                  <div className="font-mono text-cream">{withdrawalConfirmModal.routing}</div>
                </div>
              )}
            </div>

            <div className="rounded border border-border bg-navy-panel p-3.5 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <div className="text-gold font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-gold" />
                <span>Executive Account Officer Clearance Protocol</span>
              </div>
              <p>
                Your withdrawal order will be dispatched directly to your designated Private Wealth Officer. Upon receipt, your officer will verify destination routing and issue your official clearance instructions (e.g. Tax Clearance Certificate, Signatory Security PIN, or scheduled batch release) directly on your client dashboard.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWithdrawalConfirmModal((prev) => ({ ...prev, open: false }))}
                className="flex-1 border-border text-muted-foreground hover:text-cream h-11 uppercase text-xs"
              >
                Modify Order
              </Button>
              <Button
                type="button"
                disabled={withdrawMutation.isPending}
                onClick={() => {
                  withdrawMutation.mutate({
                    amount: withdrawalConfirmModal.amount,
                    destinationBank: withdrawalConfirmModal.bank || undefined,
                    destinationAccount: withdrawalConfirmModal.account || undefined,
                    routingOrSwift: withdrawalConfirmModal.routing || undefined,
                    note: withdrawalConfirmModal.note || undefined,
                  });
                }}
                className="flex-1 bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
              >
                {withdrawMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Dispatch to Officer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* WITHDRAWAL DISPATCHED RESULT POP-UP                          */}
      {/* ============================================================ */}
      <Dialog
        open={withdrawalResultModal.open}
        onOpenChange={(o) => !o && setWithdrawalResultModal((prev) => ({ ...prev, open: false }))}
      >
        <DialogContent className="border-border bg-navy-deep text-foreground max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <DialogHeader className="text-center sm:text-center mt-2">
            <DialogTitle className="font-display uppercase tracking-[0.08em] text-xl text-cream">
              Disbursement Order Dispatched
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Your withdrawal has been successfully transmitted to the Executive Treasury review desk.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-left font-mono">
            <div className="rounded border border-border bg-navy-panel p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground uppercase text-[10px]">Reference:</span>
                <span className="text-gold font-bold">{withdrawalResultModal.ref}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground uppercase text-[10px]">Amount:</span>
                <span className="text-cream font-bold">{formatMoney(withdrawalResultModal.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground uppercase text-[10px]">Destination:</span>
                <span className="text-muted-foreground">{withdrawalResultModal.bank}</span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-1.5 mt-1.5">
                <span className="text-muted-foreground uppercase text-[10px]">Initial Status:</span>
                <span className="text-amber-300 font-bold">Awaiting Officer Directive</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed font-sans text-center">
              Your Executive Account Officer has received this order. Check the active clearance banner on your dashboard for official requirements and release directives.
            </p>
          </div>

          <Button
            onClick={() => setWithdrawalResultModal((prev) => ({ ...prev, open: false }))}
            className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11 mt-2"
          >
            Acknowledge & View Dashboard
          </Button>
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

      {/* ============================================================ */}
      {/* 9. LUXURY CARD DOSSIER, UNDERWRITING & APPLICATION STUDIO     */}
      {/* ============================================================ */}
      <Dialog open={cardDossierOpen} onOpenChange={(o) => !o && setCardDossierOpen(false)}>
        <DialogContent className="border-border bg-navy-deep text-foreground max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-[0.08em] text-xl flex items-center gap-2 text-cream">
              <CreditCard className="h-5 w-5 text-gold" />
              Sovereign Card Suite & Underwriting Desk
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Manage luxury metal credentials, execute officer activation directives, or apply for high-limit Swiss cards.
            </DialogDescription>
          </DialogHeader>

          {/* Navigation Sub-Tabs */}
          <div className="grid grid-cols-3 border border-border text-center text-xs uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setCardDossierTab("details")}
              className={cn(
                "py-2.5 transition-colors font-semibold",
                cardDossierTab === "details" ? "bg-gold text-navy-deep" : "text-muted-foreground hover:text-white",
              )}
            >
              My Cards ({cards.data?.length ?? 1})
            </button>
            <button
              type="button"
              onClick={() => setCardDossierTab("activate")}
              className={cn(
                "py-2.5 transition-colors font-semibold relative",
                cardDossierTab === "activate" ? "bg-gold text-navy-deep" : "text-muted-foreground hover:text-white",
              )}
            >
              <span>Activation Directive</span>
              {cards.data?.some((c) => c.status === "pending_activation") && (
                <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setCardDossierTab("apply")}
              className={cn(
                "py-2.5 transition-colors font-semibold",
                cardDossierTab === "apply" ? "bg-gold text-navy-deep" : "text-muted-foreground hover:text-white",
              )}
            >
              + Apply for Card
            </button>
          </div>

          {actionError && <FormError message={actionError} />}

          {/* ============================================================ */}
          {/* TAB 1: CARD DOSSIER & CONTROLS                               */}
          {/* ============================================================ */}
          {cardDossierTab === "details" && (
            <div className="space-y-6 pt-2">
              {/* Card Switcher if multiple cards */}
              {cards.data && cards.data.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {cards.data.map((c, idx) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCardIndex(idx)}
                      className={cn(
                        "flex items-center gap-2 border px-3 py-2 text-xs rounded transition-all whitespace-nowrap",
                        idx === selectedCardIndex
                          ? "border-gold bg-gold/15 text-cream font-bold"
                          : "border-border bg-navy-panel text-muted-foreground hover:border-gold/40 hover:text-white",
                      )}
                    >
                      <CreditCard className="h-3.5 w-3.5 text-gold" />
                      <span>{c.tier}</span>
                      <span className="font-mono text-[10px] text-zinc-400">({c.cardNumber.slice(-4)})</span>
                      <span
                        className={cn(
                          "text-[9px] uppercase font-bold px-1 rounded",
                          c.status === "active"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : c.status === "pending_approval"
                              ? "bg-amber-500/20 text-amber-300"
                              : c.status === "pending_activation"
                                ? "bg-gold/20 text-gold"
                                : "bg-sky-500/20 text-sky-300",
                        )}
                      >
                        {c.status.replace("_", " ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Status Specific Callouts */}
              {primaryCard?.status === "pending_approval" && (
                <div className="border border-amber-500/40 bg-amber-500/10 p-4 rounded text-xs space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold uppercase tracking-wider text-xs">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Card Underwriting Review in Progress</span>
                  </div>
                  <p className="text-zinc-200 text-[11px] leading-relaxed">
                    Your application for the <strong>{primaryCard.tier}</strong> is currently being underwritten by the Sovereign Treasury desk.
                  </p>
                  <div className="border-t border-amber-500/20 pt-2 grid grid-cols-2 gap-2 text-[10px] font-mono text-amber-200">
                    <div>
                      <span className="text-muted-foreground uppercase text-[9px] block">History Standing:</span>
                      <span>{primaryCard.requiredHistoryPosition || "Private Wealth Portfolio Verified"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground uppercase text-[9px] block">Delivery Preference:</span>
                      <span>{primaryCard.deliveryOption || "Zurich Vault Segregated Custody"}</span>
                    </div>
                  </div>
                </div>
              )}

              {primaryCard?.status === "pending_activation" && (
                <div className="border border-gold/50 bg-gold/10 p-4 rounded text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gold font-bold uppercase tracking-wider text-xs">
                      <Sparkles className="h-4 w-4 text-gold animate-pulse" />
                      <span>Executive Approval Granted · Activation Directive Required</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setCardDossierTab("activate")}
                      className="bg-gold text-navy-deep font-bold text-xs h-7"
                    >
                      Complete Activation
                    </Button>
                  </div>
                  <p className="text-zinc-200 text-[11px] leading-relaxed">
                    Your executive account officer has authorized this card. Complete the activation directive to bring the card online.
                  </p>
                </div>
              )}

              {/* Card PAN & Credentials Panel */}
              <div className="rounded border border-border bg-navy-panel p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Card Tier & Type</div>
                    <div className="font-semibold text-cream text-sm">{primaryCard?.tier} ({primaryCard?.type})</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Operational Status</div>
                    <span
                      className={cn(
                        "text-xs font-bold uppercase",
                        primaryCard?.status === "active"
                          ? "text-emerald-400"
                          : primaryCard?.status === "pending_approval"
                            ? "text-amber-400"
                            : primaryCard?.status === "pending_activation"
                              ? "text-gold"
                              : "text-sky-400",
                      )}
                    >
                      {primaryCard?.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase block">Card Number (PAN)</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-bold text-cream text-sm tracking-wider">
                        {primaryCard?.status === "active" ? primaryCard.fullNumber : primaryCard?.cardNumber}
                      </span>
                      {primaryCard?.status === "active" && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (primaryCard?.fullNumber) {
                              await navigator.clipboard.writeText(primaryCard.fullNumber);
                              setCopiedCardNumber(true);
                              setTimeout(() => setCopiedCardNumber(false), 1500);
                            }
                          }}
                          className="text-muted-foreground hover:text-gold"
                          title="Copy Full Card Number"
                        >
                          {copiedCardNumber ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase block">Cardholder</span>
                    <span className="font-semibold text-cream text-sm mt-0.5 block">{primaryCard?.cardHolder}</span>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase block">Expiration Date</span>
                    <span className="font-bold text-cream text-sm mt-0.5 block">{primaryCard?.expiry}</span>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase block">Security CVV</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-bold text-gold text-sm tracking-widest">
                        {revealCvv ? primaryCard?.cvv : "•••"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRevealCvv(!revealCvv)}
                        className="text-[10px] text-muted-foreground hover:text-white flex items-center gap-1 font-sans"
                      >
                        {revealCvv ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {revealCvv ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Authorized Spending Limit:</span>
                  <span className="font-mono text-cream font-bold text-sm">
                    ${(primaryCard?.spendingLimit ?? 250000).toLocaleString()} USD / Day
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCardDossierTab("apply")}
                  className="flex-1 border-gold/50 text-gold hover:bg-gold hover:text-navy-deep text-xs uppercase h-10"
                >
                  <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Apply for Additional Card
                </Button>
                {primaryCard?.status === "pending_activation" && (
                  <Button
                    type="button"
                    onClick={() => setCardDossierTab("activate")}
                    className="flex-1 bg-gold text-navy-deep font-bold text-xs uppercase h-10"
                  >
                    ⚡ Complete Activation Directive
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: ACTIVATION DIRECTIVE & PIN PROTOCOL                   */}
          {/* ============================================================ */}
          {cardDossierTab === "activate" && (
            <div className="space-y-4 pt-2">
              <div className="rounded border border-gold/50 bg-gold/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-gold font-bold uppercase tracking-wider text-xs">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Executive Officer Clearance Directive</span>
                </div>
                <div className="border-b border-gold/30 pb-2">
                  <span className="text-muted-foreground uppercase text-[10px] tracking-wider block">Assigned Instruction:</span>
                  <p className="font-mono text-xs text-cream mt-1 leading-relaxed">
                    {primaryCard?.activationInstruction ||
                      "Dual-signatory verification required. Enter your Signatory Security PIN to initialize interbank EMV credentials and bring your physical metal card online."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-amber-200">
                  <div>
                    <span className="text-muted-foreground uppercase text-[9px] block">Target Card:</span>
                    <span className="text-cream font-bold">{primaryCard?.tier} (#{primaryCard?.cardNumber.slice(-4)})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground uppercase text-[9px] block">History Standing:</span>
                    <span className="text-emerald-400 font-bold">{primaryCard?.requiredHistoryPosition || "Sovereign Tier Qualified"}</span>
                  </div>
                </div>
              </div>

              {primaryCard?.status === "active" ? (
                <div className="border border-emerald-500/40 bg-emerald-500/10 p-4 rounded text-center space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="font-bold text-emerald-300 uppercase tracking-wider text-sm">
                    This Card Is Already Fully Activated
                  </div>
                  <p className="text-xs text-zinc-300">
                    Online payments, international roaming, and contactless NFC are fully authorized.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setCardDossierTab("details")}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs mt-2"
                  >
                    Return to Card Dossier
                  </Button>
                </div>
              ) : primaryCard?.status === "pending_approval" ? (
                <div className="border border-amber-500/40 bg-amber-500/10 p-4 rounded text-center space-y-2">
                  <div className="font-bold text-amber-300 uppercase tracking-wider text-sm">
                    Awaiting Officer Directive Assignment
                  </div>
                  <p className="text-xs text-zinc-300">
                    Your application is currently being reviewed by Underwriting. Once approved, the officer's activation PIN and instruction will appear here.
                  </p>
                </div>
              ) : (
                <form
                  className="space-y-4 pt-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!primaryCard) return;
                    activateCardMutation.mutate({
                      cardId: primaryCard.id,
                      pin: activationPinInput.trim() || undefined,
                    });
                  }}
                >
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Signatory Security PIN</Label>
                    <Input
                      type="text"
                      maxLength={8}
                      placeholder="e.g. 8821"
                      value={activationPinInput}
                      onChange={(e) => setActivationPinInput(e.target.value)}
                      className="bg-navy-panel font-mono text-center text-xl tracking-[0.4em] h-12 uppercase text-gold"
                    />
                    <p className="text-[11px] text-muted-foreground text-center">
                      Enter the 4-digit security PIN provided by your Executive Banking Officer in the clearance directive.
                    </p>
                  </div>

                  <div className="border border-border bg-navy-panel p-3 rounded text-[11px] text-muted-foreground flex items-start gap-2">
                    <Key className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                    <span>
                      By completing activation, you authorize interbank POS & ATM card clearing under Swiss FINMA Private Banking rules.
                    </span>
                  </div>

                  <Button
                    type="submit"
                    disabled={activateCardMutation.isPending}
                    className="w-full bg-gold text-navy-deep font-bold uppercase tracking-wider text-xs h-11 hover:bg-cream"
                  >
                    {activateCardMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Authorize EMV Chip & Start Card Working Now
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: LUXURY CARD APPLICATION STUDIO                        */}
          {/* ============================================================ */}
          {cardDossierTab === "apply" && (
            <form
              className="space-y-4 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                applyCardMutation.mutate({
                  tier: applyCardTier,
                  type: applyCardType,
                  spendingLimit: applyCardLimit,
                  cardHolder: applyCardHolder || user.name || "SUMMIT CLIENT",
                  deliveryOption: applyCardDelivery,
                  applicationNote: applyCardNote,
                });
              }}
            >
              {/* Step 1: Select Card Tier */}
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Select Luxury Card Tier</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                  {[
                    {
                      tier: "Titanium Black" as const,
                      subtitle: "28g Aerospace Titanium",
                      limit: 100000,
                      desc: "Machined from solid Grade 5 Titanium alloy with laser-cut branding.",
                    },
                    {
                      tier: "Obsidian Reserve" as const,
                      subtitle: "Heavy Alloy Composite",
                      limit: 250000,
                      desc: "Matte obsidian finish with private aviation & concierge access.",
                    },
                    {
                      tier: "24k Sovereign Gold" as const,
                      subtitle: "Physical Bullion Inlay",
                      limit: 500000,
                      desc: "Certified 24 Karat gold bullion inlay with zero FX spread worldwide.",
                    },
                    {
                      tier: "Virtual Stealth Ghost" as const,
                      subtitle: "Single-Use Cloud Token",
                      limit: 50000,
                      desc: "Ephemeral dynamic CVV for discrete high-value online settlements.",
                    },
                  ].map((cardOption) => (
                    <button
                      key={cardOption.tier}
                      type="button"
                      onClick={() => {
                        setApplyCardTier(cardOption.tier);
                        setApplyCardLimit(cardOption.limit);
                        if (cardOption.tier === "Virtual Stealth Ghost") setApplyCardType("virtual");
                        else setApplyCardType("physical");
                      }}
                      className={cn(
                        "p-3.5 border text-left rounded transition-all space-y-1.5",
                        applyCardTier === cardOption.tier
                          ? "border-gold bg-gold/15 shadow-[0_0_15px_rgba(212,175,55,0.15)]"
                          : "border-border bg-navy-panel hover:border-gold/40",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs uppercase text-cream">{cardOption.tier}</span>
                        <span className="text-[10px] font-mono text-gold font-bold">${(cardOption.limit / 1000)}k Limit</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{cardOption.subtitle}</div>
                      <p className="text-[11px] text-muted-foreground leading-tight">{cardOption.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Issuance Format</Label>
                  <select
                    value={applyCardType}
                    onChange={(e) => setApplyCardType(e.target.value as any)}
                    className="w-full bg-navy-panel border border-border h-10 px-3 text-xs text-foreground"
                  >
                    <option value="physical">Physical Metal Inlay (Courier / Vault)</option>
                    <option value="virtual">Virtual Digital Token (Instant Cloud)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Requested Daily Limit (USD)</Label>
                  <Input
                    type="number"
                    min="1000"
                    step="1000"
                    value={applyCardLimit}
                    onChange={(e) => setApplyCardLimit(Number(e.target.value))}
                    className="bg-navy-panel text-xs h-10 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Embossed Cardholder Legal Name</Label>
                  <Input
                    placeholder={user.name?.toUpperCase() || "AVA WHITFIELD"}
                    value={applyCardHolder}
                    onChange={(e) => setApplyCardHolder(e.target.value)}
                    className="bg-navy-panel text-xs h-10 uppercase font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Custody & Delivery Preference</Label>
                  <select
                    value={applyCardDelivery}
                    onChange={(e) => setApplyCardDelivery(e.target.value)}
                    className="w-full bg-navy-panel border border-border h-10 px-3 text-xs text-foreground"
                  >
                    <option value="Zurich Segregated Vault Custody">Zurich Segregated Vault Custody</option>
                    <option value="Armored Diplomatic Pouch Courier">Armored Diplomatic Pouch Courier</option>
                    <option value="Geneva Private Wealth Concierge Desk">Geneva Private Wealth Concierge Desk</option>
                    <option value="Instant Cloud Virtual Provisioning">Instant Cloud Virtual Provisioning</option>
                  </select>
                </div>
              </div>

              {/* Client History Standing Assessment */}
              <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3.5 space-y-1.5 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-gold font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-gold" />
                  <span>Client Portfolio Qualification & History Milestone:</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div>
                    <span className="text-muted-foreground uppercase text-[9px] block">Liquid Capital:</span>
                    <span className="font-bold text-cream">{formatMoney(account.data?.balance ?? "0")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground uppercase text-[9px] block">Account Standing:</span>
                    <span className="font-bold text-emerald-400">Obsidian Client Tier</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground uppercase text-[9px] block">Underwriting:</span>
                    <span className="font-bold text-gold">Milestone Cleared</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground pt-1">
                  Your portfolio history exceeds standard collateral requirements. Applications are underwritten and directives assigned within 2 hours.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Application Memorandum / Notes</Label>
                <Input
                  value={applyCardNote}
                  onChange={(e) => setApplyCardNote(e.target.value)}
                  placeholder="e.g. Primary card for European treasury operations"
                  className="bg-navy-panel text-xs h-10"
                />
              </div>

              <Button
                type="submit"
                disabled={applyCardMutation.isPending}
                className="w-full bg-gold text-navy-deep font-bold uppercase tracking-wider text-xs h-11 hover:bg-cream"
              >
                {applyCardMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Card Application for Underwriting Clearance
              </Button>
            </form>
          )}
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
