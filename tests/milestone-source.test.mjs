import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (name) => readFile(new URL(`contracts/${name}`, root), "utf8");

test("the original Episode contract is not imported or edited by companion contracts", async () => {
  const files = await Promise.all([
    source("episode_truth.py"), source("episode_policy_guard.py"),
    source("episode_integrity_graph.py"), source("episode_capital_pool.py"),
  ]);
  for (const text of files) {
    assert.match(text, /^# \{/);
    assert.doesNotMatch(text, /from\s+episode\s+import|import\s+episode/);
  }
});

test("all four companion contract surfaces are present", async () => {
  const expected = {
    "episode_truth.py": ["configure_policy", "resolve", "finding", "policy"],
    "episode_policy_guard.py": ["review", "review_of"],
    "episode_integrity_graph.py": ["index_filing", "signal", "threshold"],
    "episode_capital_pool.py": ["open_pool", "settle_supplement", "withdraw", "pool"],
  };
  for (const [file, methods] of Object.entries(expected)) {
    const text = await source(file);
    for (const method of methods) assert.match(text, new RegExp(`def ${method}\\(`));
  }
});

test("the supplemental pool cannot settle without all additive gates", async () => {
  const text = await source("episode_capital_pool.py");
  for (const gate of ["episode-finality", "truth", "integrity", "policy", "self.settled[key] = True"]) {
    assert.ok(text.includes(gate), `missing settlement guard: ${gate}`);
  }
  assert.match(text, /Payee\(Address\(who\)\)\.emit_transfer/);
});
