import {
  createEmptySchedule,
  getDoctorCounts,
  getDoctorDayStatus,
  validateSchedule
} from "./rules";
import type { Doctor } from "./types";

const doctors: Doctor[] = [
  { id: "a", name: "王医生", kind: "normal", unavailableDays: [] },
  { id: "b", name: "钟医生", kind: "dayOnly", targetDayShifts: 2, unavailableDays: [] }
];

it("creates an empty week with seven days and four positions per day", () => {
  const schedule = createEmptySchedule();
  expect(schedule.days).toHaveLength(7);
  expect(schedule.days[0].assignments).toEqual({ day1: null, day2: null, night1: null, night2: null });
});

it("counts day, night, and total shifts", () => {
  const schedule = createEmptySchedule();
  schedule.days[0].assignments.day1 = "a";
  schedule.days[1].assignments.night2 = "a";
  expect(getDoctorCounts(schedule, "a")).toEqual({ day: 1, night: 1, total: 2 });
});

it("derives 出 after a night shift", () => {
  const schedule = createEmptySchedule();
  schedule.days[1].assignments.night1 = "a";
  expect(getDoctorDayStatus(schedule, "a", 2)).toBe("offAfterNight");
});

it("reports missing positions and rule violations", () => {
  const schedule = createEmptySchedule();
  schedule.days[0].assignments.day1 = "b";
  schedule.days[0].assignments.night1 = "b";
  const issues = validateSchedule(schedule, doctors, { requireFilledPositions: true });
  expect(issues.some((issue) => issue.type === "missingPosition")).toBe(true);
  expect(issues.some((issue) => issue.type === "sameDayMultipleAssignments")).toBe(true);
  expect(issues.some((issue) => issue.type === "dayOnlyDoctorOnNight")).toBe(true);
});
