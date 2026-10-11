import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Eye, Mail, MailCheck, Pencil, RefreshCw, Send } from "lucide-react";
import { useLifecycle, useLifecycleActions, type LifecycleTemplate } from "@/hooks/admin/useAdminLifecycle";
import { TEMPLATE_INFO, VARIABLE_HINT, type Mode } from "../../../supabase/functions/_shared/lifecycleRules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReasonConfirmDialog } from "@/components/admin/ReasonConfirmDialog";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { cn } from "@/lib/utils";

const MODE_LABEL: Record<Mode, string> = { off: "Off", dry_run: "Dry run", live: "Live" };
const MODE_HELP: Record<Mode, string> = {
  off: "Nothing is sent. This is how it starts.",
  dry_run: "Works out who would get each message and sends nothing. Use it to check the numbers.",
  live: "Sends real emails to customers, within the daily limit.",
};
const ago = (iso: string | null) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "never");

function EditDialog({ t, onClose }: { t: LifecycleTemplate | null; onClose: () => void }) {
  const { updateTemplate } = useLifecycleActions();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"service" | "marketing">("service");
  const [reason, setReason] = useState("");
  const [confirmService, setConfirmService] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);

  if (t && loaded !== t.key) {
    setLoaded(t.key); setSubject(t.subject); setBody(t.body); setAudience(t.audience); setReason(""); setConfirmService(false);
  }
  if (!t) return null;
  const info = TEMPLATE_INFO[t.key];
  const widening = t.audience === "marketing" && audience === "service";
  const canSave = !updateTemplate.isPending && (!widening || (confirmService && reason.trim().length >= 10));

  const save = () =>
    updateTemplate.mutate(
      { key: t.key, subject, body, audience: audience !== t.audience ? audience : undefined, reason: widening ? reason : undefined, confirmService: widening ? true : undefined },
      { onSuccess: () => { setLoaded(null); onClose(); } },
    );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) { setLoaded(null); onClose(); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit: {info.title}</DialogTitle>
          <DialogDescription>{info.when}. Changes apply to messages sent from now on.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lc-subject">Subject</Label>
            <Input id="lc-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lc-body">Message</Label>
            <Textarea id="lc-body" rows={11} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap gap-1.5">
              {info.variables.map((v) => (
                <Button key={v} type="button" variant="outline" size="sm" className="h-7 text-xs" title={VARIABLE_HINT[v]} onClick={() => setBody(`${body}{{${v}}}`)}>
                  {`{{${v}}}`}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Click a placeholder to add it to the end. Plain text only; links and paragraphs are formatted for you.</p>
          </div>
          {info.audiences.length > 1 && (
            <div className="space-y-2">
              <Label>Who gets it</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as "service" | "marketing")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Only people who opted in to marketing email (recommended)</SelectItem>
                  <SelectItem value="service">Everyone with a confirmed account, except those who opted out</SelectItem>
                </SelectContent>
              </Select>
              {widening && (
                <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
                  <p>Almost nobody has opted in to marketing email (the default is off), so this widens the audience a lot. Only do it if this message counts as part of using the product and your privacy policy and local law allow it.</p>
                  <div className="space-y-1">
                    <Label htmlFor="lc-reason">Why does this count as an account email?</Label>
                    <Input id="lc-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Onboarding help for a new account, covered by our privacy policy" />
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox id="lc-confirm" checked={confirmService} onCheckedChange={(c) => setConfirmService(c === true)} />
                    <Label htmlFor="lc-confirm" className="text-sm font-normal">I understand and take responsibility for this choice. It is recorded in the audit log.</Label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setLoaded(null); onClose(); }}>Cancel</Button>
          <Button onClick={save} disabled={!canSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ t, onEdit, onToggle, onPreview, onTest, testing }: {
  t: LifecycleTemplate; onEdit: () => void; onToggle: () => void; onPreview: () => void; onTest: () => void; testing: boolean;
}) {
  const info = TEMPLATE_INFO[t.key];
  return (
    <Card className="glass-card">
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-4">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {info.title}
            <Badge variant={t.audience === "marketing" ? "outline" : "secondary"}>{t.audience === "marketing" ? "Marketing: opted-in only" : "Account email"}</Badge>
          </CardTitle>
          <CardDescription>{info.when}</CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Label htmlFor={`on-${t.key}`} className="text-sm">{t.enabled ? "On" : "Off"}</Label>
          <Switch id={`on-${t.key}`} checked={t.enabled} onCheckedChange={onToggle} aria-label={`${t.enabled ? "Switch off" : "Switch on"} ${info.title}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/30 bg-card/50 p-3">
          <p className="text-sm font-medium">{t.subject}</p>
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{t.body}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Would send now", t.enabled ? t.eligibleNow : "–", t.enabled && t.eligibleNow > 0 ? "text-primary" : ""],
            ["Sent, last 7 days", t.sent7d, ""],
            ["Sent, ever", t.sentTotal, ""],
            ["Failed, last 7 days", t.failed7d, t.failed7d > 0 ? "text-destructive" : ""],
          ].map(([label, value, tone]) => (
            <div key={label as string}>
              <p className={cn("text-2xl font-bold", tone as string)}>{value as number | string}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t.enabled && t.liveSince
            ? `Live since ${format(new Date(t.liveSince), "MMM d, HH:mm")}. It reaches people whose trigger happens after that, never an older backlog.`
            : "Switched off. When you switch it on it starts from that moment and does not email existing customers."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={onEdit}><Pencil className="h-4 w-4" />Edit</Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={onPreview}><Eye className="h-4 w-4" />Preview</Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={onTest} disabled={testing}><Send className="h-4 w-4" />Send me a test</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Lifecycle() {
  const { data: o, isLoading, error, refetch, isFetching } = useLifecycle();
  const { updateTemplate, updateSettings, preview, test } = useLifecycleActions();
  const [editing, setEditing] = useState<LifecycleTemplate | null>(null);
  const [toggling, setToggling] = useState<LifecycleTemplate | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [previewing, setPreviewing] = useState<{ subject: string; html: string } | null>(null);
  const [cap, setCap] = useState<string | null>(null);
  const [gap, setGap] = useState<string | null>(null);

  if (error) {
    return <div className="animate-fade-in"><AdminErrorState icon={Mail} title="Failed to load messages" description={error.message} onRetry={() => refetch()} /></div>;
  }

  const eligibleTotal = o?.templates.filter((t) => t.enabled).reduce((n, t) => n + t.eligibleNow, 0) ?? 0;
  const limitsChanged = o && ((cap !== null && Number(cap) !== o.settings.daily_cap) || (gap !== null && Number(gap) !== o.settings.min_gap_hours));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Messages</h1>
          <p className="text-muted-foreground">Emails sent automatically at key moments: a welcome, a nudge to log a first transaction, and a trial reminder.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 self-start" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />Refresh
        </Button>
      </div>

      {isLoading || !o ? (
        <div className="space-y-4"><div className="h-40 shimmer rounded-xl" /><div className="h-64 shimmer rounded-xl" /></div>
      ) : (
        <>
          {!o.emailConfigured && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">Email is not set up on the server, so nothing can be sent.</div>
          )}

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MailCheck className="h-4 w-4 text-primary" />Sending</CardTitle>
              <CardDescription>{MODE_HELP[o.settings.mode]}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Sending mode">
                {(["off", "dry_run", "live"] as Mode[]).map((m) => (
                  <Button key={m} role="radio" aria-checked={o.settings.mode === m} size="sm" variant={o.settings.mode === m ? "default" : "outline"}
                    onClick={() => o.settings.mode !== m && setMode(m)}>
                    {MODE_LABEL[m]}
                  </Button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">Sent today: {o.sentToday} of {o.settings.daily_cap}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="cap">Daily limit (emails)</Label>
                  <Input id="cap" type="number" min={1} max={500} value={cap ?? o.settings.daily_cap} onChange={(e) => setCap(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gap">Gap between emails to one person (hours)</Label>
                  <Input id="gap" type="number" min={1} max={720} value={gap ?? o.settings.min_gap_hours} onChange={(e) => setGap(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" disabled={!limitsChanged || updateSettings.isPending}
                    onClick={() => updateSettings.mutate(
                      { daily_cap: Number(cap ?? o.settings.daily_cap), min_gap_hours: Number(gap ?? o.settings.min_gap_hours), reason: "Changed the sending limits" },
                      { onSuccess: () => { setCap(null); setGap(null); } },
                    )}>Save limits</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Each person gets each message at most once. Marketing messages only go to people who opted in, and always carry an unsubscribe link.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {o.templates.map((t) => (
              <TemplateCard key={t.key} t={t} testing={test.isPending}
                onEdit={() => setEditing(t)} onToggle={() => setToggling(t)}
                onPreview={() => preview.mutate(t.key, { onSuccess: setPreviewing })}
                onTest={() => test.mutate(t.key)} />
            ))}
          </div>

          <Card className="glass-card">
            <CardHeader><CardTitle>Recent sends</CardTitle><CardDescription>The last 20. Addresses are partly hidden.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Message</TableHead><TableHead>To</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
                <TableBody>
                  {o.recent.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{ago(r.at)}</TableCell>
                      <TableCell>{TEMPLATE_INFO[r.template]?.title ?? r.template}</TableCell>
                      <TableCell className="text-muted-foreground">{r.email}</TableCell>
                      <TableCell>{r.status === "sent" ? <Badge variant="secondary">Sent</Badge> : <span className="text-destructive">Failed <span className="text-xs">{r.error}</span></span>}</TableCell>
                    </TableRow>
                  ))}
                  {o.recent.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Nothing has been sent yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <EditDialog t={editing} onClose={() => setEditing(null)} />

      <ReasonConfirmDialog
        open={!!toggling} onOpenChange={(open) => !open && setToggling(null)}
        title={toggling?.enabled ? `Switch off ${toggling ? TEMPLATE_INFO[toggling.key].title : ""}` : `Switch on ${toggling ? TEMPLATE_INFO[toggling.key].title : ""}`}
        description={toggling?.enabled
          ? "It stops being sent. People it was due for in the meantime will not get it later."
          : `It starts from now: only people whose trigger happens after this moment are eligible, never existing customers. Nothing is sent unless Sending is set to Live.${toggling ? ` Right now ${toggling.eligibleNow} people would qualify.` : ""}`}
        reasonLabel="Why?" reasonPlaceholder="e.g. Launching onboarding emails for new sign-ups"
        confirmLabel={toggling?.enabled ? "Switch off" : "Switch on"} destructive={!!toggling?.enabled} pending={updateTemplate.isPending}
        onConfirm={({ reason }) => toggling && updateTemplate.mutate({ key: toggling.key, enabled: !toggling.enabled, reason }, { onSuccess: () => setToggling(null) })}
      />

      <ReasonConfirmDialog
        open={!!mode} onOpenChange={(open) => !open && setMode(null)}
        title={mode ? `Set sending to ${MODE_LABEL[mode]}` : ""}
        description={mode === "live"
          ? `Real emails will go to customers, up to ${o?.settings.daily_cap ?? 25} a day. Right now ${eligibleTotal} people qualify across the messages that are switched on. Check them with a dry run first if you have not.`
          : mode ? MODE_HELP[mode] : ""}
        reasonLabel="Why?" reasonPlaceholder="e.g. Dry run first to check who would qualify"
        confirmLabel={mode ? `Set to ${MODE_LABEL[mode]}` : "Confirm"} destructive={mode === "live"} pending={updateSettings.isPending}
        onConfirm={({ reason }) => mode && updateSettings.mutate({ mode, reason }, { onSuccess: () => setMode(null) })}
      />

      <Dialog open={!!previewing} onOpenChange={(open) => !open && setPreviewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>Subject: {previewing?.subject}. Shown with a sample name; nothing was sent.</DialogDescription>
          </DialogHeader>
          {previewing && <iframe title="Email preview" sandbox="" srcDoc={previewing.html} className="h-[28rem] w-full rounded-lg border border-border/40 bg-white" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
