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
  onAddExtra: (dayIndex: DayIndex, type: "day" | "night", doctorId: string) => void;
  onRemoveExtra: (dayIndex: DayIndex, type: "day" | "night", doctorId: string) => void;
}

function getDoctorName(doctors: Doctor[], doctorId: string | null) {
  if (!doctorId) return "";
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
    <div
      ref={droppable.setNodeRef}
      className={[
        "shift-cell",
        isFilled ? "filled" : "empty",
        hasIssue ? "issue-cell" : "",
        droppable.isOver ? "drop-target" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      onContextMenu={(event) => {
        event.preventDefault();
        onAssign(dayIndex, shiftKey, null);
      }}
    >
      <button
        type="button"
        className="cell-assign-button"
        onClick={() => onAssign(dayIndex, shiftKey, selectedDoctorId)}
      >
        {doctorName || "缺人"}
      </button>
      {doctorName ? (
        <button
          type="button"
          className="cell-clear-button"
          aria-label={`清除 ${dayLabels[dayIndex]} ${shiftLabels[shiftKey]} ${doctorName}`}
          onClick={(event) => {
            event.stopPropagation();
            onAssign(dayIndex, shiftKey, null);
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

interface ExtraCellProps {
  dayIndex: DayIndex;
  doctorIds: string[];
  doctors: Doctor[];
  type: "day" | "night";
  onRemoveExtra: (dayIndex: DayIndex, type: "day" | "night", doctorId: string) => void;
}

function ExtraCell({ dayIndex, doctorIds, doctors, type, onRemoveExtra }: ExtraCellProps) {
  const dropId = `extra-${type}:${dayIndex}`;
  const droppable = useDroppable({ id: dropId });

  return (
    <div
      ref={droppable.setNodeRef}
      className={["extra-cell", droppable.isOver ? "drop-target" : ""].filter(Boolean).join(" ")}
    >
      {doctorIds.length === 0 ? (
        <span className="extra-placeholder">拖入</span>
      ) : (
        doctorIds.map((id) => {
          const name = getDoctorName(doctors, id);
          return (
            <span key={id} className="extra-tag">
              {name}
              <button
                type="button"
                className="extra-tag-remove"
                aria-label={`移除 ${name}`}
                onClick={() => onRemoveExtra(dayIndex, type, id)}
              >
                ×
              </button>
            </span>
          );
        })
      )}
    </div>
  );
}

export function ScheduleGrid({
  doctors,
  issues,
  schedule,
  selectedDoctorId,
  onAssign,
  onAddExtra,
  onRemoveExtra
}: ScheduleGridProps) {
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
        {/* Extra rows */}
        <div className="shift-row">
          <div className="shift-label extra-label">+白</div>
          {schedule.days.map((day) => (
            <ExtraCell
              key={`extra-day-${day.dayIndex}`}
              dayIndex={day.dayIndex}
              doctorIds={day.extraDay}
              doctors={doctors}
              type="day"
              onRemoveExtra={onRemoveExtra}
            />
          ))}
        </div>
        <div className="shift-row">
          <div className="shift-label extra-label">+夜</div>
          {schedule.days.map((day) => (
            <ExtraCell
              key={`extra-night-${day.dayIndex}`}
              dayIndex={day.dayIndex}
              doctorIds={day.extraNight}
              doctors={doctors}
              type="night"
              onRemoveExtra={onRemoveExtra}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
