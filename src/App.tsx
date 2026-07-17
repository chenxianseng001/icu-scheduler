import { useEffect, useMemo, useState } from "react";
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import "./App.css";
import { DoctorPanel } from "./components/DoctorPanel";
import { IssuePanel } from "./components/IssuePanel";
import { ScheduleGrid } from "./components/ScheduleGrid";
import { Toolbar } from "./components/Toolbar";
import { exportWorkbook } from "./domain/exportExcel";
import { createEmptySchedule, validateSchedule } from "./domain/rules";
import { generateSchedule } from "./domain/scheduler";
import { loadAppState, saveAppState } from "./domain/storage";
import type { AppState, DayIndex, Doctor, ShiftKey } from "./domain/types";

export default function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [schedulerMessage, setSchedulerMessage] = useState<string | null>(null);
  const [activeDragDoctorId, setActiveDragDoctorId] = useState<string | null>(null);

  const issues = useMemo(
    () => validateSchedule(state.schedule, state.doctors, { requireFilledPositions: true }),
    [state]
  );

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const updateDoctors = (updater: (doctors: Doctor[]) => Doctor[]) => {
    setSchedulerMessage(null);
    setState((current) => ({
      ...current,
      doctors: updater(current.doctors)
    }));
  };

  const updateSchedule = (updater: (schedule: AppState["schedule"]) => AppState["schedule"]) => {
    setSchedulerMessage(null);
    setState((current) => ({
      ...current,
      schedule: updater(current.schedule)
    }));
  };

  const assignDoctor = (dayIndex: DayIndex, shiftKey: ShiftKey, doctorId: string | null) => {
    updateSchedule((schedule) => ({
      days: schedule.days.map((day) =>
        day.dayIndex === dayIndex
          ? {
              ...day,
              assignments: {
                ...day.assignments,
                [shiftKey]: doctorId
              }
            }
          : day
      )
    }));
  };

  const toggleUnavailableDay = (doctorId: string, dayIndex: DayIndex) => {
    updateDoctors((doctors) =>
      doctors.map((doctor) => {
        if (doctor.id !== doctorId) {
          return doctor;
        }

        const unavailableDays = doctor.unavailableDays.includes(dayIndex)
          ? doctor.unavailableDays.filter((day) => day !== dayIndex)
          : [...doctor.unavailableDays, dayIndex].sort();

        return {
          ...doctor,
          unavailableDays
        };
      })
    );
  };

  const changeTargetDayShifts = (doctorId: string, targetDayShifts: 2 | 3) => {
    updateDoctors((doctors) =>
      doctors.map((doctor) => (doctor.id === doctorId ? { ...doctor, targetDayShifts } : doctor))
    );
  };

  const renameDoctor = (doctorId: string, name: string) => {
    updateDoctors((doctors) =>
      doctors.map((doctor) => (doctor.id === doctorId ? { ...doctor, name } : doctor))
    );
  };

  const autoSchedule = () => {
    const result = generateSchedule(state.doctors);
    if (result.ok) {
      setState((current) => ({
        ...current,
        schedule: result.schedule
      }));
      setSchedulerMessage("已生成一版合法排班");
      return;
    }

    setSchedulerMessage(result.message);
  };

  const clearSchedule = () => {
    updateSchedule(() => createEmptySchedule());
  };

  const newWeek = () => {
    setSchedulerMessage(null);
    setState((current) => ({
      doctors: current.doctors.map((doctor) => ({
        ...doctor,
        unavailableDays: []
      })),
      schedule: createEmptySchedule()
    }));
  };

  const exportSchedule = () => {
    if (issues.length > 0 && !window.confirm(`当前排班仍有 ${issues.length} 个问题，是否继续导出？`)) {
      return;
    }

    exportWorkbook(state, issues);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    if (activeId.startsWith("doctor:")) {
      setActiveDragDoctorId(activeId.replace("doctor:", ""));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : "";
    setActiveDragDoctorId(null);

    if (!activeId.startsWith("doctor:") || !overId.startsWith("cell:")) {
      return;
    }

    const doctorId = activeId.replace("doctor:", "");
    const [, dayIndexText, shiftKey] = overId.split(":");
    assignDoctor(Number(dayIndexText) as DayIndex, shiftKey as ShiftKey, doctorId);
  };

  const handleDragCancel = () => {
    setActiveDragDoctorId(null);
  };

  const activeDragDoctor = activeDragDoctorId
    ? state.doctors.find((doctor) => doctor.id === activeDragDoctorId)
    : undefined;

  return (
    <main className="app-shell">
      <Toolbar
        issuesCount={issues.length}
        onAutoSchedule={autoSchedule}
        onClear={clearSchedule}
        onExport={exportSchedule}
        onNewWeek={newWeek}
      />
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div className="workspace">
          <DoctorPanel
            doctors={state.doctors}
            schedule={state.schedule}
            selectedDoctorId={selectedDoctorId}
            onSelectDoctor={setSelectedDoctorId}
            onRenameDoctor={renameDoctor}
            onToggleUnavailableDay={toggleUnavailableDay}
            onChangeTargetDayShifts={changeTargetDayShifts}
          />
          <ScheduleGrid
            doctors={state.doctors}
            issues={issues}
            schedule={state.schedule}
            selectedDoctorId={selectedDoctorId}
            onAssign={assignDoctor}
          />
          <IssuePanel issues={issues} schedulerMessage={schedulerMessage} />
        </div>
        <DragOverlay>
          {activeDragDoctor ? <div className="drag-overlay-card">{activeDragDoctor.name}</div> : null}
        </DragOverlay>
      </DndContext>
    </main>
  );
}
