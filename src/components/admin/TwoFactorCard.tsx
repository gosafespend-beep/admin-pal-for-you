import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Factor = { id: string; status: string; friendly_name?: string | null };
type Enrolment = { factorId: string; qr: string; secret: string };

/**
 * Real two-factor status for the signed-in admin, with enrolment for an
 * authenticator app (TOTP). This replaces a block of static "Enabled" badges
 * that reported nothing about the account.
 */
export function TwoFactorCard() {
  const { toast } = useToast();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");

  const load = useCallback(async () => {
    const [{ data: list }, { data: aal }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setFactors((list?.totp ?? []) as Factor[]);
    setLevel(aal?.currentLevel ?? null);
  }, []);

  useEffect(() => {
    load().catch(() => setFactors([]));
  }, [load]);

  const verified = factors?.find((f) => f.status === "verified");

  const startEnrolment = async () => {
    setBusy(true);
    try {
      // An abandoned, unverified attempt would block a new one with the same name.
      for (const f of factors?.filter((f) => f.status !== "verified") ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Admin ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error || !data) throw error ?? new Error("Could not start setup");
      setEnrolment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      toast({ title: "Could not start setup", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const confirmEnrolment = async () => {
    if (!enrolment) return;
    setBusy(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enrolment.factorId });
      if (cErr) throw cErr;
      const { error } = await supabase.auth.mfa.verify({ factorId: enrolment.factorId, challengeId: challenge.id, code });
      if (error) throw new Error("That code was not accepted. Check the code and try again.");
      toast({ title: "Two-factor sign-in enabled", description: "You'll be asked for a code each time you sign in." });
      setEnrolment(null);
      setCode("");
      await load();
    } catch (e) {
      toast({ title: "Verification failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-info" />
          Two-factor sign-in
        </CardTitle>
        <CardDescription>
          A code from an authenticator app is required after your password. Admin accounts can see and change customer data, so this should be on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {factors === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking…
          </div>
        ) : verified ? (
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Authenticator app is set up</p>
                <p className="text-xs text-muted-foreground">
                  This session is {level === "aal2" ? "verified with a code" : "password-only"}.
                </p>
              </div>
            </div>
            <Badge className="bg-primary/10 text-primary border border-primary/20">On</Badge>
          </div>
        ) : enrolment ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this with an authenticator app (Google Authenticator, 1Password, Authy…), then enter the 6-digit code it shows.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <img src={enrolment.qr} alt="Two-factor setup QR code" className="h-40 w-40 rounded-lg border border-border/50 bg-white p-2" />
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Can't scan? Enter this key</Label>
                  <p className="select-all break-all font-mono text-xs">{enrolment.secret}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mfa-setup-code">6-digit code</Label>
                  <Input
                    id="mfa-setup-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="w-40 text-center tracking-[0.4em]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={confirmEnrolment} disabled={busy || code.length !== 6}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Turn on
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => { setEnrolment(null); setCode(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm font-medium text-foreground">Not set up</p>
                <p className="text-xs text-muted-foreground">Your account is protected by your password alone.</p>
              </div>
            </div>
            <Button onClick={startEnrolment} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Set up
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
