import { getDoctorDayStatus } from "./rules";
import type { DayIndex, Doctor, DoctorStats, V2AppState, WeeklySchedule, WeekArchive } from "./types";

function countSchedule(
  schedule: WeeklySchedule,
  doctorId: string,
  acc: { day: number; night: number; offAfterNight: number; rest: number; weeks: number }
) {
  let hasShift = false;
  for (let d = 0; d < 7; d++) {
    const dayIndex = d as DayIndex;
    const status = getDoctorDayStatus(schedule, doctorId, dayIndex);
    if (status === "day1" || status === "day2") {
      acc.day++;
      hasShift = true;
    } else if (status === "night1" || status === "night2") {
      acc.night++;
      hasShift = true;
    } else if (status === "offAfterNight") {
      acc.offAfterNight++;
    } else {
      acc.rest++;
    }
  }
  if (hasShift) acc.weeks++;
}

function dedupeDoctors(allDoctors: Doctor[]): Doctor[] {
  const seen = new Map<string, Doctor>();
  for (const d of allDoctors) {
    if (!seen.has(d.id)) {
      seen.set(d.id, d);
    }
  }
  return [...seen.values()];
}

export function computeStats(
  currentDoctors: V2AppState["doctors"],
  currentSchedule: V2AppState["schedule"],
  archives: WeekArchive[],
  dateFrom: string,
  dateTo: string
): DoctorStats[] {
  const filteredArchives = archives.filter(
    (a) => a.weekStart >= dateFrom && a.weekStart <= dateTo
  );

  // Collect all doctors that ever appear in the selected range
  const allDoctors = dedupeDoctors([
    ...currentDoctors,
    ...filteredArchives.flatMap((a) => a.doctors)
  ]);

  return allDoctors.map((doctor) => {
    const acc = { day: 0, night: 0, offAfterNight: 0, rest: 0, weeks: 0 };

    // Always include current week
    countSchedule(currentSchedule, doctor.id, acc);

    // Count from filtered archives
    for (const archive of filteredArchives) {
      countSchedule(archive.schedule, doctor.id, acc);
    }

    return {
      doctorId: doctor.id,
      doctorName: doctor.name,
      kind: doctor.kind,
      day: acc.day,
      night: acc.night,
      total: acc.day + acc.night,
      offAfterNight: acc.offAfterNight,
      rest: acc.rest,
      weekCount: acc.weeks
    };
  });
}
