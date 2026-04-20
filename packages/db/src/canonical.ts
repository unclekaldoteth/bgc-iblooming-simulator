import {
  Prisma,
  CanonicalBusinessEventType,
  CanonicalCashoutEventType,
  CanonicalDistributionCycle,
  CanonicalMemberRoleType,
  CanonicalOfferType,
  CanonicalPcEntryType,
  CanonicalPoolCode,
  CanonicalPoolEntryType,
  CanonicalQualificationStatus,
  CanonicalQualificationType,
  CanonicalRewardObligationStatus,
  CanonicalRewardSourceCode,
  CanonicalSourceSystem,
  CanonicalSpEntryType,
  CanonicalValueUnit
} from "@prisma/client";

import { prisma } from "./client";

export type CanonicalMemberInput = {
  stableKey: string;
  displayName?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type CanonicalMemberAliasInput = {
  memberStableKey: string;
  sourceSystem: CanonicalSourceSystem;
  aliasKey: string;
  aliasType: string;
  confidence?: number | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type CanonicalMemberRoleHistoryInput = {
  memberStableKey: string;
  roleType: CanonicalMemberRoleType;
  roleValue: string;
  sourceSystem?: CanonicalSourceSystem | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  sourceEventRef?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type CanonicalOfferInput = {
  offerCode: string;
  offerType: CanonicalOfferType;
  sourceSystem: CanonicalSourceSystem;
  label: string;
  priceFiatUsd?: number | null;
  pcGrantRuleJson?: Prisma.InputJsonValue | null;
  ltsGenerationRuleJson?: Prisma.InputJsonValue | null;
  rewardRuleReference?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type CanonicalBusinessEventInput = {
  eventRef: string;
  eventType: CanonicalBusinessEventType;
  sourceSystem: CanonicalSourceSystem;
  occurredAt: Date;
  effectivePeriodKey: string;
  actorMemberStableKey?: string | null;
  beneficiaryMemberStableKey?: string | null;
  relatedMemberStableKey?: string | null;
  offerCode?: string | null;
  quantity?: number | null;
  amount?: number | null;
  unit?: CanonicalValueUnit | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type CanonicalPcLedgerEntryInput = {
  memberStableKey: string;
  sourceEventRef?: string | null;
  entryType: CanonicalPcEntryType;
  effectivePeriodKey: string;
  amountPc: number;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type CanonicalSpLedgerEntryInput = {
  memberStableKey: string;
  sourceEventRef?: string | null;
  entryType: CanonicalSpEntryType;
  effectivePeriodKey: string;
  amountSp: number;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type CanonicalRewardObligationEntryInput = {
  memberStableKey: string;
  sourceEventRef?: string | null;
  rewardSourceCode: CanonicalRewardSourceCode;
  distributionCycle: CanonicalDistributionCycle;
  obligationStatus?: CanonicalRewardObligationStatus;
  effectivePeriodKey: string;
  amount: number;
  unit: CanonicalValueUnit;
  eligibilitySnapshotKey?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type CanonicalPoolLedgerEntryInput = {
  sourceEventRef?: string | null;
  recipientMemberStableKey?: string | null;
  poolCode: CanonicalPoolCode;
  entryType: CanonicalPoolEntryType;
  distributionCycle: CanonicalDistributionCycle;
  effectivePeriodKey: string;
  amount: number;
  unit: CanonicalValueUnit;
  shareCount?: number | null;
  eligibilitySnapshotKey?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type CanonicalCashoutEventInput = {
  memberStableKey: string;
  sourceEventRef?: string | null;
  eventType: CanonicalCashoutEventType;
  occurredAt: Date;
  effectivePeriodKey: string;
  amountUsd: number;
  feeUsd?: number | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type CanonicalQualificationWindowInput = {
  memberStableKey: string;
  qualificationType: CanonicalQualificationType;
  windowKey: string;
  startsAt: Date;
  endsAt: Date;
  thresholdAmount?: number | null;
  thresholdUnit?: CanonicalValueUnit | null;
  sourceEventRef?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type CanonicalQualificationStatusHistoryInput = {
  memberStableKey: string;
  qualificationType: CanonicalQualificationType;
  status: CanonicalQualificationStatus;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  sourceWindowKey?: string | null;
  sourceEventRef?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type ReplaceCanonicalSnapshotDataInput = {
  snapshotId: string;
  importRunId?: string | null;
  members?: CanonicalMemberInput[];
  memberAliases?: CanonicalMemberAliasInput[];
  roleHistory?: CanonicalMemberRoleHistoryInput[];
  offers?: CanonicalOfferInput[];
  businessEvents?: CanonicalBusinessEventInput[];
  pcEntries?: CanonicalPcLedgerEntryInput[];
  spEntries?: CanonicalSpLedgerEntryInput[];
  rewardObligations?: CanonicalRewardObligationEntryInput[];
  poolEntries?: CanonicalPoolLedgerEntryInput[];
  cashoutEvents?: CanonicalCashoutEventInput[];
  qualificationWindows?: CanonicalQualificationWindowInput[];
  qualificationStatusHistory?: CanonicalQualificationStatusHistoryInput[];
};

function requireMapValue(
  map: Map<string, string>,
  key: string,
  entityLabel: string
) {
  const value = map.get(key);

  if (!value) {
    throw new Error(`${entityLabel} "${key}" was not found in canonical snapshot import.`);
  }

  return value;
}

function resolveOptionalMapValue(
  map: Map<string, string>,
  key: string | null | undefined
) {
  if (!key) {
    return null;
  }

  return requireMapValue(map, key, "Reference");
}

function toNullableJsonValue(
  value: Prisma.InputJsonValue | null | undefined
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull | undefined {
  return value == null ? Prisma.DbNull : value;
}

export async function listCanonicalMembers(snapshotId: string) {
  return prisma.canonicalMember.findMany({
    where: {
      snapshotId
    },
    include: {
      aliases: {
        orderBy: [{ sourceSystem: "asc" }, { aliasKey: "asc" }]
      },
      roleHistory: {
        orderBy: [{ effectiveFrom: "asc" }, { roleType: "asc" }]
      }
    },
    orderBy: [{ stableKey: "asc" }]
  });
}

export async function listCanonicalOffers() {
  return prisma.canonicalOffer.findMany({
    orderBy: [{ sourceSystem: "asc" }, { offerType: "asc" }, { offerCode: "asc" }]
  });
}

export async function listCanonicalBusinessEvents(snapshotId: string) {
  return prisma.canonicalBusinessEvent.findMany({
    where: {
      snapshotId
    },
    orderBy: [{ occurredAt: "asc" }, { eventRef: "asc" }]
  });
}

export async function getCanonicalSnapshotGraph(snapshotId: string) {
  return prisma.datasetSnapshot.findUnique({
    where: {
      id: snapshotId
    },
    include: {
      canonicalMembers: {
        include: {
          aliases: {
            orderBy: [{ sourceSystem: "asc" }, { aliasKey: "asc" }]
          },
          roleHistory: {
            orderBy: [{ effectiveFrom: "asc" }, { roleType: "asc" }]
          }
        },
        orderBy: [{ stableKey: "asc" }]
      },
      canonicalBusinessEvents: {
        orderBy: [{ occurredAt: "asc" }, { eventRef: "asc" }]
      },
      canonicalPcEntries: {
        orderBy: [{ effectivePeriodKey: "asc" }, { createdAt: "asc" }]
      },
      canonicalSpEntries: {
        orderBy: [{ effectivePeriodKey: "asc" }, { createdAt: "asc" }]
      },
      canonicalRewardObligations: {
        orderBy: [{ effectivePeriodKey: "asc" }, { rewardSourceCode: "asc" }]
      },
      canonicalPoolEntries: {
        orderBy: [{ effectivePeriodKey: "asc" }, { poolCode: "asc" }]
      },
      canonicalCashoutEvents: {
        orderBy: [{ occurredAt: "asc" }]
      },
      canonicalQualificationWindows: {
        orderBy: [{ startsAt: "asc" }, { qualificationType: "asc" }]
      },
      canonicalQualificationStatusHistory: {
        orderBy: [{ effectiveFrom: "asc" }, { qualificationType: "asc" }]
      }
    }
  });
}

export async function replaceCanonicalSnapshotData(
  input: ReplaceCanonicalSnapshotDataInput
) {
  return prisma.$transaction(async (tx) => {
    for (const offer of input.offers ?? []) {
      await tx.canonicalOffer.upsert({
        where: {
          offerCode: offer.offerCode
        },
        update: {
          offerType: offer.offerType,
          sourceSystem: offer.sourceSystem,
          label: offer.label,
          priceFiatUsd: offer.priceFiatUsd ?? null,
          pcGrantRuleJson: toNullableJsonValue(offer.pcGrantRuleJson),
          ltsGenerationRuleJson: toNullableJsonValue(offer.ltsGenerationRuleJson),
          rewardRuleReference: offer.rewardRuleReference ?? null,
          metadataJson: toNullableJsonValue(offer.metadataJson)
        },
        create: {
          offerCode: offer.offerCode,
          offerType: offer.offerType,
          sourceSystem: offer.sourceSystem,
          label: offer.label,
          priceFiatUsd: offer.priceFiatUsd ?? null,
          pcGrantRuleJson: toNullableJsonValue(offer.pcGrantRuleJson),
          ltsGenerationRuleJson: toNullableJsonValue(offer.ltsGenerationRuleJson),
          rewardRuleReference: offer.rewardRuleReference ?? null,
          metadataJson: toNullableJsonValue(offer.metadataJson)
        }
      });
    }

    await tx.canonicalQualificationStatusHistory.deleteMany({
      where: { snapshotId: input.snapshotId }
    });
    await tx.canonicalQualificationWindow.deleteMany({
      where: { snapshotId: input.snapshotId }
    });
    await tx.canonicalCashoutEvent.deleteMany({
      where: { snapshotId: input.snapshotId }
    });
    await tx.canonicalPoolLedgerEntry.deleteMany({
      where: { snapshotId: input.snapshotId }
    });
    await tx.canonicalRewardObligationEntry.deleteMany({
      where: { snapshotId: input.snapshotId }
    });
    await tx.canonicalSpLedgerEntry.deleteMany({
      where: { snapshotId: input.snapshotId }
    });
    await tx.canonicalPcLedgerEntry.deleteMany({
      where: { snapshotId: input.snapshotId }
    });
    await tx.canonicalMemberRoleHistory.deleteMany({
      where: { snapshotId: input.snapshotId }
    });
    await tx.canonicalMemberAlias.deleteMany({
      where: { snapshotId: input.snapshotId }
    });
    await tx.canonicalBusinessEvent.deleteMany({
      where: { snapshotId: input.snapshotId }
    });
    await tx.canonicalMember.deleteMany({
      where: { snapshotId: input.snapshotId }
    });

    if ((input.members ?? []).length > 0) {
      await tx.canonicalMember.createMany({
        data: (input.members ?? []).map((member) => ({
          snapshotId: input.snapshotId,
          stableKey: member.stableKey,
          displayName: member.displayName ?? null,
          metadataJson: toNullableJsonValue(member.metadataJson)
        }))
      });
    }

    const members = await tx.canonicalMember.findMany({
      where: {
        snapshotId: input.snapshotId
      },
      select: {
        id: true,
        stableKey: true
      }
    });
    const memberIdByStableKey = new Map(
      members.map((member) => [member.stableKey, member.id] as const)
    );

    const offers = await tx.canonicalOffer.findMany({
      where: {
        offerCode: {
          in: [...new Set((input.offers ?? []).map((offer) => offer.offerCode))]
        }
      },
      select: {
        id: true,
        offerCode: true
      }
    });
    const offerIdByCode = new Map(offers.map((offer) => [offer.offerCode, offer.id] as const));

    if ((input.businessEvents ?? []).length > 0) {
      await tx.canonicalBusinessEvent.createMany({
        data: (input.businessEvents ?? []).map((event) => ({
          snapshotId: input.snapshotId,
          importRunId: input.importRunId ?? null,
          eventRef: event.eventRef,
          eventType: event.eventType,
          sourceSystem: event.sourceSystem,
          occurredAt: event.occurredAt,
          effectivePeriodKey: event.effectivePeriodKey,
          actorMemberId: event.actorMemberStableKey
            ? requireMapValue(memberIdByStableKey, event.actorMemberStableKey, "Member")
            : null,
          beneficiaryMemberId: event.beneficiaryMemberStableKey
            ? requireMapValue(memberIdByStableKey, event.beneficiaryMemberStableKey, "Member")
            : null,
          relatedMemberId: event.relatedMemberStableKey
            ? requireMapValue(memberIdByStableKey, event.relatedMemberStableKey, "Member")
            : null,
          offerId: event.offerCode ? requireMapValue(offerIdByCode, event.offerCode, "Offer") : null,
          quantity: event.quantity ?? null,
          amount: event.amount ?? null,
          unit: event.unit ?? null,
          metadataJson: toNullableJsonValue(event.metadataJson)
        }))
      });
    }

    const events = await tx.canonicalBusinessEvent.findMany({
      where: {
        snapshotId: input.snapshotId
      },
      select: {
        id: true,
        eventRef: true
      }
    });
    const eventIdByRef = new Map(
      events
        .filter((event): event is { id: string; eventRef: string } => Boolean(event.eventRef))
        .map((event) => [event.eventRef, event.id] as const)
    );

    if ((input.memberAliases ?? []).length > 0) {
      await tx.canonicalMemberAlias.createMany({
        data: (input.memberAliases ?? []).map((alias) => ({
          snapshotId: input.snapshotId,
          memberId: requireMapValue(memberIdByStableKey, alias.memberStableKey, "Member"),
          sourceSystem: alias.sourceSystem,
          aliasKey: alias.aliasKey,
          aliasType: alias.aliasType,
          confidence: alias.confidence ?? null,
          metadataJson: toNullableJsonValue(alias.metadataJson)
        }))
      });
    }

    if ((input.roleHistory ?? []).length > 0) {
      await tx.canonicalMemberRoleHistory.createMany({
        data: (input.roleHistory ?? []).map((item) => ({
          snapshotId: input.snapshotId,
          memberId: requireMapValue(memberIdByStableKey, item.memberStableKey, "Member"),
          roleType: item.roleType,
          roleValue: item.roleValue,
          sourceSystem: item.sourceSystem ?? null,
          effectiveFrom: item.effectiveFrom,
          effectiveTo: item.effectiveTo ?? null,
          sourceEventId: resolveOptionalMapValue(eventIdByRef, item.sourceEventRef),
          metadataJson: toNullableJsonValue(item.metadataJson)
        }))
      });
    }

    if ((input.pcEntries ?? []).length > 0) {
      await tx.canonicalPcLedgerEntry.createMany({
        data: (input.pcEntries ?? []).map((entry) => ({
          snapshotId: input.snapshotId,
          importRunId: input.importRunId ?? null,
          memberId: requireMapValue(memberIdByStableKey, entry.memberStableKey, "Member"),
          sourceEventId: resolveOptionalMapValue(eventIdByRef, entry.sourceEventRef),
          entryType: entry.entryType,
          effectivePeriodKey: entry.effectivePeriodKey,
          amountPc: entry.amountPc,
          metadataJson: toNullableJsonValue(entry.metadataJson)
        }))
      });
    }

    if ((input.spEntries ?? []).length > 0) {
      await tx.canonicalSpLedgerEntry.createMany({
        data: (input.spEntries ?? []).map((entry) => ({
          snapshotId: input.snapshotId,
          importRunId: input.importRunId ?? null,
          memberId: requireMapValue(memberIdByStableKey, entry.memberStableKey, "Member"),
          sourceEventId: resolveOptionalMapValue(eventIdByRef, entry.sourceEventRef),
          entryType: entry.entryType,
          effectivePeriodKey: entry.effectivePeriodKey,
          amountSp: entry.amountSp,
          metadataJson: toNullableJsonValue(entry.metadataJson)
        }))
      });
    }

    if ((input.rewardObligations ?? []).length > 0) {
      await tx.canonicalRewardObligationEntry.createMany({
        data: (input.rewardObligations ?? []).map((entry) => ({
          snapshotId: input.snapshotId,
          importRunId: input.importRunId ?? null,
          memberId: requireMapValue(memberIdByStableKey, entry.memberStableKey, "Member"),
          sourceEventId: resolveOptionalMapValue(eventIdByRef, entry.sourceEventRef),
          rewardSourceCode: entry.rewardSourceCode,
          distributionCycle: entry.distributionCycle,
          obligationStatus: entry.obligationStatus ?? "ACCRUED",
          effectivePeriodKey: entry.effectivePeriodKey,
          amount: entry.amount,
          unit: entry.unit,
          eligibilitySnapshotKey: entry.eligibilitySnapshotKey ?? null,
          metadataJson: toNullableJsonValue(entry.metadataJson)
        }))
      });
    }

    if ((input.poolEntries ?? []).length > 0) {
      await tx.canonicalPoolLedgerEntry.createMany({
        data: (input.poolEntries ?? []).map((entry) => ({
          snapshotId: input.snapshotId,
          importRunId: input.importRunId ?? null,
          sourceEventId: resolveOptionalMapValue(eventIdByRef, entry.sourceEventRef),
          recipientMemberId: entry.recipientMemberStableKey
            ? requireMapValue(memberIdByStableKey, entry.recipientMemberStableKey, "Member")
            : null,
          poolCode: entry.poolCode,
          entryType: entry.entryType,
          distributionCycle: entry.distributionCycle,
          effectivePeriodKey: entry.effectivePeriodKey,
          amount: entry.amount,
          unit: entry.unit,
          shareCount: entry.shareCount ?? null,
          eligibilitySnapshotKey: entry.eligibilitySnapshotKey ?? null,
          metadataJson: toNullableJsonValue(entry.metadataJson)
        }))
      });
    }

    if ((input.cashoutEvents ?? []).length > 0) {
      await tx.canonicalCashoutEvent.createMany({
        data: (input.cashoutEvents ?? []).map((entry) => ({
          snapshotId: input.snapshotId,
          importRunId: input.importRunId ?? null,
          memberId: requireMapValue(memberIdByStableKey, entry.memberStableKey, "Member"),
          sourceEventId: resolveOptionalMapValue(eventIdByRef, entry.sourceEventRef),
          eventType: entry.eventType,
          occurredAt: entry.occurredAt,
          effectivePeriodKey: entry.effectivePeriodKey,
          amountUsd: entry.amountUsd,
          feeUsd: entry.feeUsd ?? null,
          metadataJson: toNullableJsonValue(entry.metadataJson)
        }))
      });
    }

    if ((input.qualificationWindows ?? []).length > 0) {
      await tx.canonicalQualificationWindow.createMany({
        data: (input.qualificationWindows ?? []).map((window) => ({
          snapshotId: input.snapshotId,
          importRunId: input.importRunId ?? null,
          memberId: requireMapValue(memberIdByStableKey, window.memberStableKey, "Member"),
          qualificationType: window.qualificationType,
          windowKey: window.windowKey,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          thresholdAmount: window.thresholdAmount ?? null,
          thresholdUnit: window.thresholdUnit ?? null,
          sourceEventId: resolveOptionalMapValue(eventIdByRef, window.sourceEventRef),
          metadataJson: toNullableJsonValue(window.metadataJson)
        }))
      });
    }

    const windows = await tx.canonicalQualificationWindow.findMany({
      where: {
        snapshotId: input.snapshotId
      },
      select: {
        id: true,
        windowKey: true,
        memberId: true,
        qualificationType: true
      }
    });
    const windowIdByCompositeKey = new Map(
      windows.map((window) => [
        `${window.memberId}::${window.qualificationType}::${window.windowKey}`,
        window.id
      ] as const)
    );

    if ((input.qualificationStatusHistory ?? []).length > 0) {
      await tx.canonicalQualificationStatusHistory.createMany({
        data: (input.qualificationStatusHistory ?? []).map((item) => {
          const memberId = requireMapValue(memberIdByStableKey, item.memberStableKey, "Member");
          const compositeWindowKey = item.sourceWindowKey
            ? `${memberId}::${item.qualificationType}::${item.sourceWindowKey}`
            : null;

          return {
            snapshotId: input.snapshotId,
            memberId,
            qualificationType: item.qualificationType,
            status: item.status,
            effectiveFrom: item.effectiveFrom,
            effectiveTo: item.effectiveTo ?? null,
            sourceWindowId: compositeWindowKey
              ? requireMapValue(windowIdByCompositeKey, compositeWindowKey, "Qualification window")
              : null,
            sourceEventId: resolveOptionalMapValue(eventIdByRef, item.sourceEventRef),
            metadataJson: toNullableJsonValue(item.metadataJson)
          };
        })
      });
    }

    return getCanonicalSnapshotGraph(input.snapshotId);
  });
}
