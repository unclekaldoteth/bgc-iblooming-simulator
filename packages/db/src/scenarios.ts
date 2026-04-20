import type { Prisma } from "@prisma/client";

import { prisma } from "./client";
import { snapshotDefaultRelationSelect } from "./snapshots";

type ScenarioUpsertInput = {
  name: string;
  templateType: string;
  description?: string | null;
  snapshotIdDefault?: string | null;
  modelVersionId: string;
  parameterJson: Prisma.InputJsonValue;
  createdBy?: string | null;
};

const scenarioSelect = {
  id: true,
  name: true,
  templateType: true,
  description: true,
  snapshotIdDefault: true,
  modelVersionId: true,
  parameterJson: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  modelVersion: true,
  snapshotDefault: {
    select: snapshotDefaultRelationSelect
  },
  runs: {
    take: 1,
    orderBy: {
      createdAt: "desc" as const
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      completedAt: true
    }
  }
} as const;

export async function listScenarios() {
  return prisma.scenario.findMany({
    select: scenarioSelect,
    orderBy: {
      updatedAt: "desc"
    }
  });
}

export async function getScenarioById(scenarioId: string) {
  return prisma.scenario.findUnique({
    where: {
      id: scenarioId
    },
    select: scenarioSelect
  });
}

export async function createScenario(input: ScenarioUpsertInput) {
  return prisma.scenario.create({
    data: {
      name: input.name,
      templateType: input.templateType,
      description: input.description ?? null,
      snapshotIdDefault: input.snapshotIdDefault ?? null,
      modelVersionId: input.modelVersionId,
      parameterJson: input.parameterJson,
      createdBy: input.createdBy ?? null
    },
    select: scenarioSelect
  });
}

export async function updateScenario(
  scenarioId: string,
  input: Omit<ScenarioUpsertInput, "createdBy">
) {
  return prisma.scenario.update({
    where: {
      id: scenarioId
    },
    data: {
      name: input.name,
      templateType: input.templateType,
      description: input.description ?? null,
      snapshotIdDefault: input.snapshotIdDefault ?? null,
      modelVersionId: input.modelVersionId,
      parameterJson: input.parameterJson
    },
    select: scenarioSelect
  });
}
