import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import "./App.css";
import { DoctorPanel } from "./components/DoctorPanel";
import { DoctorStatusTable } from "./components/DoctorStatusTable";
import { IssuePanel } from "./components/IssuePanel";
import { PreviousWeekPanel } from "./components/PreviousWeekPanel";
import { ScheduleGrid } from "./components/ScheduleGrid";
import { StatisticsPanel } from "./components/StatisticsPanel";
import { Toolbar } from "./components/Toolbar";
import { exportWorkbook } from "./domain/exportExcel";
import { createEmptySchedule, validateSchedule } from "./domain/rules";
import { generateSchedule } from "./domain/scheduler";
import { loadState, saveState, archiveCurrentWeek, createDefaultState } from "./domain/storage";
import type { DayIndex, Doctor, DoctorKind, ShiftKey, V2AppState } from "./domain/types";

export default function App() {
  const [state, setState] = useState<V2AppState>(() => createDefaultState());
  const [loading, setLoading] = useState(true);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [schedulerMessage, setSchedulerMessage] = useState<string | null>(null);
  const [activeDragDoctorId, setActiveDragDoctorId] = useState<string | null>(null);

  useEffect(() => {
    loadState().then((s) => { setState(s); setLoading(false); });
  }, []);

  const loaded = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (!loaded.current) { loaded.current = true; return; }
    saveState(state);
  }, [state, loading]);

  const issues = useMemo(
    () => validateSchedule(state.schedule, state.doctors, { requireFilledPositions: true }),
    [state]
  );

  if (loading) {
    return (
      <main className="app-shell">
        <p style={{ padding: 40, fontSize: 16, color: "#4e5f70" }}>加载中…</p>
      </main>
    );
  }

  const updateDoctors = (updater: (doctors: Doctor[]) => Doctor[]) => {
    setSchedulerMessage(null);
    setState((current) => ({
      ...current,
      doctors: updater(current.doctors)
    }));
  };

  const updateSchedule = (updater: (schedule: V2AppState["schedule"]) => V2AppState["schedule"]) => {
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

  const toggleUnavailableDayShift = (doctorId: string, dayIndex: DayIndex) => {
    updateDoctors((doctors) =>
      doctors.map((doctor) => {
        if (doctor.id !== doctorId) return doctor;
        const arr = doctor.unavailableDayShifts;
        return { ...doctor, unavailableDayShifts: arr.includes(dayIndex) ? arr.filter((d) => d !== dayIndex) : [...arr, dayIndex].sort() };
      })
    );
  };

  const toggleUnavailableNightShift = (doctorId: string, dayIndex: DayIndex) => {
    updateDoctors((doctors) =>
      doctors.map((doctor) => {
        if (doctor.id !== doctorId) return doctor;
        const arr = doctor.unavailableNightShifts;
        return { ...doctor, unavailableNightShifts: arr.includes(dayIndex) ? arr.filter((d) => d !== dayIndex) : [...arr, dayIndex].sort() };
      })
    );
  };

  const changePreference = (doctorId: string, pref: "auto" | "1白2夜" | "2白1夜") => {
    updateDoctors((doctors) =>
      doctors.map((doctor) => (doctor.id === doctorId ? { ...doctor, preference: pref } : doctor))
    );
  };

  const renameDoctor = (doctorId: string, name: string) => {
    updateDoctors((doctors) =>
      doctors.map((doctor) => (doctor.id === doctorId ? { ...doctor, name } : doctor))
    );
  };

  const addDoctor = (name: string, kind: DoctorKind) => {
    const id = crypto.randomUUID();
    const newDoctor: Doctor = {
      id,
      name: name || "新医生",
      kind,
      unavailableDays: [],
      unavailableDayShifts: [],
      unavailableNightShifts: [],
      preference: "auto",
      ...(kind === "dayOnly" ? { targetDayShifts: 2 as const } : {})
    };
    updateDoctors((doctors) => [...doctors, newDoctor]);
  };

  const deleteDoctor = (doctorId: string) => {
    const doctor = state.doctors.find((d) => d.id === doctorId);
    if (!doctor) return;

    const assignedCount = state.schedule.days.reduce((count, day) => {
      return count + Object.values(day.assignments).filter((a) => a === doctorId).length;
    }, 0);

    const confirmMsg =
      assignedCount > 0
        ? `${doctor.name} 本周已排 ${assignedCount} 个班，确认删除？`
        : `确认删除 ${doctor.name}？`;

    if (!window.confirm(confirmMsg)) return;

    setSchedulerMessage(null);
    setState((current) => ({
      ...current,
      doctors: current.doctors.filter((d) => d.id !== doctorId),
      schedule: {
        days: current.schedule.days.map((day) => ({
          ...day,
          assignments: Object.fromEntries(
            Object.entries(day.assignments).map(([key, val]) => [key, val === doctorId ? null : val])
          ) as Record<ShiftKey, string | null>
        }))
      }
    }));
  };

  const addExtraDoctor = (dayIndex: DayIndex, type: "day" | "night", doctorId: string) => {
    setSchedulerMessage(null);
    setState((current) => ({
      ...current,
      schedule: {
        days: current.schedule.days.map((day) => {
          if (day.dayIndex !== dayIndex) return day;
          const key = type === "day" ? "extraDay" : "extraNight";
          const list = day[key];
          if (list.includes(doctorId)) return day;
          return { ...day, [key]: [...list, doctorId] };
        })
      }
    }));
  };

  const removeExtraDoctor = (dayIndex: DayIndex, type: "day" | "night", doctorId: string) => {
    setSchedulerMessage(null);
    setState((current) => ({
      ...current,
      schedule: {
        days: current.schedule.days.map((day) => {
          if (day.dayIndex !== dayIndex) return day;
          const key = type === "day" ? "extraDay" : "extraNight";
          return { ...day, [key]: day[key].filter((id) => id !== doctorId) };
        })
      }
    }));
  };

  const autoSchedule = () => {
    const latestArchive = state.archives.length > 0
      ? [...state.archives].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))[0]
      : undefined;
    const result = generateSchedule(state.doctors, latestArchive);
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
    setState((current) =>
      archiveCurrentWeek({
        ...current,
        doctors: current.doctors.map((doctor) => ({
          ...doctor,
          unavailableDays: []
        }))
      })
    );
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

    if (!activeId.startsWith("doctor:")) return;

    const doctorId = activeId.replace("doctor:", "");

    if (overId.startsWith("cell:")) {
      const [, dayIndexText, shiftKey] = overId.split(":");
      assignDoctor(Number(dayIndexText) as DayIndex, shiftKey as ShiftKey, doctorId);
      return;
    }

    if (overId.startsWith("extra-day:")) {
      const dayIndex = Number(overId.split(":")[1]) as DayIndex;
      addExtraDoctor(dayIndex, "day", doctorId);
      return;
    }

    if (overId.startsWith("extra-night:")) {
      const dayIndex = Number(overId.split(":")[1]) as DayIndex;
      addExtraDoctor(dayIndex, "night", doctorId);
    }
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
            onAddDoctor={addDoctor}
            onDeleteDoctor={deleteDoctor}
            onToggleUnavailableDayShift={toggleUnavailableDayShift}
            onToggleUnavailableNightShift={toggleUnavailableNightShift}
            onChangePreference={changePreference}
          />
          <div className="middle-column">
            <ScheduleGrid
              doctors={state.doctors}
              issues={issues}
              schedule={state.schedule}
              selectedDoctorId={selectedDoctorId}
              weekStart={state.weekStart}
              onAssign={assignDoctor}
              onAddExtra={addExtraDoctor}
              onRemoveExtra={removeExtraDoctor}
            />
            <DoctorStatusTable
              doctors={state.doctors}
              schedule={state.schedule}
              issues={issues}
            />
            <PreviousWeekPanel state={state} />
            <StatisticsPanel state={state} />
          </div>
          <IssuePanel issues={issues} schedulerMessage={schedulerMessage} />
        </div>
        <DragOverlay>
          {activeDragDoctor ? <div className="drag-overlay-card">{activeDragDoctor.name}</div> : null}
        </DragOverlay>
      </DndContext>
    </main>
  );
}
