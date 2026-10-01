import type { StudentInput } from "../../domain/student-validation";
import type { SchoolYear } from "../../domain/school-year";
import type { LayoutItem } from "../../domain/classroom-layout";
import type { AllocationCandidate, SeatingAssignment, Student } from "../../domain/models";
import type { SeatingHistoryRow, StudentExperienceRow } from "../../application/seating-history-service";
import type { ConstraintSet } from "../../application/constraint-service";
import type { CafeteriaAssignment } from "../../domain/cafeteria-engine";
import type { PairProximityStat } from "../../domain/pair-proximity-stats";
import type { CafeteriaHistoryRow } from "../../application/cafeteria-service";

export interface AppInfo {
  name: string;
  version: string;
  environment: "development" | "production";
}

export interface SeatingOptions {
  /** 세로 한 줄 모둠 활동을 고려한다. */
  groupActivity: boolean;
}

export interface AppApi {
  getInfo(): Promise<AppInfo>;
  students: {
    list(schoolYearId: string): Promise<Student[]>;
    add(schoolYearId: string, input: StudentInput): Promise<Student>;
    transferOut(studentId: string, date: string): Promise<Student>;
  };
  schoolYears: {
    list(): Promise<SchoolYear[]>;
    create(year: number): Promise<SchoolYear>;
  };
  classroom: {
    get(schoolYearId: string): Promise<{ classroomLayoutId: string; schoolYearId: string; items: LayoutItem[] } | undefined>;
    save(schoolYearId: string, items: LayoutItem[]): Promise<{ classroomLayoutId: string; schoolYearId: string; items: LayoutItem[] }>;
  };
  seating: {
    confirm(schoolYearId: string, classroomLayoutId: string, students: Student[], desks: LayoutItem[], assignments: SeatingAssignment[], semester: number, occurredOn: string): Promise<number>;
    generate(schoolYearId: string, students: Student[], desks: LayoutItem[], options?: SeatingOptions): Promise<AllocationCandidate[]>;
    /** 진행 중인 후보 생성을 취소한다. 취소된 generate는 빈 배열을 반환한다. */
    cancelGenerate(): Promise<void>;
    /** 후보 생성 진행(완료 횟수/전체)을 구독하고 해제 함수를 반환한다. */
    onGenerateProgress(listener: (progress: { completed: number; total: number }) => void): () => void;
    evaluate(schoolYearId: string, students: Student[], desks: LayoutItem[], assignments: SeatingAssignment[], options?: SeatingOptions): Promise<AllocationCandidate["evaluation"]>;
  };
  history: { list(schoolYearId: string, semester?: number): Promise<SeatingHistoryRow[]>; experience(schoolYearId: string, semester?: number): Promise<StudentExperienceRow[]>; assignments(sessionId: string): Promise<SeatingAssignment[]>; latestAssignments(schoolYearId: string): Promise<SeatingAssignment[]>; pairProximity(schoolYearId: string, desks: LayoutItem[]): Promise<PairProximityStat[]>; importHistorical(schoolYearId: string, classroomLayoutId: string, students: Student[], desks: LayoutItem[], sessions: Array<{ semester: number; occurredOn: string; assignments: SeatingAssignment[] }>): Promise<number[]>; };
  constraints: { get(schoolYearId: string): Promise<ConstraintSet>; save(schoolYearId: string, set: ConstraintSet): Promise<ConstraintSet>; };
  cafeteria: { confirm(schoolYearId: string, semester: number, assignments: CafeteriaAssignment[]): Promise<number>; history(schoolYearId: string): Promise<CafeteriaHistoryRow[]>; assignments(sessionId: string): Promise<CafeteriaAssignment[]>; };
  leadership: { list(schoolYearId: string, semester: number): Promise<string[]>; save(schoolYearId: string, semester: number, studentIds: string[]): Promise<string[]>; };
  backup: { export(): Promise<string | null>; restore(): Promise<string | null>; };
}
