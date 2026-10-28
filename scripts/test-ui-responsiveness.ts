import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../components/ui/button";
import { formatRomanianDecimal } from "../lib/ui/decimal-display";
import { DateInput } from "../components/ui/date-input";
import { dateInputError, formatDate, parseDateInput } from "../lib/ui/date-display";
import { NormativeCosts } from "../app/(app)/professional-estimates/[calculationContextId]/normative-costs";
import type { ProcurementStorageResult } from "../domain/professional-estimates/calculation/procurement-storage";
import type { ProfessionalEstimateWorkspace } from "../domain/professional-estimates/professional-estimate-workspace.repository";
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

{
  const nav = readFileSync(join(process.cwd(), "app", "(app)", "main-nav.tsx"), "utf8");
  const workspacePage = readFileSync(join(process.cwd(), "app", "(app)",
    "professional-estimates", "page.tsx"), "utf8");
  for (const [href, label] of [
    ["/professional-estimates/new", "Deviz profesional nou"],
    ["/professional-estimates/object-estimates", "Devize pe obiect"],
    ["/professional-estimates/general-estimates", "Devize generale"],
    ["/professional-estimates/norms", "Biblioteca de norme"],
    ["/professional-estimates/resources", "Resurse și prețuri"],
    ["/professional-estimates/rules", "Reguli de calcul"],
  ]) {
    assert.ok(nav.includes(`href: "${href}"`), `Header shortcut: ${href}`);
    assert.ok(nav.includes(`label: "${label}"`), `Header label: ${label}`);
    assert.ok(workspacePage.includes(`href="${href}"`), `Keep page shortcut: ${href}`);
  }
  assert.ok(nav.includes("onMouseEnter={open}"), "Hover opens the shortcuts");
  assert.ok(nav.includes('aria-expanded={position !== null}'), "Expose the toggle state");
  assert.ok(nav.includes('event.key === "Escape"'), "Escape dismisses the dropdown");
  assert.ok(nav.includes('event.key === "Tab"'), "Keyboard can enter the portaled links");
  assert.ok(nav.includes("createPortal("), "Horizontal header scrolling must not clip the dropdown");
  assert.ok(nav.includes('href="/professional-estimates"'), "Devize still links to the workspace");
}

{
  const forms = readFileSync(join(process.cwd(), "app", "(app)",
    "professional-estimates", "semantics-forms.tsx"), "utf8");
  const contextForm = forms.slice(forms.indexOf("export function CalculationContextForm"));
  assert.ok(contextForm.includes('key={`${context.estimatePerspective ?? ""}:${context.workKind ?? ""}`}'),
    "Persisted perspective/workKind changes must remount uncontrolled controls after server actions");
  assert.ok(contextForm.includes('defaultValue={context.estimatePerspective ?? ""}'));
  assert.ok(contextForm.includes('defaultValue={context.workKind ?? ""}'));
  assert.ok(contextForm.includes("<Message state={state} />"));
}

{
  const forms = readFileSync(join(process.cwd(), "app", "(app)",
    "professional-estimates", "general-estimates", "general-estimate-forms.tsx"), "utf8");
  const controls = forms.slice(forms.indexOf("export function GeneralEstimateEntryControls"));
  assert.match(controls, /<form\s+key=\{`\$\{entry\.id\}:\$\{entry\.chapterNumber\}`\}\s+action=\{formAction\}/,
    "Persisted chapter changes (2 -> 7 -> 2) must remount the uncontrolled chapter form");
  assert.ok(controls.includes('defaultValue={String(entry.chapterNumber)}'),
    "The persisted server chapter must determine the visible selection");
  assert.ok(!controls.includes("useState"),
    "Client state must not become authoritative for the persisted chapter");
}

{
  const forms = readFileSync(join(process.cwd(), "app", "(app)",
    "professional-estimates", "general-estimates", "winter-conditions-forms.tsx"), "utf8");
  const winterDecision = forms.slice(forms.indexOf("export function WinterDecisionForm"));
  assert.ok(winterDecision.includes("onSubmit={submitWithoutReset}"),
    "Winter decisions must prevent native form reset after rejected saves");
  assert.ok(winterDecision.includes("event.preventDefault()"));
  assert.ok(winterDecision.includes("new FormData(event.currentTarget)"));
  assert.ok(winterDecision.includes("startTransition(() => formAction(values))"));
  assert.ok(winterDecision.includes("loading={pending}"),
    "The button must reflect the pending transition");
}

{
  const page = readFileSync(join(process.cwd(), "app", "(app)",
    "professional-estimates", "object-estimates", "[objectEstimateId]", "page.tsx"), "utf8");
  assert.ok(page.includes('Obiect local: {local?.constructionObjectId ?? "—"}'));
  assert.ok(page.includes('<Detail label="ID obiect">{estimate.constructionObjectId}</Detail>'));
  assert.ok(page.includes("Neeligibil pentru agregare"));
  assert.ok(page.includes("{entry.eligibilityError}"));
  assert.ok(!page.includes("Obiect: {estimate.constructionObjectId}"));
}

{
  const rulesDirectory = join(
    process.cwd(), "app", "(app)", "professional-estimates", "rules",
  );
  const page = readFileSync(join(rulesDirectory, "page.tsx"), "utf8");
  const forms = readFileSync(join(rulesDirectory, "rule-forms.tsx"), "utf8");
  assert.ok(forms.startsWith('"use client";'));
  assert.ok(page.includes('import { CreateCompanyRuleForm } from "./rule-forms";'));
  assert.ok(!page.includes("companyRuleComponentLabel"));
  assert.ok(!forms.includes("companyRuleComponentLabel"));
  assert.ok(page.includes("{componentLabels[component]}"));
  assert.ok(page.includes("{componentLabels[rule.component]}"));
  for (const label of [
    "Contribuții aferente manoperei", "Transport materiale",
    "Aprovizionare-depozitare", "Cheltuieli de regie", "Beneficiu estimat",
  ]) assert.ok(page.includes(label), label);
}

{
  const forms = readFileSync(join(process.cwd(),
    "app", "(app)", "professional-estimates", "semantics-forms.tsx"), "utf8");
  const closure = forms.slice(forms.indexOf("export function CloseResourcePriceValidityForm"),
    forms.indexOf("export function PriceSemanticsFields"));
  assert.ok(closure.includes('validTo ? "Modifică data de încheiere" : "Închide valabilitatea"'));
  assert.ok(closure.includes("Valabil până la"));
  assert.match(closure, /<DateInput[^>]*name="validTo"\s+required min=\{validFrom\} defaultValue=\{validTo \?\? ""\}/);
  assert.ok(closure.includes("<Message state={state} />"));
  for (const field of [
    "price", "basisQuantity", "currency", "validFrom", "sourceType", "sourceReference",
    "location", "vatTreatment", "transportTreatment", "organizationId",
  ]) assert.ok(!closure.includes(`name="${field}"`), field);
  const actions = readFileSync(join(process.cwd(),
    "app", "(app)", "professional-estimates", "actions.ts"), "utf8");
  const action = actions.slice(actions.indexOf("export async function closeResourcePriceValidity"));
  assert.ok(action.includes("await requireCurrentOrg()"));
  assert.ok(action.includes('formData.get("validTo")'));
  assert.ok(action.includes('revalidatePath(`/professional-estimates/resources/${resourceId}`)'));
  assert.ok(action.includes('revalidatePath("/professional-estimates", "layout")'));
  const detail = readFileSync(join(process.cwd(), "app", "(app)",
    "professional-estimates", "resources", "[resourceId]", "page.tsx"), "utf8");
  assert.ok(detail.includes("Prețurile nu se șterg și valoarea lor nu se rescrie retroactiv."));
  assert.ok(detail.includes("closeResourcePriceValidity.bind(null, resource.id, price.id)"));
}

{
  assert.equal(formatDate("2026-10-19"), "19-Oct-2026");
  assert.equal(formatDate(new Date("2026-10-19T00:00:00Z")), "19-Oct-2026");
  assert.equal(formatDate("2026-10-19T00:30:00+03:00"), "18-Oct-2026");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate(undefined), "—");
  assert.equal(formatDate(""), "—");
  assert.throws(() => formatDate("2026-02-30"));
  assert.throws(() => formatDate("invalid"));
  assert.throws(() => formatDate(new Date("invalid")));
  assert.equal(parseDateInput("19-Oct-2026"), "2026-10-19");
  assert.equal(parseDateInput(" 19-oct-2026 "), "2026-10-19");
  assert.equal(parseDateInput("29-Feb-2024"), "2024-02-29");
  for (const invalid of ["29-Feb-2026", "31-Apr-2026", "19-xxx-2026", "2026-10-19", "10/19/2026", ""]) {
    assert.equal(parseDateInput(invalid), null, invalid);
  }
  for (let month = 1; month <= 12; month++) {
    const iso = `2026-${String(month).padStart(2, "0")}-19`;
    assert.equal(parseDateInput(formatDate(iso)), iso);
  }
  assert.equal(dateInputError("19-Oct-2026", "2026-10-19", "2026-10-19"), "");
  assert.ok(dateInputError("18-Oct-2026", "2026-10-19").includes("19-Oct-2026"));
  assert.ok(dateInputError("20-Oct-2026", undefined, "2026-10-19").includes("19-Oct-2026"));
  assert.ok(dateInputError("31-Feb-2026").includes("19-Oct-2026"));
  assert.ok(dateInputError("   ").includes("19-Oct-2026"));
  assert.equal(dateInputError(""), "");
  const rendered = renderToStaticMarkup(createElement(DateInput, {
    id: "test-date", name: "validTo", defaultValue: "2026-10-19", required: true,
  }));
  assert.ok(rendered.includes('type="text"'));
  assert.ok(rendered.includes('value="19-Oct-2026"'));
  assert.ok(rendered.includes('type="hidden" name="validTo" value="2026-10-19"'));
}

{
  const context: ProfessionalEstimateWorkspace["context"] = {
    id: "context-1", organizationId: "org-1", name: "Test",
    valuationDate: "2026-06-15", currency: "MDL", method: "resource",
    estimatePerspective: "investor", workKind: "construction",
  };
  const result: ProcurementStorageResult = {
    contextComplete: true, complete: true, blocks: [],
    directResourceTotal: "4224", procurementStorageTotal: "1.98",
    directPlusProcurement: "4225.98",
    categories: [{
      category: "construction_materials", materialBase: "99",
      resolution: {
        component: "procurement_storage", valuationDate: context.valuationDate,
        status: "selected", eligibleCandidates: [],
        candidate: {
          candidateId: "definition-test", component: "procurement_storage",
          valueType: "percent", value: "2", currency: null,
          calculationBasis: "material_cost", validFrom: "2012-08-17", validTo: null,
          estimatePerspective: "investor", workKind: "any",
          procurementCategory: "construction_materials",
          ruleOrigin: "normative_sector_average", sourceId: "source-test",
          sourceReference: "CP L.01.07-2012, pct. 3.2, 3.3(a)",
        },
      },
      application: {
        professionalRuleDefinitionId: "definition-test",
        sourceId: "source-test", applicabilityDecisionId: "decision-test",
        sourceReference: "CP L.01.07-2012, pct. 3.2, 3.3(a)",
        ruleOrigin: "normative_sector_average", ratePercent: "2",
        ruleValidFrom: "2012-08-17", ruleValidTo: null,
        procurementCategory: "construction_materials", materialBase: "99",
        amount: "1.98", valuationDate: context.valuationDate,
        estimatePerspective: "investor", workKind: "construction", currency: "MDL",
        materials: [{
          workQuantityItemId: "position-test", resourceConsumptionId: "consumption-test",
          resourceId: "resource-test", resourcePriceId: "price-test", resourceCost: "99",
        }],
      },
    }],
  };
  const markup = renderToStaticMarkup(createElement(NormativeCosts, {
    result, context, allPositionsAssigned: true,
  }));
  for (const expected of [
    "Costuri normative", "1,98 MDL", "4 225,98 MDL", "Investitor", "Construcții",
    "definition-test", "source-test", "decision-test", "resource-test", "price-test",
  ]) assert.ok(markup.includes(expected), expected);
  const unassigned = renderToStaticMarkup(createElement(NormativeCosts, {
    result, context, allPositionsAssigned: false,
  }));
  assert.ok(unassigned.includes("Nu toate pozițiile au norme alocate"));
  assert.ok(!unassigned.includes("Cost direct + aprovizionare-depozitare:"));
  const blocked = renderToStaticMarkup(createElement(NormativeCosts, {
    context: { ...context, estimatePerspective: null },
    allPositionsAssigned: false,
    result: {
      ...result, contextComplete: false, complete: false,
      procurementStorageTotal: null, directPlusProcurement: null, categories: [],
      blocks: [{
        workQuantityItemId: "position-test", resourceId: "resource-test",
        resourceName: "Material", reason: "price_semantics",
        procurementCategory: "construction_materials",
      }],
    },
  }));
  assert.ok(blocked.includes("Selectați perspectiva devizului"));
  assert.ok(blocked.includes("Prețul nu este confirmat"));
  assert.ok(!blocked.includes("1,98 MDL"));
  assert.ok(!blocked.includes("4 225,98 MDL"));
  const incomplete = renderToStaticMarkup(createElement(NormativeCosts, {
    context, allPositionsAssigned: true,
    result: { ...result, complete: false },
  }));
  assert.ok(incomplete.includes("Calcul incomplet"));
  assert.ok(incomplete.includes("Regulă eligibilă (neaplicată)"));
  assert.ok(incomplete.includes("99 MDL"));
  assert.ok(!incomplete.includes("1,98 MDL"));
  assert.ok(!incomplete.includes("4 225,98 MDL"));
  assert.ok(!incomplete.includes("Aprovizionare-depozitare:"));
  assert.ok(!unassigned.includes("1,98 MDL"));
  const partialCategory = renderToStaticMarkup(createElement(NormativeCosts, {
    context, allPositionsAssigned: true,
    result: {
      ...result, complete: false, procurementStorageTotal: null, directPlusProcurement: null,
      categories: result.categories.map((entry) => ({ ...entry, application: null })),
      blocks: [{
        workQuantityItemId: "position-test", resourceId: "material-B",
        resourceName: "Material B", reason: "price_semantics",
        procurementCategory: "construction_materials",
      }],
    },
  }));
  assert.ok(partialCategory.includes("Material B"));
  assert.ok(partialCategory.includes("Prețul nu este confirmat"));
  assert.ok(partialCategory.includes("Bază eligibilă cunoscută (diagnostic)"));
  assert.ok(partialCategory.includes("Regulă eligibilă (neaplicată)"));
  assert.ok(partialCategory.includes("2%"));
  assert.ok(!partialCategory.includes("Aprovizionare-depozitare:"));
  assert.ok(!partialCategory.includes("1,98 MDL"));
  for (const status of ["missing", "ambiguous"] as const) {
    const unresolved = renderToStaticMarkup(createElement(NormativeCosts, {
      context, allPositionsAssigned: true,
      result: {
        ...result, complete: false, procurementStorageTotal: null, directPlusProcurement: null,
        categories: result.categories.map((entry) => ({
          ...entry, application: null, resolution: { ...entry.resolution, status },
        })),
      },
    }));
    assert.ok(unresolved.includes(status === "missing"
      ? "Nu există o regulă eligibilă" : "Devizo nu a ales automat una"));
    assert.ok(!unresolved.includes("1,98 MDL"));
    assert.ok(!unresolved.includes("4 225,98 MDL"));
  }
}

{
  for (const [input, expected] of [
    ["2.000000", "2"],
    ["0.750000", "0,75"],
    ["14.500000", "14,5"],
    ["0.123456", "0,123456"],
    ["0.000000", "0"],
    ["2", "2"],
    ["0.123456789012345678901234567890", "0,12345678901234567890123456789"],
    ["9007199254740993.010000", "9007199254740993,01"],
  ] as const) {
    assert.equal(formatRomanianDecimal(input), expected);
  }
}

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
// --- no fake controls, no redundant redirect hops, nothing slow in the way ---
{
  const root = process.cwd();
  const read = (relative: string) => readFileSync(join(root, relative), "utf8");

  // Controls that look interactive but do nothing must not come back. Add
  // real navigation instead of a placeholder.
  const shell = [
    "app/(app)/layout.tsx",
    "app/(app)/main-nav.tsx",
    "app/(app)/sidebar.tsx",
    "app/(app)/quotes/[id]/edit/quote-editor.tsx",
  ].map((file) => [file, read(file)] as const);
  for (const [file, source] of shell) {
    for (const fake of [
      "Rapoarte",
      "Caută în proiecte",
      "Notificări",
      "Proiectele mele",
      "Favorite",
      "Plan Pro",
      "Upgrade",
      "Ajutor",
      "Documente",
      "Notițe",
      "Activitate",
      "Trimite clientului",
    ]) {
      assert.ok(!source.includes(fake), `${file} still contains the placeholder "${fake}"`);
    }
  }
  const everything: string[] = [];
  (function collect(directory: string) {
    for (const name of readdirSync(directory)) {
      const fullPath = join(directory, name);
      if (statSync(fullPath).isDirectory()) collect(fullPath);
      else if (fullPath.endsWith(".tsx")) everything.push(fullPath);
    }
  })(join(root, "app"));
  for (const file of everything) {
    const source = readFileSync(file, "utf8");
    assert.ok(
      !source.includes('aria-disabled="true"') && !source.includes("cursor-not-allowed"),
      `${file} contains a permanently disabled control`,
    );
  }

  // Every real navigation target stays in the shell.
  const nav = read("app/(app)/main-nav.tsx");
  for (const href of ["/", "/projects", "/catalog", "/customers", "/normative", "/settings"]) {
    assert.ok(nav.includes(`href: "${href}"`), `main nav is missing ${href}`);
  }

  // Where the version is already known, link to it directly. Going through
  // /quotes/:id or /quotes/:id/edit (without versionId) forces another lookup
  // of the latest version just to redirect.
  const hopPattern = /href=\{`\/quotes\/\$\{[^}]+\}(?:\/edit)?`\}/;
  for (const file of everything) {
    assert.ok(
      !hopPattern.test(readFileSync(file, "utf8")),
      `${file} links to a quote without its known version`,
    );
  }

  // A catalog write must not wait for the AI embedding provider.
  for (const file of ["app/(app)/catalog/actions.ts", "app/(app)/catalog/import/actions.ts"]) {
    const source = read(file);
    assert.ok(!/await\s+syncCatalogEmbeddings/.test(source), `${file} awaits the embedding sync`);
    assert.ok(/after\(\s*\(\)\s*=>\s*syncCatalogEmbeddings/.test(source), `${file} must run the sync via after()`);
  }
}
// --- professional workspace: compact, grouped metadata and position entry ---
{
  const detail = readFileSync(
    join(process.cwd(), "app/(app)/professional-estimates/[calculationContextId]/page.tsx"),
    "utf8",
  );
  const itemForms = readFileSync(
    join(process.cwd(), "app/(app)/professional-estimates/[calculationContextId]/item-forms.tsx"),
    "utf8",
  );
  assert.match(
    detail,
    /<div className="min-w-0">\s*<dt[^>]*>.*<\/dt>\s*<dd[^>]*>.*<\/dd>\s*<\/div>/,
    "each metadata label/value must share a grid cell",
  );
  assert.match(detail, /grid-cols-2[^"]*lg:grid-cols-4/);
  assert.match(detail, /<ol className="mt-2 flex flex-wrap gap-2">/);
  assert.match(detail, /workspace\.items\.length > 0/);
  assert.match(detail, /complete \? "Complet: " : "În așteptare: "/);
  assert.match(itemForms, /grid-cols-2[^"]*sm:grid-cols-6[^"]*lg:grid-cols-12/);
  assert.match(
    itemForms,
    /<details[^>]*>\s*<summary[^>]*>\s*Note \(opțional\)\s*<\/summary>[\s\S]*?name="notes"/,
    "optional notes stay available without taking a full row by default",
  );
  assert.match(itemForms, /name="quantity"\s*type="text"\s*inputMode="decimal"/);
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
