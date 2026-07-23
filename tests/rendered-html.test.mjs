import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the MyAi application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ja"/i);
  assert.match(html, /<title>MyAi — Today execution system<\/title>/i);
  assert.match(html, /restoring local agent state/);
  assert.match(html, /MyAiApp-/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the complete local-first interaction contract", async () => {
  const [app, css, tokens, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/MyAiApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../tokens.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(app, /localStorage\.setItem/);
  assert.match(app, /localDateKey/);
  assert.match(app, /startTask/);
  assert.match(app, /pauseTask/);
  assert.match(app, /completeTask/);
  assert.match(app, /addLog/);
  assert.match(app, /updateLogStatus/);
  assert.match(app, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(app, /event\.code === "Space"/);
  assert.match(app, /event\.shiftKey && event\.key === "Enter"/);

  assert.match(css, /Hallmark · genre: atmospheric · macrostructure: Workbench/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media \(min-width: 40rem\)/);
  assert.match(css, /@media \(min-width: 68rem\)/);
  assert.match(tokens, /--color-accent:\s*oklch/);
  assert.match(tokens, /\[data-theme="light"\]/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});
