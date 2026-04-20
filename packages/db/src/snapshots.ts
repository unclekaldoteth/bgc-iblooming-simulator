import { Prisma } from "@prisma/client";
import { SnapshotImportStatus, SnapshotStatus } from "@prisma/client";

import { prisma } from "./client";

export type SnapshotValidationIssueInput = {
  severity: "ERROR" | "WARNING";
  issueType: string;
  message: string;
  rowRef?: string | null;
};

export type SnapshotImportIssueInput = {
  severity: "ERROR" | "WARNING";
  issueType: string;
  message: string;
  rowRef?: string | null;
};

export type SnapshotMemberMonthFactInput = {
  periodKey: string;
  memberKey: string;
  sourceSystem: string;
  memberTier?: string | null;
  groupKey?: string | null;
  pcVolume: number;
  spRewardBasis: number;
  globalRewardUsd: number;
  poolRewardUsd: number;
  cashoutUsd: number;
  sinkSpendUsd: number;
  activeMember: boolean;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type SnapshotRewardSourcePeriodFactInput = {
  periodKey: string;
  sourceSystem: "BGC" | "IBLOOMING";
  rewardSourceCode: string;
  unit: "USD" | "PC" | "SP" | "COUNT" | "SHARE";
  amount: number;
  obligationCount: number;
  beneficiaryCount: number;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type SnapshotPoolPeriodFactInput = {
  periodKey: string;
  poolCode: string;
  distributionCycle: string;
  unit: "USD" | "PC" | "SP" | "COUNT" | "SHARE";
  fundingAmount: number;
  distributionAmount: number;
  recipientCount: number;
  shareCountTotal: number;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type SnapshotMemberMonthFactRecord = Awaited<
  ReturnType<typeof listSnapshotMemberMonthFacts>
>[number];

type CreateSnapshotInput = {
  name: string;
  sourceSystems: string[];
  dateFrom: Date;
  dateTo: Date;
  fileUri: string;
  recordCount?: number | null;
  notes?: string | null;
  createdByUserId?: string | null;
};

type CreateSnapshotImportRunInput = {
  snapshotId: string;
  fileUri: string;
  requestedByUserId?: string | null;
};

const snapshotInclude = {
  validationIssues: {
    orderBy: [
      {
        severity: "asc" as const
      },
      {
        createdAt: "asc" as const
      }
    ]
  },
  importRuns: {
    take: 1,
    orderBy: {
      createdAt: "desc" as const
    },
    include: {
      issues: {
        orderBy: [
          {
            severity: "asc" as const
          },
          {
            createdAt: "asc" as const
          }
        ]
      }
    }
  },
  _count: {
    select: {
      memberMonthFacts: true
    }
  }
};

export async function listSnapshots() {
  return prisma.datasetSnapshot.findMany({
    include: snapshotInclude,
    orderBy: [
      {
        createdAt: "desc"
      }
    ]
  });
}

export async function getSnapshotById(snapshotId: string) {
  return prisma.datasetSnapshot.findUnique({
    where: {
      id: snapshotId
    },
    include: snapshotInclude
  });
}

export async function createSnapshot(input: CreateSnapshotInput) {
  return prisma.datasetSnapshot.create({
    data: {
      name: input.name,
      sourceSystems: input.sourceSystems,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      fileUri: input.fileUri,
      recordCount: input.recordCount ?? null,
      notes: input.notes ?? null,
      createdByUserId: input.createdByUserId ?? null
    },
    include: {
      validationIssues: true,
      importRuns: {
        take: 1,
        orderBy: {
          createdAt: "desc"
        }
      },
      _count: {
        select: {
          memberMonthFacts: true
        }
      }
    }
  });
}

export async function createSnapshotImportRun(input: CreateSnapshotImportRunInput) {
  return prisma.snapshotImportRun.create({
    data: {
      snapshotId: input.snapshotId,
      fileUri: input.fileUri,
      requestedByUserId: input.requestedByUserId ?? null,
      status: SnapshotImportStatus.QUEUED
    },
    include: {
      issues: true
    }
  });
}

export async function getSnapshotImportRunById(importRunId: string) {
  return prisma.snapshotImportRun.findUnique({
    where: {
      id: importRunId
    },
    include: {
      snapshot: true,
      issues: {
        orderBy: [
          {
            severity: "asc"
          },
          {
            createdAt: "asc"
          }
        ]
      }
    }
  });
}

export async function listSnapshotMemberMonthFacts(snapshotId: string) {
  return prisma.snapshotMemberMonthFact.findMany({
    where: {
      snapshotId
    },
    orderBy: [
      {
        periodKey: "asc"
      },
      {
        memberKey: "asc"
      },
      {
        sourceSystem: "asc"
      }
    ]
  });
}

export async function listSnapshotRewardSourcePeriodFacts(snapshotId: string) {
  return prisma.snapshotRewardSourcePeriodFact.findMany({
    where: {
      snapshotId
    },
    orderBy: [{ periodKey: "asc" }, { sourceSystem: "asc" }, { rewardSourceCode: "asc" }]
  });
}

export async function listSnapshotPoolPeriodFacts(snapshotId: string) {
  return prisma.snapshotPoolPeriodFact.findMany({
    where: {
      snapshotId
    },
    orderBy: [{ periodKey: "asc" }, { poolCode: "asc" }, { distributionCycle: "asc" }]
  });
}

export async function markSnapshotImportRunning(importRunId: string) {
  return prisma.snapshotImportRun.update({
    where: {
      id: importRunId
    },
    data: {
      status: SnapshotImportStatus.RUNNING,
      startedAt: new Date(),
      completedAt: null,
      notes: null
    }
  });
}

export async function replaceSnapshotFactsAndCompleteImport(
  importRunId: string,
  snapshotId: string,
  facts: SnapshotMemberMonthFactInput[],
  input: {
    rowCountRaw: number;
    rowCountImported: number;
    notes?: string | null;
    issues?: SnapshotImportIssueInput[];
    rewardSourcePeriodFacts?: SnapshotRewardSourcePeriodFactInput[];
    poolPeriodFacts?: SnapshotPoolPeriodFactInput[];
    canonicalSourceSnapshotKey?: string | null;
  }
) {
  return prisma.$transaction(async (tx) => {
    await tx.snapshotImportIssue.deleteMany({
      where: {
        importRunId
      }
    });

    if (input.issues && input.issues.length > 0) {
      await tx.snapshotImportIssue.createMany({
        data: input.issues.map((issue) => ({
          importRunId,
          severity: issue.severity,
          issueType: issue.issueType,
          message: issue.message,
          rowRef: issue.rowRef ?? null
        }))
      });
    }

    await tx.snapshotMemberMonthFact.deleteMany({
      where: {
        snapshotId
      }
    });

    await tx.snapshotRewardSourcePeriodFact.deleteMany({
      where: {
        snapshotId
      }
    });

    await tx.snapshotPoolPeriodFact.deleteMany({
      where: {
        snapshotId
      }
    });

    await tx.snapshotValidationIssue.deleteMany({
      where: {
        snapshotId
      }
    });

    if (facts.length > 0) {
      await tx.snapshotMemberMonthFact.createMany({
        data: facts.map((fact) => ({
          snapshotId,
          importRunId,
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
          metadataJson:
            typeof fact.metadataJson === "undefined"
              ? undefined
              : fact.metadataJson === null
                ? Prisma.JsonNull
                : fact.metadataJson
        }))
      });
    }

    if (input.rewardSourcePeriodFacts && input.rewardSourcePeriodFacts.length > 0) {
      await tx.snapshotRewardSourcePeriodFact.createMany({
        data: input.rewardSourcePeriodFacts.map((fact) => ({
          snapshotId,
          importRunId,
          periodKey: fact.periodKey,
          sourceSystem: fact.sourceSystem,
          rewardSourceCode: fact.rewardSourceCode as never,
          unit: fact.unit,
          amount: fact.amount,
          obligationCount: fact.obligationCount,
          beneficiaryCount: fact.beneficiaryCount,
          metadataJson:
            typeof fact.metadataJson === "undefined"
              ? undefined
              : fact.metadataJson === null
                ? Prisma.JsonNull
                : fact.metadataJson
        }))
      });
    }

    if (input.poolPeriodFacts && input.poolPeriodFacts.length > 0) {
      await tx.snapshotPoolPeriodFact.createMany({
        data: input.poolPeriodFacts.map((fact) => ({
          snapshotId,
          importRunId,
          periodKey: fact.periodKey,
          poolCode: fact.poolCode as never,
          distributionCycle: fact.distributionCycle as never,
          unit: fact.unit,
          fundingAmount: fact.fundingAmount,
          distributionAmount: fact.distributionAmount,
          recipientCount: fact.recipientCount,
          shareCountTotal: fact.shareCountTotal,
          metadataJson:
            typeof fact.metadataJson === "undefined"
              ? undefined
              : fact.metadataJson === null
                ? Prisma.JsonNull
                : fact.metadataJson
        }))
      });
    }

    await tx.datasetSnapshot.update({
      where: {
        id: snapshotId
      },
      data: {
        validationStatus: SnapshotStatus.DRAFT,
        approvedAt: null,
        approvedByUserId: null,
        canonicalSourceSnapshotKey: input.canonicalSourceSnapshotKey ?? null
      }
    });

    return tx.snapshotImportRun.update({
      where: {
        id: importRunId
      },
      data: {
        status: SnapshotImportStatus.COMPLETED,
        rowCountRaw: input.rowCountRaw,
        rowCountImported: input.rowCountImported,
        completedAt: new Date(),
        notes: input.notes ?? null
      },
      include: {
        issues: {
          orderBy: [
            {
              severity: "asc"
            },
            {
              createdAt: "asc"
            }
          ]
        }
      }
    });
  });
}

export async function failSnapshotImportRun(
  importRunId: string,
  input: {
    message: string;
    rowCountRaw?: number | null;
    rowCountImported?: number | null;
    issues?: SnapshotImportIssueInput[];
  }
) {
  return prisma.$transaction(async (tx) => {
    await tx.snapshotImportIssue.deleteMany({
      where: {
        importRunId
      }
    });

    if (input.issues && input.issues.length > 0) {
      await tx.snapshotImportIssue.createMany({
        data: input.issues.map((issue) => ({
          importRunId,
          severity: issue.severity,
          issueType: issue.issueType,
          message: issue.message,
          rowRef: issue.rowRef ?? null
        }))
      });
    }

    return tx.snapshotImportRun.update({
      where: {
        id: importRunId
      },
      data: {
        status: SnapshotImportStatus.FAILED,
        rowCountRaw: input.rowCountRaw ?? null,
        rowCountImported: input.rowCountImported ?? null,
        completedAt: new Date(),
        notes: input.message
      },
      include: {
        issues: {
          orderBy: [
            {
              severity: "asc"
            },
            {
              createdAt: "asc"
            }
          ]
        }
      }
    });
  });
}

export async function setSnapshotValidationResult(
  snapshotId: string,
  issues: SnapshotValidationIssueInput[]
) {
  const status = issues.some((issue) => issue.severity === "ERROR")
    ? SnapshotStatus.INVALID
    : SnapshotStatus.VALID;

  return prisma.$transaction(async (tx) => {
    await tx.snapshotValidationIssue.deleteMany({
      where: {
        snapshotId
      }
    });

    if (issues.length > 0) {
      await tx.snapshotValidationIssue.createMany({
        data: issues.map((issue) => ({
          snapshotId,
          severity: issue.severity,
          issueType: issue.issueType,
          message: issue.message,
          rowRef: issue.rowRef ?? null
        }))
      });
    }

    return tx.datasetSnapshot.update({
      where: {
        id: snapshotId
      },
      data: {
        validationStatus: status
      },
      include: {
        validationIssues: {
          orderBy: [
            {
              severity: "asc"
            },
            {
              createdAt: "asc"
            }
          ]
        }
      }
    });
  });
}

export async function markSnapshotValidating(snapshotId: string) {
  return prisma.datasetSnapshot.update({
    where: {
      id: snapshotId
    },
    data: {
      validationStatus: SnapshotStatus.VALIDATING
    }
  });
}

export async function approveSnapshot(snapshotId: string, approvedByUserId: string) {
  return prisma.datasetSnapshot.update({
    where: {
      id: snapshotId
    },
    data: {
      validationStatus: SnapshotStatus.APPROVED,
      approvedByUserId,
      approvedAt: new Date()
    },
    include: {
      validationIssues: true
    }
  });
}
