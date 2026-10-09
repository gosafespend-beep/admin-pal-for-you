/**
 * CSV building for admin exports.
 *
 * Two properties the old per-page copies lacked:
 *  - quotes inside a value are doubled, so a name like `Jo "JJ" Doe` or a note
 *    containing a comma cannot shift columns;
 *  - text that a spreadsheet would execute as a formula (`=`, `+`, `-`, `@`,
 *    tab, carriage return) is prefixed with an apostrophe. Notes and display
 *    names are user-controlled, so an export is otherwise a way to plant a
 *    formula in an admin's spreadsheet. Real numbers are left alone so that
 *    negative amounts stay numeric.
 */

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text: string;
  if (typeof value === "number" || typeof value === "boolean") {
    text = String(value);
  } else if (typeof value === "object") {
    text = JSON.stringify(value);
    if (FORMULA_TRIGGER.test(text)) text = `'${text}`;
  } else {
    text = String(value);
    if (FORMULA_TRIGGER.test(text)) text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return "";
  const headers = columns ?? Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  return lines.join("\r\n");
}
