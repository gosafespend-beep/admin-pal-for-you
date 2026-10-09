import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, Check, Circle, Download, FilePlus2, RefreshCw, ShieldCheck } from "lucide-react";
import {
  useCreateDataRequest, useDataRequest, useDataRequestAction, useDataRequests, useHeldReport,
  type DataRequest, type RequestType, type UserDataExport,
} from "@/hooks/admin/useAdminDataRequests";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReasonConfirmDialog } from "@/components/admin/ReasonConfirmDialog";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<RequestType, string> = {
  export: "Copy of my data", delete: "Delete my data", rectify: "Correct my data", opt_out: "Stop marketing", other: "Other",
};

function DueBadge({ r }: { r: DataRequest }) {
  const { tone, days } = r.due;
  if (tone === "closed") return <Badge variant="secondary" className="capitalize">{r.status.replace("_", " ")}</Badge>;
  const text = tone === "overdue" ? `${days} day${days === 1 ? "" : "s"} overdue` : `${days} day${days === 1 ? "" : "s"} left`;
  const style =
    tone === "overdue" ? "bg-destructive/10 text-destructive border-destructive/20"
    : tone === "soon" ? "bg-warning/10 text-warning border-warning/20"
    : "bg-primary/10 text-primary border-primary/20";
  return <Badge className={cn("border", style)}>{text}</Badge>;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Step({ done, title, detail, children }: { done: boolean; title: string; detail?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      {done ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />}
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", !done && "text-muted-foreground")}>{title}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
}

function NewRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateDataRequest();
  const [type, setType] = useState<RequestType>("export");
  const [email, setEmail] = useState("");
  const [received, setReceived] = useState("");
  const [days, setDays] = useState("30");

  const submit = () =>
    create.mutate(
      { type, requesterEmail: email, receivedAt: received || undefined, dueDays: Number(days) },
      { onSuccess: () => { onOpenChange(false); setEmail(""); setReceived(""); setDays("30"); } },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a data request</DialogTitle>
          <DialogDescription>Someone asked you for something about their data, usually by email. Log it so the clock is tracked.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>What are they asking for?</Label>
            <Select value={type} onValueChange={(v) => setType(v as RequestType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABEL) as RequestType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dr-email">Their email address</Label>
            <Input id="dr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dr-received">Received on</Label>
              <Input id="dr-received" type="date" value={received} onChange={(e) => setReceived(e.target.value)} />
              <p className="text-xs text-muted-foreground">Blank means today</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dr-days">Answer within (days)</Label>
              <Input id="dr-days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} />
              <p className="text-xs text-muted-foreground">30 is a common default; check what applies to them</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending || !email.includes("@")}>Log request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading, error } = useDataRequest(id);
  const act = useDataRequestAction();
  const [dialog, setDialog] = useState<null | "verify" | "complete" | "reject" | "export">(null);
  const r = data?.request;

  const run = (action: "verify" | "export" | "complete" | "reject", extra: { note?: string; resolution?: string } = {}) => {
    if (!r) return;
    act.mutate(
      { id: r.id, action, ...extra },
      {
        onSuccess: (res) => {
          setDialog(null);
          if (action === "export" && res.export) {
            const ex: UserDataExport = res.export;
            downloadJson(`safespend-data-${format(new Date(), "yyyy-MM-dd")}.json`, ex);
          }
        },
      },
    );
  };

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {isLoading || !r ? (
          <div className="space-y-3 pt-8">{error ? <p className="text-sm text-destructive">{error.message}</p> : [1, 2, 3].map((i) => <div key={i} className="h-16 shimmer rounded-lg" />)}</div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{TYPE_LABEL[r.request_type]}</SheetTitle>
              <SheetDescription>{r.requester_email} · received {format(new Date(r.received_at), "MMM d, yyyy")} by {r.channel}</SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex items-center gap-2"><DueBadge r={r} /><span className="text-xs text-muted-foreground">due {format(new Date(r.due_at), "MMM d, yyyy")}</span></div>

            <Card className="glass-card mt-4">
              <CardContent className="p-4 text-sm">
                {data!.subject?.exists ? (
                  <>Matching account: <Link className="text-primary hover:underline" to={`/users/${r.subject_user_id}`}>{data!.subject.email}</Link></>
                ) : r.subject_user_id ? (
                  <span className="text-muted-foreground">The matching account no longer exists.</span>
                ) : (
                  <span className="text-muted-foreground">No account matched this email when it was logged. They may have used a different address.</span>
                )}
              </CardContent>
            </Card>

            <ol className="mt-6 space-y-5">
              <Step done title="Received" detail={format(new Date(r.received_at), "MMM d, yyyy HH:mm")} />
              <Step
                done={!!r.identity_verified_at}
                title="Confirm it's really them"
                detail={r.identity_verified_at ? `${format(new Date(r.identity_verified_at), "MMM d, yyyy")}: ${r.verification_note}` : "Before sending or deleting anything, check the request came from the account owner."}
              >
                {!r.identity_verified_at && r.status !== "completed" && r.status !== "rejected" && (
                  <Button size="sm" variant="outline" onClick={() => setDialog("verify")}><ShieldCheck className="mr-2 h-4 w-4" />Record verification</Button>
                )}
              </Step>

              {r.request_type === "export" && (
                <Step
                  done={!!r.export_generated_at}
                  title="Generate their data export"
                  detail={r.export_generated_at ? `Generated ${format(new Date(r.export_generated_at), "MMM d, yyyy HH:mm")}` : "Downloads a JSON file of everything held on their account."}
                >
                  {r.identity_verified_at && r.status === "in_progress" && data!.subject?.exists && (
                    <Button size="sm" variant="outline" onClick={() => setDialog("export")}><Download className="mr-2 h-4 w-4" />{r.export_generated_at ? "Generate again" : "Generate and download"}</Button>
                  )}
                </Step>
              )}

              {r.request_type === "delete" && (
                <Step done={!data!.subject?.exists && !!r.subject_user_id} title="Delete the account" detail="Done from the user's own page (it asks for a reason and the email typed back).">
                  {data!.deletionPreview.length > 0 && (
                    <div className="rounded-lg border border-border/30 bg-card/50 p-3 text-xs">
                      <p className="mb-1 font-medium text-foreground">Deleting would remove or anonymise:</p>
                      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                        {data!.deletionPreview.map((p) => (
                          <li key={p.table_name}>{p.table_name.replace(/_/g, " ")}: {p.rows_affected}{p.action.includes("anonymise") ? " (anonymised)" : ""}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data!.subject?.exists && <Button asChild size="sm" variant="outline" className="mt-2"><Link to={`/users/${r.subject_user_id}`}>Open the user</Link></Button>}
                </Step>
              )}

              {(r.request_type === "rectify" || r.request_type === "opt_out" || r.request_type === "other") && (
                <Step done={r.status === "completed"} title="Do what they asked" detail={r.request_type === "opt_out" ? "Turn off their marketing emails from their account." : "Make the change, then describe it when you close the request."} />
              )}

              <Step done={r.status === "completed"} title={r.status === "rejected" ? "Refused" : "Closed"} detail={r.resolution ?? undefined}>
                {(r.status === "received" || r.status === "in_progress") && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setDialog("complete")}>Mark complete</Button>
                    <Button size="sm" variant="outline" onClick={() => setDialog("reject")}>Refuse</Button>
                  </div>
                )}
              </Step>
            </ol>

            <ReasonConfirmDialog
              open={dialog === "verify"} onOpenChange={(o) => !o && setDialog(null)}
              title="Record identity check" description="This is written to the audit log."
              reasonLabel="How did you confirm it's them?" reasonPlaceholder="e.g. They replied from the email on the account"
              confirmLabel="Record" pending={act.isPending}
              onConfirm={({ reason }) => run("verify", { note: reason })}
            />
            <ReasonConfirmDialog
              open={dialog === "complete"} onOpenChange={(o) => !o && setDialog(null)}
              title="Close this request" description="Say what was done. It stays on the record."
              reasonLabel="What was done?" reasonPlaceholder="e.g. Export emailed to the verified address"
              confirmLabel="Mark complete" pending={act.isPending}
              onConfirm={({ reason }) => run("complete", { resolution: reason })}
            />
            <ReasonConfirmDialog
              open={dialog === "reject"} onOpenChange={(o) => !o && setDialog(null)}
              title="Refuse this request" description="Give the reason. It is recorded and can be shown to the person."
              reasonLabel="Why is it being refused?" reasonPlaceholder="e.g. Could not verify the requester"
              confirmLabel="Refuse" destructive pending={act.isPending}
              onConfirm={({ reason }) => run("reject", { resolution: reason })}
            />
            <Dialog open={dialog === "export"} onOpenChange={(o) => !o && setDialog(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate their data export</DialogTitle>
                  <DialogDescription>
                    The file contains their personal and financial data. Send it only to the verified email address, over a secure channel, and delete your copy afterwards. The audit log records that you generated it, never the contents.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                  <Button onClick={() => run("export")} disabled={act.isPending}>Generate and download</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function HeldTab() {
  const { data, isLoading, error } = useHeldReport(true);
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (isLoading || !data) return <div className="h-40 shimmer rounded-xl" />;
  const c = data.consent;
  const nothingSaved = c.accounts > 0 && c.noPreferenceSaved / c.accounts > 0.5;
  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Marketing email consent</CardTitle>
          <CardDescription>What accounts have chosen about marketing emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[["Opted in", c.marketingOn], ["Opted out", c.marketingOff], ["No choice saved", c.noPreferenceSaved]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg border border-border/30 bg-card/50 p-3">
                <p className="text-2xl font-bold">{v as number}</p><p className="text-xs text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
          {nothingSaved && (
            <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p>
                {c.noPreferenceSaved} of {c.accounts} accounts have no saved marketing choice. If marketing email goes to everyone by default,
                there is no record that these people agreed to it. Worth checking against your privacy policy and the law that applies to your users.
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Also on file: {c.waitlist} waitlist sign-ups and {c.ebookLeads} ebook leads, who joined separately from accounts.</p>
        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle>What we hold</CardTitle>
          <CardDescription>Row counts and the oldest record in each place personal data lives. Nothing on this page deletes anything.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/30"><TableHead>Table</TableHead><TableHead className="text-right">Rows</TableHead><TableHead className="text-right">Oldest record</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {data.retention.filter((t) => t.rows > 0).map((t) => (
                <TableRow key={t.table} className="border-border/30">
                  <TableCell className="font-medium">{t.table.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-right">{t.rows}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{t.oldest ? format(new Date(t.oldest), "MMM d, yyyy") : "n/a"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DataRequests() {
  const [status, setStatus] = useState("open");
  const [type, setType] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState("requests");
  const { data, isLoading, error, refetch, isFetching } = useDataRequests(status, type);

  if (error) {
    return <div className="animate-fade-in"><AdminErrorState icon={ShieldCheck} title="Failed to load data requests" description={error.message} onRetry={() => refetch()} /></div>;
  }
  const s = data?.stats;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Data requests</h1>
          <p className="text-muted-foreground">People asking for a copy of their data, deletion, correction, or to stop marketing.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />Refresh</Button>
          <Button size="sm" className="gap-2" onClick={() => setCreating(true)}><FilePlus2 className="h-4 w-4" />Log a request</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="requests" className="data-[state=active]:bg-background">Requests</TabsTrigger>
          <TabsTrigger value="held" className="data-[state=active]:bg-background">What we hold</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["Open", s?.open, ""], ["Overdue", s?.overdue, (s?.overdue ?? 0) > 0 ? "text-destructive" : ""],
              ["Due within 7 days", s?.dueSoon, (s?.dueSoon ?? 0) > 0 ? "text-warning" : ""], ["Closed, last 90 days", s?.closedLast90Days, ""],
            ].map(([label, value, tone]) => (
              <Card key={label as string} className="glass-card"><CardContent className="p-4">
                <p className={cn("text-3xl font-bold", tone as string)}>{(value as number | undefined) ?? "–"}</p>
                <p className="text-sm text-muted-foreground">{label as string}</p>
              </CardContent></Card>
            ))}
          </div>

          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle>Queue</CardTitle>
                <div className="flex gap-2">
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-[130px] bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem><SelectItem value="closed">Closed</SelectItem><SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-[170px] bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any type</SelectItem>
                      {(Object.keys(TYPE_LABEL) as RequestType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 shimmer rounded" />)}</div>
              ) : data!.requests.length === 0 ? (
                <div className="py-12 text-center">
                  <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    {status === "open" ? "No open requests. When someone emails asking for their data, log it here so the clock is tracked." : "Nothing here."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead>Requester</TableHead><TableHead>Request</TableHead><TableHead>Received</TableHead><TableHead>Due</TableHead><TableHead>Account</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.requests.map((r) => (
                      <TableRow key={r.id} className="cursor-pointer border-border/30 hover:bg-card/50" onClick={() => setOpenId(r.id)}>
                        <TableCell className="font-medium break-all">{r.requester_email}</TableCell>
                        <TableCell>{TYPE_LABEL[r.request_type]}</TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(r.received_at), "MMM d, yyyy")}</TableCell>
                        <TableCell><DueBadge r={r} /></TableCell>
                        <TableCell className="text-muted-foreground">{r.subject_user_id ? "matched" : "none"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="held">{tab === "held" && <HeldTab />}</TabsContent>
      </Tabs>

      <NewRequestDialog open={creating} onOpenChange={setCreating} />
      <RequestSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
