import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Landmark,
  Lock,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Vault as VaultIcon,
  Wallet,
} from "lucide-react";
import { BankLogo } from "@/components/BankLogo";
import { SealBadge } from "@/components/SealBadge";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const INSTITUTIONAL_PILLARS = [
  {
    n: "01",
    icon: Wallet,
    title: "Sovereign Settlement Accounts",
    subtitle: "High-Watermark Liquidity",
    body: "Every client is provisioned a dedicated Swiss-domiciled settlement account with individual Fedwire ABA and SWIFT routing coordinates. Capital is segregated, audited hourly, and liquid on demand.",
    image: "/images/vault.jpg",
  },
  {
    n: "02",
    icon: Landmark,
    title: "Institutional Wealth Desk",
    subtitle: "Absolute Administrative Clarity",
    body: "Multi-currency treasury clearing, prioritized domestic Fedwire and international SWIFT execution, optical mobile check processing, and bespoke private wealth advisory.",
    image: "/images/lounge.jpg",
  },
  {
    n: "03",
    icon: CreditCard,
    title: "Obsidian Reserve Titanium",
    subtitle: "Uncapped Global Spending",
    body: "Contactless physical titanium and instant virtual cards with customizable daily limits up to $250,000, 0% foreign exchange fees, and real-time biometric toggle controls.",
    image: "/images/card.jpg",
  },
  {
    n: "04",
    icon: VaultIcon,
    title: "High-Yield Collateral Vaults",
    subtitle: "5.25% Compound Preservation",
    body: "Lock idle liquidity into designated wealth preservation vaults backed by physical 999.9 sovereign bullion and Swiss government short-term bonds.",
    image: "/images/gold.jpg",
  },
];

export default function Landing() {
  const { user, isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-navy-panel text-foreground selection:bg-gold selection:text-navy-deep scroll-smooth">
      {/* 1. Global Financial & Reserve Ticker */}
      <div className="border-b border-border/70 bg-navy-deep/95 py-2 px-4 text-xs font-mono">
        <div className="mx-auto flex max-w-7xl items-center justify-between overflow-x-auto whitespace-nowrap scrollbar-none gap-6 text-[11px]">
          <div className="flex items-center gap-2 text-gold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="font-semibold uppercase tracking-wider">SWISS SOVEREIGN LEDGER</span>
          </div>

          <div className="flex items-center gap-6 divide-x divide-border/60">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">GOLD BULLION (XAU/USD)</span>
              <span className="text-cream font-medium">$2,748.50</span>
              <span className="text-[10px] text-emerald-400">+1.15%</span>
            </div>
            <div className="pl-6 flex items-center gap-2">
              <span className="text-muted-foreground">FED FUNDS RATE</span>
              <span className="text-cream font-medium">5.25%</span>
              <span className="text-[10px] text-amber-300">BENCHMARK</span>
            </div>
            <div className="pl-6 flex items-center gap-2">
              <span className="text-muted-foreground">EUR / USD</span>
              <span className="text-cream font-medium">1.0845</span>
              <span className="text-[10px] text-emerald-400">+0.24%</span>
            </div>
            <div className="pl-6 flex items-center gap-2">
              <span className="text-muted-foreground">INSTITUTIONAL BTC</span>
              <span className="text-cream font-medium">$89,450</span>
              <span className="text-[10px] text-emerald-400">+3.40%</span>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground uppercase tracking-widest hidden lg:block">
            FINMA REGULATED · <span className="text-gold">ZURICH & NEW YORK</span>
          </div>
        </div>
      </div>

      {/* 2. Primary Navigation Header */}
      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-300",
          scrolled
            ? "border-b border-border bg-navy-deep/90 backdrop-blur-md"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-4">
            <BankLogo />
          </div>

          <nav className="hidden items-center gap-8 text-[11px] uppercase tracking-[0.24em] text-muted-foreground md:flex">
            <a href="#pillars" className="transition-colors hover:text-cream">
              Private Banking
            </a>
            <a href="#vaults" className="transition-colors hover:text-cream">
              Reserve Vaults
            </a>
            <a href="#security" className="transition-colors hover:text-cream">
              Security
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Admin entry is strictly visible ONLY to registered admin users */}
            {user?.role === "admin" && (
              <Link
                to="/admin"
                className="inline-flex h-10 items-center gap-1.5 border border-gold/60 bg-gold/10 px-3.5 text-[11px] uppercase tracking-[0.18em] text-gold transition-colors hover:bg-gold hover:text-navy-deep"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Admin Console</span>
              </Link>
            )}

            <Link
              to={isAuthenticated ? "/dashboard" : "/login"}
              className="inline-flex h-10 items-center gap-2 border border-gold/70 bg-gold px-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-navy-deep transition-all hover:bg-cream hover:border-cream"
            >
              {isAuthenticated ? "My Portfolio" : "Client Portal"}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* 3. Hero Section with Atmospheric Photography */}
      <section className="relative min-h-[90svh] flex items-center justify-center overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 scale-105 transition-transform duration-1000 ease-out"
          style={{ backgroundImage: "url('/images/vault.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-panel via-navy-deep/80 to-navy-panel/60" />

        <div className="relative z-10 mx-auto max-w-5xl px-5 py-24 text-center">
          <div className="mb-6 flex justify-center">
            <SealBadge />
          </div>

          <p className="mb-4 text-[11px] uppercase tracking-mega text-gold font-medium">
            Next-Generation Private Banking & Treasury Architecture
          </p>

          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl uppercase leading-[1.06] tracking-[0.05em] text-foreground">
            Sovereign Liquidity.
            <br />
            <span className="text-cream">Uncompromising</span> Discretion.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Summit Private Bank pairs the historical discretion of European private banking with
            state-of-the-art treasury liquidity. Experience real-time multi-currency settlement,
            physical 999.9 gold bullion reserves, and personalized wealth preservation.
          </p>

          {/* Clean Public Call to Action */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to={isAuthenticated ? "/dashboard" : "/login"}
              className="inline-flex h-13 w-full sm:w-auto items-center justify-center gap-3 bg-gold px-8 py-3.5 text-xs font-bold uppercase tracking-[0.22em] text-navy-deep transition-all hover:bg-cream shadow-xl"
            >
              <Sparkles className="h-4 w-4" />
              <span>Access Client Portal</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/login?mode=signup"
              className="inline-flex h-13 w-full sm:w-auto items-center justify-center gap-3 border border-border bg-navy-deep/80 px-8 py-3.5 text-xs uppercase tracking-[0.22em] text-cream transition-all hover:border-gold hover:bg-navy-panel"
            >
              <span>Open an Account</span>
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground/80 font-mono">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
              <span>FINMA Compliant #SPB-9921</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
              <span>Fedwire & SWIFT Integrated</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
              <span>Full Capital Segregation</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Institutional Statistics Band */}
      <section className="border-b border-border bg-navy-deep">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0 px-5 md:px-8">
          {[
            ["$4.8B+", "Institutional Assets Settled"],
            ["5.25%", "Preferential Treasury Yield"],
            ["$250K", "Daily Obsidian Card Limit"],
            ["100%", "Cold Reserve Backing"],
          ].map(([val, label]) => (
            <div key={label} className="p-6 md:py-10 text-center">
              <div className="tnum font-display text-3xl md:text-4xl text-cream tracking-tight">
                {val}
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. The Four Institutional Pillars */}
      <section id="pillars" className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32 scroll-mt-20">
        <div className="mb-16 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-mega text-gold">The Summit Framework</p>
            <h2 className="mt-2 font-display text-3xl uppercase leading-tight tracking-[0.05em] text-foreground md:text-5xl">
              Engineered for Sovereignty & Scale
            </h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
            Every layer from client authentication to cross-border clearing reflects the
            rigor and prestige of European private banking.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {INSTITUTIONAL_PILLARS.map((p) => (
            <div
              key={p.n}
              className="group relative overflow-hidden border border-border bg-navy-deep transition-all duration-300 hover:border-gold/60"
            >
              <div className="relative h-64 w-full overflow-hidden">
                <img
                  src={p.image}
                  alt={p.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/40 to-transparent" />
                <div className="absolute top-4 left-4 border border-gold/40 bg-navy-deep/90 px-3 py-1 text-xs font-mono text-gold">
                  PILLAR {p.n}
                </div>
              </div>

              <div className="p-6 md:p-8">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gold">
                  <p.icon className="h-4 w-4" />
                  <span>{p.subtitle}</span>
                </div>
                <h3 className="mt-2 font-display text-2xl uppercase tracking-[0.04em] text-cream">
                  {p.title}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. SECTION: RESERVE VAULTS (id="vaults") */}
      <section id="vaults" className="border-t border-border bg-navy-deep relative overflow-hidden py-24 md:py-32 scroll-mt-20">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none"
          style={{ backgroundImage: "url('/images/gold.jpg')" }}
        />
        <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-8">
          <div className="mb-16 max-w-2xl">
            <p className="text-[11px] uppercase tracking-mega text-gold font-medium">
              Sovereign Asset Allocation
            </p>
            <h2 className="mt-2 font-display text-3xl uppercase leading-tight tracking-[0.05em] text-foreground md:text-5xl">
              High-Yield Wealth Reserve Vaults
            </h2>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              Lock idle liquidity into designated wealth preservation vaults backed by physical 999.9 gold bullion
              and institutional treasury paper, earning compound annual yields up to 5.25% with flexible liquidity recall.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                name: "Zurich Gold Bullion Reserve",
                yield: "4.10% APY",
                collateral: "Allocated 999.9 Fine Gold",
                term: "Continuous Compounding",
                description: "Physical bullion stored in deep subterranean vaults in the Canton of Zurich with independent quarterly assay reports.",
              },
              {
                name: "Prime Liquid Treasury Vault",
                yield: "5.25% APY",
                collateral: "Short-Duration Sovereign Debt",
                term: "Instant Recall On Demand",
                description: "Ultra-liquid US Treasury and Swiss National Bank bills generating premier interest while remaining fully accessible.",
              },
              {
                name: "Sovereign Escrow & Bond Vault",
                yield: "4.50% APY",
                collateral: "Tri-Party Institutional Escrow",
                term: "30-Day Liquidity Cycles",
                description: "Structured capital escrow designed for family offices, acquisition deposits, and high-watermark asset reserves.",
              },
            ].map((v) => (
              <div
                key={v.name}
                className="border border-border bg-navy-panel p-8 relative flex flex-col justify-between hover:border-gold/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-widest text-gold font-bold">
                      {v.yield}
                    </span>
                    <VaultIcon className="h-5 w-5 text-gold" />
                  </div>
                  <h3 className="mt-4 font-display text-2xl uppercase tracking-wide text-cream">
                    {v.name}
                  </h3>
                  <div className="mt-3 space-y-1 text-xs font-mono text-muted-foreground border-y border-border/60 py-3 my-4">
                    <div>Collateral: <span className="text-cream">{v.collateral}</span></div>
                    <div>Liquidity: <span className="text-cream">{v.term}</span></div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {v.description}
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-border">
                  <Link
                    to={isAuthenticated ? "/dashboard" : "/login"}
                    className="inline-flex w-full items-center justify-center gap-2 border border-gold/40 bg-gold/10 py-2.5 text-xs uppercase tracking-wider text-gold hover:bg-gold hover:text-navy-deep transition-colors"
                  >
                    <span>Allocate Capital</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. SECTION: SECURITY & COMPLIANCE (id="security") */}
      <section id="security" className="border-t border-border bg-navy-panel relative py-24 md:py-32 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6 space-y-6">
              <p className="text-[11px] uppercase tracking-mega text-gold font-medium">
                Institutional Defense Architecture
              </p>
              <h2 className="font-display text-3xl uppercase leading-tight tracking-[0.05em] text-foreground md:text-5xl">
                Guarded by Cryptographic Rigor & Sovereign Law
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Client privacy and capital protection are fortified at every layer. Our architecture operates
                under the Swiss Federal Act on Banks and Savings Banks, implementing multi-signature execution,
                hardware security modules, and strict administrative segregation.
              </p>

              <div className="space-y-4 pt-2">
                {[
                  {
                    title: "End-to-End Cryptographic Ledger",
                    desc: "Every deposit, withdrawal, and transfer is cryptographically stamped with SHA-256 integrity verification.",
                  },
                  {
                    title: "Multi-Signature Authorization",
                    desc: "High-value external wires require dual-operator verification before settlement.",
                  },
                  {
                    title: "Hardware Security Modules (HSM)",
                    desc: "Private keys and card credentials are safeguarded inside FIPS 140-3 Level 4 certified physical enclaves.",
                  },
                  {
                    title: "FINMA & Swiss Banking Secrecy",
                    desc: "Compliant with Swiss Banking Ordinance requirements, ensuring strict institutional discretion.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <ShieldCheck className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-wider text-cream">
                        {item.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="border border-border bg-navy-deep p-8 rounded-lg shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <span className="text-xs font-mono uppercase tracking-widest text-gold">Security Protocols</span>
                  <span className="text-xs font-mono text-emerald-400">ACTIVE & AUDITED</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="border border-border/80 bg-navy-panel p-4">
                    <KeyRound className="h-5 w-5 text-gold mb-2" />
                    <div className="text-cream font-bold">Scrypt + AES-256</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Hashed credentials & encrypted vaults</div>
                  </div>

                  <div className="border border-border/80 bg-navy-panel p-4">
                    <Server className="h-5 w-5 text-gold mb-2" />
                    <div className="text-cream font-bold">Cold Storage Engine</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Air-gapped transaction archival</div>
                  </div>

                  <div className="border border-border/80 bg-navy-panel p-4">
                    <Lock className="h-5 w-5 text-gold mb-2" />
                    <div className="text-cream font-bold">Biometric Card Lock</div>
                    <div className="text-[10px] text-muted-foreground mt-1">1-click card freeze & CVV mask</div>
                  </div>

                  <div className="border border-border/80 bg-navy-panel p-4">
                    <ShieldAlert className="h-5 w-5 text-gold mb-2" />
                    <div className="text-cream font-bold">Autonomous Defense</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Real-time fraud anomaly screening</div>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-muted-foreground font-mono leading-relaxed border-t border-border">
                  Audited by independent security examiners per ISO/IEC 27001 and FINMA circular standards.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="border-t border-border bg-navy-deep">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4 md:px-8">
          <div className="md:col-span-2">
            <BankLogo />
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Summit Private Bank is an institutional digital banking architecture designed for
              high-net-worth liquidity custody, multi-channel payment disbursement, and sovereign reserve management.
            </p>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-gold font-medium">Platform</div>
            <ul className="mt-4 space-y-2.5 text-xs text-muted-foreground">
              <li><Link to="/login" className="hover:text-cream">Client Sign In</Link></li>
              <li><Link to="/login?mode=signup" className="hover:text-cream">Open an Account</Link></li>
              <li><a href="#vaults" className="hover:text-cream">Reserve Vaults</a></li>
              <li><a href="#security" className="hover:text-cream">Security & Audits</a></li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-gold font-medium">Credentials</div>
            <ul className="mt-4 space-y-2.5 text-xs text-muted-foreground">
              <li><span className="text-emerald-400">FINMA Ordinance Compliant</span></li>
              <li><span>SWIFT BIC: SUMMUS33XXX</span></li>
              <li><span>Fedwire Routing: 021000021</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/80">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground md:flex-row md:px-8 font-mono">
            <span>© MMXXVI Summit Private Bank AG</span>
            <span>Zurich · Geneva · New York · London</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
