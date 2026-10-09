import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("doubles embedded quotes and keeps commas inside the cell", () => {
    expect(csvCell('Jo "JJ" Doe, Esq.')).toBe('"Jo ""JJ"" Doe, Esq."');
  });

  it("neutralises spreadsheet formulas in text", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+1555")).toBe('"\'+1555"');
    expect(csvCell("-2+3")).toBe('"\'-2+3"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
  });

  it("leaves real numbers alone so negatives stay numeric", () => {
    expect(csvCell(-1500.5)).toBe('"-1500.5"');
  });

  it("renders null and undefined as empty", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});

describe("toCsv", () => {
  it("writes a header row and one line per record", () => {
    const out = toCsv([{ a: 1, b: "x" }, { a: 2, b: "y" }], ["a", "b"]);
    expect(out.split("\r\n")).toEqual(['"a","b"', '"1","x"', '"2","y"']);
  });

  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
