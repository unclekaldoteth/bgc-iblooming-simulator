import { createHash } from "node:crypto";

import type {
  SnapshotMemberMonthFactInput,
  SnapshotPoolPeriodFactInput,
  SnapshotRewardSourcePeriodFactInput
} from "./snapshots";

type SnapshotDataFingerprintInput = {
  importRunId: string;
  canonicalSourceSnapshotKey?: string | null;
  facts: SnapshotMemberMonthFactInput[];
  rewardSourcePeriodFacts?: SnapshotRewardSourcePeriodFactInput[];
  poolPeriodFacts?: SnapshotPoolPeriodFactInput[];
};

function normalizeValue(value: unknown): unknown {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Number(value.toFixed(10)) : null;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, childValue]) => [key, normalizeValue(childValue)])
    );
  }

  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeValue(value));
}

function normalizeMemberFact(fact: SnapshotMemberMonthFactInput) {
  return {
    periodKey: fact.periodKey,
    memberKey: fact.memberKey,
    sourceSystem: fact.sourceSystem,
    memberTier: fact.memberTier ?? null,
    groupKey: fact.groupKey ?? null,
    pcVolume: fact.pcVolume,
    spRewardBasis: fact.spRewardBasis,
    globalRewardUsd: fact.globalRewardUsd,
    poolRewardUsd: fact.poolRewardUsd,
    cashoutUsd: fact.cashoutUsd,
    sinkSpendUsd: fact.sinkSpendUsd,
    activeMember: fact.activeMember,
    metadataJson: fact.metadataJson ?? null
  };
}

function normalizeRewardSourcePeriodFact(fact: SnapshotRewardSourcePeriodFactInput) {
  return {
    periodKey: fact.periodKey,
    sourceSystem: fact.sourceSystem,
    rewardSourceCode: fact.rewardSourceCode,
    unit: fact.unit,
    amount: fact.amount,
    obligationCount: fact.obligationCount,
    beneficiaryCount: fact.beneficiaryCount,
    metadataJson: fact.metadataJson ?? null
  };
}

function normalizePoolPeriodFact(fact: SnapshotPoolPeriodFactInput) {
  return {
    periodKey: fact.periodKey,
    poolCode: fact.poolCode,
    distributionCycle: fact.distributionCycle,
    unit: fact.unit,
    fundingAmount: fact.fundingAmount,
    distributionAmount: fact.distributionAmount,
    recipientCount: fact.recipientCount,
    shareCountTotal: fact.shareCountTotal,
    metadataJson: fact.metadataJson ?? null
  };
}

export function buildSnapshotDataFingerprint(input: SnapshotDataFingerprintInput) {
  const payload = {
    fingerprintVersion: 1,
    importRunId: input.importRunId,
    canonicalSourceSnapshotKey: input.canonicalSourceSnapshotKey ?? null,
    facts: input.facts
      .map(normalizeMemberFact)
      .sort((left, right) =>
        `${left.periodKey}::${left.memberKey}::${left.sourceSystem}`.localeCompare(
          `${right.periodKey}::${right.memberKey}::${right.sourceSystem}`
        )
      ),
    rewardSourcePeriodFacts: (input.rewardSourcePeriodFacts ?? [])
      .map(normalizeRewardSourcePeriodFact)
      .sort((left, right) =>
        `${left.periodKey}::${left.sourceSystem}::${left.rewardSourceCode}`.localeCompare(
          `${right.periodKey}::${right.sourceSystem}::${right.rewardSourceCode}`
        )
      ),
    poolPeriodFacts: (input.poolPeriodFacts ?? [])
      .map(normalizePoolPeriodFact)
      .sort((left, right) =>
        `${left.periodKey}::${left.poolCode}::${left.distributionCycle}`.localeCompare(
          `${right.periodKey}::${right.poolCode}::${right.distributionCycle}`
        )
      )
  };

  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}
