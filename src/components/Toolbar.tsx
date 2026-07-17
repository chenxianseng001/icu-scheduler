interface ToolbarProps {
  issuesCount: number;
  onAutoSchedule: () => void;
  onClear: () => void;
  onExport: () => void;
  onNewWeek: () => void;
}

export function Toolbar({ issuesCount, onAutoSchedule, onClear, onExport, onNewWeek }: ToolbarProps) {
  return (
    <div className="toolbar">
      <div>
        <h1>ICU 排班系统</h1>
        <p>每周排班、实时查错、导出 Excel</p>
      </div>
      <div className="toolbar-actions">
        <button type="button" onClick={onNewWeek}>
          新建本周
        </button>
        <button type="button" className="primary" onClick={onAutoSchedule}>
          自动排班
        </button>
        <button type="button" onClick={onClear}>
          清空排班
        </button>
        <button type="button" onClick={onExport}>
          导出 Excel
        </button>
        <span className={issuesCount > 0 ? "issue-count has-issues" : "issue-count"}>
          {issuesCount > 0 ? `${issuesCount} 个问题` : "无问题"}
        </span>
      </div>
    </div>
  );
}
