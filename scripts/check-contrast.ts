// Every palette × scheme × surface must keep text at WCAG AA. Run after
// touching palettes.ts or derive.ts: npm run check:contrast
import { deriveVars } from "../web/src/ds/theme/derive.ts";
import { contrast } from "../web/src/ds/theme/color.ts";
import { PALETTES } from "../web/src/ds/theme/palettes.ts";
const checks: [string, string, string][] = [["fg", "--fg", "--bg-base"], ["subtle", "--fg-subtle", "--bg-base"], ["muted", "--fg-muted", "--bg-base"], ["on-accent", "--on-accent", "--accent"], ["on-primary", "--on-primary", "--primary"], ["accent-text", "--accent", "--bg-base"], ["warning", "--warning", "--bg-base"], ["success", "--success", "--bg-base"], ["danger", "--danger", "--bg-base"]];
let fails = 0;
for (const p of Object.keys(PALETTES) as any[]) for (const s of ["light", "dark"] as const) for (const surf of ["page", "subtle", "inverse", "accent"] as const) {
  const v = deriveVars(p, s, surf);
  const bad = checks.map(([n, a, b]) => [n, contrast(v[a], v[b])] as const).filter(([n, c]) => c < (n === "accent-text" ? 3 : 4.5));
  if (bad.length) { fails += bad.length; console.log(`${p}/${s}/${surf}: ` + bad.map(([n, c]) => `${n}=${c.toFixed(2)}`).join(" ")); }
}
console.log(fails ? `${fails} failing pairs` : "all palettes pass");
process.exit(fails ? 1 : 0);
