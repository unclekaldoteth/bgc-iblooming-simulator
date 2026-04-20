import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInvalidCanonicalGateCsvFixture,
  buildInvalidFormulaCsvFixture,
  buildInvalidHistoryCsvFixture,
  buildInvalidLegacyKeyCsvFixture,
  buildInvalidPoolCsvFixture,
  loadCanonicalSnapshotFixture,
  loadInvalidAllErrorTypesCsvFixture,
  loadValidCompatibilityCsvFixture
} from "./__fixtures__/snapshot-import-compatibility-fixtures";
import { buildDerivedSnapshotDataFromCanonical } from "./canonical-derived";
import { parseCanonicalSnapshotText } from "./canonical-payload";
import {
  parseCompatibilityCsvSnapshotText,
  validateCompatibilitySnapshotFacts
} from "./snapshot-import-compatibility";

function errorMessages(csvText: string, mode: "legacy_compatibility" | "understanding_doc_strict" = "understanding_doc_strict") {
  const result = parseCompatibilityCsvSnapshotText(csvText, { mode });

  return result.issues
    .filter((issue) => issue.severity === "ERROR")
    .map((issue) => `${issue.issueType}: ${issue.message}`);
}

test("valid compatibility fixture passes in understanding_doc_strict mode", () => {
  const result = parseCompatibilityCsvSnapshotText(loadValidCompatibilityCsvFixture(), {
    mode: "understanding_doc_strict"
  });

  assert.equal(result.rowCountRaw, 291);
  assert.equal(result.facts.length, 291);
  assert.equal(result.issues.filter((issue) => issue.severity === "ERROR").length, 0);
  assert.equal(result.issues.filter((issue) => issue.severity === "WARNING").length, 0);
});

test("invalid formula fixture is rejected in understanding_doc_strict mode", () => {
  const errors = errorMessages(buildInvalidFormulaCsvFixture());

  assert.ok(errors.some((message) => message.includes("pc_breakdown total 10000.00 does not match column value 9999.00")));
});

test("invalid history fixture is rejected in understanding_doc_strict mode", () => {
  const errors = errorMessages(buildInvalidHistoryCsvFixture());

  assert.ok(errors.some((message) => message.includes("member_join_period must stay immutable")));
});

test("invalid pool fixture is rejected in understanding_doc_strict mode", () => {
  const errors = errorMessages(buildInvalidPoolCsvFixture());

  assert.ok(
    errors.some((message) =>
      message.includes("pool_funding_basis.IB_GPS_SEMIANNUAL_POOL.distribution_amount cannot exceed funding_amount")
    )
  );
});

test("invalid legacy revenue basis key is rejected in understanding_doc_strict mode", () => {
  const errors = errorMessages(buildInvalidLegacyKeyCsvFixture());

  assert.ok(
    errors.some((message) =>
      message.includes("recognized_revenue_basis.platform_revenue_usd is no longer accepted")
    )
  );
});

test("canonical-only rule families require canonical_json gate in understanding_doc_strict mode", () => {
  const errors = errorMessages(buildInvalidCanonicalGateCsvFixture());

  assert.ok(errors.some((message) => message.includes("canonical_rule_gate.validated_via must be canonical_json")));
});

test("combined invalid demo fixture surfaces formula, history, pool, and canonical-gate errors together", () => {
  const errors = errorMessages(loadInvalidAllErrorTypesCsvFixture());

  assert.ok(errors.some((message) => message.includes("canonical_rule_gate.validated_via must be canonical_json")));
  assert.ok(errors.some((message) => message.includes("recognized_revenue_basis total 30.00 does not match column value 29.00")));
  assert.ok(
    errors.some((message) =>
      message.includes("pool_funding_basis.IB_GPS_SEMIANNUAL_POOL.distribution_amount cannot exceed funding_amount")
    )
  );
  assert.ok(errors.some((message) => message.includes("member_join_period must stay immutable")));
});

test("canonical sample derives facts that also pass understanding_doc_strict validation", () => {
  const payload = parseCanonicalSnapshotText(loadCanonicalSnapshotFixture());
  const derived = buildDerivedSnapshotDataFromCanonical(payload, {
    snapshotDateFrom: new Date("2025-01-01T00:00:00.000Z"),
    snapshotDateTo: new Date("2026-12-31T23:59:59.999Z")
  });
  const result = validateCompatibilitySnapshotFacts(derived.memberMonthFacts, {
    mode: "understanding_doc_strict",
    poolPeriodFacts: derived.poolPeriodFacts,
    canonicalSnapshotId: payload.snapshot_id
  });

  assert.equal(result.rowCountRaw, derived.memberMonthFacts.length);
  assert.equal(result.issues.filter((issue) => issue.severity === "ERROR").length, 0);
});

test("legacy_compatibility mode skips strict history checks", () => {
  const result = parseCompatibilityCsvSnapshotText(buildInvalidHistoryCsvFixture(), {
    mode: "legacy_compatibility"
  });

  assert.equal(result.issues.filter((issue) => issue.severity === "ERROR").length, 0);
});
