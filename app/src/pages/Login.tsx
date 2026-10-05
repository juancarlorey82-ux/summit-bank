import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { BankLogo } from "@/components/BankLogo";
import { SealBadge } from "@/components/SealBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export default function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState(params.get("mode") === "signup" ? "signup" : "signin");
  const [error, setError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  const login = trpc.credentialAuth.login.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/dashboard");
    },
    onError: (e) => setError(e.message),
  });
  const signup = trpc.credentialAuth.signup.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/dashboard");
    },
    onError: (e) => setError(e.message),
  });

  const pending = login.isPending || signup.isPending;

  const submitSignin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    login.mutate({
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
  };

  const submitSignup = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    signup.mutate({
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
  };

  return (
    <div className="grid min-h-[100svh] bg-navy-panel lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hero-glow fine-lines relative hidden flex-col justify-between p-10 lg:flex">
        <BankLogo />
        <div className="max-w-md">
          <SealBadge className="mb-10" />
          <h1 className="font-display text-4xl uppercase leading-tight tracking-[0.06em] text-foreground">
            The quiet confidence of a private ledger.
          </h1>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            Deposits, withdrawals and transfers — each dated, referenced and
            approved by your account administrator.
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          © MMXXVI Summit Private Bank
        </p>
      </div>

      {/* Form panel */}
      <div className="flex min-h-[100svh] flex-col bg-navy-deep px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex h-10 items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-cream"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
          <div className="lg:hidden">
            <BankLogo compact />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <p className="mb-3 text-[11px] uppercase tracking-mega text-gold">
            Client Access
          </p>
          <h2 className="font-display text-3xl uppercase tracking-[0.05em] text-foreground">
            {tab === "signin" ? "Welcome back" : "Open your account"}
          </h2>

          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v);
              setError(null);
            }}
            className="mt-8"
          >
            <TabsList className="grid h-11 w-full grid-cols-2 bg-navy-panel">
              <TabsTrigger value="signin" className="text-xs uppercase tracking-[0.16em]">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="text-xs uppercase tracking-[0.16em]">
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={submitSignin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="si-email" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="si-email"
                    name="email"
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-12 bg-navy-panel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si-password" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Password
                  </Label>
                  <Input
                    id="si-password"
                    name="password"
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-12 bg-navy-panel"
                  />
                </div>
                <AuthError message={error} />
                <Button
                  type="submit"
                  disabled={pending}
                  className="h-12 w-full bg-gold text-[12px] font-semibold uppercase tracking-[0.22em] text-navy-deep hover:bg-cream"
                >
                  {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={submitSignup} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="su-name" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Full name
                  </Label>
                  <Input
                    id="su-name"
                    name="name"
                    required
                    autoComplete="name"
                    placeholder="Ava Whitfield"
                    className="h-12 bg-navy-panel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="su-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-12 bg-navy-panel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Password
                  </Label>
                  <Input
                    id="su-password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    className="h-12 bg-navy-panel"
                  />
                </div>
                <AuthError message={error} />
                <Button
                  type="submit"
                  disabled={pending}
                  className="h-12 w-full bg-gold text-[12px] font-semibold uppercase tracking-[0.22em] text-navy-deep hover:bg-cream"
                >
                  {signup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your account number is issued instantly. Deposits are credited
                  once approved by an administrator.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-8 flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              or continue with
            </span>
            <Separator className="flex-1" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full border-border text-[12px] uppercase tracking-[0.22em] text-cream hover:border-gold hover:bg-navy-panel transition-all flex items-center justify-center gap-3"
            onClick={() => {
              // Standard OAuth integration fallback
              setError("Single sign-on via Google Workspace is currently restricted to verified institutional domains.");
            }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google</span>
          </Button>

          <p className="mt-8 text-center text-[11px] text-muted-foreground font-mono">
            Secured by Swiss Banking Grade TLS 1.3 Encryption
          </p>
        </div>
      </div>
    </div>
  );
}

function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}
