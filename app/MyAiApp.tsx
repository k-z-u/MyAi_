"use client";
/* eslint-disable react-hooks/purity, react-hooks/set-state-in-effect -- event timestamps and one-time localStorage hydration are intentional external-state reads */

import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Effort = "Low" | "Medium" | "High" | "Extra High";
type TaskStatus = "Queued" | "Running" | "Paused" | "Completed" | "Error";
type LogStatus = "Success" | "Error" | "Note" | "Warning" | "In progress";

type WorkLog = {
  id: string;
  text: string;
  status: LogStatus;
  elapsed: number;
  createdAt: string;
};

type Task = {
  id: string;
  sequence: number;
  title: string;
  effort: Effort;
  status: TaskStatus;
  createdAt: string;
  activeSince: number | null;
  elapsedSeconds: number;
  completedAt: string | null;
  logs: WorkLog[];
};

type DayState = {
  date: string;
  nextSequence: number;
  tasks: Task[];
};

type Preferences = {
  name: string;
  theme: "dark" | "light";
};

const EFFORTS: Effort[] = ["Low", "Medium", "High", "Extra High"];
const LOG_STATUSES: LogStatus[] = [
  "Success",
  "Error",
  "Note",
  "Warning",
  "In progress",
];
const STORAGE_PREFIX = "myai:day:";
const PREFS_KEY = "myai:preferences";

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function makeDay(date = localDateKey()): DayState {
  return { date, nextSequence: 1, tasks: [] };
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function currentElapsed(task: Task, now = Date.now()) {
  if (task.status === "Running" && task.activeSince) {
    return task.elapsedSeconds + Math.max(0, Math.floor((now - task.activeSince) / 1000));
  }
  return task.elapsedSeconds;
}

function formatDuration(totalSeconds: number, compact = false) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (compact && h === 0) {
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatToday(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(year, month - 1, day));
}

function statusSymbol(status: TaskStatus | LogStatus) {
  switch (status) {
    case "Running":
    case "In progress":
      return "›";
    case "Completed":
    case "Success":
      return "✓";
    case "Error":
      return "×";
    case "Warning":
      return "!";
    case "Paused":
      return "Ⅱ";
    case "Note":
      return "—";
    default:
      return "○";
  }
}

export default function MyAiApp() {
  const [hydrated, setHydrated] = useState(false);
  const [day, setDay] = useState<DayState>(() => makeDay());
  const [prefs, setPrefs] = useState<Preferences>({ name: "Kazuki", theme: "dark" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taskText, setTaskText] = useState("");
  const [effort, setEffort] = useState<Effort>("High");
  const [logText, setLogText] = useState("");
  const [logStatus, setLogStatus] = useState<LogStatus>("Success");
  const [now, setNow] = useState(Date.now());
  const [undoTask, setUndoTask] = useState<{ task: Task; index: number } | null>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const logInputRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const today = localDateKey();
    const storedDay = safeParse<DayState>(
      localStorage.getItem(`${STORAGE_PREFIX}${today}`),
      makeDay(today),
    );
    const storedPrefs = safeParse<Preferences>(
      localStorage.getItem(PREFS_KEY),
      { name: "Kazuki", theme: "dark" },
    );
    setDay(storedDay.date === today ? storedDay : makeDay(today));
    setPrefs(storedPrefs);
    setSelectedId(
      storedDay.tasks.find((task) => task.status === "Running")?.id ??
        storedDay.tasks.find((task) => task.status !== "Completed")?.id ??
        storedDay.tasks[0]?.id ??
        null,
    );
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(`${STORAGE_PREFIX}${day.date}`, JSON.stringify(day));
  }, [day, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs, hydrated]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      const today = localDateKey(new Date(nextNow));
      setDay((current) => {
        if (current.date === today) return current;
        localStorage.setItem(`${STORAGE_PREFIX}${current.date}`, JSON.stringify(current));
        const nextDay = safeParse<DayState>(
          localStorage.getItem(`${STORAGE_PREFIX}${today}`),
          makeDay(today),
        );
        setSelectedId(null);
        return nextDay;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selected = day.tasks.find((task) => task.id === selectedId) ?? null;
  const running = day.tasks.find((task) => task.status === "Running") ?? null;
  const completedCount = day.tasks.filter((task) => task.status === "Completed").length;
  const queuedCount = day.tasks.filter((task) => task.status === "Queued").length;
  const pausedCount = day.tasks.filter((task) => task.status === "Paused").length;
  const errorCount = day.tasks.filter((task) => task.status === "Error").length;
  const activeSeconds = day.tasks.reduce(
    (sum, task) => sum + currentElapsed(task, now),
    0,
  );
  const allCompleted = day.tasks.length > 0 && completedCount === day.tasks.length;
  const agentEffort = running?.effort ?? selected?.effort ?? effort;

  const mutateTask = useCallback((id: string, fn: (task: Task) => Task) => {
    setDay((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === id ? fn(task) : task)),
    }));
  }, []);

  const stopOtherRunningTasks = useCallback((exceptId: string, timestamp: number) => {
    setDay((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.id === exceptId || task.status !== "Running" || !task.activeSince) {
          return task;
        }
        return {
          ...task,
          status: "Paused",
          elapsedSeconds: currentElapsed(task, timestamp),
          activeSince: null,
        };
      }),
    }));
  }, []);

  function addTask(startImmediately = false) {
    const title = taskText.trim();
    if (!title) return null;
    const timestamp = Date.now();
    const task: Task = {
      id: uid(),
      sequence: day.nextSequence,
      title,
      effort,
      status: startImmediately ? "Running" : "Queued",
      createdAt: new Date(timestamp).toISOString(),
      activeSince: startImmediately ? timestamp : null,
      elapsedSeconds: 0,
      completedAt: null,
      logs: [],
    };
    if (startImmediately) {
      stopOtherRunningTasks(task.id, timestamp);
    }
    setDay((current) => ({
      ...current,
      nextSequence: current.nextSequence + 1,
      tasks: [task, ...current.tasks],
    }));
    setTaskText("");
    setSelectedId(task.id);
    return task;
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    addTask(false);
  }

  function startTask(taskId: string) {
    const timestamp = Date.now();
    stopOtherRunningTasks(taskId, timestamp);
    mutateTask(taskId, (task) => ({
      ...task,
      status: "Running",
      activeSince: timestamp,
      completedAt: null,
    }));
  }

  function pauseTask(taskId: string) {
    const timestamp = Date.now();
    mutateTask(taskId, (task) => ({
      ...task,
      status: "Paused",
      elapsedSeconds: currentElapsed(task, timestamp),
      activeSince: null,
    }));
  }

  function completeTask(taskId: string) {
    const timestamp = Date.now();
    mutateTask(taskId, (task) => ({
      ...task,
      status: "Completed",
      elapsedSeconds: currentElapsed(task, timestamp),
      activeSince: null,
      completedAt: new Date(timestamp).toISOString(),
    }));
  }

  function deleteTask(taskId: string) {
    setDay((current) => {
      const index = current.tasks.findIndex((task) => task.id === taskId);
      if (index < 0) return current;
      const task = current.tasks[index];
      setUndoTask({ task, index });
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoTask(null), 7000);
      return { ...current, tasks: current.tasks.filter((item) => item.id !== taskId) };
    });
    if (selectedId === taskId) setSelectedId(null);
  }

  function restoreTask() {
    if (!undoTask) return;
    setDay((current) => {
      const tasks = [...current.tasks];
      tasks.splice(Math.min(undoTask.index, tasks.length), 0, undoTask.task);
      return { ...current, tasks };
    });
    setSelectedId(undoTask.task.id);
    setUndoTask(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }

  function addLog(event: FormEvent) {
    event.preventDefault();
    if (!selected || !logText.trim()) return;
    const entry: WorkLog = {
      id: uid(),
      text: logText.trim(),
      status: logStatus,
      elapsed: currentElapsed(selected, Date.now()),
      createdAt: new Date().toISOString(),
    };
    mutateTask(selected.id, (task) => ({
      ...task,
      status: logStatus === "Error" ? "Error" : task.status,
      elapsedSeconds:
        logStatus === "Error" && task.status === "Running"
          ? currentElapsed(task, Date.now())
          : task.elapsedSeconds,
      activeSince:
        logStatus === "Error" && task.status === "Running" ? null : task.activeSince,
      logs: [...task.logs, entry],
    }));
    setLogText("");
    if (logStatus === "Error") setLogStatus("Success");
    requestAnimationFrame(() => logInputRef.current?.focus());
  }

  function updateLogStatus(logId: string, status: LogStatus) {
    if (!selected) return;
    mutateTask(selected.id, (task) => ({
      ...task,
      logs: task.logs.map((log) => (log.id === logId ? { ...log, status } : log)),
    }));
  }

  function loadDemoQueue() {
    const timestamp = Date.now();
    const examples = [
      ["Skriptを制作する", "Extra High"],
      ["ブリッジサーバーのバグを修正する", "High"],
      ["英語の問題集を進める", "Medium"],
    ] as const;
    const tasks: Task[] = examples.map(([title, taskEffort], index) => ({
      id: uid(),
      sequence: index + 1,
      title,
      effort: taskEffort,
      status: "Queued",
      createdAt: new Date(timestamp + index).toISOString(),
      activeSince: null,
      elapsedSeconds: 0,
      completedAt: null,
      logs: [],
    }));
    setDay((current) => ({ ...current, nextSequence: 4, tasks }));
    setSelectedId(tasks[0].id);
  }

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const command = event.metaKey || event.ctrlKey;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";

      if (command && event.key.toLowerCase() === "k") {
        event.preventDefault();
        taskInputRef.current?.focus();
        return;
      }
      if (command && event.shiftKey && event.key === "Enter" && selected) {
        event.preventDefault();
        completeTask(selected.id);
        return;
      }
      if (command && event.key === "Enter") {
        event.preventDefault();
        if (taskText.trim()) addTask(true);
        else if (selected && selected.status !== "Completed") startTask(selected.id);
        return;
      }
      if (event.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if (event.code === "Space" && !isTyping && selected) {
        event.preventDefault();
        if (selected.status === "Running") pauseTask(selected.id);
        else startTask(selected.id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // Rebind only when keyboard-relevant state changes; task handlers intentionally close over that state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, taskText, effort, day.nextSequence]);

  const sortedTasks = useMemo(() => {
    const rank: Record<TaskStatus, number> = {
      Running: 0,
      Error: 1,
      Paused: 2,
      Queued: 3,
      Completed: 4,
    };
    return [...day.tasks].sort(
      (a, b) => rank[a.status] - rank[b.status] || b.sequence - a.sequence,
    );
  }, [day.tasks]);

  function composerKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      addTask(false);
    }
  }

  if (!hydrated) {
    return (
      <main className="boot-screen" aria-label="MyAiを起動中">
        <span className="boot-prompt">&gt;</span> restoring local agent state
      </main>
    );
  }

  return (
    <div className={`myai-shell ${running ? "is-focusing" : ""}`}>
      <aside className="agent-rail" aria-label="Agent status">
        <div className="brand-block">
          <a className="wordmark" href="#queue" aria-label="MyAi home">
            MyAi<span className="wordmark-cursor" aria-hidden="true">_</span>
          </a>
          <p>Today-only execution system</p>
        </div>

        <section className="agent-identity">
          <label htmlFor="agent-name">Agent</label>
          <input
            id="agent-name"
            value={prefs.name}
            onChange={(event) =>
              setPrefs((current) => ({ ...current, name: event.target.value.slice(0, 24) }))
            }
            aria-label="Agent name"
          />
          <div className="agent-mode">
            <span className={`status-dot ${running ? "is-live" : ""}`} aria-hidden="true" />
            <strong>{agentEffort}</strong>
          </div>
        </section>

        <dl className="telemetry">
          <div>
            <dt>Agent status</dt>
            <dd>{running ? "Active" : errorCount ? "Attention" : "Idle"}</dd>
          </div>
          <div>
            <dt>Tasks processed</dt>
            <dd>{completedCount}</dd>
          </div>
          <div>
            <dt>Current workload</dt>
            <dd>{agentEffort}</dd>
          </div>
          <div>
            <dt>Session uptime</dt>
            <dd>{formatDuration(activeSeconds)}</dd>
          </div>
        </dl>

        <div className="rail-bottom">
          <button
            className="text-control"
            type="button"
            onClick={() =>
              setPrefs((current) => ({
                ...current,
                theme: current.theme === "dark" ? "light" : "dark",
              }))
            }
          >
            Theme / {prefs.theme}
          </button>
          <p className="colophon">
            local://{day.date}
            <br />
            persistence enabled
          </p>
        </div>
      </aside>

      <main className="queue-workbench" id="queue">
        <header className="command-line" aria-label="Command navigation">
          <span className="prompt">&gt;</span>
          <span>myai</span>
          <button type="button" onClick={() => taskInputRef.current?.focus()}>
            --new
          </button>
          <button type="button" onClick={() => selected && startTask(selected.id)}>
            --run
          </button>
          <button type="button" onClick={() => selected && completeTask(selected.id)}>
            --return-0
          </button>
          <span className="command-caret" aria-hidden="true">▮</span>
        </header>

        <section className="today-strip" aria-label="Today summary">
          <div>
            <p>{formatToday(day.date)}</p>
            <h1>{allCompleted ? "All jobs returned 0." : "Process today."}</h1>
          </div>
          <div className="summary-inline" aria-live="polite">
            <span>{completedCount} completed</span>
            <span>{running ? 1 : 0} running</span>
            <span>{queuedCount} queued</span>
            {pausedCount > 0 && <span>{pausedCount} paused</span>}
          </div>
        </section>

        <form className="task-composer" onSubmit={handleAdd}>
          <div className="composer-input">
            <label htmlFor="task-title">New work unit</label>
            <input
              ref={taskInputRef}
              id="task-title"
              value={taskText}
              onChange={(event) => setTaskText(event.target.value)}
              onKeyDown={composerKeyDown}
              placeholder="例: ブリッジサーバーのバグを修正する"
              autoComplete="off"
            />
          </div>
          <fieldset className="effort-picker">
            <legend>Compute effort</legend>
            <div>
              {EFFORTS.map((level) => (
                <label key={level} className={effort === level ? "is-selected" : ""}>
                  <input
                    type="radio"
                    name="effort"
                    value={level}
                    checked={effort === level}
                    onChange={() => setEffort(level)}
                  />
                  {level}
                </label>
              ))}
            </div>
          </fieldset>
          <button className="add-task" type="submit" disabled={!taskText.trim()}>
            Add task
          </button>
        </form>

        <section className="queue-section" aria-labelledby="queue-title">
          <div className="queue-heading">
            <div>
              <h2 id="queue-title">Execution queue</h2>
              <p>{day.tasks.length} work units / ordered by runtime state</p>
            </div>
            <span className="queue-health">
              {errorCount ? `${errorCount} need attention` : "Queue healthy"}
            </span>
          </div>

          {day.tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-glyph" aria-hidden="true">∅</div>
              <h3>No work units queued.</h3>
              <p>Describe one concrete output. MyAi will hold its state for today.</p>
              <div>
                <button type="button" onClick={() => taskInputRef.current?.focus()}>
                  Create first task
                </button>
                <button type="button" className="text-control" onClick={loadDemoQueue}>
                  Load example queue
                </button>
              </div>
            </div>
          ) : (
            <div className="task-table" role="list">
              <div className="task-table-head" aria-hidden="true">
                <span>Job</span>
                <span>State</span>
                <span>Effort</span>
                <span>Runtime</span>
                <span />
              </div>
              {sortedTasks.map((task) => (
                <article
                  key={task.id}
                  className={`task-row status-${task.status.toLowerCase()} ${
                    selectedId === task.id ? "is-selected" : ""
                  }`}
                  role="listitem"
                >
                  <button
                    className="task-select"
                    type="button"
                    onClick={() => setSelectedId(task.id)}
                    aria-label={`${task.title}を選択`}
                  >
                    <span className="job-id">JOB-{String(task.sequence).padStart(3, "0")}</span>
                    <strong>{task.title}</strong>
                    <span className="task-status">
                      <i aria-hidden="true">{statusSymbol(task.status)}</i>
                      {task.status}
                    </span>
                    <span className="task-effort">{task.effort}</span>
                    <time>{formatClock(currentElapsed(task, now))}</time>
                    <span className="open-detail" aria-hidden="true">→</span>
                  </button>
                  <button
                    className="remove-task"
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    aria-label={`${task.title}を削除`}
                  >
                    Remove
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="app-colophon">
          <span>MyAi / local-first / today-scoped</span>
          <span>⌘K new · ⌘↵ run · Space pause · ⇧⌘↵ complete</span>
        </footer>
      </main>

      {selected && (
        <>
          <button
            className="detail-scrim"
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label="詳細を閉じる"
          />
          <aside className="detail-panel" aria-label="Selected task details">
            <header className="detail-header">
              <div>
                <span>JOB-{String(selected.sequence).padStart(3, "0")}</span>
                <p className={`detail-state status-${selected.status.toLowerCase()}`}>
                  <i aria-hidden="true">{statusSymbol(selected.status)}</i>
                  {selected.status}
                </p>
              </div>
              <button
                className="close-detail"
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="詳細を閉じる"
              >
                Close
              </button>
            </header>

            <section className="task-detail-copy">
              <h2>{selected.title}</h2>
              <label htmlFor="detail-effort">Compute effort</label>
              <select
                id="detail-effort"
                value={selected.effort}
                onChange={(event) =>
                  mutateTask(selected.id, (task) => ({
                    ...task,
                    effort: event.target.value as Effort,
                  }))
                }
              >
                {EFFORTS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </section>

            <section className={`timer-block status-${selected.status.toLowerCase()}`}>
              <p>{selected.status === "Running" ? "Processing task…" : selected.status}</p>
              <time aria-live="off">{formatClock(currentElapsed(selected, now))}</time>
              <span>elapsed / {selected.effort} compute</span>
            </section>

            {selected.status === "Completed" && (
              <section className="result-block" aria-label="Execution result">
                <p>Process exited with code 0</p>
                <dl>
                  <div><dt>Duration</dt><dd>{formatDuration(selected.elapsedSeconds)}</dd></div>
                  <div><dt>Effort</dt><dd>{selected.effort}</dd></div>
                  <div><dt>Logs</dt><dd>{selected.logs.length}</dd></div>
                  <div>
                    <dt>Errors resolved</dt>
                    <dd>{selected.logs.filter((log) => log.status === "Error").length}</dd>
                  </div>
                </dl>
              </section>
            )}

            <section className="log-section">
              <div className="log-heading">
                <h3>Work log</h3>
                <span>{selected.logs.length} entries</span>
              </div>
              <div className="log-stream" aria-live="polite">
                {selected.logs.length === 0 ? (
                  <p className="log-empty">No tool calls recorded for this job.</p>
                ) : (
                  selected.logs.map((log) => (
                    <div className={`log-entry log-${log.status.toLowerCase().replace(" ", "-")}`} key={log.id}>
                      <time>{formatClock(log.elapsed)}</time>
                      <span className="log-symbol" aria-hidden="true">{statusSymbol(log.status)}</span>
                      <span>{log.text}</span>
                      <select
                        value={log.status}
                        onChange={(event) =>
                          updateLogStatus(log.id, event.target.value as LogStatus)
                        }
                        aria-label={`${log.text}のログ状態`}
                      >
                        {LOG_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  ))
                )}
              </div>
              <form className="log-composer" onSubmit={addLog}>
                <label htmlFor="log-text">Append execution log</label>
                <div>
                  <select
                    value={logStatus}
                    onChange={(event) => setLogStatus(event.target.value as LogStatus)}
                    aria-label="ログ状態"
                  >
                    {LOG_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <input
                    ref={logInputRef}
                    id="log-text"
                    value={logText}
                    onChange={(event) => setLogText(event.target.value)}
                    placeholder="例: 構文エラーを修正"
                  />
                  <button type="submit" disabled={!logText.trim()}>Append</button>
                </div>
              </form>
            </section>

            <div className="task-actions">
              {selected.status === "Running" ? (
                <button type="button" onClick={() => pauseTask(selected.id)}>Pause</button>
              ) : selected.status !== "Completed" ? (
                <button className="primary-action" type="button" onClick={() => startTask(selected.id)}>
                  {selected.status === "Paused" || selected.status === "Error"
                    ? "Resume task"
                    : "Start task"}
                </button>
              ) : (
                <button type="button" onClick={() => startTask(selected.id)}>Run again</button>
              )}
              {selected.status !== "Completed" && (
                <button type="button" onClick={() => completeTask(selected.id)}>Complete</button>
              )}
            </div>
          </aside>
        </>
      )}

      {undoTask && (
        <div className="undo-toast" role="status">
          <span>Work unit removed.</span>
          <button type="button" onClick={restoreTask}>Undo</button>
        </div>
      )}
    </div>
  );
}
