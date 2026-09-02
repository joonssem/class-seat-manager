import type { ClassroomLayoutData, ClassroomRepository } from "../../application/classroom-service";
import type { LayoutItem } from "../../domain/classroom-layout";
import type { SeatPosition } from "../../domain/models";

interface Statement { all(...params: unknown[]): Record<string, unknown>[]; run(...params: unknown[]): void; }
interface SqliteDatabase { prepare(sql: string): Statement; exec(sql: string): void; }

export class SqliteClassroomRepository implements ClassroomRepository {
  constructor(private readonly database: SqliteDatabase) {}
  get(schoolYearId: string): ClassroomLayoutData | undefined {
    const layout = this.database.prepare("SELECT * FROM classroom_layout WHERE school_year_id = ? ORDER BY updated_at DESC LIMIT 1").all(schoolYearId)[0];
    if (!layout) return undefined;
    const elements = this.database.prepare("SELECT * FROM classroom_element e WHERE e.classroom_layout_id = ? AND (e.element_type != 'desk' OR EXISTS (SELECT 1 FROM seat s WHERE s.element_id = e.element_id AND s.is_active = 1)) ORDER BY e.z_index, e.element_id").all(layout.classroom_layout_id);
    return { classroomLayoutId: String(layout.classroom_layout_id), schoolYearId, items: elements.map((row) => ({ id: String(row.element_id), type: row.element_type as LayoutItem["type"], x: Number(row.x), y: Number(row.y), width: Number(row.width), height: Number(row.height), positionOverride: row.position_override_json ? JSON.parse(String(row.position_override_json)) as Partial<SeatPosition> : undefined })) };
  }
  save(data: ClassroomLayoutData): void {
    const now = new Date().toISOString();
    this.database.exec("BEGIN");
    try {
      this.database.prepare("INSERT INTO classroom_layout (classroom_layout_id, school_year_id, name, canvas_width, canvas_height, coordinate_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(classroom_layout_id) DO UPDATE SET updated_at = excluded.updated_at").run(data.classroomLayoutId, data.schoolYearId, "기본 교실", 1, 1, now, now);
      this.database.prepare("UPDATE seat SET is_active = 0 WHERE classroom_layout_id = ?").run(data.classroomLayoutId);
      const insert = this.database.prepare("INSERT INTO classroom_element (element_id, classroom_layout_id, element_type, x, y, width, height, rotation, z_index, position_override_json) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?) ON CONFLICT(element_id) DO UPDATE SET classroom_layout_id = excluded.classroom_layout_id, element_type = excluded.element_type, x = excluded.x, y = excluded.y, width = excluded.width, height = excluded.height, z_index = excluded.z_index, position_override_json = excluded.position_override_json");
      data.items.forEach((item, index) => insert.run(item.id, data.classroomLayoutId, item.type, item.x, item.y, item.width, item.height, index, item.positionOverride ? JSON.stringify(item.positionOverride) : null));
      const seatUpsert = this.database.prepare("INSERT INTO seat (seat_id, classroom_layout_id, element_id, seat_code, is_active, auto_position_tags_json) VALUES (?, ?, ?, ?, 1, '{}') ON CONFLICT(seat_id) DO UPDATE SET classroom_layout_id = excluded.classroom_layout_id, element_id = excluded.element_id, seat_code = excluded.seat_code, is_active = 1");
      data.items.filter((item) => item.type === "desk").forEach((item) => seatUpsert.run(item.id, data.classroomLayoutId, item.id, item.id));
      this.database.exec("COMMIT");
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
}
