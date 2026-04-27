import type { Prisma } from "@prisma/client";
import { RunStatus } from "@prisma/client";

import { prisma } from "./client";
import { runSnapshotSelect } from "./snapshots";

type CreateSimulationRunInput = {
  scenarioId: string;
  snapshotId: string;
  modelVersionId: string;
  createdBy?: string | null;
  engineVersion?: string | null;
  seedHash?: string | null;
};

type RunListOptions = {
  includeArchived?: boolean;
};

type PersistCompletedRunInput = {
  summaryMetrics: Record<string, number>;
  timeSeriesMetrics: Array<{
    period_key: string;
    metric_key: string;
    metric_value: number;
  }>;
  segmentMetrics: Array<{
    segment_type: string;
    segment_key: string;
    metric_key: string;
    metric_value: number;
  }>;
  flags: Array<{
    flag_type: string;
    severity: string;
    message: string;
    period_key?: string | null;
  }>;
  recommendationSignals: Prisma.InputJsonValue;
  runNotes?: string | null;
  completedAt?: Date | null;
};

const runInclude = {
  scenario: true,
  snapshot: {
    select: runSnapshotSelect
  },
  modelVersion: true,
  summaryMetrics: {
    orderBy: {
      metricKey: "asc" as const
    }
  },
  timeSeries: {
    orderBy: [
      {
        periodKey: "asc" as const
      },
      {
        metricKey: "asc" as const
      }
    ]
  },
  segmentMetrics: {
    orderBy: [
      {
        segmentType: "asc" as const
      },
      {
        segmentKey: "asc" as const
      },
      {
        metricKey: "asc" as const
      }
    ]
  },
  flags: {
    orderBy: [
      {
        severity: "asc" as const
      },
      {
        flagType: "asc" as const
      }
    ]
  },
  decisionLogResolutions: {
    orderBy: {
      updatedAt: "desc" as const
    }
  },
  decisionPacks: {
    orderBy: {
      createdAt: "desc" as const
    }
  }
};

const duplicateBlockingStatuses = [
  RunStatus.QUEUED,
  RunStatus.RUNNING,
  RunStatus.COMPLETED
] as const;

function buildRunArchiveWhere(options: RunListOptions = {}) {
  return options.includeArchived
    ? {}
    : {
        archivedAt: null
      };
}

export async function listRuns(options: RunListOptions = {}) {
  return prisma.simulationRun.findMany({
    where: buildRunArchiveWhere(options),
    include: runInclude,
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function listRunReferences(options: RunListOptions = {}) {
  return prisma.simulationRun.findMany({
    where: buildRunArchiveWhere(options),
    select: {
      id: true,
      status: true,
      archivedAt: true,
      isPinned: true,
      createdAt: true,
      completedAt: true,
      scenario: {
        select: {
          id: true,
          name: true
        }
      },
      snapshot: {
        select: {
          id: true,
          name: true
        }
      },
      modelVersion: {
        select: {
          id: true,
          versionName: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function listCompletedRuns(options: RunListOptions = {}) {
  return prisma.simulationRun.findMany({
    where: {
      status: RunStatus.COMPLETED,
      ...(buildRunArchiveWhere(options) ?? {})
    },
    include: runInclude,
    orderBy: {
      completedAt: "desc"
    }
  });
}

export async function listCompletedRunsByIds(runIds: string[]) {
  if (runIds.length === 0) {
    return [];
  }

  return prisma.simulationRun.findMany({
    where: {
      id: {
        in: runIds
      },
      status: RunStatus.COMPLETED
    },
    include: runInclude
  });
}

export async function getRunById(runId: string) {
  return prisma.simulationRun.findUnique({
    where: {
      id: runId
    },
    include: runInclude
  });
}

export async function createSimulationRun(input: CreateSimulationRunInput) {
  return prisma.simulationRun.create({
    data: {
      scenarioId: input.scenarioId,
      snapshotId: input.snapshotId,
      modelVersionId: input.modelVersionId,
      createdBy: input.createdBy ?? null,
      engineVersion: input.engineVersion ?? null,
      seedHash: input.seedHash ?? null,
      status: RunStatus.QUEUED
    },
    include: runInclude
  });
}

export async function createSimulationRunIfUnique(input: CreateSimulationRunInput) {
  if (!input.seedHash) {
    return {
      duplicateOf: null,
      run: await createSimulationRun(input)
    };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${input.seedHash}, 0))
    `;

    const duplicateOf = await tx.simulationRun.findFirst({
      where: {
        seedHash: input.seedHash,
        archivedAt: null,
        status: {
          in: [...duplicateBlockingStatuses]
        }
      },
      include: runInclude,
      orderBy: {
        createdAt: "desc"
      }
    });

    if (duplicateOf) {
      return {
        duplicateOf,
        run: null
      };
    }

    const run = await tx.simulationRun.create({
      data: {
        scenarioId: input.scenarioId,
        snapshotId: input.snapshotId,
        modelVersionId: input.modelVersionId,
        createdBy: input.createdBy ?? null,
        engineVersion: input.engineVersion ?? null,
        seedHash: input.seedHash,
        status: RunStatus.QUEUED
      },
      include: runInclude
    });

    return {
      duplicateOf: null,
      run
    };
  });
}

export async function markRunStarted(runId: string) {
  return prisma.simulationRun.update({
    where: {
      id: runId
    },
    data: {
      status: RunStatus.RUNNING,
      startedAt: new Date()
    }
  });
}

export async function persistCompletedRun(runId: string, input: PersistCompletedRunInput) {
  return prisma.$transaction(async (tx) => {
    await tx.runSummaryMetric.deleteMany({
      where: {
        runId
      }
    });
    await tx.runTimeSeries.deleteMany({
      where: {
        runId
      }
    });
    await tx.runSegmentMetric.deleteMany({
      where: {
        runId
      }
    });
    await tx.runFlag.deleteMany({
      where: {
        runId
      }
    });

    await tx.runSummaryMetric.createMany({
      data: Object.entries(input.summaryMetrics).map(([metricKey, metricValue]) => ({
        runId,
        metricKey,
        metricValue
      }))
    });

    await tx.runTimeSeries.createMany({
      data: input.timeSeriesMetrics.map((metric) => ({
        runId,
        periodKey: metric.period_key,
        metricKey: metric.metric_key,
        metricValue: metric.metric_value
      }))
    });

    await tx.runSegmentMetric.createMany({
      data: input.segmentMetrics.map((metric) => ({
        runId,
        segmentType: metric.segment_type,
        segmentKey: metric.segment_key,
        metricKey: metric.metric_key,
        metricValue: metric.metric_value
      }))
    });

    if (input.flags.length > 0) {
      await tx.runFlag.createMany({
        data: input.flags.map((flag) => ({
          runId,
          flagType: flag.flag_type,
          severity: flag.severity,
          message: flag.message,
          periodKey: flag.period_key ?? null
        }))
      });
    }

    return tx.simulationRun.update({
      where: {
        id: runId
      },
      data: {
        status: RunStatus.COMPLETED,
        completedAt: input.completedAt ?? new Date(),
        runNotes: input.runNotes ?? null
      },
      include: runInclude
    });
  });
}

export async function markRunFailed(runId: string, message: string) {
  return prisma.simulationRun.update({
    where: {
      id: runId
    },
    data: {
      status: RunStatus.FAILED,
      completedAt: new Date(),
      runNotes: message
    }
  });
}

export async function archiveRun(
  runId: string,
  input: {
    archivedBy?: string | null;
    reason?: string | null;
  }
) {
  return prisma.simulationRun.update({
    where: {
      id: runId
    },
    data: {
      archivedAt: new Date(),
      archivedBy: input.archivedBy ?? null,
      archiveReason: input.reason ?? null
    },
    include: runInclude
  });
}

export async function unarchiveRun(runId: string) {
  return prisma.simulationRun.update({
    where: {
      id: runId
    },
    data: {
      archivedAt: null,
      archivedBy: null,
      archiveReason: null
    },
    include: runInclude
  });
}

export async function setRunPinned(runId: string, pinned: boolean) {
  return prisma.simulationRun.update({
    where: {
      id: runId
    },
    data: {
      isPinned: pinned
    },
    include: runInclude
  });
}
