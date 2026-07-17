import * as XLSX from "xlsx";
import { dayLabels, getDoctorDayStatus, shiftLabels } from "./rules";
import type { AppState, DoctorDayStatus, ScheduleIssue, ShiftKey } from "./types";

function getDoctorName(state: AppState, doctorId: string | null) {
  if (!doctorId) {
    return "";
  }

  return state.doctors.find((doctor) => doctor.id === doctorId)?.name ?? doctorId;
}

function buildDateRows(state: AppState) {
  return state.schedule.days.map((day) => ({
    日期: dayLabels[day.dayIndex],
    白1: getDoctorName(state, day.assignments.day1),
    白2: getDoctorName(state, day.assignments.day2),
    夜1: getDoctorName(state, day.assignments.night1),
    夜2: getDoctorName(state, day.assignments.night2)
  }));
}

function buildDoctorRows(state: AppState) {
  const formatStatus = (status: DoctorDayStatus) => {
    if (status === "offAfterNight") {
      return "出";
    }

    if (status === "rest") {
      return "休";
    }

    return shiftLabels[status];
  };

  return state.doctors.map((doctor) => ({
    医生: doctor.name,
    周一: formatStatus(getDoctorDayStatus(state.schedule, doctor.id, 0)),
    周二: formatStatus(getDoctorDayStatus(state.schedule, doctor.id, 1)),
    周三: formatStatus(getDoctorDayStatus(state.schedule, doctor.id, 2)),
    周四: formatStatus(getDoctorDayStatus(state.schedule, doctor.id, 3)),
    周五: formatStatus(getDoctorDayStatus(state.schedule, doctor.id, 4)),
    周六: formatStatus(getDoctorDayStatus(state.schedule, doctor.id, 5)),
    周日: formatStatus(getDoctorDayStatus(state.schedule, doctor.id, 6))
  }));
}

function buildIssueRows(state: AppState, issues: ScheduleIssue[]) {
  return issues.map((issue) => ({
    类型: issue.type,
    问题: issue.message,
    医生: issue.doctorId ? state.doctors.find((doctor) => doctor.id === issue.doctorId)?.name ?? issue.doctorId : "",
    日期: typeof issue.dayIndex === "number" ? dayLabels[issue.dayIndex] : "",
    班次: issue.shiftKey ? shiftLabels[issue.shiftKey as ShiftKey] : ""
  }));
}

export function buildWorkbook(state: AppState, issues: ScheduleIssue[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildDoctorRows(state)), "按医生查看");

  if (issues.length > 0) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildIssueRows(state, issues)), "问题列表");
  }

  return workbook;
}

export function exportWorkbook(state: AppState, issues: ScheduleIssue[]): void {
  const workbook = buildWorkbook(state, issues);
  XLSX.writeFile(workbook, "ICU排班.xlsx");
}
