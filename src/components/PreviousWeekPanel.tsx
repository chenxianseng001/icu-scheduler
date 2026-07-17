import { DoctorStatusTable } from "./DoctorStatusTable";
import type { V2AppState } from "../domain/types";

interface PreviousWeekPanelProps {
  state: V2AppState;
}

export function PreviousWeekPanel({ state }: PreviousWeekPanelProps) {
  const latestArchive = state.archives.length > 0
    ? [...state.archives].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))[0]
    : null;

  return (
    <section className="panel previous-week-panel" aria-label="上周排班">
      <div className="panel-heading">
        <h2>上周排班</h2>
        {latestArchive ? (
          <span>{latestArchive.weekStart}</span>
        ) : (
          <span>暂无</span>
        )}
      </div>
      {latestArchive ? (
        <DoctorStatusTable
          doctors={state.doctors}
          schedule={latestArchive.schedule}
          issues={[]}
        />
      ) : (
        <div className="empty-issues">暂无上周排班数据</div>
      )}
    </section>
  );
}
