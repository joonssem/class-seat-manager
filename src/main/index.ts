import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { z } from "zod";
import { join } from "node:path";
import type { AppInfo } from "../shared/contracts/app";
import { StudentService } from "../application/student-service";
import type { StudentInput } from "../domain/student-validation";
import { openDatabase } from "./db/database";
import { SqliteStudentRepository } from "./db/student-repository";
import { SchoolYearService } from "../application/school-year-service";
import { SqliteSchoolYearRepository } from "./db/school-year-repository";
import { ClassroomService } from "../application/classroom-service";
import { SqliteClassroomRepository } from "./db/classroom-repository";
import { SeatingService } from "../application/seating-service";
import { SqliteSeatingRepository } from "./db/seating-repository";
import { SeatingHistoryService } from "../application/seating-history-service";
import { SqliteSeatingHistoryRepository } from "./db/seating-history-repository";
import { evaluateAllocation, generateCandidates } from "../domain/seating-engine";
import { calculateSeatPosition } from "../domain/classroom-layout";
import type { LayoutItem } from "../domain/classroom-layout";
import type { Seat, Student, SeatingAssignment } from "../domain/models";
import { SqliteConstraintRepository } from "./db/constraint-repository";
import { ConstraintService } from "../application/constraint-service";
import { SqliteConstraintWriteRepository } from "./db/constraint-write-repository";
import { CafeteriaService } from "../application/cafeteria-service";
import { SqliteCafeteriaRepository } from "./db/cafeteria-repository";
import type { CafeteriaAssignment } from "../domain/cafeteria-engine";
import { BackupService } from "./system/backup-service";
import { LeadershipService } from "../application/leadership-service";
import { SqliteLeadershipRepository } from "./db/leadership-repository";
import { assignmentSchema, cafeteriaAssignmentSchema, constraintSetSchema, layoutItemSchema, parseIpc, schoolYearIdSchema, studentIdSchema, studentInputSchema, studentSchema, zDateSchema } from "./ipc-validation";

let mainWindow: BrowserWindow | undefined;

let studentService: StudentService;
let schoolYearService: SchoolYearService;
let classroomService: ClassroomService;
let seatingService: SeatingService;
let historyService: SeatingHistoryService;
let constraintRepository: SqliteConstraintRepository;
let constraintService: ConstraintService;
let cafeteriaService: CafeteriaService;
let leadershipService: LeadershipService;
let backupService: BackupService;
let database: ReturnType<typeof openDatabase> | undefined;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());

  mainWindow.on("closed", () => { mainWindow = undefined; });
}

function registerIpc(): void {
  ipcMain.handle("app:get-info", (): AppInfo => ({
    name: "학급 자리배치 도우미",
    version: app.getVersion(),
    environment: app.isPackaged ? "production" : "development"
  }));
  ipcMain.handle("students:list", (_event, schoolYearId: string) => studentService.list(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID")));
  ipcMain.handle("students:add", (_event, schoolYearId: string, input: StudentInput) => studentService.add(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID"), parseIpc(studentInputSchema, input, "학생 정보")));
  ipcMain.handle("students:transfer-out", (_event, studentId: string, date: string) => studentService.transferOut(parseIpc(studentIdSchema, studentId, "학생 ID"), parseIpc(zDateSchema, date, "전출일")));
  ipcMain.handle("school-years:list", () => schoolYearService.list());
  ipcMain.handle("school-years:create", (_event, year: number) => schoolYearService.create(parseIpc(z.number().int().min(2000).max(2100), year, "학년도")));
  ipcMain.handle("classroom:get", (_event, schoolYearId: string) => classroomService.get(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID")));
  ipcMain.handle("classroom:save", (_event, schoolYearId: string, items: LayoutItem[]) => classroomService.save(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID"), parseIpc(layoutItemSchema.array().max(500), items, "교실 요소")));
  ipcMain.handle("seating:confirm", (_event, schoolYearId: string, classroomLayoutId: string, students: Student[], desks: LayoutItem[], assignments: SeatingAssignment[], semester: number, occurredOn: string) => seatingService.confirm(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID"), parseIpc(z.string().trim().min(1), classroomLayoutId, "교실 배치 ID"), parseIpc(studentSchema.array().max(100), students, "학생 목록"), parseIpc(layoutItemSchema.array().max(500), desks, "교실 요소"), parseIpc(assignmentSchema.array().max(100), assignments, "자리 배치"), parseIpc(z.number().int().min(1).max(2), semester, "학기"), parseIpc(zDateSchema, occurredOn, "배치일")));
  ipcMain.handle("seating:generate", (_event, schoolYearId: string, students: Student[], desks: LayoutItem[]) => {
    const validatedSchoolYearId = parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID");
    const validatedStudents = parseIpc(studentSchema.array().max(100), students, "학생 목록");
    const validatedDesks = parseIpc(layoutItemSchema.array().max(500), desks, "교실 요소");
    return generateCandidates({ students: validatedStudents, seats: toSeats(validatedDesks), history: historyService.confirmedSessions(validatedSchoolYearId), seatConstraints: constraintRepository.seat(validatedSchoolYearId), pairConstraints: constraintRepository.pairs(validatedSchoolYearId) });
  });
  ipcMain.handle("seating:evaluate", (_event, schoolYearId: string, students: Student[], desks: LayoutItem[], assignments: SeatingAssignment[]) => { const id = parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID"); const validatedStudents = parseIpc(studentSchema.array().max(100), students, "학생 목록"); const validatedDesks = parseIpc(layoutItemSchema.array().max(500), desks, "교실 요소"); return evaluateAllocation({ students: validatedStudents, seats: toSeats(validatedDesks), history: historyService.confirmedSessions(id), seatConstraints: constraintRepository.seat(id), pairConstraints: constraintRepository.pairs(id) }, parseIpc(assignmentSchema.array().max(100), assignments, "자리 배치")); });
  ipcMain.handle("history:list", (_event, schoolYearId: string, semester?: number) => historyService.list(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID"), semester === undefined ? undefined : parseIpc(z.number().int().min(1).max(2), semester, "학기")));
  ipcMain.handle("history:experience", (_event, schoolYearId: string, semester?: number) => historyService.experience(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID"), semester === undefined ? undefined : parseIpc(z.number().int().min(1).max(2), semester, "학기")));
  ipcMain.handle("history:assignments", (_event, sessionId: string) => historyService.assignments(parseIpc(z.string().trim().min(1), sessionId, "자리배치 회차 ID")));
  ipcMain.handle("history:latest-assignments", (_event, schoolYearId: string) => historyService.latestAssignments(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID")));
  ipcMain.handle("history:import-historical", (_event, schoolYearId: string, classroomLayoutId: string, students: Student[], desks: LayoutItem[], sessions: Array<{ semester: number; occurredOn: string; assignments: SeatingAssignment[] }>) => seatingService.confirmBatch(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID"), parseIpc(z.string().trim().min(1), classroomLayoutId, "교실 배치 ID"), parseIpc(studentSchema.array().max(100), students, "학생 목록"), parseIpc(layoutItemSchema.array().max(500), desks, "교실 요소"), sessions));
  ipcMain.handle("constraints:save", (_event, schoolYearId: string, set) => constraintService.save(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID"), parseIpc(constraintSetSchema, set, "자리 조건")));
  ipcMain.handle("constraints:get", (_event, schoolYearId: string) => { const id = parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID"); return { seat: constraintRepository.seat(id), pairs: constraintRepository.pairs(id) }; });
  ipcMain.handle("cafeteria:confirm", (_event, schoolYearId: string, semester: number, assignments: CafeteriaAssignment[]) => cafeteriaService.confirm(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID"), parseIpc(z.number().int().min(1).max(2), semester, "학기"), parseIpc(cafeteriaAssignmentSchema.array().max(22), assignments, "급식실 배치")));
  ipcMain.handle("cafeteria:history", (_event, schoolYearId: string) => cafeteriaService.history(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID")));
  ipcMain.handle("cafeteria:assignments", (_event, sessionId: string) => cafeteriaService.assignments(parseIpc(z.string().trim().min(1), sessionId, "급식실 회차 ID")));
  ipcMain.handle("leadership:list", (_event, schoolYearId: string, semester: number) => leadershipService.list(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID"), parseIpc(z.number().int().min(1).max(2), semester, "학기")));
  ipcMain.handle("leadership:save", (_event, schoolYearId: string, semester: number, studentIds: string[]) => leadershipService.save(parseIpc(schoolYearIdSchema, schoolYearId, "학년도 ID"), parseIpc(z.number().int().min(1).max(2), semester, "학기"), parseIpc(studentIdSchema.array().length(4), studentIds, "인솔 학생")));
  ipcMain.handle("backup:export", async () => { const selected = await dialog.showSaveDialog({ title: "자리배치 데이터 백업", defaultPath: "class-seat-manager-backup.sqlite", filters: [{ name: "SQLite 백업", extensions: ["sqlite"] }] }); return selected.canceled || !selected.filePath ? null : backupService.export(selected.filePath); });
  ipcMain.handle("backup:restore", async () => { const selected = await dialog.showOpenDialog({ title: "자리배치 백업 복원", properties: ["openFile"], filters: [{ name: "SQLite 백업", extensions: ["sqlite"] }] }); if (selected.canceled || !selected.filePaths[0]) return null; const confirmed = await dialog.showMessageBox({ type: "warning", buttons: ["복원", "취소"], defaultId: 1, cancelId: 1, title: "백업 복원 확인", message: "현재 로컬 데이터가 백업 파일로 교체됩니다.", detail: "복원 전 현재 데이터의 안전 백업을 자동으로 만든 뒤 앱을 재시작합니다." }); if (confirmed.response !== 0) return null; const source = selected.filePaths[0]; const safetyBackup = backupService.createRestoreSafetyBackup(); database?.close(); backupService.restore(source); app.relaunch({ args: [`--restored-from=${source}`, `--safety-backup=${safetyBackup}`] }); app.exit(0); return source; });
}

function toSeats(desks: LayoutItem[]): Seat[] {
  const frontDoor = desks.find((item) => item.type === "front-door"); const backDoor = desks.find((item) => item.type === "back-door");
  return desks.filter((item) => item.type === "desk").map((item) => ({ seatId: item.id, seatCode: item.id, x: item.x, y: item.y, width: item.width, height: item.height, position: calculateSeatPosition(item, frontDoor, backDoor), isActive: true }));
}

app.whenReady().then(() => {
  database = openDatabase(join(app.getPath("userData"), "data", "class-seat-manager.sqlite"));
  schoolYearService = new SchoolYearService(new SqliteSchoolYearRepository(database));
  studentService = new StudentService(new SqliteStudentRepository(database));
  classroomService = new ClassroomService(new SqliteClassroomRepository(database));
  seatingService = new SeatingService(new SqliteSeatingRepository(database));
  historyService = new SeatingHistoryService(new SqliteSeatingHistoryRepository(database));
  constraintRepository = new SqliteConstraintRepository(database);
  constraintService = new ConstraintService(new SqliteConstraintWriteRepository(database));
  cafeteriaService = new CafeteriaService(new SqliteCafeteriaRepository(database));
  leadershipService = new LeadershipService(new SqliteLeadershipRepository(database));
  backupService = new BackupService(database, join(app.getPath("userData"), "data", "class-seat-manager.sqlite"));
  registerIpc();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("before-quit", () => { database?.close(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
