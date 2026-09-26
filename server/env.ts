// Load .env before anything reads process.env (imported first in index.ts;
// ES modules run in import order). Values already set in the shell win, so
// `SHOP_STATS_KEY=x npm run dev` and the cloud environment still override.
// No more `export $(grep … .env | xargs)` before starting.
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

if (existsSync(".env")) {
  for (const [k, v] of Object.entries(parseEnv(readFileSync(".env", "utf8")))) {
    if (process.env[k] === undefined || process.env[k] === "") process.env[k] = v;
  }
}
