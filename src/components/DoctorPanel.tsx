import { useDraggable } from "@dnd-kit/core";
import { dayLabels, getDoctorCounts } from "../domain/rules";
import type { DayIndex, Doctor, WeeklySchedule } from "../domain/types";

interface DoctorPanelProps {
  doctors: Doctor[];
  schedule: WeeklySchedule;
  selectedDoctorId: string | null;
  onSelectDoctor: (doctorId: string) => void;
  onRenameDoctor: (doctorId: string, name: string) => void;
  onToggleUnavailableDay: (doctorId: string, dayIndex: DayIndex) => void;
  onChangeTargetDayShifts: (doctorId: string, target: 2 | 3) => void;
}

interface DoctorCardProps {
  doctor: Doctor;
  schedule: WeeklySchedule;
  selectedDoctorId: string | null;
  onSelectDoctor: (doctorId: string) => void;
  onRenameDoctor: (doctorId: string, name: string) => void;
  onToggleUnavailableDay: (doctorId: string, dayIndex: DayIndex) => void;
  onChangeTargetDayShifts: (doctorId: string, target: 2 | 3) => void;
}

function DoctorCard({
  doctor,
  schedule,
  selectedDoctorId,
  onSelectDoctor,
  onRenameDoctor,
  onToggleUnavailableDay,
  onChangeTargetDayShifts
}: DoctorCardProps) {
  const counts = getDoctorCounts(schedule, doctor.id);
  const totalLimit = doctor.kind === "dayOnly" ? doctor.targetDayShifts ?? 2 : 3;
  const dayLimit = doctor.kind === "dayOnly" ? doctor.targetDayShifts ?? 2 : 2;
  const nightLimit = doctor.kind === "dayOnly" ? 0 : 2;
  const overLimit = counts.total > totalLimit || counts.day > dayLimit || counts.night > nightLimit;
  const draggable = useDraggable({ id: `doctor:${doctor.id}` });
  const style = draggable.transform
    ? {
        transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`
      }
    : undefined;

  return (
    <article
      ref={draggable.setNodeRef}
      style={style}
      className={[
        "doctor-card",
        selectedDoctorId === doctor.id ? "selected" : "",
        overLimit ? "over-limit" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="doctor-name-row">
        <input
          aria-label={`${doctor.name} 姓名`}
          className="doctor-name-input"
          value={doctor.name}
          onChange={(event) => onRenameDoctor(doctor.id, event.target.value)}
          onFocus={() => onSelectDoctor(doctor.id)}
        />
        <button
          type="button"
          className="doctor-drag-handle"
          aria-label={`拖拽 ${doctor.name}`}
          onClick={() => onSelectDoctor(doctor.id)}
          {...draggable.attributes}
          {...draggable.listeners}
        >
          拖
        </button>
      </div>
      <div className="doctor-meta">
        <span>{doctor.kind === "dayOnly" ? "只白班" : "普通"}</span>
        <span className={counts.day > dayLimit ? "bad-stat" : ""}>白 {counts.day}/{dayLimit}</span>
        <span className={counts.night > nightLimit ? "bad-stat" : ""}>夜 {counts.night}/{nightLimit}</span>
        <span className={counts.total > totalLimit ? "bad-stat" : ""}>总 {counts.total}/{totalLimit}</span>
      </div>
      {doctor.kind === "dayOnly" ? (
        <label className="target-select">
          白班目标
          <select
            value={doctor.targetDayShifts ?? 2}
            onChange={(event) => onChangeTargetDayShifts(doctor.id, Number(event.target.value) as 2 | 3)}
          >
            <option value={2}>2 个</option>
            <option value={3}>3 个</option>
          </select>
        </label>
      ) : null}
      <div className="unavailable-row">
        <span className="unavailable-title">不可排</span>
        <div className="unavailable-days" aria-label={`${doctor.name} 不可排日期`}>
          {dayLabels.map((label, index) => {
            const dayIndex = index as DayIndex;
            return (
              <label key={label}>
                <input
                  type="checkbox"
                  checked={doctor.unavailableDays.includes(dayIndex)}
                  onChange={() => onToggleUnavailableDay(doctor.id, dayIndex)}
                />
                {label.replace("周", "")}
              </label>
            );
          })}
        </div>
      </div>
    </article>
  );
}

export function DoctorPanel({
  doctors,
  schedule,
  selectedDoctorId,
  onSelectDoctor,
  onRenameDoctor,
  onToggleUnavailableDay,
  onChangeTargetDayShifts
}: DoctorPanelProps) {
  return (
    <aside className="panel doctor-panel" aria-label="医生列表">
      <div className="panel-heading">
        <h2>医生</h2>
        <span>{doctors.length} 人</span>
      </div>
      <div className="doctor-list">
        {doctors.map((doctor) => (
          <DoctorCard
            key={doctor.id}
            doctor={doctor}
            schedule={schedule}
            selectedDoctorId={selectedDoctorId}
            onSelectDoctor={onSelectDoctor}
            onRenameDoctor={onRenameDoctor}
            onToggleUnavailableDay={onToggleUnavailableDay}
            onChangeTargetDayShifts={onChangeTargetDayShifts}
          />
        ))}
      </div>
    </aside>
  );
}
