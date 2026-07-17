import { generateSchedule } from "./scheduler";
import { validateSchedule } from "./rules";
import type { Doctor } from "./types";

function makeDoctors(): Doctor[] {
  return [
    { id: "d1", name: "医生1", kind: "normal", unavailableDays: [] },
    { id: "d2", name: "医生2", kind: "normal", unavailableDays: [] },
    { id: "d3", name: "医生3", kind: "normal", unavailableDays: [] },
    { id: "d4", name: "医生4", kind: "normal", unavailableDays: [] },
    { id: "d5", name: "医生5", kind: "normal", unavailableDays: [] },
    { id: "d6", name: "医生6", kind: "normal", unavailableDays: [] },
    { id: "d7", name: "医生7", kind: "normal", unavailableDays: [] },
    { id: "d8", name: "医生8", kind: "normal", unavailableDays: [] },
    { id: "d9", name: "医生9", kind: "normal", unavailableDays: [] },
    { id: "zhong", name: "钟医生", kind: "dayOnly", targetDayShifts: 2, unavailableDays: [] }
  ];
}

it("generates a legal schedule for ten available doctors", () => {
  const result = generateSchedule(makeDoctors());
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(validateSchedule(result.schedule, makeDoctors(), { requireFilledPositions: true })).toEqual([]);
});

it("returns failure when capacity is not enough", () => {
  const result = generateSchedule(makeDoctors().slice(0, 6));
  expect(result.ok).toBe(false);
});

it("does not assign night shifts to day-only doctors", () => {
  const doctors = makeDoctors();
  const result = generateSchedule(doctors);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const zhongNightCount = result.schedule.days.filter((day) =>
    day.assignments.night1 === "zhong" || day.assignments.night2 === "zhong"
  ).length;
  expect(zhongNightCount).toBe(0);
});
