import { z } from "zod";

const id = z.string().trim().min(1).max(120);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다.");
export const zDateSchema = date;

export const schoolYearIdSchema = id;
export const studentIdSchema = id;
export const studentInputSchema = z.object({
  studentNumber: z.number().int().min(1).max(999),
  name: z.string().trim().min(1).max(100),
  gender: z.enum(["남", "여"]),
  enrollmentStatus: z.enum(["재학", "전출"]).optional(),
  transferInDate: date.optional(),
  transferOutDate: date.optional()
});

export const layoutItemSchema = z.object({
  id,
  type: z.enum(["desk", "chalkboard", "front-door", "back-door"]),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
  positionOverride: z.object({
    vertical: z.enum(["앞", "중간", "뒤"]).optional(),
    horizontal: z.enum(["왼쪽", "가운데", "오른쪽"]).optional(),
    nearFrontDoor: z.boolean().optional(),
    nearBackDoor: z.boolean().optional()
  }).strict().optional()
}).strict();

export const studentSchema = studentInputSchema.extend({
  studentId: id,
  schoolYearId: id,
  enrollmentStatus: z.enum(["재학", "전출"]),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const assignmentSchema = z.object({ studentId: id, seatId: id }).strict();
const strength = z.enum(["필수", "가급적", "선호"]);
export const seatConstraintSchema = z.object({ studentId: id, tag: z.enum(["vertical", "horizontal", "nearFrontDoor", "nearBackDoor"]), strength, expected: z.union([z.boolean(), z.string()]).optional() }).strict();
export const pairConstraintSchema = z.object({ studentAId: id, studentBId: id, type: z.enum(["바로 인접 금지", "최소 거리", "가능한 한 멀리"]), minDistance: z.number().positive().optional(), strength }).strict();
export const constraintSetSchema = z.object({ seat: seatConstraintSchema.array().max(500), pairs: pairConstraintSchema.array().max(500) }).strict();
export const cafeteriaAssignmentSchema = z.object({ studentId: id, queueOrder: z.number().int().min(1).max(21), cafeteriaSeatId: z.string().regex(/^CAF-(0[2-9]|1[0-9]|2[0-2])$/), role: z.literal("marshal").optional() }).strict();

export function parseIpc<T>(schema: z.ZodType<T>, value: unknown, fieldName: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`${fieldName} 입력이 올바르지 않습니다: ${result.error.issues[0]?.message ?? "형식 오류"}`);
  return result.data;
}
