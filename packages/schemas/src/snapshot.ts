import { z } from "zod";

export const snapshotStatusSchema = z.enum([
  "DRAFT",
  "VALIDATING",
  "INVALID",
  "VALID",
  "APPROVED",
  "ARCHIVED"
]);

export const datasetSnapshotSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  sourceSystems: z.array(z.string()).min(1),
  canonicalSourceSnapshotKey: z.string().nullable().optional(),
  dateFrom: z.string(),
  dateTo: z.string(),
  fileUri: z.string().min(1),
  recordCount: z.number().int().nonnegative().nullable().optional(),
  validationStatus: snapshotStatusSchema,
  approvedBy: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export type DatasetSnapshot = z.infer<typeof datasetSnapshotSchema>;

export const snapshotValidationIssueSchema = z.object({
  severity: z.enum(["ERROR", "WARNING"]),
  issueType: z.string().min(1),
  message: z.string().min(1),
  rowRef: z.string().nullable().optional()
});

export const createDatasetSnapshotSchema = z.object({
  name: z.string().min(3),
  sourceSystems: z.array(z.string().min(1)).min(1),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  fileUri: z.string().min(1),
  recordCount: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(1000).nullable().optional()
});

export const approveDatasetSnapshotSchema = z.object({
  approvedByUserId: z.string().min(1).optional()
});

export type SnapshotValidationIssue = z.infer<typeof snapshotValidationIssueSchema>;
export type CreateDatasetSnapshotInput = z.infer<typeof createDatasetSnapshotSchema>;
