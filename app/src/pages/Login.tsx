import { useState, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Camera, CheckCircle2, Loader2, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { BankLogo } from "@/components/BankLogo";
import { SealBadge } from "@/components/SealBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ── Camera capture hook ───────────────────────────────────────────────────────
function useCameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  const start = useCallback(async () => {
    try {
      setCamError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      setActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 80);
    } catch {
      setCamError("Camera permission denied.");
    }
  }, []);

  const snap = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.8);
    stop();
    return dataUrl;
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  return { videoRef, canvasRef, active, camError, start, snap, stop };
}

// ── ID capture widget ─────────────────────────────────────────────────────────
function IdCapture({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const cam = useCameraCapture();
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {cam.active ? (
        <div className="border border-gold/50 bg-black rounded overflow-hidden">
          <video ref={cam.videoRef} autoPlay playsInline muted className="w-full h-32 object-cover" />
          <canvas ref={cam.canvasRef} className="hidden" />
          <div className="flex gap-2 p-1.5 bg-navy-panel">
            <Button
              type="button"
              onClick={() => { const img = cam.snap(); if (img) onChange(img); }}
              className="flex-1 bg-gold text-navy-deep h-8 text-xs font-bold uppercase tracking-wider"
            >
              <Camera className="h-3 w-3 mr-1" /> Capture
            </Button>
            <Button type="button" variant="outline" onClick={cam.stop} className="h-8 px-2 border-border text-muted-foreground">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : value ? (
        <div className="relative border border-emerald-500/70 rounded overflow-hidden">
          <img src={value} alt={label} className="w-full h-20 object-cover" />
          <div className="absolute inset-0 flex items-end justify-between px-2 pb-1 bg-gradient-to-t from-black/70">
            <span className="text-emerald-300 text-[10px] font-bold uppercase flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Captured
            </span>
            <button type="button" onClick={() => { onChange(""); cam.start(); }} className="text-[9px] text-zinc-300 underline">
              Retake
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={cam.start}
          className="w-full border border-dashed border-border hover:border-gold p-3 rounded flex flex-col items-center justify-center gap-1 min-h-[64px] text-muted-foreground transition-colors"
        >
          <Camera className="h-5 w-5 text-gold" />
          <span className="text-[11px]">Open Camera to Capture</span>
          {cam.camError && <span className="text-[10px] text-red-400">{cam.camError}</span>}
        </button>
      )}
    </div>
  );
}

export default function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState(params.get("mode") === "signup" ? "signup" : "signin");
  const [error, setError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  // Signup multi-step (1 = credentials, 2 = personal KYC, 3 = documents)
  const [signupStep, setSignupStep] = useState(1);
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPass, setSuPass] = useState("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [occupation, setOccupation] = useState("");
  const [employer, setEmployer] = useState("");
  const [income, setIncome] = useState("");
  const [sourceOfFunds, setSourceOfFunds] = useState("");
  const [govIdType, setGovIdType] = useState<"passport" | "national_id" | "drivers_license">("passport");
  const [govIdFront, setGovIdFront] = useState<string>("");
  const [govIdBack, setGovIdBack] = useState<string>("");
  const [selfie, setSelfie] = useState<string>("");

  const login = trpc.credentialAuth.login.useMutation({
    onSuccess: async () => { await utils.invalidate(); navigate("/dashboard"); },
    onError: (e) => setError(e.message),
  });

  const kycSubmit = trpc.bank.submitKycApplication.useMutation({
    onSuccess: async () => { await utils.invalidate(); navigate("/dashboard"); },
    onError: () => navigate("/dashboard"),
  });

  const signup = trpc.credentialAuth.signup.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      if (govIdFront && govIdBack && selfie) {
        kycSubmit.mutate({
          dateOfBirth: dob, nationality, phone, address, city, country, postalCode,
          occupation, employerName: employer, annualIncome: income, sourceOfFunds,
          govIdType, govIdFront, govIdBack, selfie,
        });
      } else {
        navigate("/dashboard");
      }
    },
    onError: (e) => setError(e.message),
  });

  const pending = login.isPending || signup.isPending || kycSubmit.isPending;

  const submitSignin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    login.mutate({ email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? "") });
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
            Deposits, withdrawals and transfers — each dated, referenced and approved by your account administrator.
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">© MMXXVI Summit Private Bank</p>
      </div>

      {/* Form panel */}
      <div className="flex min-h-[100svh] flex-col bg-navy-deep px-5 py-6 sm:px-10 overflow-y-auto">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex h-10 items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-cream">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <div className="lg:hidden"><BankLogo compact /></div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <p className="mb-3 text-[11px] uppercase tracking-mega text-gold">Client Access</p>
          <h2 className="font-display text-3xl uppercase tracking-[0.05em] text-foreground">
            {tab === "signin" ? "Welcome back" : "Open your account"}
          </h2>

          <Tabs value={tab} onValueChange={(v) => { setTab(v); setError(null); setSignupStep(1); }} className="mt-8">
            <TabsList className="grid h-11 w-full grid-cols-2 bg-navy-panel">
              <TabsTrigger value="signin" className="text-xs uppercase tracking-[0.16em]">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="text-xs uppercase tracking-[0.16em]">Create account</TabsTrigger>
            </TabsList>

            {/* SIGN IN */}
            <TabsContent value="signin" className="mt-6">
              <form onSubmit={submitSignin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="si-email" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Email</Label>
                  <Input id="si-email" name="email" type="email" required value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)} autoComplete="email"
                    placeholder="you@example.com" className="h-12 bg-navy-panel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si-password" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Password</Label>
                  <Input id="si-password" name="password" type="password" required value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)} autoComplete="current-password"
                    placeholder="••••••••" className="h-12 bg-navy-panel" />
                </div>
                <AuthError message={error} />
                <Button type="submit" disabled={pending} className="h-12 w-full bg-gold text-[12px] font-semibold uppercase tracking-[0.22em] text-navy-deep hover:bg-cream">
                  {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            {/* SIGN UP — Multi-step KYC */}
            <TabsContent value="signup" className="mt-6">
              {/* Progress */}
              <div className="mb-5 flex items-center gap-1.5">
                {[1, 2, 3].map((s) => (
                  <div key={s} className={cn("h-1 flex-1 rounded-full transition-all duration-300", s <= signupStep ? "bg-gold" : "bg-navy-panel")} />
                ))}
                <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {signupStep === 1 ? "Credentials" : signupStep === 2 ? "Personal Info" : "Documents"}
                </span>
              </div>

              {/* Step 1 */}
              {signupStep === 1 && (
                <div className="space-y-4">
                  <p className="text-[11px] text-muted-foreground">Enter your login credentials to begin.</p>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Full Legal Name</Label>
                    <Input required value={suName} onChange={(e) => setSuName(e.target.value)} autoComplete="name" placeholder="Ava Whitfield" className="h-12 bg-navy-panel" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Email Address</Label>
                    <Input required type="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className="h-12 bg-navy-panel" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Password</Label>
                    <Input required type="password" minLength={8} value={suPass} onChange={(e) => setSuPass(e.target.value)} autoComplete="new-password" placeholder="Minimum 8 characters" className="h-12 bg-navy-panel" />
                  </div>
                  <AuthError message={error} />
                  <Button type="button" disabled={!suName || !suEmail || suPass.length < 8}
                    onClick={() => { setError(null); setSignupStep(2); }}
                    className="h-12 w-full bg-gold text-[12px] font-semibold uppercase tracking-[0.22em] text-navy-deep hover:bg-cream">
                    Continue →
                  </Button>
                </div>
              )}

              {/* Step 2 */}
              {signupStep === 2 && (
                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground">Required by Swiss Banking Ordinance for account opening.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date of Birth</Label>
                      <Input type="date" required value={dob} onChange={(e) => setDob(e.target.value)} className="bg-navy-panel text-xs h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nationality</Label>
                      <Input required value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. American" className="bg-navy-panel text-xs h-10" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone Number</Label>
                    <Input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (212) 555-0198" className="bg-navy-panel text-xs h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Residential Address</Label>
                    <Input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Park Avenue" className="bg-navy-panel text-xs h-10" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">City</Label>
                      <Input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" className="bg-navy-panel text-xs h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Country</Label>
                      <Input required value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States" className="bg-navy-panel text-xs h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Postal</Label>
                      <Input required value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="10001" className="bg-navy-panel text-xs h-10" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Occupation</Label>
                      <Input required value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Executive Director" className="bg-navy-panel text-xs h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Employer</Label>
                      <Input required value={employer} onChange={(e) => setEmployer(e.target.value)} placeholder="Goldman Sachs" className="bg-navy-panel text-xs h-10" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Annual Income (USD)</Label>
                    <Input required value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. $500,000 – $1,000,000" className="bg-navy-panel text-xs h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Source of Funds</Label>
                    <Input required value={sourceOfFunds} onChange={(e) => setSourceOfFunds(e.target.value)} placeholder="Business income, investments, inheritance..." className="bg-navy-panel text-xs h-10" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={() => setSignupStep(1)} className="flex-1 border-border text-muted-foreground h-11">← Back</Button>
                    <Button type="button" disabled={!dob || !phone || !address || !city || !country || !occupation || !sourceOfFunds}
                      onClick={() => setSignupStep(3)}
                      className="flex-1 bg-gold text-[12px] font-semibold uppercase tracking-[0.18em] text-navy-deep hover:bg-cream h-11">
                      Continue →
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3 */}
              {signupStep === 3 && (
                <div className="space-y-4">
                  <p className="text-[11px] text-muted-foreground">Photographs are encrypted and submitted to Summit compliance for verification.</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Document Type</Label>
                    <div className="flex gap-2">
                      {([["passport", "Passport"], ["national_id", "National ID"], ["drivers_license", "Driver's Lic."]] as const).map(([val, lbl]) => (
                        <button key={val} type="button" onClick={() => setGovIdType(val)}
                          className={cn("flex-1 py-1.5 border text-[10px] font-semibold uppercase tracking-wider transition-colors rounded",
                            govIdType === val ? "border-gold bg-gold text-navy-deep" : "border-border text-muted-foreground")}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <IdCapture label="ID Front" value={govIdFront} onChange={setGovIdFront} />
                  <IdCapture label="ID Back" value={govIdBack} onChange={setGovIdBack} />
                  <IdCapture label="Live Selfie (hold ID visible)" value={selfie} onChange={setSelfie} />
                  <div className="border border-border/50 bg-navy-panel p-3 rounded text-[10px] text-muted-foreground leading-relaxed">
                    📋 Your application is reviewed by our compliance team within 1–2 business days. Account functions are available immediately but deposits require admin approval.
                  </div>
                  <AuthError message={error} />
                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={() => setSignupStep(2)} className="flex-1 border-border text-muted-foreground h-11">← Back</Button>
                    <Button type="button" disabled={pending || !govIdFront || !govIdBack || !selfie}
                      onClick={() => {
                        setError(null);
                        signup.mutate({
                          name: suName,
                          email: suEmail,
                          password: suPass,
                          kyc: {
                            dateOfBirth: dob,
                            phone,
                            address,
                            city,
                            country,
                            postalCode,
                            occupation,
                            employerName: employer,
                            annualIncome: income,
                            sourceOfFunds,
                            govIdType,
                            govIdFront,
                            govIdBack,
                            selfie,
                          },
                        });
                      }}
                      className="flex-1 bg-gold text-[12px] font-semibold uppercase tracking-[0.18em] text-navy-deep hover:bg-cream h-11">
                      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Application
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="my-8 flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">or continue with</span>
            <Separator className="flex-1" />
          </div>

          <Button type="button" variant="outline"
            className="h-12 w-full border-border text-[12px] uppercase tracking-[0.22em] text-cream hover:border-gold hover:bg-navy-panel transition-all flex items-center justify-center gap-3"
            onClick={() => setError("Single sign-on via Google Workspace is currently restricted to verified institutional domains.")}>
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
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

