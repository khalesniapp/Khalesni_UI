#!/usr/bin/env node
/**
 * Vitest launcher that works on Node 22.11.
 *
 * jsdom 29 pulls in `html-encoding-sniffer@6`, which `require()`s an ESM-only
 * package. Node supports that unflagged only from 22.12; this machine runs
 * 22.11 (CLAUDE.md, Phase 0 note 4), so without the flag every test file fails
 * to start with ERR_REQUIRE_ESM before a single assertion runs.
 *
 * `NODE_OPTIONS` rather than `execArgv`, because the flag has to reach the pool
 * workers too, and NODE_OPTIONS is what child processes inherit. A plain
 * `NODE_OPTIONS=… vitest` in package.json would not run on Windows, hence this
 * script instead of a one-liner or a `cross-env` dependency.
 *
 * Delete this the day the project's Node floor is 22.12 or newer, and point the
 * npm scripts back at `vitest` directly.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
// `vitest/vitest.mjs` is not an export of the package, so resolve the package
// root through its manifest and join the bin path by hand.
const vitestBin = path.join(
  path.dirname(require.resolve("vitest/package.json")),
  "vitest.mjs",
);

const FLAG = "--experimental-require-module";
const existing = process.env.NODE_OPTIONS ?? "";

const child = spawn(
  process.execPath,
  [vitestBin, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: existing.includes(FLAG) ? existing : `${existing} ${FLAG}`.trim(),
      // The flag prints an ExperimentalWarning per worker, which buries the
      // actual test output. The behaviour is not experimental on 22.12+.
      NODE_NO_WARNINGS: "1",
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
