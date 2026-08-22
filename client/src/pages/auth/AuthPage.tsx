import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/AuthProvider";
import { api } from "@/lib/api";

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mfaStage, setMfaStage] = useState<"none" | "verify" | "setup">("none");
  const [mfaSetupToken, setMfaSetupToken] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const destination = (location.state as { from?: string } | null)?.from || "/dashboard";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "register") {
        await register({ firstName, lastName, email, phone: phone || undefined, password });
      } else if (mfaStage === "setup") {
        await api.confirmMfaSetup(mfaSetupToken, otp);
        await login(email, password, otp);
      } else {
        const response = await login(email, password, mfaStage === "verify" ? otp : undefined);
        if (response.mfaSetupRequired && response.setupToken) {
          const setup = await api.beginMfaSetup(response.setupToken);
          setMfaSetupToken(response.setupToken);
          setMfaSecret(setup.secret);
          setMfaStage("setup");
          return;
        }
        if (response.mfaRequired) {
          setMfaStage("verify");
          return;
        }
      }
      navigate(destination, { replace: true });
    } catch (requestError: any) {
      setError(requestError.message || "We couldn't sign you in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden rounded-2xl bg-slate-950 p-10 text-white lg:block">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300"><CheckCircle2 className="h-4 w-4" /> One account, two experiences</p>
        <h1 className="mt-5 max-w-md text-4xl font-bold tracking-tight">Book your next game. Follow every match.</h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">Keep your turf bookings, match updates, followed teams and player activity in one personal dashboard.</p>
        <div className="mt-10 grid gap-4">{["Fast access to your booking history", "Personalised fixtures and league updates", "Secure account controls and notifications"].map((item) => <p key={item} className="flex items-center gap-3 text-sm text-slate-200"><span className="h-2 w-2 rounded-full bg-emerald-400" />{item}</p>)}</div>
      </section>
      <Card className="mx-auto w-full max-w-md shadow-md">
        <CardHeader><p className="text-sm font-medium text-primary">Fusion Turf</p><CardTitle className="text-2xl">{mode === "signin" ? "Welcome back" : "Create your account"}</CardTitle><CardDescription>{mode === "signin" ? "Sign in to manage bookings and your football dashboard." : "Use your details to start booking and following the league."}</CardDescription></CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-2 rounded-lg bg-secondary p-1" role="tablist" aria-label="Authentication mode"><button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => { setMode("signin"); setError(""); setMfaStage("none"); }} className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Sign in</button><button type="button" role="tab" aria-selected={mode === "register"} onClick={() => { setMode("register"); setError(""); setMfaStage("none"); }} className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "register" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Create account</button></div>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {mode === "register" && <div className="grid gap-4 sm:grid-cols-2"><Field label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" required /><Field label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" required /></div>}
            <div className="space-y-1.5"><label htmlFor="auth-email" className="text-sm font-medium">Email address</label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="auth-email" className="pl-9" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></div></div>
            {mode === "register" && <div className="space-y-1.5"><label htmlFor="auth-phone" className="text-sm font-medium">Phone number <span className="text-muted-foreground">(optional)</span></label><Input id="auth-phone" value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" /></div>}
            <div className="space-y-1.5"><label htmlFor="auth-password" className="text-sm font-medium">Password</label><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="auth-password" className="pl-9" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : undefined} required /></div>{mode === "register" && <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>}</div>
            {mfaStage === "setup" && <div className="rounded-lg border bg-muted/40 p-3 text-sm"><p className="font-semibold">Set up your authenticator</p><p className="mt-1 text-muted-foreground">Add this key to your authenticator app, then enter its six-digit code. Privileged accounts cannot sign in without MFA.</p><code className="mt-2 block break-all rounded bg-background p-2 font-mono text-xs">{mfaSecret}</code></div>}
            {mfaStage !== "none" && <div className="space-y-1.5"><label htmlFor="auth-otp" className="text-sm font-medium">Authentication code</label><Input id="auth-otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus /></div>}
            {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
            <Button className="w-full gap-2" size="lg" type="submit" disabled={submitting || (mfaStage !== "none" && otp.length !== 6)}>{mode === "signin" ? <UserRound className="h-4 w-4" /> : null}{submitting ? "Please wait…" : mfaStage === "setup" ? "Enable MFA and sign in" : mfaStage === "verify" ? "Verify and sign in" : mode === "signin" ? "Sign in" : "Create account"}</Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">By continuing, you can manage turf bookings and receive relevant competition updates.</p><Link to="/" className="mt-4 block text-center text-sm font-medium text-primary hover:underline">Return home</Link>
        </CardContent>
      </Card>
    </main>
  );
}

function Field({ label, value, onChange, autoComplete, required }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string; required?: boolean }) {
  const id = label.toLowerCase().replace(" ", "-");
  return <div className="space-y-1.5"><label htmlFor={id} className="text-sm font-medium">{label}</label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required={required} /></div>;
}
