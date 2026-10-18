import { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  Building2,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Landmark,
  Loader2,
  LogOut,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Snowflake,
  Sun,
  UserPlus,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { BankLogo } from "@/components/BankLogo";
import { StatusPill } from "@/components/StatusPill";
import { TransactionLedger, txLabel } from "@/components/TransactionLedger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDateTime, formatMoney } from "@/lib/money";

type Tab = "overview" | "clients" | "cards" | "deposits" | "payments" | "withdrawals" | "approvals" | "logs" | "deposit_coords";

const PRESET_AMOUNTS = [1000, 5000, 25000, 50000, 100000, 500000, 1000000];

export default function Admin() {
  const { user, isLoading, logout } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: LOGIN_PATH,
  });
  const utils = trpc.useUtils();
  const isAdmin = !!user && user.role === "admin";
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Top Up Modal State
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpTargetUserId, setTopUpTargetUserId] = useState<number | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<number>(50000);
  const [topUpChannel, setTopUpChannel] = useState<
    "admin_topup" | "wire_domestic" | "wire_international" | "crypto_settlement"
  >("admin_topup");
  const [topUpNote, setTopUpNote] = useState("");
  const [topUpRef, setTopUpRef] = useState("");

  // Create Client Modal State
  const [createClientOpen, setCreateClientOpen] = useState(false);

  // Card Underwriting Modal State
  const [cardUnderwriteModal, setCardUnderwriteModal] = useState<{
    open: boolean;
    card?: any;
    decision: "approve_with_instruction" | "instant_activate" | "reject";
    instruction: string;
    pin: string;
    limit: number;
    note: string;
  }>({
    open: false,
    decision: "approve_with_instruction",
    instruction: "Dual-signatory executive authorization required. Enter Signatory PIN 8821 on your client dashboard to initialize card EMV chip.",
    pin: "8821",
    limit: 100000,
    note: "Underwritten under Swiss Private Banking Collateral Framework",
  });
  const [cardFilterStatus, setCardFilterStatus] = useState<"all" | "pending_approval" | "pending_activation" | "active" | "frozen">("all");
  const [cardSearch, setCardSearch] = useState("");

  // Clearance Schedule & Expedite Modal State
  const [scheduleModal, setScheduleModal] = useState<{
    open: boolean;
    txId?: number;
    ref?: string;
    clientName?: string;
    estimatedApproval?: string;
    adminNote?: string;
    expediteDepositRequired?: number;
  }>({ open: false });

  // Custom Transaction Modal State
  const [customTxOpen, setCustomTxOpen] = useState(false);
  const [customTxTargetUserId, setCustomTxTargetUserId] = useState<number | null>(null);
  const [customTxType, setCustomTxType] = useState<"deposit" | "withdrawal" | "transfer_in" | "transfer_out" | "bill_payment" | "card_spend">("deposit");
  const [customTxChannel, setCustomTxChannel] = useState<any>("admin_topup");
  const [customTxAmount, setCustomTxAmount] = useState<number>(25000);
  const [customTxStatus, setCustomTxStatus] = useState<"approved" | "pending" | "rejected">("approved");
  const [customTxRef, setCustomTxRef] = useState("");
  const [customTxNote, setCustomTxNote] = useState("");
  const [customTxCounterparty, setCustomTxCounterparty] = useState("");
  const [customTxBeneficiaryBank, setCustomTxBeneficiaryBank] = useState("");
  const [customTxBeneficiaryAccount, setCustomTxBeneficiaryAccount] = useState("");
  const [customTxEstimated, setCustomTxEstimated] = useState("");
  const [customTxAdminNote, setCustomTxAdminNote] = useState("");
  const [customTxExpedite, setCustomTxExpedite] = useState<number | undefined>(undefined);

  // Deposit Coordinates & Inbound Settings State
  const depositSettingsQuery = trpc.admin.getDepositSettings.useQuery(undefined, { enabled: isAdmin });
  const [wireBankName, setWireBankName] = useState("Summit Private Bank AG");
  const [wireSwift, setWireSwift] = useState("SUMMUS33XXX");
  const [wireRouting, setWireRouting] = useState("021000021");
  const [wireAddress, setWireAddress] = useState("Bahnhofstrasse 45, 8001 Zurich, Switzerland");
  const [wireBeneficiary, setWireBeneficiary] = useState("Summit Institutional Custody Desk");
  const [wireInstructions, setWireInstructions] = useState("Include your unique account number and reference in the wire narrative / memo line for auto-routing.");
  const [cryptoUsdt, setCryptoUsdt] = useState("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
  const [cryptoBtc, setCryptoBtc] = useState("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");
  const [cryptoEth, setCryptoEth] = useState("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
  const [cryptoUsdc, setCryptoUsdc] = useState("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
  const [directInstructions, setDirectInstructions] = useState("Submit your deposit declaration below. Treasury will credit and settle funds once physical or wire verification is authenticated.");
  const [depositNoticeText, setDepositNoticeText] = useState("All client inbound capital is maintained in segregated Swiss Tier-1 custody vaults.");
  const [depositCoordsInitialized, setDepositCoordsInitialized] = useState(false);

  useEffect(() => {
    if (depositSettingsQuery.data && !depositCoordsInitialized) {
      const d = depositSettingsQuery.data;
      setWireBankName(d.bankName || "");
      setWireSwift(d.swiftBic || "");
      setWireRouting(d.routingNumber || "");
      setWireAddress(d.bankAddress || "");
      setWireBeneficiary(d.beneficiaryName || "");
      setWireInstructions(d.wireInstructions || "");
      setCryptoUsdt(d.usdtAddress || "");
      setCryptoBtc(d.btcAddress || "");
      setCryptoEth(d.ethAddress || "");
      setCryptoUsdc(d.usdcAddress || "");
      setDirectInstructions(d.directCreditInstructions || "");
      setDepositNoticeText(d.depositNotice || "");
      setDepositCoordsInitialized(true);
    }
  }, [depositSettingsQuery.data, depositCoordsInitialized]);

  // Search & Filter States
  const [depositSearch, setDepositSearch] = useState("");
  const [depositStatus, setDepositStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [withdrawalSearch, setWithdrawalSearch] = useState("");
  const [withdrawalStatus, setWithdrawalStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [clientSearch, setClientSearch] = useState("");

  const overview = trpc.admin.overview.useQuery(undefined, { enabled: isAdmin });
  const users = trpc.admin.listUsers.useQuery(undefined, { enabled: isAdmin });
  const approvals = trpc.admin.listTransactions.useQuery(
    { status: "pending", limit: 200 },
    { enabled: isAdmin },
  );
  const deposits = trpc.admin.depositHistory.useQuery(
    { status: depositStatus, search: depositSearch, limit: 300 },
    { enabled: isAdmin && (tab === "deposits" || tab === "overview") },
  );
  const payments = trpc.admin.paymentHistory.useQuery(
    { search: paymentSearch, limit: 300 },
    { enabled: isAdmin && tab === "payments" },
  );
  const withdrawals = trpc.admin.withdrawalHistory.useQuery(
    { status: withdrawalStatus, search: withdrawalSearch, limit: 300 },
    { enabled: isAdmin && tab === "withdrawals" },
  );
  const logs = trpc.admin.activityLogs.useQuery(undefined, { enabled: isAdmin && tab === "logs" });
  const allCards = trpc.admin.listCards.useQuery(undefined, { enabled: isAdmin && (tab === "cards" || tab === "overview" || tab === "approvals") });

  const invalidateAll = async () => {
    await Promise.all([
      utils.admin.overview.invalidate(),
      utils.admin.listUsers.invalidate(),
      utils.admin.listTransactions.invalidate(),
      utils.admin.listCards.invalidate(),
      utils.admin.depositHistory.invalidate(),
      utils.admin.paymentHistory.invalidate(),
      utils.admin.withdrawalHistory.invalidate(),
      utils.admin.userDetail.invalidate(),
      utils.admin.activityLogs.invalidate(),
      utils.bank.account.invalidate(),
      utils.bank.transactions.invalidate(),
      utils.bank.cards.invalidate(),
    ]);
  };

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const decide = trpc.admin.decide.useMutation({
    onSuccess: async (_, vars) => {
      flash(vars.approve ? "Transaction approved and funds cleared." : "Transaction rejected.");
      await invalidateAll();
    },
    onError: (e) => flash(e.message),
  });

  const topUpMutation = trpc.admin.topUp.useMutation({
    onSuccess: async (res) => {
      setTopUpOpen(false);
      flash(`Successfully topped up account! Transaction Ref: ${res.transaction.reference}`);
      await invalidateAll();
    },
    onError: (e) => flash(e.message),
  });

  const createClientMutation = trpc.admin.createClient.useMutation({
    onSuccess: async (res) => {
      setCreateClientOpen(false);
      flash(`New client "${res.user.name}" onboarded with initial capitalization of ${formatMoney(res.account.balance)}!`);
      await invalidateAll();
    },
    onError: (e) => flash(e.message),
  });

  const updateScheduleMutation = trpc.admin.updateApprovalSchedule.useMutation({
    onSuccess: async () => {
      setScheduleModal({ open: false });
      flash("Clearance schedule & expedited deposit terms updated.");
      await invalidateAll();
    },
    onError: (e) => flash(e.message),
  });

  const underwriteCardMutation = trpc.admin.underwriteCard.useMutation({
    onSuccess: async (card) => {
      setCardUnderwriteModal((prev) => ({ ...prev, open: false }));
      flash(`Card #${card.cardNumber.slice(-4)} (${card.tier}) underwritten: ${card.status.toUpperCase()}`);
      await invalidateAll();
    },
    onError: (e) => flash(e.message),
  });

  const addCustomTxMutation = trpc.admin.addCustomTransaction.useMutation({
    onSuccess: async (res) => {
      setCustomTxOpen(false);
      flash(`Transaction recorded! Ref: ${res.transaction.reference}`);
      await invalidateAll();
    },
    onError: (e) => flash(e.message),
  });

  const updateDepositSettingsMutation = trpc.admin.updateDepositSettings.useMutation({
    onSuccess: async () => {
      flash("Client deposit coordinates updated successfully across all accounts.");
      await Promise.all([
        utils.admin.getDepositSettings.invalidate(),
        utils.bank.depositSettings.invalidate(),
      ]);
    },
    onError: (e) => flash(e.message),
  });

  const handleOpenTopUp = (targetId?: number) => {
    const clientsList = users.data?.filter((u) => u.user.role === "user") || [];
    const id = targetId || (clientsList.length > 0 ? clientsList[0].user.id : null);
    setTopUpTargetUserId(id);
    setTopUpAmount(50000);
    setTopUpNote("Institutional Private Wealth Allocation");
    setTopUpRef(`TOP-${Date.now().toString(36).toUpperCase()}`);
    setTopUpOpen(true);
  };

  // Export to CSV helper
  const exportCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        headers.join(","),
        ...data.map((row) =>
          headers
            .map((h) => {
              const val = row[h];
              return typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val;
            })
            .join(","),
        ),
      ].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-panel">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy-panel px-6 text-center">
        <BankLogo />
        <h1 className="font-display text-2xl uppercase tracking-[0.08em] text-foreground">
          Restricted Area
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The Summit Administration Console is restricted to authorized bank officers.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex h-11 items-center border border-gold/60 px-6 text-[11px] uppercase tracking-[0.2em] text-cream hover:bg-gold hover:text-navy-deep"
        >
          Return to My Account
        </Link>
      </div>
    );
  }

  const clientUsers = (users.data ?? []).filter((u) => u.user.role === "user");
  const selectedTopUpAccount = clientUsers.find((c) => c.user.id === topUpTargetUserId);

  return (
    <div className="min-h-screen bg-navy-panel text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-navy-deep/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-4">
            <Link to="/">
              <BankLogo compact />
            </Link>
            <span className="hidden items-center gap-2 border-l border-border pl-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold sm:inline-flex">
              <ShieldCheck className="h-4 w-4" />
              Sovereign Administration Console
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => handleOpenTopUp()}
              className="hidden h-9 bg-gold px-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-deep hover:bg-cream sm:inline-flex"
            >
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              Top Up Balance
            </Button>
            <Link
              to="/dashboard"
              className="inline-flex h-9 items-center border border-border px-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-cream"
            >
              Client View
            </Link>
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
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
        {/* Banner with Title and Action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.24em] text-gold">Back-Office Governance</span>
            <h1 className="mt-1 font-display text-3xl uppercase tracking-[0.05em] text-foreground md:text-4xl">
              Control Room
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => handleOpenTopUp()}
              className="h-10 bg-gold px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-deep hover:bg-cream"
            >
              <Zap className="mr-1.5 h-4 w-4" />
              Top Up Any Account
            </Button>
            <Button
              onClick={() => {
                const clientsList = users.data?.filter((u) => u.user.role === "user") || [];
                setCustomTxTargetUserId(clientsList[0]?.user.id || null);
                setCustomTxRef(`TX-${Date.now().toString(36).toUpperCase()}`);
                setCustomTxOpen(true);
              }}
              variant="outline"
              className="h-10 border-gold/60 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold hover:bg-gold/10"
            >
              <PlusCircle className="mr-1.5 h-4 w-4" />
              Add Transaction
            </Button>
            <Button
              onClick={() => setCreateClientOpen(true)}
              variant="outline"
              className="h-10 border-border text-[11px] uppercase tracking-[0.18em] text-cream hover:bg-navy-panel"
            >
              <UserPlus className="mr-1.5 h-4 w-4 text-gold" />
              New Client
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => invalidateAll()}
              className="h-10 text-muted-foreground hover:text-cream"
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {notice && (
          <div className="mt-6 flex items-center justify-between border border-gold/50 bg-gold/10 px-5 py-3.5 text-sm text-cream shadow-lg">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-cream">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Global Navigation Tabs */}
        <div className="mt-8 flex overflow-x-auto border-b border-border scrollbar-none">
          {(
            [
              ["overview", "Overview"],
              ["clients", `Clients (${clientUsers.length})`],
              [
                "cards",
                `Card Underwriting${
                  (allCards.data ?? []).filter((c) => c.status === "pending_approval" || c.status === "pending_activation").length > 0
                    ? ` (${(allCards.data ?? []).filter((c) => c.status === "pending_approval" || c.status === "pending_activation").length})`
                    : ""
                }`,
              ],
              ["deposits", "Deposit History"],
              ["deposit_coords", "Client Deposit Details"],
              ["payments", "Payment History"],
              ["withdrawals", "Withdrawal History"],
              ["approvals", `Review Queue${approvals.data?.length ? ` (${approvals.data.length})` : ""}`],
              ["logs", "Audit Stream"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "h-12 whitespace-nowrap border-b-2 px-5 text-[11px] font-medium uppercase tracking-[0.2em] transition-colors",
                tab === key
                  ? "border-gold text-cream"
                  : "border-transparent text-muted-foreground hover:text-cream",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ===================== TAB: OVERVIEW ===================== */}
        {tab === "overview" && (
          <div className="mt-8 space-y-8">
            {/* Key Metrics */}
            <section className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Total Client Assets" value={overview.isLoading ? null : formatMoney(overview.data?.totalBalance ?? 0)} gold />
              <Stat label="Pending Queue" value={overview.isLoading ? null : String(overview.data?.pendingCount ?? 0)} alert={Number(overview.data?.pendingCount ?? 0) > 0} />
              <Stat label="Cleared Deposits" value={overview.isLoading ? null : formatMoney(overview.data?.totalDeposits ?? 0)} />
              <Stat label="Cleared Withdrawals" value={overview.isLoading ? null : formatMoney(overview.data?.totalWithdrawals ?? 0)} />
              <Stat label="Vaulted Wealth" value={overview.isLoading ? null : formatMoney(overview.data?.totalVaultAssets ?? 0)} />
            </section>

            {/* Quick Actions & Recent Queue Banner */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Liquidity Top-Up Spotlight */}
              <div className="relative overflow-hidden border border-border bg-navy-deep p-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-gold">Direct Capital Injection</span>
                  <Zap className="h-4 w-4 text-gold" />
                </div>
                <h3 className="mt-3 font-display text-xl uppercase tracking-[0.05em] text-foreground">
                  Instant Client Top-Up
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Disburse capital directly into any client account. Funds reflect in their balance and ledger with full administrative audit tracking.
                </p>
                <div className="mt-6 flex gap-2">
                  <Button
                    onClick={() => handleOpenTopUp()}
                    className="h-10 flex-1 bg-gold text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-deep hover:bg-cream"
                  >
                    Launch Top-Up Desk
                  </Button>
                </div>
              </div>

              {/* Pending Approvals Summary */}
              <div className="border border-border bg-navy-deep p-6 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.22em] text-amber-300">Urgent Verification</span>
                    {Number(overview.data?.pendingCount ?? 0) > 0 && (
                      <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTab("approvals")}
                    className="h-7 text-[11px] uppercase tracking-[0.16em] text-gold hover:text-cream"
                  >
                    View All ({approvals.data?.length ?? 0}) <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>

                <div className="mt-4 divide-y divide-border/60">
                  {(approvals.data ?? []).slice(0, 3).map((row) => (
                    <div key={row.transaction.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">{row.userName}</span>
                          <span className="tnum text-xs text-muted-foreground">({row.accountNumber})</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {txLabel(row.transaction)} · {row.transaction.reference}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tnum text-base font-semibold text-cream">
                          {formatMoney(row.transaction.amount)}
                        </span>
                        <Button
                          size="sm"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ transactionId: row.transaction.id, approve: true })}
                          className="h-8 bg-emerald-500/90 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-deep hover:bg-emerald-400"
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(approvals.data ?? []).length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Review queue is clear. No transactions pending approval.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Clients Table preview */}
            <div className="border border-border bg-navy-deep p-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-gold">Active Registry</span>
                  <h3 className="font-display text-lg uppercase tracking-[0.05em] text-foreground">
                    Private Clients
                  </h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTab("clients")}
                  className="h-9 border-border text-[11px] uppercase tracking-[0.16em] text-cream"
                >
                  Manage All Clients
                </Button>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <th className="py-3 pl-4 pr-4 font-medium">Client</th>
                      <th className="py-3 pr-4 font-medium">Tier</th>
                      <th className="py-3 pr-4 font-medium">Account №</th>
                      <th className="py-3 pr-4 text-right font-medium">Balance</th>
                      <th className="py-3 pr-4 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientUsers.slice(0, 4).map((row) => (
                      <tr key={row.user.id} className="border-b border-border/60 last:border-0 hover:bg-navy-panel">
                        <td className="py-3 pl-4 pr-4">
                          <div className="font-medium text-foreground">{row.user.name}</div>
                          <div className="text-xs text-muted-foreground">{row.user.email}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-gold">
                            {row.user.tier || "Private Wealth"}
                          </span>
                        </td>
                        <td className="tnum py-3 pr-4 text-xs text-muted-foreground">
                          {row.account?.accountNumber || "—"}
                        </td>
                        <td className="tnum py-3 pr-4 text-right font-semibold text-cream">
                          {row.account ? formatMoney(row.account.balance) : "—"}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleOpenTopUp(row.user.id)}
                            className="h-8 bg-gold/90 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-deep hover:bg-gold"
                          >
                            <Zap className="mr-1 h-3 w-3" /> Top Up
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: CLIENTS ===================== */}
        {tab === "clients" && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or account №..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="h-11 bg-navy-deep pl-10 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setCreateClientOpen(true)}
                  className="h-11 bg-gold px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-deep hover:bg-cream"
                >
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  New Client
                </Button>
              </div>
            </div>

            <div className="border border-border bg-navy-deep">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <th className="py-4 pl-6 pr-4 font-medium">Client</th>
                      <th className="py-4 pr-4 font-medium">Account №</th>
                      <th className="py-4 pr-4 font-medium">Tier & KYC</th>
                      <th className="py-4 pr-4 font-medium">Status</th>
                      <th className="py-4 pr-4 font-medium">Pending</th>
                      <th className="py-4 pr-6 text-right font-medium">Balance</th>
                      <th className="py-4 pr-6 text-right font-medium">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientUsers
                      .filter((r) => {
                        if (!clientSearch) return true;
                        const q = clientSearch.toLowerCase();
                        return (
                          (r.user.name && r.user.name.toLowerCase().includes(q)) ||
                          (r.user.email && r.user.email.toLowerCase().includes(q)) ||
                          (r.account && r.account.accountNumber.includes(q))
                        );
                      })
                      .map((row) => (
                        <tr
                          key={row.user.id}
                          className="border-b border-border/60 transition-colors last:border-0 hover:bg-navy-panel"
                        >
                          <td className="py-4 pl-6 pr-4">
                            <div className="font-semibold text-foreground">{row.user.name}</div>
                            <div className="text-xs text-muted-foreground">{row.user.email}</div>
                          </td>
                          <td className="tnum py-4 pr-4 text-xs text-muted-foreground">
                            {row.account?.accountNumber ?? "—"}
                          </td>
                          <td className="py-4 pr-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-gold font-medium">
                                {row.user.tier || "Private Wealth"}
                              </span>
                              <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-400">
                                KYC Verified
                              </span>
                            </div>
                          </td>
                          <td className="py-4 pr-4">
                            {row.account ? <StatusPill status={row.account.status} /> : "—"}
                          </td>
                          <td className="tnum py-4 pr-4">
                            {row.pendingCount > 0 ? (
                              <span className="border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                                {row.pendingCount} pending
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                          </td>
                          <td className="tnum whitespace-nowrap py-4 pr-6 text-right font-semibold text-cream">
                            {row.account ? formatMoney(row.account.balance) : "—"}
                          </td>
                          <td className="whitespace-nowrap py-4 pr-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleOpenTopUp(row.user.id)}
                                className="h-8 bg-gold px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-deep hover:bg-cream"
                              >
                                <Zap className="mr-1 h-3 w-3" />
                                Top Up
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedUserId(row.user.id)}
                                className="h-8 border-border text-[10px] uppercase tracking-[0.14em] text-cream hover:bg-navy-panel"
                              >
                                Profile
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: DEPOSIT HISTORY ===================== */}
        {tab === "deposits" && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-72">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search deposits..."
                    value={depositSearch}
                    onChange={(e) => setDepositSearch(e.target.value)}
                    className="h-11 bg-navy-deep pl-10 text-sm"
                  />
                </div>
                <Select
                  value={depositStatus}
                  onValueChange={(v) => setDepositStatus(v as any)}
                >
                  <SelectTrigger className="h-11 w-40 bg-navy-deep">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-navy-deep text-foreground">
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleOpenTopUp()}
                  className="h-11 bg-gold px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-deep hover:bg-cream"
                >
                  <Zap className="mr-1.5 h-4 w-4" />
                  Top Up Client
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    exportCSV(
                      (deposits.data ?? []).map((d) => ({
                        Date: formatDateTime(d.transaction.createdAt),
                        Client: d.userName,
                        Email: d.userEmail,
                        Account: d.accountNumber,
                        Reference: d.transaction.reference,
                        Channel: d.transaction.channel,
                        Amount: d.transaction.amount,
                        Status: d.transaction.status,
                        Note: d.transaction.note ?? "",
                      })),
                      "Summit_Deposits_Ledger",
                    )
                  }
                  className="h-11 border-border text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-cream"
                >
                  <Download className="mr-1.5 h-4 w-4" /> Export CSV
                </Button>
              </div>
            </div>

            <div className="border border-border bg-navy-deep">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <th className="py-4 pl-6 pr-4 font-medium">Date & Reference</th>
                      <th className="py-4 pr-4 font-medium">Client</th>
                      <th className="py-4 pr-4 font-medium">Deposit Method</th>
                      <th className="py-4 pr-4 font-medium">Counterparty / Note</th>
                      <th className="py-4 pr-4 font-medium">Status</th>
                      <th className="py-4 pr-6 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(deposits.data ?? []).map((row) => (
                      <tr key={row.transaction.id} className="border-b border-border/60 last:border-0 hover:bg-navy-panel">
                        <td className="py-4 pl-6 pr-4">
                          <div className="tnum font-medium text-foreground text-xs">{row.transaction.reference}</div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(row.transaction.createdAt)}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="font-semibold text-foreground">{row.userName}</div>
                          <div className="tnum text-xs text-muted-foreground">{row.accountNumber}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <span className="border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                            {txLabel(row.transaction)}
                          </span>
                        </td>
                        <td className="py-4 pr-4 max-w-xs truncate text-xs text-muted-foreground">
                          {row.transaction.counterparty ? `${row.transaction.counterparty} · ` : ""}
                          {row.transaction.note || "—"}
                        </td>
                        <td className="py-4 pr-4">
                          <StatusPill status={row.transaction.status} />
                        </td>
                        <td className="tnum whitespace-nowrap py-4 pr-6 text-right font-semibold text-emerald-400 text-base">
                          +{formatMoney(row.transaction.amount)}
                        </td>
                      </tr>
                    ))}
                    {(deposits.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                          No deposit records match your filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: PAYMENT HISTORY ===================== */}
        {tab === "payments" && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative w-80">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search payments & transfers..."
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  className="h-11 bg-navy-deep pl-10 text-sm"
                />
              </div>

              <Button
                variant="outline"
                onClick={() =>
                  exportCSV(
                    (payments.data ?? []).map((p) => ({
                      Date: formatDateTime(p.transaction.createdAt),
                      Sender: p.userName,
                      Account: p.accountNumber,
                      Reference: p.transaction.reference,
                      Type: p.transaction.type,
                      Counterparty: p.transaction.counterparty ?? "",
                      Amount: p.transaction.amount,
                      Status: p.transaction.status,
                    })),
                    "Summit_Payments_Ledger",
                  )
                }
                className="h-11 border-border text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-cream"
              >
                <Download className="mr-1.5 h-4 w-4" /> Export CSV
              </Button>
            </div>

            <div className="border border-border bg-navy-deep">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <th className="py-4 pl-6 pr-4 font-medium">Date & Reference</th>
                      <th className="py-4 pr-4 font-medium">Client (Debited)</th>
                      <th className="py-4 pr-4 font-medium">Payment Type</th>
                      <th className="py-4 pr-4 font-medium">Beneficiary / Destination</th>
                      <th className="py-4 pr-4 font-medium">Status</th>
                      <th className="py-4 pr-6 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payments.data ?? []).map((row) => (
                      <tr key={row.transaction.id} className="border-b border-border/60 last:border-0 hover:bg-navy-panel">
                        <td className="py-4 pl-6 pr-4">
                          <div className="tnum font-medium text-foreground text-xs">{row.transaction.reference}</div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(row.transaction.createdAt)}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="font-semibold text-foreground">{row.userName}</div>
                          <div className="tnum text-xs text-muted-foreground">{row.accountNumber}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <span className="border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-sky-300">
                            {txLabel(row.transaction)}
                          </span>
                        </td>
                        <td className="py-4 pr-4 max-w-xs truncate text-xs text-foreground">
                          {row.transaction.counterparty || "—"}
                          {row.transaction.note ? ` · ${row.transaction.note}` : ""}
                        </td>
                        <td className="py-4 pr-4">
                          <StatusPill status={row.transaction.status} />
                        </td>
                        <td className="tnum whitespace-nowrap py-4 pr-6 text-right font-semibold text-red-300 text-base">
                          −{formatMoney(row.transaction.amount)}
                        </td>
                      </tr>
                    ))}
                    {(payments.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                          No payment history found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: WITHDRAWAL HISTORY ===================== */}
        {tab === "withdrawals" && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-72">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search withdrawals..."
                    value={withdrawalSearch}
                    onChange={(e) => setWithdrawalSearch(e.target.value)}
                    className="h-11 bg-navy-deep pl-10 text-sm"
                  />
                </div>
                <Select
                  value={withdrawalStatus}
                  onValueChange={(v) => setWithdrawalStatus(v as any)}
                >
                  <SelectTrigger className="h-11 w-40 bg-navy-deep">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-navy-deep text-foreground">
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                onClick={() =>
                  exportCSV(
                    (withdrawals.data ?? []).map((w) => ({
                      Date: formatDateTime(w.transaction.createdAt),
                      Client: w.userName,
                      Account: w.accountNumber,
                      Reference: w.transaction.reference,
                      Bank: w.transaction.beneficiaryBank ?? "",
                      BeneficiaryAccount: w.transaction.beneficiaryAccount ?? "",
                      Amount: w.transaction.amount,
                      Status: w.transaction.status,
                    })),
                    "Summit_Withdrawals_Ledger",
                  )
                }
                className="h-11 border-border text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-cream"
              >
                <Download className="mr-1.5 h-4 w-4" /> Export CSV
              </Button>
            </div>

            <div className="border border-border bg-navy-deep">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <th className="py-4 pl-6 pr-4 font-medium">Date & Reference</th>
                      <th className="py-4 pr-4 font-medium">Client</th>
                      <th className="py-4 pr-4 font-medium">Destination Financial Institution</th>
                      <th className="py-4 pr-4 font-medium">Clearance Schedule & Expedite Note</th>
                      <th className="py-4 pr-4 font-medium">Status</th>
                      <th className="py-4 pr-4 text-right font-medium">Amount</th>
                      <th className="py-4 pr-6 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(withdrawals.data ?? []).map((row) => (
                      <tr key={row.transaction.id} className="border-b border-border/60 last:border-0 hover:bg-navy-panel">
                        <td className="py-4 pl-6 pr-4">
                          <div className="tnum font-medium text-foreground text-xs">{row.transaction.reference}</div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(row.transaction.createdAt)}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="font-semibold text-foreground">{row.userName}</div>
                          <div className="tnum text-xs text-muted-foreground">{row.accountNumber}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="font-medium text-foreground">{row.transaction.beneficiaryBank || "External Wire Destination"}</div>
                          <div className="text-xs text-muted-foreground">
                            {txLabel(row.transaction)}
                            {row.transaction.beneficiaryAccount ? ` · Acct/IBAN: ${row.transaction.beneficiaryAccount}` : ""}
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-xs">
                          {row.transaction.status === "pending" ? (
                            <div className="space-y-1">
                              <div className="text-gold font-mono flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{row.transaction.estimatedApproval || "Clearance date pending"}</span>
                              </div>
                              {row.transaction.adminNote && (
                                <div className="text-muted-foreground italic text-[11px]">
                                  {row.transaction.adminNote}
                                </div>
                              )}
                              {row.transaction.expediteDepositRequired && (
                                <div className="text-amber-300 font-mono font-bold text-[10px]">
                                  ⚡ Expedite with ${formatMoney(row.transaction.expediteDepositRequired)} deposit
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-4 pr-4">
                          <StatusPill status={row.transaction.status} />
                        </td>
                        <td className="tnum whitespace-nowrap py-4 pr-4 text-right font-semibold text-red-300 text-base">
                          −{formatMoney(row.transaction.amount)}
                        </td>
                        <td className="py-4 pr-6 text-right whitespace-nowrap">
                          {row.transaction.status === "pending" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setScheduleModal({
                                    open: true,
                                    txId: row.transaction.id,
                                    ref: row.transaction.reference,
                                    clientName: row.userName,
                                    estimatedApproval: row.transaction.estimatedApproval ?? "",
                                    adminNote: row.transaction.adminNote ?? "",
                                    expediteDepositRequired: row.transaction.expediteDepositRequired
                                      ? Number(row.transaction.expediteDepositRequired)
                                      : undefined,
                                  })
                                }
                                className="h-8 border-gold/40 text-[10px] uppercase font-semibold text-gold hover:bg-gold/10 px-2"
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                Schedule / Expedite
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => decide.mutate({ transactionId: row.transaction.id, approve: true })}
                                className="h-8 bg-emerald-500/90 text-[10px] uppercase font-semibold text-navy-deep hover:bg-emerald-400 px-2"
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => decide.mutate({ transactionId: row.transaction.id, approve: false })}
                                className="h-8 border-red-400/40 text-[10px] uppercase font-semibold text-red-300 hover:bg-red-400/10 px-2"
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(withdrawals.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                          No withdrawal history found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: APPROVALS ===================== */}
        {tab === "approvals" && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl uppercase tracking-[0.05em] text-foreground">
                  Institutional Clearance Queue
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Review and settle pending deposit and withdrawal requests.
                </p>
              </div>
            </div>

            {approvals.isLoading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-24 w-full bg-navy-deep" />
                ))}
              </div>
            ) : (approvals.data ?? []).length === 0 ? (
              <div className="border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
                The review queue is empty. All deposit and withdrawal requests have been settled.
              </div>
            ) : (
              <div className="space-y-3">
                {(approvals.data ?? []).map((row) => (
                  <div
                    key={row.transaction.id}
                    className="border border-border bg-navy-deep p-5 md:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-semibold uppercase tracking-[0.14em] text-cream">
                            {txLabel(row.transaction)}
                          </span>
                          <span className="tnum text-xl font-bold text-foreground">
                            {formatMoney(row.transaction.amount)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {row.userName ?? "—"} · {row.userEmail ?? ""} · Account{" "}
                          <span className="tnum font-medium text-cream">{row.accountNumber}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Requested {formatDateTime(row.transaction.createdAt)} · Ref:{" "}
                          <span className="tnum text-foreground">{row.transaction.reference}</span>
                          {row.transaction.note ? ` · “${row.transaction.note}”` : ""}
                        </div>
                      </div>
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                        <Button
                          variant="outline"
                          onClick={() =>
                            setScheduleModal({
                              open: true,
                              txId: row.transaction.id,
                              ref: row.transaction.reference,
                              clientName: row.userName,
                              estimatedApproval: row.transaction.estimatedApproval ?? "",
                              adminNote: row.transaction.adminNote ?? "",
                              expediteDepositRequired: row.transaction.expediteDepositRequired
                                ? Number(row.transaction.expediteDepositRequired)
                                : undefined,
                            })
                          }
                          className="h-11 flex-1 border-gold/40 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold hover:bg-gold/10 sm:flex-none sm:px-4"
                        >
                          <Clock className="mr-1.5 h-4 w-4" />
                          Clearance Schedule / Expedite
                        </Button>
                        <Button
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({ transactionId: row.transaction.id, approve: true })
                          }
                          className="h-11 flex-1 bg-emerald-500/90 text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-deep hover:bg-emerald-400 sm:flex-none sm:px-6"
                        >
                          <Check className="mr-1.5 h-4 w-4" />
                          Approve & Settle
                        </Button>
                        <Button
                          disabled={decide.isPending}
                          variant="outline"
                          onClick={() =>
                            decide.mutate({ transactionId: row.transaction.id, approve: false })
                          }
                          className="h-11 flex-1 border-red-400/50 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300 hover:bg-red-400/10 sm:flex-none sm:px-6"
                        >
                          <X className="mr-1.5 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB: AUDIT STREAM ===================== */}
        {tab === "logs" && (
          <div className="mt-8 space-y-6">
            <h3 className="font-display text-xl uppercase tracking-[0.05em] text-foreground">
              Institutional Audit Trail
            </h3>
            <div className="border border-border bg-navy-deep divide-y divide-border/60">
              {(logs.data ?? []).map((l) => (
                <div key={l.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-foreground text-sm">{l.action}</span>
                      <span className="border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-gold">
                        {l.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{l.details}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      Logged by {l.actorName} · {formatDateTime(l.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              {(logs.data ?? []).length === 0 && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No activity log entries recorded.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: CLIENT DEPOSIT DETAILS & SETTINGS ===================== */}
        {tab === "deposit_coords" && (
          <div className="mt-8 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
              <div>
                <h3 className="font-display text-xl uppercase tracking-[0.05em] text-foreground flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-gold" />
                  Client Inbound Deposit Coordinates & Protocols
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Configure corporate wire instructions, institutional crypto custody addresses, and clearance disclosures shown to all private banking clients.
                </p>
              </div>
              <Button
                disabled={updateDepositSettingsMutation.isPending}
                onClick={() => {
                  updateDepositSettingsMutation.mutate({
                    bankName: wireBankName,
                    swiftBic: wireSwift,
                    routingNumber: wireRouting,
                    bankAddress: wireAddress,
                    beneficiaryName: wireBeneficiary,
                    wireInstructions: wireInstructions,
                    usdtAddress: cryptoUsdt,
                    btcAddress: cryptoBtc,
                    ethAddress: cryptoEth,
                    usdcAddress: cryptoUsdc,
                    directCreditInstructions: directInstructions,
                    depositNotice: depositNoticeText,
                  });
                }}
                className="bg-gold text-[12px] font-semibold uppercase tracking-[0.16em] text-navy-deep hover:bg-cream h-11 px-6 shadow-lg shadow-gold/10"
              >
                {updateDepositSettingsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Check className="mr-2 h-4 w-4" />
                Save All Deposit Coordinates
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Wire Coordinates Card */}
              <div className="border border-border bg-navy-deep p-6 space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-border/60">
                  <Building2 className="h-4 w-4 text-gold" />
                  <h4 className="font-display text-sm uppercase tracking-wider text-cream">
                    Global Wire Clearing Coordinates
                  </h4>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Corporate Clearing Bank Name</Label>
                    <Input
                      value={wireBankName}
                      onChange={(e) => setWireBankName(e.target.value)}
                      placeholder="e.g. Summit Private Bank AG"
                      className="bg-navy-panel border-border text-foreground text-xs h-10 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">SWIFT / BIC Code</Label>
                      <Input
                        value={wireSwift}
                        onChange={(e) => setWireSwift(e.target.value)}
                        placeholder="e.g. SUMMUS33XXX"
                        className="bg-navy-panel border-border text-gold font-bold text-xs h-10 font-mono uppercase"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fedwire / ABA Routing</Label>
                      <Input
                        value={wireRouting}
                        onChange={(e) => setWireRouting(e.target.value)}
                        placeholder="e.g. 021000021"
                        className="bg-navy-panel border-border text-foreground font-mono text-xs h-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Default Beneficiary Name / Desk</Label>
                    <Input
                      value={wireBeneficiary}
                      onChange={(e) => setWireBeneficiary(e.target.value)}
                      placeholder="e.g. Summit Institutional Custody Desk"
                      className="bg-navy-panel border-border text-foreground text-xs h-10 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bank Physical Address / Jurisdiction</Label>
                    <Input
                      value={wireAddress}
                      onChange={(e) => setWireAddress(e.target.value)}
                      placeholder="e.g. Bahnhofstrasse 45, 8001 Zurich, Switzerland"
                      className="bg-navy-panel border-border text-foreground text-xs h-10 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Wire Memo & Routing Instructions</Label>
                    <textarea
                      value={wireInstructions}
                      onChange={(e) => setWireInstructions(e.target.value)}
                      rows={3}
                      className="w-full rounded border border-border bg-navy-panel px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold"
                      placeholder="Instructions shown to clients in their wire deposit modal..."
                    />
                  </div>
                </div>
              </div>

              {/* Crypto Custody Card */}
              <div className="border border-border bg-navy-deep p-6 space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-border/60">
                  <Wallet className="h-4 w-4 text-gold" />
                  <h4 className="font-display text-sm uppercase tracking-wider text-cream">
                    Digital Asset Custody Vault Addresses
                  </h4>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Tether USD (USDT — ERC20 / TRC20)</span>
                      <span className="text-[10px] text-gold font-mono">Instant Clearing</span>
                    </Label>
                    <Input
                      value={cryptoUsdt}
                      onChange={(e) => setCryptoUsdt(e.target.value)}
                      placeholder="0x..."
                      className="bg-navy-panel border-border text-gold font-mono text-xs h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Bitcoin (BTC — Native SegWit / Taproot)</span>
                      <span className="text-[10px] text-gold font-mono">Cold Vault</span>
                    </Label>
                    <Input
                      value={cryptoBtc}
                      onChange={(e) => setCryptoBtc(e.target.value)}
                      placeholder="bc1q..."
                      className="bg-navy-panel border-border text-gold font-mono text-xs h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Ethereum (ETH — Mainnet Custody)</span>
                      <span className="text-[10px] text-gold font-mono">Smart Contract</span>
                    </Label>
                    <Input
                      value={cryptoEth}
                      onChange={(e) => setCryptoEth(e.target.value)}
                      placeholder="0x..."
                      className="bg-navy-panel border-border text-gold font-mono text-xs h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>USD Coin (USDC — Circle Treasury)</span>
                      <span className="text-[10px] text-gold font-mono">Regulated Reserve</span>
                    </Label>
                    <Input
                      value={cryptoUsdc}
                      onChange={(e) => setCryptoUsdc(e.target.value)}
                      placeholder="0x..."
                      className="bg-navy-panel border-border text-gold font-mono text-xs h-10"
                    />
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client Vault Custody Security Notice</Label>
                    <textarea
                      value={depositNoticeText}
                      onChange={(e) => setDepositNoticeText(e.target.value)}
                      rows={2}
                      className="w-full rounded border border-border bg-navy-panel px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold"
                      placeholder="Institutional custody notice banner displayed to depositors..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Credit & Institutional Protocol */}
            <div className="border border-border bg-navy-deep p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border/60">
                <ShieldCheck className="h-4 w-4 text-gold" />
                <h4 className="font-display text-sm uppercase tracking-wider text-cream">
                  Direct Credit & Regulatory Clearance Protocol
                </h4>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client Guidance for Physical / Wire / Crypto Settlement Declarations</Label>
                <textarea
                  value={directInstructions}
                  onChange={(e) => setDirectInstructions(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-border bg-navy-panel px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold"
                  placeholder="Instructions explaining deposit confirmation, compliance clearance, and treasury credit..."
                />
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: CARDS UNDERWRITING ===================== */}
        {tab === "cards" && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-xl uppercase tracking-wider text-cream flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-gold" />
                  Sovereign Card Underwriting & Directive Desk
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review luxury metal card applications, verify client portfolio history standing, and dispatch EMV activation directives.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                  placeholder="Search by client or card ending..."
                  className="bg-navy-panel text-xs h-9 w-64"
                />
                <select
                  value={cardFilterStatus}
                  onChange={(e) => setCardFilterStatus(e.target.value as any)}
                  className="bg-navy-panel border border-border h-9 px-3 text-xs text-foreground"
                >
                  <option value="all">All Card Statuses</option>
                  <option value="pending_approval">Pending Underwriting</option>
                  <option value="pending_activation">Pending Activation Directive</option>
                  <option value="active">Active Working Cards</option>
                  <option value="frozen">Frozen Cards</option>
                </select>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-4">
              <Stat label="Total Registered Cards" value={String(allCards.data?.length ?? 0)} />
              <Stat
                label="Pending Underwriting"
                value={String((allCards.data ?? []).filter((c) => c.status === "pending_approval").length)}
                alert={(allCards.data ?? []).some((c) => c.status === "pending_approval")}
              />
              <Stat
                label="Pending Activation"
                value={String((allCards.data ?? []).filter((c) => c.status === "pending_activation").length)}
                gold
              />
              <Stat
                label="Active Operational"
                value={String((allCards.data ?? []).filter((c) => c.status === "active").length)}
              />
            </div>

            {/* Card Application List */}
            <div className="border border-border bg-navy-deep overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-navy-panel text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">Client / Account</th>
                      <th className="py-3 px-4">Card Tier & Type</th>
                      <th className="py-3 px-4">Masked Number</th>
                      <th className="py-3 px-4">Spending Limit</th>
                      <th className="py-3 px-4">History Standing Milestone</th>
                      <th className="py-3 px-4">Status & Directive</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(() => {
                      let list = allCards.data ?? [];
                      if (cardFilterStatus !== "all") {
                        list = list.filter((c) => c.status === cardFilterStatus);
                      }
                      if (cardSearch.trim()) {
                        const q = cardSearch.toLowerCase();
                        list = list.filter(
                          (c) =>
                            c.userName.toLowerCase().includes(q) ||
                            c.userEmail.toLowerCase().includes(q) ||
                            c.tier.toLowerCase().includes(q) ||
                            c.cardNumber.includes(q),
                        );
                      }
                      if (list.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-muted-foreground">
                              No card records match your filter criteria.
                            </td>
                          </tr>
                        );
                      }
                      return list.map((c) => (
                        <tr key={c.id} className="hover:bg-navy-panel/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono">
                            <div className="font-semibold text-cream font-sans">{c.userName}</div>
                            <div className="text-[10px] text-muted-foreground">{c.userEmail}</div>
                            <div className="text-[10px] text-gold">Acct #{c.accountNumber} · ${formatMoney(c.accountBalance)}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-cream block">{c.tier}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{c.type} format</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-cream font-bold">
                            {c.cardNumber}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-cream">
                            ${formatMoney(c.spendingLimit)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-zinc-300 font-mono text-[11px] block">{c.requiredHistoryPosition || "Standard Private Client"}</span>
                            {c.applicationNote && (
                              <span className="text-[10px] text-muted-foreground block italic">"{c.applicationNote}"</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <span
                                className={cn(
                                  "inline-block px-2 py-0.5 text-[9px] uppercase font-bold rounded",
                                  c.status === "active"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : c.status === "pending_approval"
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                                      : c.status === "pending_activation"
                                        ? "bg-gold/20 text-gold border border-gold/40"
                                        : "bg-sky-500/20 text-sky-300 border border-sky-500/30",
                                )}
                              >
                                {c.status.replace("_", " ")}
                              </span>
                              {c.activationInstruction && (
                                <div className="text-[10px] text-zinc-300 font-mono truncate max-w-xs" title={c.activationInstruction}>
                                  Directive: {c.activationInstruction}
                                </div>
                              )}
                              {c.activationPin && (
                                <div className="text-[10px] text-gold font-mono">
                                  PIN: {c.activationPin}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              size="sm"
                              onClick={() => {
                                setCardUnderwriteModal({
                                  open: true,
                                  card: c,
                                  decision: c.status === "pending_approval" ? "approve_with_instruction" : "instant_activate",
                                  instruction: c.activationInstruction || "Dual-signatory executive authorization required. Enter Signatory PIN 8821 on your client dashboard to initialize card EMV chip.",
                                  pin: c.activationPin || "8821",
                                  limit: c.spendingLimit,
                                  note: c.adminDecisionNote || "Approved under Sovereign Collateral Underwriting",
                                });
                              }}
                              className={cn(
                                "h-8 text-[10px] uppercase font-bold px-3",
                                c.status === "pending_approval"
                                  ? "bg-gold text-navy-deep hover:bg-cream"
                                  : "border border-border text-muted-foreground hover:text-white",
                              )}
                            >
                              {c.status === "pending_approval" ? "Underwrite Application" : "Edit Directives"}
                            </Button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ===================== MODAL: TOP UP ANY USER ===================== */}
      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="border-border bg-navy-deep text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase tracking-[0.06em] text-foreground">
              ⚡ Admin Balance Top-Up
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Credit funds directly into any client's account balance. Settle with institutional liquidity.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!topUpTargetUserId || topUpAmount <= 0) return;
              topUpMutation.mutate({
                userId: topUpTargetUserId,
                amount: topUpAmount,
                channel: topUpChannel,
                reference: topUpRef || undefined,
                note: topUpNote || undefined,
              });
            }}
            className="mt-4 space-y-4"
          >
            {/* Target Client Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Select Client Account
              </Label>
              <Select
                value={topUpTargetUserId ? String(topUpTargetUserId) : ""}
                onValueChange={(val) => setTopUpTargetUserId(Number(val))}
              >
                <SelectTrigger className="h-11 bg-navy-panel border-border text-foreground">
                  <SelectValue placeholder="Choose client..." />
                </SelectTrigger>
                <SelectContent className="border-border bg-navy-deep text-foreground">
                  {clientUsers.map((c) => (
                    <SelectItem key={c.user.id} value={String(c.user.id)}>
                      {c.user.name} — Acct #{c.account?.accountNumber} ({formatMoney(c.account?.balance ?? 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Preset Buttons */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Preset Capital Allocations
              </Label>
              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopUpAmount(amt)}
                    className={cn(
                      "h-9 text-xs font-semibold uppercase tracking-[0.1em] border transition-colors",
                      topUpAmount === amt
                        ? "border-gold bg-gold text-navy-deep font-bold"
                        : "border-border bg-navy-panel text-muted-foreground hover:text-cream hover:border-gold/40",
                    )}
                  >
                    ${amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Amount (USD)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="1"
                required
                value={topUpAmount || ""}
                onChange={(e) => setTopUpAmount(Number(e.target.value))}
                className="tnum h-12 bg-navy-panel text-lg font-bold text-cream"
              />
            </div>

            {/* Channel Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Capital Channel / Funding Desk
              </Label>
              <Select
                value={topUpChannel}
                onValueChange={(val: any) => setTopUpChannel(val)}
              >
                <SelectTrigger className="h-11 bg-navy-panel border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-navy-deep text-foreground">
                  <SelectItem value="admin_topup">Administrative Capital Injection</SelectItem>
                  <SelectItem value="wire_domestic">Domestic Fedwire Clearance</SelectItem>
                  <SelectItem value="wire_international">SWIFT International Clearance</SelectItem>
                  <SelectItem value="crypto_settlement">Digital Asset / USDT Treasury Settlement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Accounting Reference & Note */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Audit Reference
                </Label>
                <Input
                  value={topUpRef}
                  onChange={(e) => setTopUpRef(e.target.value)}
                  className="tnum h-10 bg-navy-panel text-xs text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Memo / Note
                </Label>
                <Input
                  value={topUpNote}
                  onChange={(e) => setTopUpNote(e.target.value)}
                  placeholder="e.g. Wire confirmed"
                  className="h-10 bg-navy-panel text-xs"
                />
              </div>
            </div>

            {/* Balance Preview */}
            {selectedTopUpAccount?.account && (
              <div className="rounded border border-border/80 bg-navy-panel p-3.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Current Balance:</span>
                  <span className="tnum font-medium text-foreground">{formatMoney(selectedTopUpAccount.account.balance)}</span>
                </div>
                <div className="mt-1 flex justify-between font-semibold text-emerald-400">
                  <span>New Balance After Top-Up:</span>
                  <span className="tnum text-sm">
                    {formatMoney(Number(selectedTopUpAccount.account.balance) + (topUpAmount || 0))}
                  </span>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={topUpMutation.isPending || !topUpTargetUserId}
              className="h-12 w-full bg-gold text-xs font-semibold uppercase tracking-[0.2em] text-navy-deep hover:bg-cream"
            >
              {topUpMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Execute Capital Top-Up
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===================== MODAL: CREATE NEW CLIENT ===================== */}
      <Dialog open={createClientOpen} onOpenChange={setCreateClientOpen}>
        <DialogContent className="border-border bg-navy-deep text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase tracking-[0.06em] text-foreground">
              Onboard Private Wealth Client
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Register a new client account with assigned tier, initial capitalization, and immediate banking ledger.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createClientMutation.mutate({
                name: String(fd.get("name")),
                email: String(fd.get("email")),
                password: String(fd.get("password") || "SummitClient!2026"),
                tier: fd.get("tier") as any,
                initialBalance: Number(fd.get("initialBalance") || 50000),
                country: String(fd.get("country") || "Switzerland"),
              });
            }}
            className="mt-4 space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Client Full Name</Label>
                <Input name="name" required placeholder="e.g. Julian Montgomery" className="h-10 bg-navy-panel" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Email Address</Label>
                <Input name="email" type="email" required placeholder="j.montgomery@wealth.com" className="h-10 bg-navy-panel" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Client Tier</Label>
                <Select name="tier" defaultValue="Private Wealth">
                  <SelectTrigger className="h-10 bg-navy-panel border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-navy-deep text-foreground">
                    <SelectItem value="Private Wealth">Private Wealth</SelectItem>
                    <SelectItem value="Black Diamond">Black Diamond</SelectItem>
                    <SelectItem value="Sovereign Reserve">Sovereign Reserve</SelectItem>
                    <SelectItem value="Institutional">Institutional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Jurisdiction / Country</Label>
                <Input name="country" defaultValue="Switzerland" className="h-10 bg-navy-panel" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Initial Capitalization (USD)</Label>
                <Input name="initialBalance" type="number" defaultValue="50000" className="tnum h-10 bg-navy-panel" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Initial Password</Label>
                <Input name="password" defaultValue="SummitClient!2026" className="h-10 bg-navy-panel" />
              </div>
            </div>

            <Button
              type="submit"
              disabled={createClientMutation.isPending}
              className="h-11 w-full bg-gold text-xs font-semibold uppercase tracking-[0.2em] text-navy-deep hover:bg-cream"
            >
              {createClientMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Onboard & Settle Account
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===================== MODAL: CLEARANCE SCHEDULE & EXPEDITE TERMS ===================== */}
      <Dialog open={scheduleModal.open} onOpenChange={(o) => !o && setScheduleModal({ open: false })}>
        <DialogContent className="border-border bg-navy-deep text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase tracking-[0.06em] text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gold" />
              Treasury Clearance Directive & Process Instructions
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define the official instructions, compliance requirements (e.g. Tax Clearance Certificate, Security PIN), and clearance schedule dispatched to this client.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!scheduleModal.txId) return;
              updateScheduleMutation.mutate({
                transactionId: scheduleModal.txId,
                estimatedApproval: scheduleModal.estimatedApproval || undefined,
                adminNote: scheduleModal.adminNote || undefined,
                expediteDepositRequired: scheduleModal.expediteDepositRequired ? Number(scheduleModal.expediteDepositRequired) : undefined,
              });
            }}
            className="space-y-4 pt-2"
          >
            <div className="rounded border border-border/80 bg-navy-panel p-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground uppercase">Transaction Ref</span>
                <span className="text-gold font-bold">{scheduleModal.ref}</span>
              </div>
              {scheduleModal.clientName && (
                <div className="flex justify-between mt-1 pt-1 border-t border-border/50">
                  <span className="text-muted-foreground uppercase">Client</span>
                  <span className="text-cream">{scheduleModal.clientName}</span>
                </div>
              )}
            </div>

            {/* Directive Presets for User */}
            <div className="space-y-1.5 border-t border-border pt-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Client Process Directives & Requirements</span>
                <span className="text-[10px] text-gold font-mono">Dispatched to User Dashboard</span>
              </Label>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {[
                  ["📜 Tax Clearance (ITCC)", "International Tax Clearance Certificate (ITCC) required prior to wire disbursement. Please submit document to compliance@summitbank.com."],
                  ["🔑 Security PIN Code", "FINMA Regulatory Security Clearance Code required from client authorized signatory."],
                  ["⚡ Expedited Release", "Expedited Priority Liquidity Window active. Deposit designated priority fee to trigger immediate Fedwire/SWIFT transmission."],
                  ["📞 Compliance Call", "Direct verification teleconference scheduled with Executive Wealth Officer. Check registered email for conference details."],
                  ["⚖️ AML / SOW Review", "Anti-Money Laundering (AML) Source of Wealth documentation under routine review. Automated release upon verification."],
                  ["🏦 Interbank Batch", "Withdrawal approved for release in next Swiss Interbank Clearing batch window."],
                ].map(([label, directive]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setScheduleModal((prev) => ({ ...prev, adminNote: directive }))}
                    className="text-[10px] uppercase font-mono p-1.5 border border-border bg-navy-panel text-muted-foreground hover:text-cream hover:border-gold/60 text-left truncate rounded transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                placeholder="Type custom instructions for the client regarding how to withdraw or clear this transaction..."
                value={scheduleModal.adminNote || ""}
                onChange={(e) => setScheduleModal((prev) => ({ ...prev, adminNote: e.target.value }))}
                className="w-full rounded border border-border bg-navy-panel px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>

            {/* Estimated Approval Presets */}
            <div className="space-y-1.5 border-t border-border pt-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Scheduled Clearance Time
              </Label>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {[
                  "Same-Day (2 Hours)",
                  "Today at 17:00 CET",
                  "Next-Day (24 Hours)",
                  "48h Standard Queue",
                  "Tier 1 Priority (1h)",
                  "Awaiting Liquidity Sweep",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setScheduleModal((prev) => ({ ...prev, estimatedApproval: preset }))}
                    className={cn(
                      "text-[10px] uppercase font-mono p-1.5 border transition-colors text-center truncate",
                      scheduleModal.estimatedApproval === preset
                        ? "border-gold bg-gold text-navy-deep font-bold"
                        : "border-border bg-navy-panel text-muted-foreground hover:text-cream hover:border-gold/40",
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <Input
                placeholder="e.g. Oct 16, 2026 at 16:30 CET"
                value={scheduleModal.estimatedApproval || ""}
                onChange={(e) => setScheduleModal((prev) => ({ ...prev, estimatedApproval: e.target.value }))}
                className="bg-navy-panel text-xs h-10"
              />
            </div>

            {/* Expedite Deposit Request */}
            <div className="space-y-1.5 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-gold font-bold flex items-center gap-1.5">
                  <span>⚡ Optional Expedite / Priority Verification Deposit</span>
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Request a specific deposit amount from the client to prioritize and clear their withdrawal immediately.
              </p>
              <div className="flex gap-2">
                {[1000, 5000, 10000, 25000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setScheduleModal((prev) => ({ ...prev, expediteDepositRequired: amt }))}
                    className={cn(
                      "flex-1 py-1 text-xs font-mono font-bold uppercase border transition-colors",
                      scheduleModal.expediteDepositRequired === amt
                        ? "border-amber-400 bg-amber-400 text-navy-deep"
                        : "border-border bg-navy-panel text-muted-foreground hover:text-cream",
                    )}
                  >
                    ${amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                step="0.01"
                placeholder="Deposit amount required in USD (optional)"
                value={scheduleModal.expediteDepositRequired || ""}
                onChange={(e) =>
                  setScheduleModal((prev) => ({
                    ...prev,
                    expediteDepositRequired: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="bg-navy-panel text-xs h-10 font-mono"
              />
            </div>

            <div className="flex gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                disabled={decide.isPending}
                onClick={() => {
                  if (scheduleModal.txId) {
                    decide.mutate({ transactionId: scheduleModal.txId, approve: false });
                    setScheduleModal({ open: false });
                  }
                }}
                className="border-red-500/50 text-red-300 hover:bg-red-500/10 text-xs uppercase h-11"
              >
                Reject
              </Button>
              <Button
                type="submit"
                disabled={updateScheduleMutation.isPending}
                className="flex-1 bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
              >
                {updateScheduleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Dispatch Directive to Client
              </Button>
              <Button
                type="button"
                disabled={decide.isPending}
                onClick={() => {
                  if (scheduleModal.txId) {
                    decide.mutate({ transactionId: scheduleModal.txId, approve: true });
                    setScheduleModal({ open: false });
                  }
                }}
                className="bg-emerald-500/90 text-navy-deep hover:bg-emerald-400 font-semibold text-xs uppercase h-11 px-4"
              >
                Approve & Settle
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===================== MODAL: CARD UNDERWRITING & DIRECTIVES ===================== */}
      <Dialog
        open={cardUnderwriteModal.open}
        onOpenChange={(o) => !o && setCardUnderwriteModal((prev) => ({ ...prev, open: false }))}
      >
        <DialogContent className="border-border bg-navy-deep text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase tracking-[0.06em] text-foreground flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gold" />
              Underwrite Luxury Card & Issue Directive
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review client portfolio qualification, set spending limits, and assign the specific activation directive required before this card starts working.
            </DialogDescription>
          </DialogHeader>

          {cardUnderwriteModal.card && (
            <div className="space-y-4 pt-2">
              {/* Client & Card Summary */}
              <div className="rounded border border-border bg-navy-panel p-3.5 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground uppercase text-[10px]">Client Legal Name:</span>
                  <span className="text-cream font-bold">{cardUnderwriteModal.card.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground uppercase text-[10px]">Account / Balance:</span>
                  <span className="text-gold font-bold">
                    Acct #{cardUnderwriteModal.card.accountNumber} · ${formatMoney(cardUnderwriteModal.card.accountBalance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground uppercase text-[10px]">Requested Tier:</span>
                  <span className="text-cream font-bold">{cardUnderwriteModal.card.tier} ({cardUnderwriteModal.card.type})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground uppercase text-[10px]">History Standing:</span>
                  <span className="text-emerald-400 font-bold">{cardUnderwriteModal.card.requiredHistoryPosition || "Standard Private Wealth"}</span>
                </div>
              </div>

              {/* Decision Type */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Underwriting Decision</Label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setCardUnderwriteModal((prev) => ({
                        ...prev,
                        decision: "approve_with_instruction",
                      }))
                    }
                    className={cn(
                      "py-2 px-2 border rounded text-center transition-all uppercase text-[10px] font-bold",
                      cardUnderwriteModal.decision === "approve_with_instruction"
                        ? "border-gold bg-gold/20 text-gold"
                        : "border-border bg-navy-panel text-muted-foreground hover:text-white",
                    )}
                  >
                    Approve (Require Directive)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCardUnderwriteModal((prev) => ({
                        ...prev,
                        decision: "instant_activate",
                      }))
                    }
                    className={cn(
                      "py-2 px-2 border rounded text-center transition-all uppercase text-[10px] font-bold",
                      cardUnderwriteModal.decision === "instant_activate"
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-border bg-navy-panel text-muted-foreground hover:text-white",
                    )}
                  >
                    Immediate Activation
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCardUnderwriteModal((prev) => ({
                        ...prev,
                        decision: "reject",
                      }))
                    }
                    className={cn(
                      "py-2 px-2 border rounded text-center transition-all uppercase text-[10px] font-bold",
                      cardUnderwriteModal.decision === "reject"
                        ? "border-red-500 bg-red-500/20 text-red-300"
                        : "border-border bg-navy-panel text-muted-foreground hover:text-white",
                    )}
                  >
                    Reject Card
                  </button>
                </div>
              </div>

              {/* Directive Presets if approve_with_instruction */}
              {cardUnderwriteModal.decision === "approve_with_instruction" && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Particular Instruction Presets</Label>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setCardUnderwriteModal((prev) => ({
                          ...prev,
                          instruction:
                            "Dual-signatory executive authorization required. Enter Signatory PIN 8821 on your client dashboard to initialize card EMV chip.",
                          pin: "8821",
                        }))
                      }
                      className="border border-border bg-navy-panel p-2 rounded text-left hover:border-gold/50"
                    >
                      <span className="font-bold text-gold block">🔑 Security PIN Protocol</span>
                      <span className="text-[10px] text-muted-foreground">Assign PIN 8821 for EMV chip initialization</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCardUnderwriteModal((prev) => ({
                          ...prev,
                          instruction:
                            "Collateral Milestone Required: Client must maintain minimum portfolio balance of $50,000 in segregated vault before card activation.",
                          pin: "",
                        }))
                      }
                      className="border border-border bg-navy-panel p-2 rounded text-left hover:border-gold/50"
                    >
                      <span className="font-bold text-gold block">🏛️ Collateral Milestone</span>
                      <span className="text-[10px] text-muted-foreground">Require $50,000 vault balance</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCardUnderwriteModal((prev) => ({
                          ...prev,
                          instruction:
                            "Private Wealth Conference: Scheduled compliance teleconference with dedicated private wealth banker required prior to activation.",
                          pin: "3941",
                        }))
                      }
                      className="border border-border bg-navy-panel p-2 rounded text-left hover:border-gold/50"
                    >
                      <span className="font-bold text-gold block">📞 Compliance Call</span>
                      <span className="text-[10px] text-muted-foreground">Officer phone conference directive</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCardUnderwriteModal((prev) => ({
                          ...prev,
                          instruction:
                            "Immediate sovereign clearance granted. Click complete activation on your dashboard to bring card online.",
                          pin: "",
                        }))
                      }
                      className="border border-border bg-navy-panel p-2 rounded text-left hover:border-gold/50"
                    >
                      <span className="font-bold text-gold block">⚡ Sovereign Clearance</span>
                      <span className="text-[10px] text-muted-foreground">Instant self-activation clearance</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs uppercase text-muted-foreground">Specific Directive / Instructions Dispatched to Client</Label>
                    <textarea
                      rows={2}
                      value={cardUnderwriteModal.instruction}
                      onChange={(e) =>
                        setCardUnderwriteModal((prev) => ({
                          ...prev,
                          instruction: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-border bg-navy-panel px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">Assigned Signatory PIN (Optional)</Label>
                    <Input
                      maxLength={8}
                      placeholder="e.g. 8821"
                      value={cardUnderwriteModal.pin}
                      onChange={(e) =>
                        setCardUnderwriteModal((prev) => ({
                          ...prev,
                          pin: e.target.value,
                        }))
                      }
                      className="bg-navy-panel text-xs h-10 font-mono text-gold"
                    />
                  </div>
                </div>
              )}

              {/* Approved Spending Limit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Approved Spending Limit (USD)</Label>
                  <Input
                    type="number"
                    min="1000"
                    step="1000"
                    value={cardUnderwriteModal.limit}
                    onChange={(e) =>
                      setCardUnderwriteModal((prev) => ({
                        ...prev,
                        limit: Number(e.target.value),
                      }))
                    }
                    className="bg-navy-panel text-xs h-10 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Internal Audit Memo</Label>
                  <Input
                    value={cardUnderwriteModal.note}
                    onChange={(e) =>
                      setCardUnderwriteModal((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                    className="bg-navy-panel text-xs h-10"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCardUnderwriteModal((prev) => ({ ...prev, open: false }))}
                  className="flex-1 border-border text-muted-foreground hover:text-white h-11 text-xs uppercase"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={underwriteCardMutation.isPending}
                  onClick={() => {
                    underwriteCardMutation.mutate({
                      cardId: cardUnderwriteModal.card.id,
                      decision: cardUnderwriteModal.decision,
                      activationInstruction: cardUnderwriteModal.instruction || undefined,
                      activationPin: cardUnderwriteModal.pin.trim() || undefined,
                      spendingLimit: cardUnderwriteModal.limit,
                      adminDecisionNote: cardUnderwriteModal.note || undefined,
                    });
                  }}
                  className="flex-1 bg-gold text-navy-deep font-bold uppercase tracking-wider text-xs h-11 hover:bg-cream"
                >
                  {underwriteCardMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Underwriting Decision
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===================== MODAL: ADD CUSTOM TRANSACTION ===================== */}
      <Dialog open={customTxOpen} onOpenChange={setCustomTxOpen}>
        <DialogContent className="border-border bg-navy-deep text-foreground max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase tracking-[0.06em] text-foreground flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-gold" />
              Add Custom Ledger Transaction
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Insert any historical or pending transaction entry into any registered client's ledger.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!customTxTargetUserId || customTxAmount <= 0) return;
              addCustomTxMutation.mutate({
                userId: customTxTargetUserId,
                type: customTxType,
                channel: customTxChannel,
                amount: customTxAmount,
                status: customTxStatus,
                reference: customTxRef || undefined,
                note: customTxNote || undefined,
                counterparty: customTxCounterparty || undefined,
                beneficiaryBank: customTxBeneficiaryBank || undefined,
                beneficiaryAccount: customTxBeneficiaryAccount || undefined,
                estimatedApproval: customTxStatus === "pending" ? customTxEstimated || undefined : undefined,
                adminNote: customTxStatus === "pending" ? customTxAdminNote || undefined : undefined,
                expediteDepositRequired: customTxStatus === "pending" && customTxExpedite ? Number(customTxExpedite) : undefined,
              });
            }}
            className="space-y-4 pt-2"
          >
            {/* Target Client */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Target Client Account
              </Label>
              <Select
                value={customTxTargetUserId ? String(customTxTargetUserId) : ""}
                onValueChange={(val) => setCustomTxTargetUserId(Number(val))}
              >
                <SelectTrigger className="h-11 bg-navy-panel border-border text-foreground">
                  <SelectValue placeholder="Choose client account..." />
                </SelectTrigger>
                <SelectContent className="border-border bg-navy-deep text-foreground">
                  {clientUsers.map((c) => (
                    <SelectItem key={c.user.id} value={String(c.user.id)}>
                      {c.user.name} — Acct #{c.account?.accountNumber} ({formatMoney(c.account?.balance ?? 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type & Channel */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Transaction Type
                </Label>
                <Select value={customTxType} onValueChange={(val: any) => setCustomTxType(val)}>
                  <SelectTrigger className="h-10 bg-navy-panel border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-navy-deep text-foreground">
                    <SelectItem value="deposit">Deposit (Credit)</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal (Debit)</SelectItem>
                    <SelectItem value="transfer_in">Transfer Received (Credit)</SelectItem>
                    <SelectItem value="transfer_out">Transfer Sent (Debit)</SelectItem>
                    <SelectItem value="bill_payment">Bill Payment (Debit)</SelectItem>
                    <SelectItem value="card_spend">Card Spend (Debit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Execution Channel
                </Label>
                <Select value={customTxChannel} onValueChange={(val: any) => setCustomTxChannel(val)}>
                  <SelectTrigger className="h-10 bg-navy-panel border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-navy-deep text-foreground">
                    <SelectItem value="admin_topup">Direct Treasury Credit</SelectItem>
                    <SelectItem value="wire_domestic">Domestic Fedwire</SelectItem>
                    <SelectItem value="wire_international">SWIFT International Wire</SelectItem>
                    <SelectItem value="mobile_check">Mobile Check Deposit</SelectItem>
                    <SelectItem value="crypto_settlement">Crypto / Digital Asset Custody</SelectItem>
                    <SelectItem value="transfer">Summit P2P Transfer</SelectItem>
                    <SelectItem value="bill_payment">Executive Bill Payment</SelectItem>
                    <SelectItem value="card_spend">Titanium Card Spend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Amount & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Amount (USD)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={customTxAmount || ""}
                  onChange={(e) => setCustomTxAmount(Number(e.target.value))}
                  className="tnum h-10 bg-navy-panel text-base font-bold text-cream"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Initial Status
                </Label>
                <Select value={customTxStatus} onValueChange={(val: any) => setCustomTxStatus(val)}>
                  <SelectTrigger className="h-10 bg-navy-panel border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-navy-deep text-foreground">
                    <SelectItem value="approved">Approved (Settles balance now)</SelectItem>
                    <SelectItem value="pending">Pending (Awaiting clearance)</SelectItem>
                    <SelectItem value="rejected">Rejected (Logged only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reference & Counterparty */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Audit Reference ID
                </Label>
                <Input
                  value={customTxRef}
                  onChange={(e) => setCustomTxRef(e.target.value)}
                  className="tnum font-mono bg-navy-panel text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Counterparty / Institution
                </Label>
                <Input
                  placeholder="e.g. UBS Geneva / NetJets"
                  value={customTxCounterparty}
                  onChange={(e) => setCustomTxCounterparty(e.target.value)}
                  className="bg-navy-panel text-xs h-10"
                />
              </div>
            </div>

            {/* Destination Bank & Account */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Beneficiary Bank (Optional)
                </Label>
                <Input
                  placeholder="e.g. JPMorgan Chase"
                  value={customTxBeneficiaryBank}
                  onChange={(e) => setCustomTxBeneficiaryBank(e.target.value)}
                  className="bg-navy-panel text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Beneficiary Account / IBAN (Optional)
                </Label>
                <Input
                  placeholder="Account or IBAN"
                  value={customTxBeneficiaryAccount}
                  onChange={(e) => setCustomTxBeneficiaryAccount(e.target.value)}
                  className="bg-navy-panel font-mono text-xs h-10"
                />
              </div>
            </div>

            {/* Memo Note */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Transaction Memo / Internal Note
              </Label>
              <Input
                placeholder="e.g. Inbound acquisition capital from family office"
                value={customTxNote}
                onChange={(e) => setCustomTxNote(e.target.value)}
                className="bg-navy-panel text-xs h-10"
              />
            </div>

            {/* If pending: Clearance Note and Expedite Deposit */}
            {customTxStatus === "pending" && (
              <div className="border border-gold/40 bg-gold/5 p-3 rounded space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-gold">
                  Pending Clearance Configuration
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] uppercase text-muted-foreground">Estimated Approval Time</Label>
                    <Input
                      placeholder="e.g. Tomorrow at 15:00 CET"
                      value={customTxEstimated}
                      onChange={(e) => setCustomTxEstimated(e.target.value)}
                      className="bg-navy-panel text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] uppercase text-amber-300">Expedite Deposit Required ($)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 5000"
                      value={customTxExpedite || ""}
                      onChange={(e) => setCustomTxExpedite(e.target.value ? Number(e.target.value) : undefined)}
                      className="bg-navy-panel text-xs h-9 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase text-muted-foreground">Admin Clearance Note (Visible to Client)</Label>
                  <Input
                    placeholder="e.g. Tier clearance verification in progress"
                    value={customTxAdminNote}
                    onChange={(e) => setCustomTxAdminNote(e.target.value)}
                    className="bg-navy-panel text-xs h-9"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={addCustomTxMutation.isPending || !customTxTargetUserId}
              className="w-full bg-gold text-navy-deep font-semibold uppercase tracking-wider text-xs h-11"
            >
              {addCustomTxMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Commit Transaction to Ledger
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===================== DRAWER: CLIENT PROFILE ===================== */}
      <ClientSheet
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onChanged={async (msg) => {
          flash(msg);
          await invalidateAll();
        }}
        onTopUp={(uid) => {
          setSelectedUserId(null);
          handleOpenTopUp(uid);
        }}
        onUnderwriteCard={(card) => {
          setSelectedUserId(null);
          setCardUnderwriteModal({
            open: true,
            card,
            decision: "approve_with_instruction",
            instruction: card.activationInstruction || "Dual-signatory executive authorization required. Enter Signatory PIN 8821 on your client dashboard to initialize card EMV chip.",
            pin: card.activationPin || "8821",
            limit: card.spendingLimit || 100000,
            note: card.adminDecisionNote || `Underwriting review for ${card.userName || "client"}`,
          });
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  gold,
  alert,
}: {
  label: string;
  value: string | null;
  gold?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="bg-navy-deep p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      {value === null ? (
        <Skeleton className="mt-3 h-8 w-24 bg-navy-panel" />
      ) : (
        <div
          className={cn(
            "tnum mt-3 font-display text-2xl md:text-3xl",
            alert ? "text-amber-300" : gold ? "text-gold" : "text-cream",
          )}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function ClientSheet({
  userId,
  onClose,
  onChanged,
  onTopUp,
  onUnderwriteCard,
}: {
  userId: number | null;
  onClose: () => void;
  onChanged: (msg: string) => Promise<void>;
  onTopUp: (userId: number) => void;
  onUnderwriteCard?: (card: any) => void;
}) {
  const detail = trpc.admin.userDetail.useQuery(
    { userId: userId ?? 0 },
    { enabled: userId !== null },
  );

  const setStatus = trpc.admin.setAccountStatus.useMutation({
    onSuccess: async (_, vars) => {
      await onChanged(vars.status === "frozen" ? "Account frozen." : "Account reactivated.");
    },
  });

  const setWithdrawalHoldMutation = trpc.admin.setAccountWithdrawalHold.useMutation({
    onSuccess: async (_, vars) => {
      await onChanged(vars.hold ? "Withdrawal security hold activated." : "Withdrawal hold lifted.");
    },
  });

  const u = detail.data?.user;
  const acct = detail.data?.account;

  return (
    <Sheet open={userId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-border bg-navy-deep text-foreground sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle className="font-display uppercase tracking-[0.08em] text-foreground">
            Client Dossier
          </SheetTitle>
        </SheetHeader>

        {detail.isLoading || !u ? (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-8 w-48 bg-navy-panel" />
            <Skeleton className="h-24 w-full bg-navy-panel" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Identity Card */}
            <div className="border border-border bg-navy-panel p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{u.name}</h3>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <p className="mt-1 text-[11px] text-gold uppercase tracking-[0.14em]">
                    Tier: {u.tier || "Private Wealth"} · {u.country || "Switzerland"}
                  </p>
                </div>
                {acct && <StatusPill status={acct.status} />}
              </div>

              {acct && (
                <>
                  <div className="mt-5 border-t border-border pt-4 flex items-end justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Settled Balance · Acct #{acct.accountNumber}
                      </span>
                      <div className="tnum mt-1 font-display text-3xl font-bold text-cream">
                        {formatMoney(acct.balance)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => onTopUp(u.id)}
                        className="h-9 bg-gold px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-deep hover:bg-cream"
                      >
                        <Zap className="mr-1 h-3.5 w-3.5" />
                        Top Up
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={setStatus.isPending}
                        onClick={() =>
                          setStatus.mutate({
                            userId: u.id,
                            status: acct.status === "active" ? "frozen" : "active",
                          })
                        }
                        className="h-9 border-border text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-cream"
                      >
                        {acct.status === "active" ? <Snowflake className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Account-Level Withdrawal Permission / Hold */}
                  <div className="mt-4 border-t border-border pt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Withdrawal Permission</span>
                      {(acct as any).withdrawalHold ? (
                        <span className="text-rose-400 font-bold uppercase text-[10px] bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                          Security Hold Active
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold uppercase text-[10px] bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                          Withdrawals Authorized
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={setWithdrawalHoldMutation.isPending}
                      onClick={() => {
                        const isHolding = !(acct as any).withdrawalHold;
                        setWithdrawalHoldMutation.mutate({
                          userId: u.id,
                          hold: isHolding,
                          reason: isHolding ? "Administrative compliance review active. Contact executive officer." : undefined,
                        });
                      }}
                      className={cn(
                        "w-full text-[10px] uppercase font-semibold h-8 transition-colors",
                        (acct as any).withdrawalHold
                          ? "border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10"
                          : "border-rose-500/50 text-rose-300 hover:bg-rose-500/10",
                      )}
                    >
                      {(acct as any).withdrawalHold ? "✓ Lift Withdrawal Hold (Allow Outflows)" : "⛔ Place Security Hold on Withdrawals"}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Linked Cards */}
            {detail.data?.cards && detail.data.cards.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <span>Linked Metal & Virtual Cards ({detail.data.cards.length})</span>
                </div>
                <div className="space-y-2.5">
                  {detail.data.cards.map((c) => (
                    <div key={c.id} className="border border-border bg-navy-panel p-3.5 space-y-2.5 text-xs">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-2">
                            <span>{c.tier}</span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-navy-deep border border-border text-muted-foreground">
                              {c.type}
                            </span>
                          </div>
                          <div className="tnum text-muted-foreground font-mono mt-0.5">{c.cardNumber} · Exp {c.expiry}</div>
                        </div>
                        <div className="text-right">
                          <StatusPill status={c.status} />
                          <div className="tnum font-medium text-cream text-[11px] mt-1">{formatMoney(c.spendingLimit)} limit</div>
                        </div>
                      </div>

                      {(c as any).activationInstruction && (
                        <div className="text-[11px] bg-navy-deep/80 border border-border/80 p-2 text-muted-foreground rounded space-y-1">
                          <span className="text-gold font-semibold uppercase text-[10px] block">Active Underwriting Directive:</span>
                          <p>{(c as any).activationInstruction}</p>
                          {(c as any).activationPin && (
                            <p className="text-[10px] font-mono text-cream">Signatory PIN: <span className="text-gold font-bold">{(c as any).activationPin}</span></p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {(c as any).appliedAt ? `Applied ${formatDateTime((c as any).appliedAt)}` : "Standard Provisioning"}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onUnderwriteCard?.({
                              ...c,
                              userName: u.name,
                              userEmail: u.email,
                              accountBalance: acct?.balance || "0",
                              accountNumber: acct?.accountNumber || "",
                            })
                          }
                          className="h-7 text-[10px] uppercase border-gold/40 text-gold hover:bg-gold hover:text-navy-deep font-semibold"
                        >
                          Underwrite / Directives
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Client Ledger History */}
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Itemized Client Ledger
              </div>
              <div className="border border-border bg-navy-panel px-4">
                <TransactionLedger
                  transactions={detail.data?.transactions ?? []}
                  emptyMessage="No transactions for this client yet."
                />
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
