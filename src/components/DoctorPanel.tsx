import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import { dayLabels, getDoctorCounts } from "../domain/rules";
import type { DayIndex, Doctor, DoctorKind, WeeklySchedule } from "../domain/types";

interface DoctorPanelProps {
  doctors: Doctor[];
  schedule: WeeklySchedule;
  selectedDoctorId: string | null;
  onSelectDoctor: (doctorId: string) => void;
  onRenameDoctor: (doctorId: string, name: string) => void;
  onToggleUnavailableDay: (doctorId: string, dayIndex: DayIndex) => void;
  onChangeTargetDayShifts: (doctorId: string, target: 1 | 2 | 3) => void;
  onAddDoctor: (name: string, kind: DoctorKind) => void;
  onDeleteDoctor: (doctorId: string) => void;
  onToggleUnavailableDayShift: (doctorId: string, dayIndex: DayIndex) => void;
  onToggleUnavailableNightShift: (doctorId: string, dayIndex: DayIndex) => void;
  onChangePreference: (doctorId: string, pref: "auto" | "1白2夜" | "2白1夜") => void;
  onChangeTargetNightShifts: (doctorId: string, target: 1 | 2 | 3) => void;
}

interface DoctorCardProps {
  doctor: Doctor;
  schedule: WeeklySchedule;
  selectedDoctorId: string | null;
  onSelectDoctor: (doctorId: string) => void;
  onRenameDoctor: (doctorId: string, name: string) => void;
  onToggleUnavailableDay: (doctorId: string, dayIndex: DayIndex) => void;
  onChangeTargetDayShifts: (doctorId: string, target: 1 | 2 | 3) => void;
  onDeleteDoctor: (doctorId: string) => void;
  onToggleUnavailableDayShift: (doctorId: string, dayIndex: DayIndex) => void;
  onToggleUnavailableNightShift: (doctorId: string, dayIndex: DayIndex) => void;
  onChangePreference: (doctorId: string, pref: "auto" | "1白2夜" | "2白1夜") => void;
  onChangeTargetNightShifts: (doctorId: string, target: 1 | 2 | 3) => void;
}

function DoctorCard({
  doctor,
  schedule,
  selectedDoctorId,
  onSelectDoctor,
  onRenameDoctor,
  onToggleUnavailableDay,
  onChangeTargetDayShifts,
  onDeleteDoctor,
  onToggleUnavailableDayShift,
  onToggleUnavailableNightShift,
  onChangePreference,
  onChangeTargetNightShifts
}: DoctorCardProps) {
  const counts = getDoctorCounts(schedule, doctor.id);
  const totalLimit = doctor.kind === "dayOnly" ? doctor.targetDayShifts ?? 2 : 3;
  const dayLimit = doctor.kind === "dayOnly" ? doctor.targetDayShifts ?? 2
    : doctor.kind === "nightOnly" ? 0 : 2;
  const nightLimit = doctor.kind === "nightOnly" ? 2 : doctor.kind === "dayOnly" ? 0 : 2;
  const overLimit = counts.total > totalLimit || counts.day > dayLimit || counts.night > nightLimit;
  const draggable = useDraggable({ id: `doctor:${doctor.id}` });

  const kindLabel = doctor.kind === "dayOnly" ? "只白班" : doctor.kind === "nightOnly" ? "只夜班" : "普通";

  return (
    <article
      ref={draggable.setNodeRef}
      className={[
        "doctor-card",
        selectedDoctorId === doctor.id ? "selected" : "",
        draggable.isDragging ? "dragging-source" : "",
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
        <button
          type="button"
          className="doctor-delete-button"
          aria-label={`删除 ${doctor.name}`}
          onClick={() => onDeleteDoctor(doctor.id)}
        >
          ×
        </button>
      </div>
      <div className="doctor-meta">
        <span>{kindLabel}</span>
        <span className={counts.day > dayLimit ? "bad-stat" : ""}>白 {counts.day}/{dayLimit}</span>
        <span className={counts.night > nightLimit ? "bad-stat" : ""}>夜 {counts.night}/{nightLimit}</span>
        <span className={counts.total > totalLimit ? "bad-stat" : ""}>总 {counts.total}/{totalLimit}</span>
      </div>
      {doctor.kind === "dayOnly" ? (
        <label className="target-select">
          白班目标
          <select
            value={doctor.targetDayShifts ?? 2}
            onChange={(event) => onChangeTargetDayShifts(doctor.id, Number(event.target.value) as 1 | 2 | 3)}
          >
            <option value={1}>1 个</option>
            <option value={2}>2 个</option>
            <option value={3}>3 个</option>
          </select>
        </label>
      ) : null}
      {doctor.kind === "nightOnly" ? (
        <label className="target-select">
          夜班目标
          <select
            value={doctor.targetNightShifts ?? 2}
            onChange={(event) => onChangeTargetNightShifts(doctor.id, Number(event.target.value) as 1 | 2 | 3)}
          >
            <option value={1}>1 个</option>
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
      <div className="unavailable-row">
        <span className="unavailable-title">不上白</span>
        <div className="unavailable-days" aria-label={`${doctor.name} 不上白班`}>
          {dayLabels.map((label, index) => {
            const dayIndex = index as DayIndex;
            return (
              <label key={label}>
                <input
                  type="checkbox"
                  checked={doctor.unavailableDayShifts.includes(dayIndex)}
                  onChange={() => onToggleUnavailableDayShift(doctor.id, dayIndex)}
                />
                {label.replace("周", "")}
              </label>
            );
          })}
        </div>
      </div>
      <div className="unavailable-row">
        <span className="unavailable-title">不上夜</span>
        <div className="unavailable-days" aria-label={`${doctor.name} 不上夜班`}>
          {dayLabels.map((label, index) => {
            const dayIndex = index as DayIndex;
            return (
              <label key={label}>
                <input
                  type="checkbox"
                  checked={doctor.unavailableNightShifts.includes(dayIndex)}
                  onChange={() => onToggleUnavailableNightShift(doctor.id, dayIndex)}
                />
                {label.replace("周", "")}
              </label>
            );
          })}
        </div>
      </div>
      {doctor.kind === "normal" ? (
        <label className="target-select">
          偏好
          <select
            value={doctor.preference}
            onChange={(event) => onChangePreference(doctor.id, event.target.value as "auto" | "1白2夜" | "2白1夜")}
          >
            <option value="auto">自动</option>
            <option value="2白1夜">2白1夜</option>
            <option value="1白2夜">1白2夜</option>
          </select>
        </label>
      ) : null}
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
  onChangeTargetDayShifts,
  onAddDoctor,
  onDeleteDoctor,
  onToggleUnavailableDayShift,
  onToggleUnavailableNightShift,
  onChangePreference,
  onChangeTargetNightShifts
}: DoctorPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<DoctorKind>("normal");

  const handleAdd = () => {
    if (showAddForm) {
      if (newName.trim()) {
        onAddDoctor(newName.trim(), newKind);
        setNewName("");
        setNewKind("normal");
      }
      setShowAddForm(false);
    } else {
      setShowAddForm(true);
    }
  };

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
            onDeleteDoctor={onDeleteDoctor}
            onToggleUnavailableDayShift={onToggleUnavailableDayShift}
            onToggleUnavailableNightShift={onToggleUnavailableNightShift}
            onChangePreference={onChangePreference}
            onChangeTargetNightShifts={onChangeTargetNightShifts}
          />
        ))}
      </div>
      <div className="add-doctor-area">
        {showAddForm ? (
          <div className="add-doctor-form">
            <input
              className="add-doctor-name"
              placeholder="医生姓名"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
            />
            <select
              className="add-doctor-kind"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as DoctorKind)}
            >
              <option value="normal">普通医生</option>
              <option value="dayOnly">只白班</option>
              <option value="nightOnly">只夜班</option>
            </select>
            <button type="button" className="add-doctor-confirm" onClick={handleAdd}>
              确认添加
            </button>
            <button type="button" className="add-doctor-cancel" onClick={() => setShowAddForm(false)}>
              取消
            </button>
          </div>
        ) : (
          <button type="button" className="add-doctor-trigger" onClick={handleAdd}>
            + 添加医生
          </button>
        )}
      </div>
    </aside>
  );
}
