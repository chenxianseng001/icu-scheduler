import { generateSchedule } from "./scheduler";
import { getDoctorCounts, validateSchedule } from "./rules";
import type { DayIndex, Doctor } from "./types";

const def = {
  unavailableDayShifts: [] as DayIndex[],
  unavailableNightShifts: [] as DayIndex[],
  preference: "auto" as const
};

function makeDoctors(count = 12): Doctor[] {
  const list: Doctor[] = [];
  for (let i = 1; i <= count; i++) {
    list.push({ id: `d${i}`, name: `医生${i}`, kind: "normal", unavailableDays: [], ...def });
  }
  list.push({ id: "zhong", name: "钟医生", kind: "dayOnly", targetDayShifts: 2, unavailableDays: [], ...def });
  return list;
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

it("does not assign doctors on unavailable dates", () => {
  const doctors = makeDoctors();
  doctors[0].unavailableDays = [0];

  const result = generateSchedule(doctors);

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(Object.values(result.schedule.days[0].assignments)).not.toContain("d1");
});

it("does not assign a night doctor on the following day", () => {
  const doctors = makeDoctors();
  const result = generateSchedule(doctors);

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  for (let dayIndex = 1; dayIndex < result.schedule.days.length; dayIndex += 1) {
    const previousNightDoctors = [
      result.schedule.days[dayIndex - 1].assignments.night1,
      result.schedule.days[dayIndex - 1].assignments.night2
    ];
    const currentDayDoctors = Object.values(result.schedule.days[dayIndex].assignments);

    for (const doctorId of previousNightDoctors) {
      expect(currentDayDoctors).not.toContain(doctorId);
    }
  }
});

it("keeps normal doctors within their day and night shift sublimits", () => {
  const doctors = makeDoctors();
  const result = generateSchedule(doctors);

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  for (const doctor of doctors.filter((candidate) => candidate.kind === "normal")) {
    const counts = getDoctorCounts(result.schedule, doctor.id);
    expect(counts.day).toBeLessThanOrEqual(2);
    expect(counts.night).toBeLessThanOrEqual(2);
  }
});

it("fills a day-only doctor's target of three day shifts", () => {
  const doctors = makeDoctors();
  const dayOnlyDoctor = doctors.find((doctor) => doctor.id === "zhong")!;
  dayOnlyDoctor.targetDayShifts = 3;

  const result = generateSchedule(doctors);

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(getDoctorCounts(result.schedule, dayOnlyDoctor.id)).toMatchObject({ day: 3, night: 0 });
});

it("reports insufficient aggregate capacity without empty-schedule issues", () => {
  const result = generateSchedule(makeDoctors().slice(0, 6));

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.message).toContain("容量不足");
  expect(result.issues.some((issue) => issue.type === "insufficientCapacity")).toBe(true);
  expect(result.issues.some((issue) => issue.type === "missingPosition")).toBe(false);
});

it("reports unsatisfiable constraints without empty-schedule issues", () => {
  const doctors = makeDoctors();
  for (const doctor of doctors.filter((candidate) => candidate.kind === "normal")) {
    doctor.unavailableDays = [0];
  }

  const result = generateSchedule(doctors);

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.message).toContain("无法满足");
  expect(result.issues.some((issue) => issue.type === "unsatisfiableConstraints")).toBe(true);
  expect(result.issues.some((issue) => issue.type === "missingPosition")).toBe(false);
});
