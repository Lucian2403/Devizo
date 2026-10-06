import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../components/ui/button";
import { startsInAppNavigation } from "../lib/ui/navigation";
import {
  isProgressActive,
  startProgress,
  subscribeProgress,
} from "../lib/ui/progress";
import {
  canUsePreparedStatements,
  preferPreparedStatements,
} from "../infrastructure/db/prepared-statements";

// --- progress store: overlapping work, idempotent finish, subscriptions ------
{
  assert.equal(isProgressActive(), false);

  let notifications = 0;
  const unsubscribe = subscribeProgress(() => {
    notifications += 1;
  });

  const finishA = startProgress();
  const finishB = startProgress();
  assert.equal(isProgressActive(), true);

  finishA();
  assert.equal(
    isProgressActive(),
    true,
    "one finished action must not hide the bar while another is running",
  );

  finishA();
  assert.equal(isProgressActive(), true, "finishing twice must not double-count");

  finishB();
  assert.equal(isProgressActive(), false);
  assert.equal(notifications, 4, "start x2 + one real finish x2");

  unsubscribe();
  startProgress()();
  assert.equal(notifications, 4, "unsubscribed listeners are not called");
}

// --- DB client: prepared statements only where the pooler supports them -----
{
  assert.equal(
    canUsePreparedStatements("postgresql://u:p@host.pooler.supabase.com:5432/postgres"),
    true,
    "session pooler",
  );
  assert.equal(
    canUsePreparedStatements("postgresql://u:p@db.example.supabase.co:5432/postgres"),
    true,
    "direct connection",
  );
  assert.equal(
    canUsePreparedStatements("postgresql://u:p@host.pooler.supabase.com:6543/postgres"),
    false,
    "transaction pooler cannot keep prepared statements",
  );
  assert.equal(canUsePreparedStatements("not a url"), false);

  const unsafeCalls: unknown[][] = [];
  const beginCalls: unknown[][] = [];
  const makeFake = () => {
    const fake = {
      unsafe: (...args: unknown[]) => {
        unsafeCalls.push(args);
        return "result";
      },
      begin: (...args: unknown[]) => {
        beginCalls.push(args);
        const callback = args.find((arg) => typeof arg === "function") as (
          tx: unknown,
        ) => unknown;
        return callback(makeFake());
      },
    };
    return fake;
  };

  const client = makeFake();
  preferPreparedStatements(client as never);

  client.unsafe("select $1", [1]);
  assert.deepEqual(unsafeCalls[0], ["select $1", [1], { prepare: true }]);

  client.unsafe("select 1");
  assert.deepEqual(unsafeCalls[1], ["select 1", [], { prepare: true }]);

  client.unsafe("select $1", [1], { prepare: false });
  assert.deepEqual(
    unsafeCalls[2],
    ["select $1", [1], { prepare: false }],
    "an explicit per-call option still wins",
  );

  // Inside a transaction Drizzle uses the handle passed to the callback.
  client.begin((tx: ReturnType<typeof makeFake>) => {
    tx.unsafe("insert $1", [2]);
    return null;
  });
  assert.deepEqual(unsafeCalls[3], ["insert $1", [2], { prepare: true }]);

  // begin(options, callback) keeps working too.
  client.begin("isolation level serializable", (tx: ReturnType<typeof makeFake>) => {
    tx.unsafe("update $1", [3]);
    return null;
  });
  assert.equal(beginCalls[1]?.[0], "isolation level serializable");
  assert.deepEqual(unsafeCalls[4], ["update $1", [3], { prepare: true }]);
}

// --- which clicks start an in-app navigation (drives the top bar) ----------
{
  const here = {
    href: "http://localhost:4000/projects?x=1",
    origin: "http://localhost:4000",
    pathname: "/projects",
    search: "?x=1",
  };
  const click = (overrides: Partial<Parameters<typeof startsInAppNavigation>[0]> = {}) => ({
    defaultPrevented: true,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  });
  const link = (href: string, overrides = {}) => ({
    href,
    target: "",
    hasDownload: false,
    ...overrides,
  });

  assert.equal(startsInAppNavigation(click(), link("/catalog"), here), true);
  assert.equal(
    startsInAppNavigation(click(), link("http://localhost:4000/catalog"), here),
    true,
    "absolute same-origin URL",
  );
  assert.equal(
    startsInAppNavigation(click(), link("/projects?view=confirmed"), here),
    true,
    "same path, different query is a real navigation",
  );
  assert.equal(startsInAppNavigation(click(), link("/projects?x=1"), here), false, "same page");
  assert.equal(startsInAppNavigation(click(), link("/projects?x=1#top"), here), false, "hash only");
  assert.equal(
    startsInAppNavigation(click({ defaultPrevented: false }), link("/catalog"), here),
    false,
    "Next did not handle it as a client navigation",
  );
  assert.equal(startsInAppNavigation(click({ button: 1 }), link("/catalog"), here), false, "middle click");
  for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
    assert.equal(startsInAppNavigation(click({ [key]: true }), link("/catalog"), here), false, key);
  }
  assert.equal(startsInAppNavigation(click(), link("/catalog", { target: "_blank" }), here), false, "new tab");
  assert.equal(startsInAppNavigation(click(), link("/catalog", { target: "_self" }), here), true);
  assert.equal(startsInAppNavigation(click(), link("/file.pdf", { hasDownload: true }), here), false, "download");
  assert.equal(startsInAppNavigation(click(), link("https://example.com/x"), here), false, "other site");
  assert.equal(startsInAppNavigation(click(), link("http://[bad"), here), false, "unparseable URL");
}

// --- Button loading state: visible spinner, disabled, announced as busy ------
{
  const idle = renderToStaticMarkup(createElement(Button, null, "Save"));
  assert.ok(!idle.includes('role="status"'), "no spinner when idle");
  assert.ok(!idle.includes('disabled=""'), "not disabled when idle");
  assert.ok(!idle.includes("aria-busy"));

  const busy = renderToStaticMarkup(createElement(Button, { loading: true }, "Save"));
  assert.ok(busy.includes('role="status"'), "spinner while loading");
  assert.ok(busy.includes('disabled=""'), "cannot be double-clicked while loading");
  assert.ok(busy.includes('aria-busy="true"'));
  assert.ok(busy.includes("Save"), "label stays visible");

  const stillDisabled = renderToStaticMarkup(
    createElement(Button, { disabled: true }, "Save"),
  );
  assert.ok(stillDisabled.includes('disabled=""') && !stillDisabled.includes("aria-busy"));

  // asChild renders the child element (a link) and never injects a spinner.
  const asLink = renderToStaticMarkup(
    createElement(
      Button,
      { asChild: true, loading: true },
      createElement("a", { href: "/x" }, "Open"),
    ),
  );
  assert.ok(asLink.startsWith("<a ") && !asLink.includes("<button"));
}
// --- every submit button must give feedback ---------------------------------
// Plain <Button type="submit"> and <button type="submit"> do nothing while the
// action runs. SubmitButton shows a spinner, a pending label and the top bar.
{
  const offenders: string[] = [];
  const pattern = /<(?:Button|button)\b[^>]*\btype="submit"[^>]*>/gs;

  function scan(directory: string) {
    for (const name of readdirSync(directory)) {
      const fullPath = join(directory, name);
      if (statSync(fullPath).isDirectory()) {
        scan(fullPath);
        continue;
      }
      if (!fullPath.endsWith(".tsx")) continue;

      const source = readFileSync(fullPath, "utf8");
      for (const match of source.matchAll(pattern)) {
        const line = source.slice(0, match.index).split(/\r?\n/).length;
        offenders.push(`${fullPath}:${line}`);
      }
    }
  }

  scan(join(process.cwd(), "app"));
  assert.deepEqual(
    offenders,
    [],
    `Use <SubmitButton> instead of a plain submit button:\n${offenders.join("\n")}`,
  );
}

console.log("UI responsiveness checks passed.");
