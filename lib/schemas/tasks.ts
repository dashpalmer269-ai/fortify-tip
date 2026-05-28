import { z } from "zod";

export const TaskUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "blocked", "done", "dismissed"]).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
export type TaskUpdateBody = z.infer<typeof TaskUpdateSchema>;

export const TaskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  assigned_to: z.string().uuid().nullable().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
  control_id: z.string().uuid().nullable().optional(),
});
export type TaskCreateBody = z.infer<typeof TaskCreateSchema>;
