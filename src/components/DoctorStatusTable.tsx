import { dayLabels, getDoctorDayStatus, shiftLabels } from "../domain/rules";
import type { Doctor, DoctorDayStatus, ScheduleIssue, WeeklySchedule } from "../domain/types";

interface DoctorStatusTableProps {
  doctors: Doctor[];
  schedule: WeeklySchedule;
  issues: ScheduleIssue[];
}

const statusLabel: Record<DoctorDayStatus, string> = {
  day1: "白1",
  day2: "白2",
  night1: "夜1",
  night2: "夜2",
  extraDay: "白",
  extraNight: "夜",
  offAfterNight: "出",
  rest: "休"
};

function cellClassName(status: DoctorDayStatus, hasIssue: boolean) {
  const classes = ["status-cell"];
  if (status === "night1" || status === "night2" || status === "extraNight") {
    classes.push("status-night");
  } else if (status === "day1" || status === "day2" || status === "extraDay") {
    classes.push("status-day");
  } else if (status === "offAfterNight") {
    classes.push("status-off");
  } else {
    classes.push("status-rest");
  }
  if (hasIssue) {
    classes.push("status-issue");
  }
  return classes.join(" ");
}

export function DoctorStatusTable({ doctors, schedule, issues }: DoctorStatusTableProps) {
  return (
    <section className="panel status-table-panel" aria-label="医生本周一览">
      <div className="panel-heading">
        <h2>按医生查看</h2>
        <span>{doctors.length} 人</span>
      </div>
      <div className="status-table-wrapper">
        <table className="status-table">
          <thead>
            <tr>
              <th className="status-doctor-col">医生</th>
              {dayLabels.map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doctors.map((doctor) => (
              <tr key={doctor.id}>
                <td className="status-doctor-col">
                  <span className="status-doctor-name">{doctor.name}</span>
                  <span className="status-doctor-kind">
                    {doctor.kind === "dayOnly" ? "只白班" : ""}
                  </span>
                </td>
                {dayLabels.map((_, index) => {
                  const dayIndex = index as 0 | 1 | 2 | 3 | 4 | 5 | 6;
                  const status = getDoctorDayStatus(schedule, doctor.id, dayIndex);
                  const hasIssue = issues.some(
                    (issue) => issue.doctorId === doctor.id && issue.dayIndex === dayIndex
                  );
                  return (
                    <td key={index} className={cellClassName(status, hasIssue)}>
                      {statusLabel[status]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
