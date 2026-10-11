import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Flag as FlagIcon, Plus, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react";
import { useControlActions, useControls, type ControlsResponse } from "@/hooks/admin/useAdminControls";
import {
  PLATFORMS, STORE_PLATFORMS, buildPublicConfig, compareVersions,
  type Control, type Flag, type Platform, type StorePlatform,
} from "../../../supabase/functions/_shared/controlRules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReasonConfirmDialog } from "@/components/admin/ReasonConfirmDialog";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { cn } from "@/lib/utils";

const PLATFORM_LABEL: Record<Platform, string> = { ios: "iOS", android: "Android", web: "Web" };
const toLocal = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

// ---- banner ---------------------------------------------------------------------------------

function BannerCard({ c }: { c: Control }) {
  const { banner } = useControlActions();
  const [active, setActive] = useState(c.banner_active);
  const [kind, setKind] = useState(c.banner_kind);
  const [severity, setSeverity] = useState(c.banner_severity);
  const [message, setMessage] = useState(c.banner_message);
  const [starts, setStarts] = useState(toLocal(c.banner_starts_at));
  const [ends, setEnds] = useState(toLocal(c.banner_ends_at));
  const [asking, setAsking] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const changed = active !== c.banner_active || kind !== c.banner_kind || severity !== c.banner_severity || message !== c.banner_message
    || starts !== toLocal(c.banner_starts_at) || ends !== toLocal(c.banner_ends_at);
  const blocking = active && kind === "maintenance";

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Message to users {c.banner_active && <Badge>Live setting</Badge>}</CardTitle>
        <CardDescription>A note at the top of the apps, or a full "down for maintenance" screen. Apps pick up a change within about a minute of being opened.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Switch id="b-active" checked={active} onCheckedChange={setActive} />
          <Label htmlFor="b-active">Show it</Label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="banner">Banner: a note, the app still works</SelectItem>
                <SelectItem value="maintenance">Maintenance screen: the app is unusable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Importance</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Information</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="b-msg">Message</Label>
          <Textarea id="b-msg" rows={3} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. We are making improvements and will be back by 3pm UTC." />
          <p className="text-xs text-muted-foreground">{message.length} of 280 characters</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="b-start">Starts (optional)</Label><Input id="b-start" type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="b-end">Ends (optional)</Label><Input id="b-end" type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Times are in your local time. Leave "Ends" empty and remember to switch it off yourself.</p>
        <Button disabled={!changed} onClick={() => { setConfirm(false); setAsking(true); }}>Save message</Button>

        <ReasonConfirmDialog
          open={asking} onOpenChange={setAsking}
          title={blocking ? "Switch on the maintenance screen" : "Save the message"}
          description={blocking ? "Everyone who opens the app will see this and nothing else until you switch it off or it ends." : "This is recorded in the audit log."}
          reasonLabel="Why?" reasonPlaceholder="e.g. Database migration tonight" confirmLabel="Save" destructive={blocking} pending={banner.isPending}
          onConfirm={({ reason }) => banner.mutate(
            { active, kind, severity, message, startsAt: toIso(starts), endsAt: toIso(ends), reason, confirm: blocking ? confirm : undefined },
            { onSuccess: () => setAsking(false) },
          )}
        >
          {blocking && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <Checkbox id="b-confirm" checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} />
              <Label htmlFor="b-confirm" className="text-sm font-normal">I understand this stops everyone using the app.</Label>
            </div>
          )}
        </ReasonConfirmDialog>
      </CardContent>
    </Card>
  );
}

// ---- versions -------------------------------------------------------------------------------

function VersionsCard({ data }: { data: ControlsResponse }) {
  const { versions } = useControlActions();
  const c = data.control;
  const current = (p: StorePlatform) => ({ latest: c[`${p}_latest`] ?? "", min: c[`${p}_min`] ?? "", url: c[`${p}_store_url`] ?? "" });
  const [form, setForm] = useState<Record<StorePlatform, { latest: string; min: string; url: string }>>({ ios: current("ios"), android: current("android") });
  const [asking, setAsking] = useState<StorePlatform | null>(null);
  const [confirm, setConfirm] = useState(false);

  const raising = (p: StorePlatform) => !!form[p].min && (!current(p).min || (compareVersions(form[p].min, current(p).min) ?? 0) > 0);
  const dirty = (p: StorePlatform) => JSON.stringify(form[p]) !== JSON.stringify(current(p));
  const inUse = (p: StorePlatform) => data.versionsInUse.filter((v) => v.platform === p);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>App versions</CardTitle>
        <CardDescription>
          "Newest" is the version live in the store: apps older than it get a gentle "update available". "Oldest allowed" is a hard line: apps older than it must update before they can carry on.
          Only raise it when an old version is truly broken or unsafe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {STORE_PLATFORMS.map((p) => (
          <div key={p} className="space-y-3 rounded-lg border border-border/30 bg-card/50 p-4">
            <p className="font-medium">{PLATFORM_LABEL[p]}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1"><Label htmlFor={`${p}-latest`}>Newest in the store</Label><Input id={`${p}-latest`} placeholder="1.4.0" value={form[p].latest} onChange={(e) => setForm({ ...form, [p]: { ...form[p], latest: e.target.value } })} /></div>
              <div className="space-y-1"><Label htmlFor={`${p}-min`}>Oldest allowed</Label><Input id={`${p}-min`} placeholder="none" value={form[p].min} onChange={(e) => setForm({ ...form, [p]: { ...form[p], min: e.target.value } })} /></div>
              <div className="space-y-1"><Label htmlFor={`${p}-url`}>Store link</Label><Input id={`${p}-url`} placeholder="https://…" value={form[p].url} onChange={(e) => setForm({ ...form, [p]: { ...form[p], url: e.target.value } })} /></div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">In use in the last 30 days</p>
              {inUse(p).length === 0 ? (
                <p className="text-xs text-muted-foreground">Unknown. The apps do not report their version yet, so the panel cannot tell how many people a forced update would reach. The next app release should send <code>app_version</code> with its events.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {inUse(p).map((v) => <Badge key={v.version} variant="secondary">{v.version}: {v.users} {v.users === 1 ? "person" : "people"}</Badge>)}
                </div>
              )}
            </div>
            <Button size="sm" disabled={!dirty(p)} onClick={() => { setConfirm(false); setAsking(p); }}>Save {PLATFORM_LABEL[p]}</Button>
          </div>
        ))}

        <ReasonConfirmDialog
          open={!!asking} onOpenChange={(o) => !o && setAsking(null)}
          title={asking && raising(asking) ? "Raise the oldest allowed version" : "Save versions"}
          description={asking && raising(asking) ? "Everyone on an older version will be told to update before they can carry on." : "This is recorded in the audit log."}
          reasonLabel="Why?" reasonPlaceholder="e.g. 1.2.x has a bug that loses entries" confirmLabel="Save" destructive={!!asking && raising(asking)} pending={versions.isPending}
          onConfirm={({ reason }) => asking && versions.mutate(
            { platform: asking, latest: form[asking].latest, min: form[asking].min, storeUrl: form[asking].url, reason, confirm: raising(asking) ? confirm : undefined },
            { onSuccess: () => setAsking(null) },
          )}
        >
          {asking && raising(asking) && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <Checkbox id="v-confirm" checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} />
              <Label htmlFor="v-confirm" className="text-sm font-normal">I understand this forces people on older versions to update.</Label>
            </div>
          )}
        </ReasonConfirmDialog>
      </CardContent>
    </Card>
  );
}

// ---- flags ----------------------------------------------------------------------------------

const BLANK: Flag = { key: "", description: "", enabled: false, rollout_pct: 100, platforms: [...PLATFORMS], public: true };

function FlagDialog({ initial, isNew, onClose }: { initial: Flag | null; isNew: boolean; onClose: () => void }) {
  const { flag } = useControlActions();
  const [f, setF] = useState<Flag>(initial ?? BLANK);
  const [reason, setReason] = useState("");
  if (!initial) return null;
  const toggle = (p: Platform) => setF({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "New feature flag" : `Edit ${initial.key}`}</DialogTitle>
          <DialogDescription>A switch the apps can read. The app decides what it controls.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label htmlFor="f-key">Name</Label><Input id="f-key" disabled={!isNew} value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} placeholder="new_budget_screen" /><p className="text-xs text-muted-foreground">Lowercase letters, numbers and underscores. Can't be renamed later.</p></div>
          <div className="space-y-1"><Label htmlFor="f-desc">What it does</Label><Input id="f-desc" value={f.description} maxLength={200} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="flex items-center gap-2"><Switch id="f-on" checked={f.enabled} onCheckedChange={(v) => setF({ ...f, enabled: v })} /><Label htmlFor="f-on">On</Label></div>
          <div className="space-y-1">
            <Label htmlFor="f-pct">Roll out to {f.rollout_pct}% of people</Label>
            <input id="f-pct" type="range" min={0} max={100} step={5} value={f.rollout_pct} onChange={(e) => setF({ ...f, rollout_pct: Number(e.target.value) })} className="w-full" />
            <p className="text-xs text-muted-foreground">The same people stay in the group every time. A partial rollout needs the app to send a stable id; without one, nobody is included.</p>
          </div>
          <div className="space-y-2">
            <Label>Platforms</Label>
            <div className="flex gap-4">
              {PLATFORMS.map((p) => (
                <div key={p} className="flex items-center gap-2"><Checkbox id={`p-${p}`} checked={f.platforms.includes(p)} onCheckedChange={() => toggle(p)} /><Label htmlFor={`p-${p}`} className="font-normal">{PLATFORM_LABEL[p]}</Label></div>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="f-public" checked={f.public} onCheckedChange={(v) => setF({ ...f, public: v === true })} />
            <Label htmlFor="f-public" className="text-sm font-normal">Tell the apps about it. Untick to keep it private (nothing reads it yet).</Label>
          </div>
          <div className="space-y-1"><Label htmlFor="f-reason">Why this change?</Label><Input id="f-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Starting a 10% rollout" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={flag.isPending || reason.trim().length < 5}
            onClick={() => flag.mutate({ key: f.key, description: f.description, enabled: f.enabled, rolloutPct: f.rollout_pct, platforms: f.platforms, public: f.public, reason }, { onSuccess: onClose })}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FlagsCard({ flags }: { flags: Flag[] }) {
  const { deleteFlag } = useControlActions();
  const [editing, setEditing] = useState<{ flag: Flag; isNew: boolean } | null>(null);
  const [deleting, setDeleting] = useState<Flag | null>(null);
  return (
    <Card className="glass-card">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div><CardTitle className="flex items-center gap-2"><FlagIcon className="h-4 w-4" />Feature flags</CardTitle><CardDescription>Switch a feature on or off, or roll it out to a share of people, without a new release. The app has to be built to read the flag.</CardDescription></div>
        <Button size="sm" className="gap-2" onClick={() => setEditing({ flag: BLANK, isNew: true })}><Plus className="h-4 w-4" />New flag</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Flag</TableHead><TableHead>State</TableHead><TableHead>Rollout</TableHead><TableHead>Platforms</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {flags.map((f) => (
              <TableRow key={f.key}>
                <TableCell><p className="font-medium">{f.key}</p><p className="text-xs text-muted-foreground">{f.description}</p></TableCell>
                <TableCell>{f.enabled ? <Badge>On</Badge> : <Badge variant="outline">Off</Badge>}{!f.public && <Badge variant="secondary" className="ml-1">Private</Badge>}</TableCell>
                <TableCell>{f.rollout_pct}%</TableCell>
                <TableCell>{f.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ flag: f, isNew: false })}>Edit</Button>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${f.key}`} onClick={() => setDeleting(f)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {flags.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No flags yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      {editing && <FlagDialog key={editing.flag.key || "new"} initial={editing.flag} isNew={editing.isNew} onClose={() => setEditing(null)} />}
      <ReasonConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.key ?? ""}`} description="Apps that read this flag will see it as off. It can be created again later."
        reasonLabel="Why?" reasonPlaceholder="e.g. Feature shipped to everyone" confirmLabel="Delete" destructive pending={deleteFlag.isPending}
        onConfirm={({ reason }) => deleting && deleteFlag.mutate({ key: deleting.key, reason }, { onSuccess: () => setDeleting(null) })}
      />
    </Card>
  );
}

// ---- preview --------------------------------------------------------------------------------

function PreviewCard({ data }: { data: ControlsResponse }) {
  const [platform, setPlatform] = useState<Platform>("ios");
  const [version, setVersion] = useState("1.0.0");
  const [id, setId] = useState("sample-person");
  const config = useMemo(
    () => buildPublicConfig(data.control, data.flags, { platform, version: version || null, id: id || null }),
    [data, platform, version, id],
  );
  return (
    <Card className="glass-card">
      <CardHeader><CardTitle>What an app would be told</CardTitle><CardDescription>Try a platform, a version and a person. This is exactly what the apps get from the live service.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABEL[p]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label htmlFor="pv">App version</Label><Input id="pv" value={version} onChange={(e) => setVersion(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="pid">Person id</Label><Input id="pid" value={id} onChange={(e) => setId(e.target.value)} /></div>
        </div>
        <pre className={cn("max-h-72 overflow-auto rounded-lg border border-border/30 bg-card/50 p-3 text-xs")}>{JSON.stringify(config, null, 2)}</pre>
      </CardContent>
    </Card>
  );
}

export default function AppControls() {
  const { data, isLoading, error, refetch, isFetching } = useControls();
  if (error) return <div className="animate-fade-in"><AdminErrorState icon={SlidersHorizontal} title="Failed to load app controls" description={error.message} onRetry={() => refetch()} /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">App controls</h1>
          <p className="text-muted-foreground">A message for users, the oldest app version allowed, and feature flags. Read by the apps when they start.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 self-start" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />Refresh</Button>
      </div>
      <div className="rounded-lg border border-border/30 bg-card/50 p-3 text-sm">
        The apps do not read these settings yet. Nothing here affects anyone until an app release adds the check, so you can set things up safely now. If the service is ever unreachable, apps carry on as normal.
      </div>
      {isLoading || !data ? (
        <div className="space-y-4"><div className="h-56 shimmer rounded-xl" /><div className="h-64 shimmer rounded-xl" /></div>
      ) : (
        <>
          <BannerCard key={data.control.banner_message + String(data.control.banner_active)} c={data.control} />
          <VersionsCard key={JSON.stringify(data.control)} data={data} />
          <FlagsCard flags={data.flags} />
          <PreviewCard data={data} />
        </>
      )}
    </div>
  );
}
