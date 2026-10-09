import { toast } from "sonner";
import { invokeAdmin } from "@/lib/adminApi";
import { toCsv } from "@/lib/csv";

/**
 * Downloads rows as CSV and records the export in the audit log.
 *
 * Exports contain personal data, so the download is only offered after the
 * server has accepted the audit entry; if it cannot be recorded the export is
 * refused rather than done silently.
 */
export function useExportCsv() {
  return async function exportCsv(options: {
    resource: string;
    filename: string;
    rows: Array<Record<string, unknown>>;
    columns?: string[];
    filters?: Record<string, unknown>;
  }) {
    const { resource, filename, rows, columns, filters } = options;
    if (rows.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    try {
      await invokeAdmin("admin-audit-log", {
        method: "POST",
        body: { event: "export", resource, count: rows.length, filters: filters ?? {} },
      });
    } catch (error) {
      toast.error(
        `Export not recorded, so it was cancelled: ${error instanceof Error ? error.message : "audit failed"}`,
      );
      return;
    }
    const blob = new Blob(["﻿" + toCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
}
