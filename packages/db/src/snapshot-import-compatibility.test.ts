import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildInvalidCanonicalGateCsvFixture,
  buildInvalidFormulaCsvFixture,
  buildInvalidHistoryCsvFixture,
  buildInvalidLegacyKeyCsvFixture,
  buildInvalidPoolCsvFixture,
  loadCanonicalSnapshotFixture,
  loadFullDetailCsvSnapshotFixture,
  loadInvalidAllErrorTypesCsvFixture,
  loadValidCompatibilityCsvFixture
} from "./__fixtures__/snapshot-import-compatibility-fixtures";
import { parseCanonicalCsvSnapshotText } from "./canonical-csv";
import { buildDerivedSnapshotDataFromCanonical } from "./canonical-derived";
import { parseCanonicalSnapshotText } from "./canonical-payload";
import { buildSnapshotDataFingerprint } from "./snapshot-data-fingerprint";
import {
  parseCompatibilityCsvSnapshotText,
  validateCanonicalRuleGateBacking,
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

test("canonical_json rule gates require stored canonical backing before import", () => {
  const result = parseCompatibilityCsvSnapshotText(loadValidCompatibilityCsvFixture(), {
    mode: "understanding_doc_strict"
  });
  const unbackedIssues = validateCanonicalRuleGateBacking(result.facts, {
    canonicalEntityCount: 0,
    canonicalSourceSnapshotKey: null
  });
  const backedIssues = validateCanonicalRuleGateBacking(result.facts, {
    canonicalEntityCount: 1,
    canonicalSourceSnapshotKey: "sample-canonical-faithful-24m"
  });

  assert.ok(unbackedIssues.some((issue) => issue.issueType === "canonical_gate_unbacked"));
  assert.equal(backedIssues.filter((issue) => issue.severity === "ERROR").length, 0);
});

test("snapshot data fingerprint is deterministic and import-run scoped", () => {
  const fact = {
    periodKey: "2025-01",
    memberKey: "AFF-1",
    sourceSystem: "bgc",
    memberTier: "PATHFINDER",
    groupKey: "FOUNDERS",
    pcVolume: 10000,
    spRewardBasis: 70,
    globalRewardUsd: 0,
    poolRewardUsd: 0,
    cashoutUsd: 0,
    sinkSpendUsd: 0,
    activeMember: true,
    metadataJson: {
      recognized_revenue_basis: {
        entry_fee_usd: 100
      }
    }
  };
  const first = buildSnapshotDataFingerprint({
    importRunId: "import-1",
    canonicalSourceSnapshotKey: "canonical-1",
    facts: [fact]
  });
  const reorderedMetadata = buildSnapshotDataFingerprint({
    importRunId: "import-1",
    canonicalSourceSnapshotKey: "canonical-1",
    facts: [
      {
        ...fact,
        metadataJson: {
          recognized_revenue_basis: {
            entry_fee_usd: 100
          }
        }
      }
    ]
  });
  const nextImport = buildSnapshotDataFingerprint({
    importRunId: "import-2",
    canonicalSourceSnapshotKey: "canonical-1",
    facts: [fact]
  });

  assert.equal(first, reorderedMetadata);
  assert.notEqual(first, nextImport);
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

test("full detail CSV sample derives facts that pass understanding_doc_strict validation", () => {
  const payload = parseCanonicalCsvSnapshotText(loadFullDetailCsvSnapshotFixture());
  const derived = buildDerivedSnapshotDataFromCanonical(payload, {
    snapshotDateFrom: new Date("2024-04-01T00:00:00.000Z"),
    snapshotDateTo: new Date("2026-01-31T23:59:59.999Z")
  });
  const result = validateCompatibilitySnapshotFacts(derived.memberMonthFacts, {
    mode: "understanding_doc_strict",
    poolPeriodFacts: derived.poolPeriodFacts,
    canonicalSnapshotId: payload.snapshot_id
  });

  assert.equal(payload.members.length, 1);
  assert.equal(payload.member_aliases.length, 1);
  assert.equal(payload.business_events.length, 6);
  assert.equal(payload.reward_obligations.length, 1);
  assert.equal(payload.pool_entries.length, 2);
  assert.equal(payload.cashout_events.length, 1);
  assert.equal(payload.qualification_windows.length, 1);
  assert.equal(payload.qualification_status_history.length, 1);
  assert.equal(derived.memberMonthFacts.length, 13);
  assert.equal(result.issues.filter((issue) => issue.severity === "ERROR").length, 0);
});

test("repository full detail CSV examples stay parseable by canonical parser", () => {
  const examples = [
    {
      file: "case-1m-bgc-iblooming-full-detail.csv",
      expected: {
        members: 14,
        businessEvents: 15,
        rewardObligations: 12,
        poolEntries: 2,
        cashoutEvents: 12
      }
    },
    {
      file: "case-10m-12m-bgc-iblooming-full-detail.csv",
      expected: {
        members: 146,
        businessEvents: 180,
        rewardObligations: 144,
        poolEntries: 24,
        cashoutEvents: 144
      }
    }
  ];

  for (const example of examples) {
    const payload = parseCanonicalCsvSnapshotText(
      readFileSync(new URL(`../../../examples/${example.file}`, import.meta.url), "utf8")
    );

    assert.equal(payload.members.length, example.expected.members, example.file);
    assert.equal(payload.business_events.length, example.expected.businessEvents, example.file);
    assert.equal(payload.reward_obligations.length, example.expected.rewardObligations, example.file);
    assert.equal(payload.pool_entries.length, example.expected.poolEntries, example.file);
    assert.equal(payload.cashout_events.length, example.expected.cashoutEvents, example.file);
  }
});

test("legacy_compatibility mode skips strict history checks", () => {
  const result = parseCompatibilityCsvSnapshotText(buildInvalidHistoryCsvFixture(), {
    mode: "legacy_compatibility"
  });

  assert.equal(result.issues.filter((issue) => issue.severity === "ERROR").length, 0);
});

test("iblooming sink-spend source rows derive PC_SPEND breakdown and persist it on facts", () => {
  const csvText = [
    "period_key,member_key,source_system,member_tier,group_key,pc_volume,sp_reward_basis,global_reward_usd,pool_reward_usd,cashout_usd,sink_spend_usd,active_member,recognized_revenue_usd,gross_margin_usd,member_join_period,is_affiliate,cross_app_active,extra_json",
    '2025-04,B123,iblooming,CP,,0,0,0,0,0,99.5,true,29.85,29.85,2025-04,true,false,"{""source_categories"":[""cp_video_sale""]}"'
  ].join("\n");

  const result = parseCompatibilityCsvSnapshotText(csvText, {
    mode: "understanding_doc_strict"
  });

  assert.equal(result.issues.filter((issue) => issue.severity === "ERROR").length, 0);
  assert.equal(
    result.issues.some(
      (issue) =>
        issue.issueType === "missing_rule_tagged_breakdown" &&
        issue.message.includes("sink_breakdown_usd")
    ),
    false
  );

  const metadata = result.facts[0]?.metadataJson as Record<string, unknown> | null;
  assert.ok(metadata);
  assert.deepEqual(metadata?.sink_breakdown_usd, { PC_SPEND: 99.5 });
  assert.deepEqual(metadata?.accountability_checks, { sink_total_usd: 99.5 });
});

test("hybrid monthly override rows pass strict validation when shaped as accepted aggregate facts", () => {
  const csvText = [
    "period_key,member_key,source_system,member_tier,group_key,pc_volume,sp_reward_basis,global_reward_usd,pool_reward_usd,cashout_usd,sink_spend_usd,active_member,recognized_revenue_usd,gross_margin_usd,member_join_period,is_affiliate,cross_app_active,extra_json",
    '2025-04,DATA_AGG_OVERRIDE::2025-04,other,,DATA_AGG_OVERRIDE,22887500,178920,30680.14,0,30680.14,0,false,31093.17,80089.20,,,,\"{\"\"row_semantics\"\":\"\"hybrid_monthly_override_fact\"\",\"\"source_categories\"\":[\"\"data_agg_monthly_override\"\",\"\"accepted_hybrid_monthly_override\"\"],\"\"recognized_revenue_basis\"\":{\"\"hybrid_monthly_override_usd\"\":31093.17},\"\"gross_margin_basis\"\":{\"\"gross_margin_usd\"\":80089.2},\"\"pc_breakdown\"\":{\"\"DATA_AGG_MONTHLY_OVERRIDE\"\":22887500},\"\"sp_breakdown\"\":{\"\"DATA_AGG_MONTHLY_OVERRIDE\"\":178920},\"\"global_reward_breakdown_usd\"\":{\"\"DATA_AGG_MONTHLY_OVERRIDE\"\":30680.14},\"\"cashout_breakdown_usd\"\":{\"\"DATA_AGG_MONTHLY_OVERRIDE\"\":30680.14},\"\"accountability_checks\"\":{\"\"cashout_total_usd\"\":30680.14}}\"'
  ].join("\n");

  const result = parseCompatibilityCsvSnapshotText(csvText, {
    mode: "understanding_doc_strict"
  });

  assert.equal(result.issues.filter((issue) => issue.severity === "ERROR").length, 0);
  assert.equal(result.facts.length, 1);
});

test("bgc reward-only rows do not require entry_fee basis when they carry no join revenue or pc issuance", () => {
  const csvText = [
    "period_key,member_key,source_system,member_tier,group_key,pc_volume,sp_reward_basis,global_reward_usd,pool_reward_usd,cashout_usd,sink_spend_usd,active_member,recognized_revenue_usd,gross_margin_usd,member_join_period,is_affiliate,cross_app_active,extra_json",
    '2025-06,BGC-GLOBAL-2025-SPECIAL-001,bgc,special,,0,1250,125,0,0,0,true,,,2024-04,true,,"{""source_categories"":[""global_profit_2025_first_half_distribution""]}"'
  ].join("\n");

  const result = parseCompatibilityCsvSnapshotText(csvText, {
    mode: "understanding_doc_strict"
  });

  assert.equal(result.issues.filter((issue) => issue.severity === "ERROR").length, 0);
  assert.equal(result.facts.length, 1);
});
