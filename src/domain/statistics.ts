import { getDoctorDayStatus } from "./rules";
import type { DayIndex, DoctorStats, V2AppState, WeekArchive } from "./types";

function countWeek(
  doctors: V2AppState["doctors"],
  schedule: V2AppState["schedule"],
  archives: WeekArchive[],
  doctorId: string,
  acc: { day: number; night: number; offAfterNight: number; rest: number; weeks: number }
) {
  for (let d = 0; d < 7; d++) {
    const dayIndex = d as DayIndex;
    const status = getDoctorDayStatus(schedule, doctorId, dayIndex);
    if (status === "day1" || status === "day2") acc.day++;
    else if (status === "night1" || status === "night2") acc.night++;
    else if (status === "offAfterNight") acc.offAfterNight++;
    else acc.rest++;
  }

  for (const archive of archives) {
    let hasShift = false;
    for (let d = 0; d < 7; d++) {
      const dayIndex = d as DayIndex;
      const status = getDoctorDayStatus(archive.schedule, doctorId, dayIndex);
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
}

export function computeStats(
  doctors: V2AppState["doctors"],
  currentSchedule: V2AppState["schedule"],
  archives: WeekArchive[],
  dateFrom: string,
  dateTo: string
): DoctorStats[] {
  const filteredArchives = archives.filter(
    (a) => a.weekStart >= dateFrom && a.weekStart <= dateTo
  );

  return doctors.map((doctor) => {
    const acc = { day: 0, night: 0, offAfterNight: 0, rest: 0, weeks: 0 };
    countWeek(doctors, currentSchedule, filteredArchives, doctor.id, acc);

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
