import type { LayoutItem } from "../domain/classroom-layout";

export interface ClassroomLayoutData { classroomLayoutId: string; schoolYearId: string; items: LayoutItem[]; }
export interface ClassroomRepository { get(schoolYearId: string): ClassroomLayoutData | undefined; save(data: ClassroomLayoutData): void; }

export class ClassroomService {
  constructor(private readonly repository: ClassroomRepository) {}
  get(schoolYearId: string): ClassroomLayoutData | undefined { return this.repository.get(schoolYearId); }
  save(schoolYearId: string, items: LayoutItem[]): ClassroomLayoutData {
    const data = { classroomLayoutId: `layout_${schoolYearId}`, schoolYearId, items: items.map((item) => ({ ...item })) };
    this.repository.save(data);
    return data;
  }
}
