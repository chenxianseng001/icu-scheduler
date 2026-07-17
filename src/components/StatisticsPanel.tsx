import { useMemo, useState } from "react";
import { computeStats } from "../domain/statistics";
import type { DoctorStats, V2AppState } from "../domain/types";

interface StatisticsPanelProps {
  state: V2AppState;
}

export function StatisticsPanel({ state }: StatisticsPanelProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(state.weekStart);
  const [dateTo, setDateTo] = useState(today);

  const stats = useMemo(
    () => computeStats(state.doctors, state.schedule, state.archives, dateFrom, dateTo),
    [state, dateFrom, dateTo]
  );

  const normalDoctors = stats.filter((s) => s.kind === "normal");
  const dayOnlyDoctors = stats.filter((s) => s.kind === "dayOnly");

  return (
    <section className="panel stats-panel" aria-label="排班统计">
      <div className="panel-heading">
        <h2>统计</h2>
        <span>{state.archives.length + 1} 周数据</span>
      </div>
      <div className="stats-filter">
        <label>
          起
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label>
          止
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
      </div>
      <div className="stats-table-wrapper">
        <StatsTable title="普通医生" stats={normalDoctors} />
        {dayOnlyDoctors.length > 0 && (
          <StatsTable title="只白班" stats={dayOnlyDoctors} />
        )}
        <StatsTotal stats={stats} />
      </div>
    </section>
  );
}

function StatsTable({ title, stats }: { title: string; stats: DoctorStats[] }) {
  if (stats.length === 0) return null;

  return (
    <table className="stats-table">
      <thead>
        <tr>
          <th colSpan={2}>{title}</th>
          <th>白班</th>
          <th>夜班</th>
          <th>总班</th>
          <th>出</th>
          <th>休</th>
          <th>参与周</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((s) => {
          const dayOver = s.kind === "normal" ? s.day > 2 : false;
          const nightOver = s.kind === "normal" ? s.night > 2 : s.night > 0;
          const totalOver = s.kind === "normal" ? s.total > 3 : false;

          return (
            <tr key={s.doctorId}>
              <td className="stats-doctor-name">{s.doctorName}</td>
              <td className="stats-doctor-kind-cell">
                {s.kind === "dayOnly" ? "只白班" : ""}
              </td>
              <td className={dayOver ? "stat-over" : ""}>{s.day}</td>
              <td className={nightOver ? "stat-over" : ""}>{s.night}</td>
              <td className={totalOver ? "stat-over" : ""}>{s.total}</td>
              <td>{s.offAfterNight}</td>
              <td>{s.rest}</td>
              <td>{s.weekCount}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function StatsTotal({ stats }: { stats: DoctorStats[] }) {
  if (stats.length === 0) return null;

  const total = stats.reduce(
    (acc, s) => ({
      day: acc.day + s.day,
      night: acc.night + s.night,
      total: acc.total + s.total,
      offAfterNight: acc.offAfterNight + s.offAfterNight,
      rest: acc.rest + s.rest,
      weekCount: Math.max(acc.weekCount, s.weekCount)
    }),
    { day: 0, night: 0, total: 0, offAfterNight: 0, rest: 0, weekCount: 0 }
  );

  return (
    <table className="stats-table stats-total">
      <tbody>
        <tr>
          <td colSpan={2} className="stats-total-label">
            合计
          </td>
          <td>{total.day}</td>
          <td>{total.night}</td>
          <td>{total.total}</td>
          <td>{total.offAfterNight}</td>
          <td>{total.rest}</td>
          <td />
        </tr>
      </tbody>
    </table>
  );
}
