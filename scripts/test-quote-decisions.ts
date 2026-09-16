import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  QuoteDecisionNotAllowedError,
  QuoteDecisionService,
  QuoteDecisionVersionNotFoundError,
  type QuoteDecision,
  type QuoteDecisionRepository,
  type QuoteDecisionWriteResult,
} from "../domain/quotes/quote-decision.service";
import type {
  OrganizationId,
  QuoteStatus,
  QuoteVersionId,
  UserId,
} from "../domain/shared/types";

const ORGANIZATION_ID: OrganizationId = "org-1";
const USER_ID: UserId = "user-1";

interface StoredVersion {
  organizationId: OrganizationId;
  status: QuoteStatus;
}

class FakeQuoteDecisionRepository implements QuoteDecisionRepository {
  versions = new Map<QuoteVersionId, StoredVersion>();
  audit: { versionId: QuoteVersionId; eventType: string }[] = [];

  addVersion(versionId: QuoteVersionId, status: QuoteStatus) {
    this.versions.set(versionId, {
      organizationId: ORGANIZATION_ID,
      status,
    });
  }

  async applyDecision(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
    _actorUserId: UserId,
    decision: QuoteDecision,
  ): Promise<QuoteDecisionWriteResult> {
    const version = this.versions.get(versionId);
    if (!version || version.organizationId !== organizationId) {
      return "not_found";
    }
    if (version.status !== "sent") {
      return "invalid_status";
    }

    version.status = decision;
    this.audit.push({
      versionId,
      eventType: decision === "accepted" ? "quote_accepted" : "quote_rejected",
    });
    return "updated";
  }
}

let passed = 0;

async function test(name: string, run: () => Promise<void> | void) {
  try {
    await run();
    passed += 1;
    console.log(`  ok - ${name}`);
  } catch (error) {
    console.error(`  FAIL - ${name}`);
    console.error(error);
    process.exit(1);
  }
}

async function run() {
  console.log("M7.2 quote decisions:");

  await test("sent -> accepted records one acceptance event", async () => {
    const repository = new FakeQuoteDecisionRepository();
    repository.addVersion("version-1", "sent");
    const service = new QuoteDecisionService(repository);

    await service.decide(ORGANIZATION_ID, "version-1", USER_ID, "accepted");

    assert.equal(repository.versions.get("version-1")?.status, "accepted");
    assert.deepEqual(repository.audit, [
      { versionId: "version-1", eventType: "quote_accepted" },
    ]);
  });

  await test("sent -> rejected records one rejection event", async () => {
    const repository = new FakeQuoteDecisionRepository();
    repository.addVersion("version-2", "sent");
    const service = new QuoteDecisionService(repository);

    await service.decide(ORGANIZATION_ID, "version-2", USER_ID, "rejected");

    assert.equal(repository.versions.get("version-2")?.status, "rejected");
    assert.deepEqual(repository.audit, [
      { versionId: "version-2", eventType: "quote_rejected" },
    ]);
  });

  await test("draft cannot jump directly to accepted", async () => {
    const repository = new FakeQuoteDecisionRepository();
    repository.addVersion("version-3", "draft");
    const service = new QuoteDecisionService(repository);

    await assert.rejects(
      () => service.decide(ORGANIZATION_ID, "version-3", USER_ID, "accepted"),
      QuoteDecisionNotAllowedError,
    );
    assert.equal(repository.versions.get("version-3")?.status, "draft");
  });

  await test("accepted and rejected versions are terminal decisions", async () => {
    const repository = new FakeQuoteDecisionRepository();
    repository.addVersion("accepted-version", "accepted");
    repository.addVersion("rejected-version", "rejected");
    const service = new QuoteDecisionService(repository);

    await assert.rejects(
      () =>
        service.decide(
          ORGANIZATION_ID,
          "accepted-version",
          USER_ID,
          "rejected",
        ),
      QuoteDecisionNotAllowedError,
    );
    await assert.rejects(
      () =>
        service.decide(
          ORGANIZATION_ID,
          "rejected-version",
          USER_ID,
          "accepted",
        ),
      QuoteDecisionNotAllowedError,
    );
    assert.equal(repository.audit.length, 0);
  });

  await test("unknown version returns a not-found domain error", async () => {
    const repository = new FakeQuoteDecisionRepository();
    const service = new QuoteDecisionService(repository);

    await assert.rejects(
      () => service.decide(ORGANIZATION_ID, "missing", USER_ID, "accepted"),
      QuoteDecisionVersionNotFoundError,
    );
  });

  await test("DB policy allows only the intended frozen-status transition", () => {
    const policySql = readFileSync(
      join(
        process.cwd(),
        "infrastructure/db/policies/0006_quote_immutability.sql",
      ),
      "utf8",
    );

    assert.ok(policySql.includes("new.status not in ('draft', 'sent')"));
    assert.ok(
      policySql.includes(
        "old.status = 'sent' and new.status in ('accepted', 'rejected')",
      ),
    );
    assert.ok(policySql.includes("to_jsonb(new) - 'status' - 'updated_at'"));
  });

  console.log(`\n${passed} M7.2 checks passed.`);
}

run();
