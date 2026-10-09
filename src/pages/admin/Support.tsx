import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, Info, LifeBuoy, Mail, Pencil, Plus, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAdminUserDetail, type UserDetailResponse } from "@/hooks/admin/useAdminUserDetail";
import { useAddUserNote } from "@/hooks/admin/useAdminUserNotes";
import {
  useMacroMutations, useSupportLookup, useSupportMacros, useWriteSnapshot,
  type MacroDraft, type SupportMacro, type SupportMatch,
} from "@/hooks/admin/useAdminSupport";
import { diagnose, type Finding, type Severity } from "@/lib/supportDiagnosis";
import { MACRO_CATEGORIES, MACRO_VARIABLES, renderMacro } from "../../../supabase/functions/_shared/supportRules";
import { UserNotes } from "@/components/admin/UserNotes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = { account: "Account", billing: "Billing", privacy: "Privacy", how_to: "How to", other: "Other" };
const day = (iso: string | null | undefined) => (iso ? format(new Date(iso), "MMM d, yyyy") : null);
/** Longest mailto: link most email apps will take; beyond this the text is copied instead. */
const MAX_MAILTO = 1900;

const SEVERITY: Record<Severity, { icon: typeof Info; tone: string }> = {
  problem: { icon: XCircle, tone: "text-destructive" },
  warning: { icon: AlertTriangle, tone: "text-warning" },
  info: { icon: Info, tone: "text-info" },
  ok: { icon: CheckCircle2, tone: "text-primary" },
};

function planLine(d: UserDetailResponse) {
  const parts: string[] = [];
  if (d.subscription) parts.push(`${d.subscription.plan_type ?? "Web"} · ${d.subscription.status}`);
  for (const e of d.overview.entitlements) if (e.is_active) parts.push(`${e.store} · active`);
  return parts.join("; ") || "Free";
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const { icon: Icon, tone } = SEVERITY[f.severity];
  return (
    <li className="flex gap-3">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{f.title}</p>
        <p className="text-xs text-muted-foreground">{f.detail}</p>
      </div>
    </li>
  );
}

function ReplyComposer({ detail }: { detail: UserDetailResponse }) {
  const { data: macros } = useSupportMacros();
  const addNote = useAddUserNote();
  const [macroId, setMacroId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [handedOff, setHandedOff] = useState(false);
  const [managing, setManaging] = useState(false);
  const { user, subscription: sub } = detail;

  const values = useMemo(() => ({
    first_name: user.display_name?.trim().split(/\s+/)[0] || "there",
    email: user.email,
    signup_date: day(user.created_at),
    trial_end: day(sub?.trial_end),
    period_end: day(sub?.current_period_end ?? detail.overview.entitlements.find((e) => e.is_active)?.expires_at),
  }), [user, sub, detail.overview.entitlements]);

  const unfilled = useMemo(
    () => [...new Set([...`${subject}\n${body}`.matchAll(/\[\[([a-z_]+)\]\]/g)].map((m) => m[1]))],
    [subject, body],
  );
  const chosen = macros?.find((m) => m.id === macroId);

  const choose = (id: string) => {
    const macro = macros?.find((m) => m.id === id);
    if (!macro) return;
    const r = renderMacro(macro, values);
    setMacroId(id);
    setSubject(r.subject);
    setBody(r.body);
    setHandedOff(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      toast.success("Copied");
      setHandedOff(true);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it by hand.");
    }
  };

  const openEmail = () => {
    const link = `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (link.length > MAX_MAILTO) {
      toast.message("Too long for a link, so it was copied instead. Paste it into your email.");
      void copy();
      return;
    }
    window.location.href = link;
    setHandedOff(true);
  };

  const logSent = () =>
    addNote.mutate(
      { userId: user.id, note: `Support reply sent by email${chosen ? `: "${chosen.title}"` : ""}.`, tag: "Support" },
      { onSuccess: () => setHandedOff(false) },
    );

  const ordered = [...(macros ?? [])].sort((a, b) => MACRO_CATEGORIES.indexOf(a.category) - MACRO_CATEGORIES.indexOf(b.category) || a.title.localeCompare(b.title));

  return (
    <Card className="glass-card">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Reply</CardTitle>
          <CardDescription>Pick a saved reply, check it, then send it from your own email.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setManaging(true)}>Manage replies</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Saved reply</Label>
          <Select value={macroId} onValueChange={choose}>
            <SelectTrigger><SelectValue placeholder={macros ? "Choose a reply…" : "Loading…"} /></SelectTrigger>
            <SelectContent>
              {ordered.map((m) => <SelectItem key={m.id} value={m.id}>{CATEGORY_LABEL[m.category]} · {m.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {macroId && (
          <>
            <div className="space-y-2">
              <Label htmlFor="reply-to">To</Label>
              <Input id="reply-to" value={user.email} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply-subject">Subject</Label>
              <Input id="reply-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply-body">Message</Label>
              <Textarea id="reply-body" value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
            </div>

            {unfilled.length > 0 && (
              <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p>
                  We don't have {unfilled.map((u) => `[[${u}]]`).join(", ")} for this person. Replace {unfilled.length > 1 ? "them" : "it"} in the text before sending.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button className="gap-2" onClick={openEmail} disabled={!subject.trim() || !body.trim() || unfilled.length > 0}>
                <ExternalLink className="h-4 w-4" /> Open in email app
              </Button>
              <Button variant="outline" className="gap-2" onClick={copy} disabled={!subject.trim() || !body.trim()}>
                <Copy className="h-4 w-4" /> Copy
              </Button>
              {handedOff && (
                <Button variant="secondary" onClick={logSent} disabled={addNote.isPending}>Log as sent</Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Nothing is sent from here. "Log as sent" adds a Support note to their profile so the next person knows they were contacted.
            </p>
          </>
        )}
      </CardContent>
      <MacroManager open={managing} onOpenChange={setManaging} />
    </Card>
  );
}

function MacroManager({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: macros, isLoading } = useSupportMacros(true);
  const { create, update, remove } = useMacroMutations();
  const [editing, setEditing] = useState<null | "new" | SupportMacro>(null);
  const [draft, setDraft] = useState<MacroDraft>({ title: "", category: "other", subject: "", body: "", active: true });
  const [deleting, setDeleting] = useState<SupportMacro | null>(null);

  const startEdit = (m: SupportMacro | "new") => {
    setDraft(m === "new" ? { title: "", category: "other", subject: "", body: "", active: true } : { title: m.title, category: m.category, subject: m.subject, body: m.body, active: m.active });
    setEditing(m);
  };
  const busy = create.isPending || update.isPending;
  const save = () => {
    const done = { onSuccess: () => setEditing(null) };
    if (editing === "new") create.mutate(draft, done);
    else if (editing) update.mutate({ id: editing.id, ...draft }, done);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setEditing(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? (editing === "new" ? "New saved reply" : "Edit saved reply") : "Saved replies"}</DialogTitle>
          <DialogDescription>
            {editing ? "Placeholders are filled in for each person when you use the reply." : "Ready-made messages for common questions. Changes are recorded in the audit log."}
          </DialogDescription>
        </DialogHeader>

        {!editing ? (
          <div className="space-y-2">
            {isLoading && <div className="h-24 shimmer rounded-lg" />}
            {macros?.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.subject}</p>
                </div>
                <Badge variant="secondary">{CATEGORY_LABEL[m.category]}</Badge>
                {!m.active && <Badge variant="outline">Off</Badge>}
                <Button variant="ghost" size="icon" aria-label={`Edit ${m.title}`} onClick={() => startEdit(m)}><Pencil className="h-4 w-4" /></Button>
              </div>
            ))}
            {macros?.length === 0 && <p className="text-sm text-muted-foreground">No saved replies yet.</p>}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => startEdit("new")}><Plus className="h-4 w-4" /> New reply</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="m-title">Title</Label>
                <Input id="m-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as MacroDraft["category"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MACRO_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-subject">Subject</Label>
              <Input id="m-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} maxLength={150} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-body">Message</Label>
              <Textarea id="m-body" rows={10} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(MACRO_VARIABLES).map(([key, hint]) => (
                  <Button key={key} type="button" variant="outline" size="sm" className="h-7 text-xs" title={hint}
                    onClick={() => setDraft({ ...draft, body: `${draft.body}{{${key}}}` })}>
                    {`{{${key}}}`}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Click a placeholder to add it to the end of the message.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="m-active" checked={draft.active ?? true} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
              <Label htmlFor="m-active">Available to use</Label>
            </div>
          </div>
        )}

        {editing && (
          <DialogFooter className="gap-2 sm:justify-between">
            {editing !== "new" ? (
              <Button variant="ghost" className="text-destructive" onClick={() => setDeleting(editing)}>Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Back</Button>
              <Button onClick={save} disabled={busy}>Save</Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>It disappears for everyone. To keep it but hide it, switch off "Available to use" instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting.id, { onSuccess: () => { setDeleting(null); setEditing(null); } })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function SupportView({ userId }: { userId: string }) {
  const { data: detail, isLoading, error, refetch } = useAdminUserDetail(userId);
  const { data: snapshot } = useWriteSnapshot(userId);

  const findings = useMemo(() => {
    if (!detail) return [];
    return diagnose({
      user: detail.user,
      subscription: detail.subscription,
      entitlements: detail.overview.entitlements,
      milestones: detail.overview.milestones,
      totalTransactions: detail.activitySummary.totalTransactions,
      marketingEmails: detail.overview.notifications?.marketingEmails ?? null,
      snapshot: snapshot ?? null,
    });
  }, [detail, snapshot]);

  if (error) return <AdminErrorState icon={LifeBuoy} title="Couldn't load this person" description={error.message} onRetry={() => refetch()} />;
  if (isLoading || !detail) return <div className="h-64 shimmer rounded-xl" />;

  const { user, overview } = detail;
  const suspended = !!user.banned_until && new Date(user.banned_until) > new Date();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card className="glass-card">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="min-w-0">
              <CardTitle className="truncate">{user.display_name || "No name"}</CardTitle>
              <CardDescription className="break-all">{user.email}</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
              <Link to={`/users/${user.id}`}><ExternalLink className="h-4 w-4" /> Full profile</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={user.email_confirmed_at ? "secondary" : "outline"}>{user.email_confirmed_at ? "Email confirmed" : "Email not confirmed"}</Badge>
              {suspended && <Badge className="border bg-destructive/10 text-destructive border-destructive/20">Suspended</Badge>}
              {user.is_admin && <Badge variant="secondary">Admin</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Fact label="Plan" value={planLine(detail)} />
              <Fact label="Signed up" value={day(user.created_at)} />
              <Fact label="Last sign-in" value={day(user.last_sign_in_at) ?? "Never"} />
              <Fact label="Apps used" value={overview.platforms.map((p) => p.platform).join(", ")} />
              <Fact label="Transactions logged" value={String(detail.activitySummary.totalTransactions)} />
              <Fact label="Currency" value={user.currency} />
            </div>
            <p className="text-xs text-muted-foreground">
              Amounts, notes and account names are hidden here. If you need them to solve a problem, open the full profile and reveal them with a reason.
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-info" /> What could be wrong</CardTitle>
            <CardDescription>Checked from their account, billing and access</CardDescription>
          </CardHeader>
          <CardContent><ul className="space-y-3">{findings.map((f) => <FindingRow key={f.id} f={f} />)}</ul></CardContent>
        </Card>

        <UserNotes userId={user.id} />
      </div>

      <ReplyComposer key={user.id} detail={detail} />
    </div>
  );
}

function ResultRow({ m, onPick }: { m: SupportMatch; onPick: () => void }) {
  const suspended = !!m.banned_until && new Date(m.banned_until) > new Date();
  return (
    <button type="button" onClick={onPick}
      className="flex w-full items-center gap-3 rounded-lg border border-border/30 bg-card/50 p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.display_name || "No name"}</p>
        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
      </div>
      <Badge variant="secondary" className="capitalize">{m.plan}</Badge>
      {suspended && <Badge className="border bg-destructive/10 text-destructive border-destructive/20">Suspended</Badge>}
      {!m.email_confirmed_at && <Badge variant="outline">Unconfirmed</Badge>}
    </button>
  );
}

export default function Support() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const userId = params.get("user");
  const [input, setInput] = useState(q);
  const lookup = useSupportLookup(q);

  const set = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) (v ? p.set(k, v) : p.delete(k));
    setParams(p);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    set({ q: input.trim() || null, user: null });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Support</h1>
        <p className="text-muted-foreground">Find someone, see what could be wrong, and reply. Nothing here lets you act as them.</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={input} onChange={(e) => setInput(e.target.value)} className="pl-9" aria-label="Find a person"
            placeholder="Email, name, account ID, or Paystack code (CUS_… / SUB_…)" />
        </div>
        <Button type="submit" disabled={input.trim().length < 3}>Find</Button>
      </form>

      {q && !userId && (
        <div className="space-y-2">
          {lookup.isLoading && <div className="h-20 shimmer rounded-lg" />}
          {lookup.error && <p className="text-sm text-destructive">{lookup.error.message}</p>}
          {lookup.data?.users.map((m) => <ResultRow key={m.id} m={m} onPick={() => set({ user: m.id })} />)}
          {lookup.data && lookup.data.users.length === 0 && (
            <p className="text-sm text-muted-foreground">No one matches "{q}". Try part of their email, or their account ID.</p>
          )}
          {lookup.data && lookup.data.total > lookup.data.users.length && (
            <p className="text-xs text-muted-foreground">Showing {lookup.data.users.length} of {lookup.data.total}. Add more of their email to narrow it down.</p>
          )}
        </div>
      )}

      {userId && (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => set({ user: null })}>{q ? "← Back to results" : "Clear"}</Button>
          <SupportView userId={userId} />
        </div>
      )}

      {!q && !userId && (
        <Card className="glass-card"><CardContent className="p-6 text-sm text-muted-foreground">
          Search by what the customer gave you: the email they wrote from, their name, an account ID, or a Paystack customer or subscription code from a receipt.
          Device lookups aren't possible because the apps don't record device IDs.
        </CardContent></Card>
      )}
    </div>
  );
}
