import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const MIN_REASON_LENGTH = 10;

interface ReasonConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** When set, the admin must type this exact value (compared case-insensitively) before confirming. */
  typedConfirmation?: { value: string; label: string };
  /** Extra controls rendered above the reason, e.g. a suspension length. */
  children?: ReactNode;
  pending?: boolean;
  onConfirm: (result: { reason: string; typed: string }) => void;
}

/**
 * Every action that changes access, money or personal data goes through this:
 * a written reason (stored in the audit log) and, for irreversible actions,
 * retyping the thing being affected. The server enforces the same rules; this
 * only keeps the admin from sending a request that is certain to be refused.
 */
export function ReasonConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  typedConfirmation,
  children,
  pending,
  onConfirm,
}: ReasonConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
      setTyped("");
    }
  }, [open]);

  const reasonOk = reason.trim().length >= MIN_REASON_LENGTH;
  const typedOk = !typedConfirmation || typed.trim().toLowerCase() === typedConfirmation.value.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {children}

          <div className="space-y-2">
            <Label htmlFor="action-reason">Reason (recorded in the audit log)</Label>
            <Textarea
              id="action-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Why is this being done?"
            />
            <p className="text-xs text-muted-foreground">
              {reasonOk ? " " : `At least ${MIN_REASON_LENGTH} characters (${reason.trim().length}/${MIN_REASON_LENGTH})`}
            </p>
          </div>

          {typedConfirmation && (
            <div className="space-y-2">
              <Label htmlFor="action-typed">{typedConfirmation.label}</Label>
              <Input
                id="action-typed"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                placeholder={typedConfirmation.value}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!reasonOk || !typedOk || pending}
            onClick={() => onConfirm({ reason: reason.trim(), typed: typed.trim() })}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
