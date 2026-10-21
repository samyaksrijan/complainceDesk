import { expect, it } from "vitest"
import { csvCell } from "@/lib/csv"
it("quotes commas, newlines and quotes in exported audit fields", () => expect(csvCell('Policy, "annual"\nreview')).toBe('"Policy, ""annual""\nreview"'))
it("neutralizes spreadsheet formulas from user-provided resource names", () => expect(csvCell('=HYPERLINK("https://example.com")')).toBe('"\'=HYPERLINK(""https://example.com"")"'))
