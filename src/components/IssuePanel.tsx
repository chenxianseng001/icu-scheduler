import type { ScheduleIssue } from "../domain/types";

interface IssuePanelProps {
  issues: ScheduleIssue[];
  schedulerMessage: string | null;
}

export function IssuePanel({ issues, schedulerMessage }: IssuePanelProps) {
  return (
    <aside className="panel issue-panel" aria-label="问题列表">
      <div className="panel-heading">
        <h2>问题</h2>
        <span>{issues.length}</span>
      </div>
      {schedulerMessage ? <p className="scheduler-message">{schedulerMessage}</p> : null}
      {issues.length === 0 ? (
        <p className="empty-issues">当前没有发现问题</p>
      ) : (
        <ul className="issue-list">
          {issues.map((issue, index) => (
            <li key={`${issue.type}-${issue.doctorId ?? "none"}-${issue.dayIndex ?? "week"}-${index}`}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
