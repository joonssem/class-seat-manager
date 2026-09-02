import { contextBridge, ipcRenderer } from "electron";
import type { AppApi } from "../shared/contracts/app";

const api: AppApi = {
  getInfo: () => ipcRenderer.invoke("app:get-info"),
  students: {
    list: (schoolYearId) => ipcRenderer.invoke("students:list", schoolYearId),
    add: (schoolYearId, input) => ipcRenderer.invoke("students:add", schoolYearId, input),
    transferOut: (studentId, date) => ipcRenderer.invoke("students:transfer-out", studentId, date)
  },
  schoolYears: {
    list: () => ipcRenderer.invoke("school-years:list"),
    create: (year) => ipcRenderer.invoke("school-years:create", year)
  },
  classroom: {
    get: (schoolYearId) => ipcRenderer.invoke("classroom:get", schoolYearId),
    save: (schoolYearId, items) => ipcRenderer.invoke("classroom:save", schoolYearId, items)
  },
  seating: {
    confirm: (schoolYearId, classroomLayoutId, students, desks, assignments) => ipcRenderer.invoke("seating:confirm", schoolYearId, classroomLayoutId, students, desks, assignments),
    generate: (schoolYearId, students, desks) => ipcRenderer.invoke("seating:generate", schoolYearId, students, desks),
    evaluate: (schoolYearId, students, desks, assignments) => ipcRenderer.invoke("seating:evaluate", schoolYearId, students, desks, assignments)
  },
  history: {
    list: (schoolYearId, semester) => ipcRenderer.invoke("history:list", schoolYearId, semester),
    experience: (schoolYearId, semester) => ipcRenderer.invoke("history:experience", schoolYearId, semester),
    assignments: (sessionId) => ipcRenderer.invoke("history:assignments", sessionId),
    latestAssignments: (schoolYearId) => ipcRenderer.invoke("history:latest-assignments", schoolYearId)
    ,importHistorical: (schoolYearId, classroomLayoutId, students, desks, sessions) => ipcRenderer.invoke("history:import-historical", schoolYearId, classroomLayoutId, students, desks, sessions)
  },
  constraints: {
    get: (schoolYearId) => ipcRenderer.invoke("constraints:get", schoolYearId),
    save: (schoolYearId, set) => ipcRenderer.invoke("constraints:save", schoolYearId, set)
  },
  cafeteria: {
    confirm: (schoolYearId, semester, assignments) => ipcRenderer.invoke("cafeteria:confirm", schoolYearId, semester, assignments),
    history: (schoolYearId) => ipcRenderer.invoke("cafeteria:history", schoolYearId),
    assignments: (sessionId) => ipcRenderer.invoke("cafeteria:assignments", sessionId)
  },
  leadership: {
    list: (schoolYearId, semester) => ipcRenderer.invoke("leadership:list", schoolYearId, semester),
    save: (schoolYearId, semester, studentIds) => ipcRenderer.invoke("leadership:save", schoolYearId, semester, studentIds)
  },
  backup: {
    export: () => ipcRenderer.invoke("backup:export"),
    restore: () => ipcRenderer.invoke("backup:restore")
  }
};

contextBridge.exposeInMainWorld("appApi", api);
