import { useDroppable } from "@dnd-kit/core";
import { dayLabels, shiftLabels } from "../domain/rules";
import type { DayIndex, Doctor, ScheduleIssue, ShiftKey, WeeklySchedule } from "../domain/types";

const shiftKeys: ShiftKey[] = ["day1", "day2", "night1", "night2"];

interface ScheduleGridProps {
  doctors: Doctor[];
  issues: ScheduleIssue[];
  schedule: WeeklySchedule;
  selectedDoctorId: string | null;
  onAssign: (dayIndex: DayIndex, shiftKey: ShiftKey, doctorId: string | null) => void;
}

function getDoctorName(doctors: Doctor[], doctorId: string | null) {
  if (!doctorId) {
    return "";
  }

  return doctors.find((doctor) => doctor.id === doctorId)?.name ?? doctorId;
}

function hasCellIssue(issues: ScheduleIssue[], dayIndex: DayIndex, shiftKey: ShiftKey) {
  return issues.some((issue) => issue.dayIndex === dayIndex && (!issue.shiftKey || issue.shiftKey === shiftKey));
}

interface ScheduleCellProps {
  dayIndex: DayIndex;
  doctorName: string;
  hasIssue: boolean;
  isFilled: boolean;
  selectedDoctorId: string | null;
  shiftKey: ShiftKey;
  onAssign: (dayIndex: DayIndex, shiftKey: ShiftKey, doctorId: string | null) => void;
}

function ScheduleCell({
  dayIndex,
  doctorName,
  hasIssue,
  isFilled,
  selectedDoctorId,
  shiftKey,
  onAssign
}: ScheduleCellProps) {
  const droppable = useDroppable({ id: `cell:${dayIndex}:${shiftKey}` });

  return (
    <button
      ref={droppable.setNodeRef}
      type="button"
      className={["shift-cell", isFilled ? "filled" : "empty", hasIssue ? "issue-cell" : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onAssign(dayIndex, shiftKey, selectedDoctorId)}
      onContextMenu={(event) => {
        event.preventDefault();
        onAssign(dayIndex, shiftKey, null);
      }}
    >
      {doctorName || "缺人"}
    </button>
  );
}

export function ScheduleGrid({ doctors, issues, schedule, selectedDoctorId, onAssign }: ScheduleGridProps) {
  return (
    <section className="panel schedule-panel" aria-label="一周排班表">
      <div className="panel-heading">
        <h2>本周排班</h2>
        <span>{selectedDoctorId ? `已选择 ${getDoctorName(doctors, selectedDoctorId)}` : "先选医生或直接拖拽"}</span>
      </div>
      <div className="schedule-grid">
        <div className="grid-corner" />
        {dayLabels.map((label) => (
          <div key={label} className="day-header">
            {label}
          </div>
        ))}
        {shiftKeys.map((shiftKey) => (
          <div className="shift-row" key={shiftKey}>
            <div className="shift-label">{shiftLabels[shiftKey]}</div>
            {schedule.days.map((day) => {
              const doctorId = day.assignments[shiftKey];
              const hasIssue = hasCellIssue(issues, day.dayIndex, shiftKey);
              return (
                <ScheduleCell
                  key={`${day.dayIndex}-${shiftKey}`}
                  dayIndex={day.dayIndex}
                  doctorName={getDoctorName(doctors, doctorId)}
                  hasIssue={hasIssue}
                  isFilled={Boolean(doctorId)}
                  selectedDoctorId={selectedDoctorId}
                  shiftKey={shiftKey}
                  onAssign={onAssign}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
