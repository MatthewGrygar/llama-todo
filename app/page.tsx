"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────── types ─────────────────────────── */
type Col = "todo" | "doing" | "done";
type Color = "lilac" | "pink" | "mint" | "peach" | "sky" | "lemon";
type CalMode = "day" | "week" | "month";

interface Task {
  id: string;
  title: string;
  note: string;
  due: string;
  time: string;        // HH:MM or ""
  col: Col;
  color: Color;
  starred: boolean;
  created: number;
}

interface CalEvent {
  id: string;
  title: string;
  date: string;
  start: number;
  end: number;
  color: Color;
}

interface ReminderAlert {
  id: string;
  title: string;
  type: "task" | "event";
  minutesLeft: number;
}

/* ─────────────────────────── constants ─────────────────────── */
const COLS: { id: Col; label: string; short: string; dot: string }[] = [
  { id: "todo",  label: "To Do 📋",       short: "To Do",       dot: "#C4A6F2" },
  { id: "doing", label: "In Progress ⚡", short: "In Progress", dot: "#F6B8E0" },
  { id: "done",  label: "Done ✅",         short: "Done",        dot: "#A6E3C7" },
];

const COLORS: { id: Color; bg: string; border: string; name: string }[] = [
  { id: "lilac", bg: "#E8DCFF", border: "#C4A6F2", name: "Lila" },
  { id: "pink",  bg: "#FFD6EC", border: "#F6B8E0", name: "Lamí růžová" },
  { id: "mint",  bg: "#CDF0DD", border: "#9ADCBD", name: "Kaktusová mint" },
  { id: "peach", bg: "#FFE0C4", border: "#FFBF8A", name: "Broskvová" },
  { id: "sky",   bg: "#C9E1FF", border: "#8FC3FF", name: "Oblačná modrá" },
  { id: "lemon", bg: "#FFEBA0", border: "#FFD84D", name: "Citronová" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/* ─────────────────────────── helpers ───────────────────────── */
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function sameDate(a: Date, b: Date) { return ymd(a) === ymd(b); }
function fmtHour(h: number) {
  const ap = h < 12 ? "AM" : "PM";
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh} ${ap}`;
}
function fmtHourShort(h: number) {
  const ap = h < 12 ? "a" : "p";
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}${ap}`;
}
function pad2(n: number) { return String(n).padStart(2, "0"); }
function parseTimeToHour(s: string): number | null {
  if (!s) return null;
  const [h, m] = s.split(":").map(Number);
  return h + m / 60;
}
function hourToTimeStr(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${pad2(hh)}:${pad2(mm)}`;
}
function friendlyDate(iso: string, time?: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const today = startOfDay(new Date());
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  let label = "";
  if (diff === 0) label = "Dnes";
  else if (diff === 1) label = "Zítra";
  else if (diff === -1) label = "Včera";
  else if (diff > 0 && diff < 7) label = d.toLocaleDateString("cs-CZ", { weekday: "long" });
  else label = d.toLocaleDateString("cs-CZ", { month: "short", day: "numeric" });
  return time ? `${label} ${time}` : label;
}

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v ?? fallback;
  } catch { return fallback; }
}
function saveStorage<T>(key: string, v: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(v));
}

function colorOf(id: Color) {
  return COLORS.find(c => c.id === id) || COLORS[0];
}

function seedTasks(): Task[] {
  const today = new Date();
  const inDays = (d: number) => {
    const x = new Date(today); x.setDate(x.getDate() + d);
    return x.toISOString().slice(0, 10);
  };
  return [
    { id: uid(), title: "Učesat lamu 🦙", note: "Tentokrát použít jemný kartáč — minule jí to docela cuchalo.", due: inDays(0), time: "10:00", col: "todo",  color: "lilac", starred: true,  created: Date.now() - 3e5 },
    { id: uid(), title: "Najít nové ovesné seno", note: "", due: inDays(2), time: "", col: "todo",  color: "peach", starred: false, created: Date.now() - 2e5 },
    { id: uid(), title: "Sticker pack design", note: "4 samolepky pro launch:\n• lama s kafe\n• lama na józe\n• lama ve sněhu\n• lama čte knihu", due: inDays(1), time: "14:00", col: "doing", color: "pink",  starred: false, created: Date.now() - 1e5 },
    { id: uid(), title: "Odepsat Lile", note: "Ohledně výletu na louku příští sobotu", due: "", time: "", col: "doing", color: "sky",   starred: false, created: Date.now() - 9e4 },
    { id: uid(), title: "Zastříhnout kopýtka", note: "", due: inDays(-1), time: "", col: "done",  color: "mint",  starred: false, created: Date.now() - 2e6 },
  ];
}

function seedEvents(): CalEvent[] {
  const shift = (n: number) => ymd(addDays(startOfDay(new Date()), n));
  return [
    { id: uid(), title: "Morning oat-cino ☕", date: shift(0), start: 8,  end: 9,  color: "peach" },
    { id: uid(), title: "Design review",       date: shift(0), start: 11, end: 12, color: "lilac" },
    { id: uid(), title: "Llama yoga 🧘",       date: shift(1), start: 7,  end: 8,  color: "mint"  },
    { id: uid(), title: "Pasture walk",        date: shift(2), start: 15, end: 17, color: "pink"  },
  ];
}

/* ─────────────────────────── sub-components ─────────────────── */

function IosStatus() {
  const [time, setTime] = useState("9:41");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(`${now.getHours()}:${pad2(now.getMinutes())}`);
    };
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="ios-status" aria-hidden="true">
      <span className="ios-time">{time}</span>
      <span className="ios-right">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="0.6"/><rect x="4.5" y="5" width="3" height="6" rx="0.6"/><rect x="9" y="3" width="3" height="8" rx="0.6"/><rect x="13.5" y="0" width="3" height="11" rx="0.6"/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1 4.5a10 10 0 0 1 13 0"/><path d="M3.5 7a6 6 0 0 1 8 0"/><circle cx="7.5" cy="9.5" r="1" fill="currentColor" stroke="none"/></svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
          <rect x="0.5" y="0.5" width="22" height="11" rx="2.5" stroke="currentColor" strokeOpacity="0.45"/>
          <rect x="24" y="4" width="1.6" height="4" rx="0.6" fill="currentColor" fillOpacity="0.45"/>
          <rect x="2" y="2" width="16" height="8" rx="1.4" fill="currentColor"/>
        </svg>
      </span>
    </div>
  );
}

function StarSvg({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 2.5l2.95 6 6.55.95-4.75 4.65 1.1 6.5L12 17.6l-5.85 3 1.1-6.5L2.5 9.45 9.05 8.5z"/>
    </svg>
  );
}

function ColorSwatches({ selected, onChange }: { selected: Color; onChange: (c: Color) => void }) {
  return (
    <div className="color-swatches">
      {COLORS.map(c => (
        <button
          key={c.id}
          type="button"
          style={{ background: c.bg, outline: selected === c.id ? `2px solid ${c.border}` : "none", outlineOffset: "2px" }}
          aria-label={c.name}
          title={c.name}
          className={selected === c.id ? "active" : ""}
          onClick={() => onChange(c.id)}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────── main app ───────────────────────── */
export default function App() {
  /* ── state ── */
  const [tasks, setTasksRaw] = useState<Task[]>([]);
  const [events, setEventsRaw] = useState<CalEvent[]>([]);
  const [view, setView] = useState<"tasks" | "calendar">("tasks");
  const [taskFilter, setTaskFilter] = useState<"all" | Col>("all");
  const [calMode, setCalMode] = useState<CalMode>("week");
  const [calDate, setCalDate] = useState<Date>(() => startOfDay(new Date()));
  const [greeting, setGreeting] = useState("Pohodově a produktivně ✨");

  /* task modal */
  const [taskModal, setTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [tTitle, setTTitle] = useState("");
  const [tNote, setTNote] = useState("");
  const [tDue, setTDue] = useState("");
  const [tTime, setTTime] = useState("");
  const [tColor, setTColor] = useState<Color>("lilac");
  const [tStarred, setTStarred] = useState(false);
  const taskTitleRef = useRef<HTMLInputElement>(null);

  /* event modal */
  const [eventModal, setEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evTitle, setEvTitle] = useState("");
  const [evStart, setEvStart] = useState("08:00");
  const [evEnd, setEvEnd] = useState("09:00");
  const [evColor, setEvColor] = useState<Color>("lilac");
  const [evModalSub, setEvModalSub] = useState("");
  const [evIsEdit, setEvIsEdit] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<{ date: string; hour: number } | null>(null);
  const eventTitleRef = useRef<HTMLInputElement>(null);

  /* move sheet */
  const [moveModal, setMoveModal] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);

  /* drag state */
  const dragId = useRef<string | null>(null);

  /* reminder */
  const [reminder, setReminder] = useState<ReminderAlert | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  /* ── init ── */
  useEffect(() => {
    const stored = loadStorage<Task[] | null>("llama.tasks.v1", null);
    if (!stored) {
      const seeded = seedTasks();
      setTasksRaw(seeded);
      saveStorage("llama.tasks.v1", seeded);
    } else {
      const migrated = stored.map(t => ({
        ...t,
        color: t.color || "lilac" as Color,
        starred: t.starred ?? false,
        time: t.time ?? "",
      }));
      setTasksRaw(migrated);
    }

    const storedEv = loadStorage<CalEvent[] | null>("llama.events.v1", null);
    if (!storedEv) {
      const seeded = seedEvents();
      setEventsRaw(seeded);
      saveStorage("llama.events.v1", seeded);
    } else {
      setEventsRaw(storedEv);
    }

    const h = new Date().getHours();
    setGreeting(
      h < 5  ? "Pozdní noc, lamo 🌙" :
      h < 12 ? "Dobré ráno, lamo ☀️" :
      h < 17 ? "Odpolední makot ✨" :
      h < 21 ? "Pohodový večer 🌸" :
               "Čas se zklidnit 🌙"
    );

    /* request notification permission */
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  /* ── reminder check ── */
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const todayStr = ymd(startOfDay(now));
      const bucket = Math.floor(nowMin / 5);

      for (const ev of events) {
        if (ev.date === todayStr) {
          const evMin = ev.start * 60;
          const diff = evMin - nowMin;
          const key = `ev-${ev.id}-${bucket}`;
          if (diff > 0 && diff <= 30 && !notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            const alert: ReminderAlert = { id: key, title: ev.title, type: "event", minutesLeft: Math.round(diff) };
            setReminder(alert);
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              new Notification(`⏰ Za ${Math.round(diff)} min: ${ev.title}`, { body: "Lama To-Do připomínka" });
            }
          }
        }
      }

      for (const t of tasks) {
        if (t.due === todayStr && t.time && t.col !== "done") {
          const taskHour = parseTimeToHour(t.time);
          if (taskHour == null) continue;
          const taskMin = taskHour * 60;
          const diff = taskMin - nowMin;
          const key = `task-${t.id}-${bucket}`;
          if (diff > 0 && diff <= 30 && !notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            const alert: ReminderAlert = { id: key, title: t.title, type: "task", minutesLeft: Math.round(diff) };
            setReminder(alert);
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              new Notification(`⏰ Za ${Math.round(diff)} min: ${t.title}`, { body: "Lama To-Do připomínka" });
            }
          }
        }
      }
    };

    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [events, tasks]);

  /* ── persistence helpers ── */
  const setTasks = useCallback((fn: (prev: Task[]) => Task[]) => {
    setTasksRaw(prev => {
      const next = fn(prev);
      saveStorage("llama.tasks.v1", next);
      return next;
    });
  }, []);
  const setEvents = useCallback((fn: (prev: CalEvent[]) => CalEvent[]) => {
    setEventsRaw(prev => {
      const next = fn(prev);
      saveStorage("llama.events.v1", next);
      return next;
    });
  }, []);

  /* ── counts ── */
  const counts = { all: tasks.length, todo: 0, doing: 0, done: 0 };
  tasks.forEach(t => { counts[t.col]++; });

  /* ── task modal actions ── */
  function openCreateTask() {
    setEditingTaskId(null);
    setTTitle(""); setTNote(""); setTDue(""); setTTime(""); setTColor("lilac"); setTStarred(false);
    setTaskModal(true);
    setTimeout(() => taskTitleRef.current?.focus(), 250);
  }
  function openEditTask(t: Task) {
    setEditingTaskId(t.id);
    setTTitle(t.title); setTNote(t.note); setTDue(t.due); setTTime(t.time ?? ""); setTColor(t.color); setTStarred(t.starred);
    setTaskModal(true);
    setTimeout(() => taskTitleRef.current?.focus(), 250);
  }
  function saveTask() {
    const title = tTitle.trim();
    if (!title) { taskTitleRef.current?.focus(); return; }
    if (editingTaskId) {
      setTasks(prev => prev.map(t => t.id === editingTaskId
        ? { ...t, title, note: tNote.trim(), due: tDue, time: tTime, color: tColor, starred: tStarred }
        : t
      ));
    } else {
      setTasks(prev => [...prev, {
        id: uid(), title, note: tNote.trim(), due: tDue, time: tTime,
        col: "todo", color: tColor, starred: tStarred, created: Date.now()
      }]);
    }
    setTaskModal(false);
  }

  /* ── move ── */
  function openMoveSheet(id: string) { setMovingTaskId(id); setMoveModal(true); }
  function moveTask(id: string, col: Col) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, col } : t));
    setMoveModal(false);
  }
  function moveTaskDirect(id: string, col: Col) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, col } : t));
  }

  /* ── event modal actions ── */
  function openCreateEvent(day: Date, hour: number) {
    setEditingEventId(null);
    setEvIsEdit(false);
    setPendingSlot({ date: ymd(day), hour });
    setEvTitle("");
    setEvStart(hourToTimeStr(hour));
    setEvEnd(hourToTimeStr(Math.min(hour + 1, 23.99)));
    setEvColor("lilac");
    setEvModalSub(
      `${day.toLocaleDateString("cs-CZ", { weekday: "long", month: "short", day: "numeric" })} · začátek ${fmtHour(hour)}`
    );
    setEventModal(true);
    setTimeout(() => eventTitleRef.current?.focus(), 250);
  }
  function openEditEvent(ev: CalEvent) {
    setEditingEventId(ev.id);
    setEvIsEdit(true);
    setPendingSlot(null);
    setEvTitle(ev.title);
    setEvStart(hourToTimeStr(ev.start));
    setEvEnd(hourToTimeStr(ev.end));
    setEvColor(ev.color);
    const d = new Date(ev.date + "T00:00:00");
    setEvModalSub(d.toLocaleDateString("cs-CZ", { weekday: "long", month: "short", day: "numeric" }));
    setEventModal(true);
  }
  function saveEvent() {
    const title = evTitle.trim();
    if (!title) { eventTitleRef.current?.focus(); return; }
    const start = parseTimeToHour(evStart);
    let end = parseTimeToHour(evEnd);
    if (start == null) return;
    if (end == null || end <= start!) end = Math.min(start! + 1, 24);
    if (editingEventId) {
      setEvents(prev => prev.map(e => e.id === editingEventId
        ? { ...e, title, start: start!, end: end!, color: evColor }
        : e
      ));
    } else if (pendingSlot) {
      setEvents(prev => [...prev, { id: uid(), title, start: start!, end: end!, color: evColor, date: pendingSlot!.date }]);
    }
    setEventModal(false);
  }
  function deleteEvent() {
    if (!editingEventId) return;
    setEvents(prev => prev.filter(e => e.id !== editingEventId));
    setEventModal(false);
  }

  /* ── drag / drop ── */
  function handleDragStart(id: string) { dragId.current = id; }
  function handleDrop(col: Col) {
    if (dragId.current) moveTaskDirect(dragId.current, col);
    dragId.current = null;
  }

  /* ── calendar title ── */
  function calTitle() {
    if (calMode === "week") {
      const s = startOfWeek(calDate);
      const e = addDays(s, 6);
      return s.getMonth() === e.getMonth()
        ? s.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" })
        : `${s.toLocaleDateString("cs-CZ", { month: "short" })} – ${e.toLocaleDateString("cs-CZ", { month: "short", year: "numeric" })}`;
    }
    if (calMode === "day") return calDate.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" });
    return calDate.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
  }

  /* ── fab action ── */
  function fabAction() {
    if (view === "tasks") {
      openCreateTask();
    } else {
      const now = new Date();
      openCreateEvent(startOfDay(now), now.getHours());
    }
  }

  /* ── calendar nav ── */
  function calPrev() {
    if (calMode === "month") setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1));
    else setCalDate(addDays(calDate, calMode === "week" ? -7 : -1));
  }
  function calNext() {
    if (calMode === "month") setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1));
    else setCalDate(addDays(calDate, calMode === "week" ? 7 : 1));
  }

  /* ── tasks render helpers ── */
  function getSortedTasks(col: Col) {
    return tasks
      .filter(t => t.col === col)
      .sort((a, b) => {
        if (col === "todo" && a.starred !== b.starred) return (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
        return b.created - a.created;
      });
  }

  /* ── calendar day/week render ── */
  const calDays = calMode === "week"
    ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(calDate), i))
    : calMode === "day" ? [calDate] : [];

  const calGridCols = calMode === "week"
    ? "44px repeat(7, minmax(80px, 1fr))"
    : "44px 1fr";
  const today = startOfDay(new Date());

  /* ── month render ── */
  const dowLabels = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
  const firstOfMonth = new Date(calDate.getFullYear(), calDate.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const monthCells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  /* ── calendar scroll to now ── */
  const calScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view === "calendar" && calMode !== "month" && calScrollRef.current) {
      const now = new Date();
      const showing = calDays.some(d => sameDate(d, now));
      const targetHour = showing ? Math.max(0, now.getHours() - 1) : 7;
      calScrollRef.current.scrollTop = targetHour * 52;
    }
  }, [view, calMode, calDate]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── now line position ── */
  const [nowMinute, setNowMinute] = useState(0);
  useEffect(() => {
    const update = () => {
      const n = new Date();
      setNowMinute(n.getHours() * 60 + n.getMinutes());
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);

  /* ────────────────────────── render ────────────────────────── */
  return (
    <>
      <div className="phone-frame">
        <div className="app">
          <IosStatus />

          <header>
            <div className="mascot" aria-hidden="true">🦙</div>
            <div className="brand">
              <h1>Lama To-Do</h1>
              <p>{greeting}</p>
            </div>
            <div className="header-spacer" />
          </header>

          <main>
            {/* ══ TASKS VIEW ══ */}
            <section className={`view${view === "tasks" ? " active" : ""}`}>
              <div className="tasks-toolbar">
                <h2>Moje poznámky</h2>
                <span className="count">{tasks.length}</span>
              </div>

              <div className="task-filter" role="tablist">
                {(["all", "todo", "doing", "done"] as const).map(f => (
                  <button
                    key={f}
                    className={`tf-btn${taskFilter === f ? " active" : ""}`}
                    role="tab"
                    onClick={() => setTaskFilter(f)}
                  >
                    {f === "all" ? "Vše" : f === "todo" ? "To Do" : f === "doing" ? "Probíhá" : "Hotovo"}
                    <span className="tf-count">{counts[f]}</span>
                  </button>
                ))}
              </div>

              <div className="board" data-filter={taskFilter}>
                {COLS.map(col => {
                  const items = getSortedTasks(col.id);
                  return (
                    <div
                      key={col.id}
                      className="column"
                      data-col={col.id}
                      onDragOver={e => { e.preventDefault(); (e.currentTarget.querySelector(".column-list") as HTMLElement)?.classList.add("drag-over"); }}
                      onDragLeave={e => { (e.currentTarget.querySelector(".column-list") as HTMLElement)?.classList.remove("drag-over"); }}
                      onDrop={e => { e.preventDefault(); (e.currentTarget.querySelector(".column-list") as HTMLElement)?.classList.remove("drag-over"); handleDrop(col.id); }}
                    >
                      <div className="column-head">
                        <h3>{col.label}</h3>
                        <span className="badge">{items.length}</span>
                      </div>
                      <div className="column-list">
                        {items.length === 0 ? (
                          <div className="empty-col">
                            {col.id === "todo" ? "Žádné úkoly — přidej nějaký!" : col.id === "doing" ? "Teď nic neběží" : "Zatím nic hotového"}
                          </div>
                        ) : items.map(t => (
                          <TaskCard
                            key={t.id}
                            task={t}
                            onStar={() => setTasks(prev => prev.map(x => x.id === t.id ? { ...x, starred: !x.starred } : x))}
                            onDelete={() => setTasks(prev => prev.filter(x => x.id !== t.id))}
                            onMovePrev={() => { const ci = COLS.findIndex(c => c.id === t.col); if (ci > 0) moveTaskDirect(t.id, COLS[ci-1].id); }}
                            onMoveNext={() => { const ci = COLS.findIndex(c => c.id === t.col); if (ci < COLS.length - 1) moveTaskDirect(t.id, COLS[ci+1].id); }}
                            onDragStart={() => handleDragStart(t.id)}
                            onMoveSheet={() => openMoveSheet(t.id)}
                            onEdit={() => openEditTask(t)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ══ CALENDAR VIEW ══ */}
            <section className={`view${view === "calendar" ? " active" : ""}`}>
              <div className="cal-bar">
                <div className="cal-nav">
                  <button className="nav-btn" onClick={calPrev} aria-label="Předchozí">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <button className="nav-btn" onClick={() => setCalDate(startOfDay(new Date()))} aria-label="Dnes">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button className="nav-btn" onClick={calNext} aria-label="Další">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                </div>
                <h2 className="cal-bar-title">{calTitle()}</h2>
                <div className="cal-modes" role="tablist">
                  {(["day", "week", "month"] as CalMode[]).map(m => (
                    <button key={m} className={calMode === m ? "active" : ""} onClick={() => setCalMode(m)} role="tab">
                      {m === "day" ? "Den" : m === "week" ? "Týd" : "Měs"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="cal-scroll" ref={calScrollRef}>
                {/* Day / Week */}
                {calMode !== "month" && (
                  <>
                    {/* Day headers */}
                    <div className="day-header-row" style={{ gridTemplateColumns: calGridCols }}>
                      <div className="time-corner" />
                      {calDays.map((d, i) => (
                        <div key={i} className={`day-header${sameDate(d, today) ? " today" : ""}`} onClick={() => { setCalDate(startOfDay(d)); setCalMode("day"); }}>
                          <span className="dwday">{d.toLocaleDateString("cs-CZ", { weekday: "short" })}</span>
                          <span className={`dnum${sameDate(d, today) ? " today" : ""}`}>{d.getDate()}</span>
                        </div>
                      ))}
                    </div>

                    {/* All-day tasks row */}
                    {calDays.some(d => tasks.some(t => t.due === ymd(d) && !t.time && t.col !== "done")) && (
                      <div className="allday-row" style={{ gridTemplateColumns: calGridCols }}>
                        <div className="allday-label">Celý den</div>
                        {calDays.map((d, di) => {
                          const allDayTasks = tasks.filter(t => t.due === ymd(d) && !t.time && t.col !== "done");
                          return (
                            <div key={di} className="allday-col">
                              {allDayTasks.map(t => {
                                const c = colorOf(t.color);
                                return (
                                  <div key={t.id} className="allday-task" style={{ background: c.bg, borderLeft: `3px solid ${c.border}` }} onClick={() => openEditTask(t)}>
                                    ✓ {t.title}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Time grid */}
                    <div className="grid-wrap" style={{ gridTemplateColumns: calGridCols }}>
                      {/* time col */}
                      <div className="time-col">
                        {HOURS.map(h => (
                          <div key={h} className="hour-label">{h === 0 ? "" : fmtHour(h)}</div>
                        ))}
                      </div>
                      {/* day cols */}
                      {calDays.map((day, di) => {
                        const dayEvents = events.filter(ev => ev.date === ymd(day));
                        const dayTasks = tasks.filter(t => t.due === ymd(day) && t.time && t.col !== "done");
                        const isToday = sameDate(day, today);
                        const nowTop = (nowMinute / 60) * 52;
                        return (
                          <div key={di} className={`day-col${isToday ? " today-col" : ""}`}>
                            {HOURS.map(h => (
                              <div key={h} className="hour-cell" onClick={() => openCreateEvent(day, h)} />
                            ))}

                            {/* calendar events */}
                            {dayEvents.map(ev => {
                              const c = colorOf(ev.color);
                              return (
                                <div
                                  key={ev.id}
                                  className="event"
                                  style={{ background: c.bg, borderLeft: `3px solid ${c.border}`, top: ev.start * 52, height: Math.max((ev.end - ev.start) * 52 - 2, 24) }}
                                  onClick={e => { e.stopPropagation(); openEditEvent(ev); }}
                                >
                                  <span className="ev-title">{ev.title}</span>
                                  <span className="ev-time">{fmtHourShort(ev.start)}–{fmtHourShort(ev.end)}</span>
                                </div>
                              );
                            })}

                            {/* tasks with time */}
                            {dayTasks.map(t => {
                              const hour = parseTimeToHour(t.time) ?? 9;
                              const c = colorOf(t.color);
                              return (
                                <div
                                  key={t.id}
                                  className="event task-block"
                                  style={{ background: c.bg, borderLeft: `3px solid ${c.border}`, top: hour * 52, height: 48 }}
                                  onClick={e => { e.stopPropagation(); openEditTask(t); }}
                                >
                                  <span className="ev-title">✓ {t.title}</span>
                                  <span className="ev-time">{t.time}</span>
                                </div>
                              );
                            })}

                            {isToday && <div className="now-line" style={{ top: nowTop }} />}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Month */}
                {calMode === "month" && (
                  <div className="month-wrap">
                    <div className="month-dow">
                      {dowLabels.map(l => <div key={l}>{l}</div>)}
                    </div>
                    <div className="month-grid">
                      {monthCells.map((d, i) => {
                        const dateStr = ymd(d);
                        const dayEvents = events.filter(ev => ev.date === dateStr);
                        const dayTasks = tasks.filter(t => t.due === dateStr && t.col !== "done");
                        const isOther = d.getMonth() !== calDate.getMonth();
                        const isToday2 = sameDate(d, today);
                        const allItems = [
                          ...dayTasks.map(t => ({ key: `t-${t.id}`, label: t.title, color: colorOf(t.color), isTask: true, obj: t })),
                          ...dayEvents.map(ev => ({ key: `e-${ev.id}`, label: ev.title, color: colorOf(ev.color), isTask: false, obj: ev })),
                        ];
                        const visible = allItems.slice(0, 3);
                        const overflow = allItems.length - visible.length;
                        return (
                          <div
                            key={i}
                            className={`month-cell${isOther ? " other-month" : ""}${isToday2 ? " today" : ""}`}
                            onClick={() => { setCalDate(startOfDay(d)); setCalMode("day"); }}
                          >
                            <div className="mday">{d.getDate()}</div>
                            <div className="mevents">
                              {visible.map(item => (
                                <div
                                  key={item.key}
                                  className="mchip"
                                  style={{ background: item.color.bg, borderLeft: `2px solid ${item.color.border}` }}
                                  onClick={e => { e.stopPropagation(); item.isTask ? openEditTask(item.obj as Task) : openEditEvent(item.obj as CalEvent); }}
                                >
                                  {item.isTask ? "✓ " : ""}{item.label}
                                </div>
                              ))}
                              {overflow > 0 && <div className="mmore">+{overflow}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </main>

          {/* ══ TAB BAR ══ */}
          <nav className="tabbar">
            <button className={`tab${view === "tasks" ? " active" : ""}`} onClick={() => setView("tasks")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9h8M8 13h5M8 17h7"/></svg>
              Poznámky
            </button>
            <button className="tab-fab" onClick={fabAction} aria-label="Přidat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button className={`tab${view === "calendar" ? " active" : ""}`} onClick={() => setView("calendar")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
              Kalendář
            </button>
          </nav>
        </div>
      </div>

      {/* ══ REMINDER POPUP ══ */}
      {reminder && (
        <div className="reminder-popup" role="alert">
          <div className="reminder-icon">⏰</div>
          <div className="reminder-body">
            <div className="reminder-title">{reminder.title}</div>
            <div className="reminder-sub">
              {reminder.type === "task" ? "Úkol" : "Událost"} · za {reminder.minutesLeft} min
            </div>
          </div>
          <button className="reminder-close" onClick={() => setReminder(null)} aria-label="Zavřít">✕</button>
        </div>
      )}

      {/* ══ TASK MODAL ══ */}
      <div className={`scrim${taskModal ? " open" : ""}`} onClick={e => { if (e.target === e.currentTarget) setTaskModal(false); }}>
        <div className="sheet" role="dialog" aria-modal="true">
          <div className="sheet-handle" />
          <h3>{editingTaskId ? "✏️ Upravit poznámku" : "🦙 Nová poznámka"}</h3>
          <p className="sub">Co by si lama ráda odbavila?</p>
          <div className="field">
            <label htmlFor="task-title">Název</label>
            <input ref={taskTitleRef} id="task-title" type="text" placeholder="např. Zalít kaktusy" maxLength={80} autoComplete="off" value={tTitle} onChange={e => setTTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && saveTask()} />
          </div>
          <div className="field">
            <label htmlFor="task-note">Poznámka (volitelné)</label>
            <textarea id="task-note" placeholder="Detaily, kontext, případně odkazy…" maxLength={500} value={tNote} onChange={e => setTNote(e.target.value)} />
          </div>
          <div className="field field-row">
            <div className="field-sub">
              <label htmlFor="task-due">Datum</label>
              <input id="task-due" type="date" value={tDue} onChange={e => setTDue(e.target.value)} />
            </div>
            <div className="field-sub">
              <label htmlFor="task-time">Čas{!tDue && <span className="field-hint"> (vyber datum)</span>}</label>
              <input id="task-time" type="time" value={tTime} disabled={!tDue} onChange={e => setTTime(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Barva</label>
            <ColorSwatches selected={tColor} onChange={setTColor} />
          </div>
          <div className="field">
            <button type="button" className={`star-toggle${tStarred ? " on" : ""}`} aria-pressed={tStarred} onClick={() => setTStarred(v => !v)}>
              <span className="star-icon"><StarSvg filled={tStarred} /></span>
              <span className="label-stack">
                Důležité
                <small>Připnout nahoře v To Do</small>
              </span>
            </button>
          </div>
          <div className="sheet-actions">
            <button className="btn-secondary" onClick={() => setTaskModal(false)}>Zrušit</button>
            <button className="btn-primary" onClick={saveTask}>Uložit</button>
          </div>
        </div>
      </div>

      {/* ══ EVENT MODAL ══ */}
      <div className={`scrim${eventModal ? " open" : ""}`} onClick={e => { if (e.target === e.currentTarget) setEventModal(false); }}>
        <div className="sheet" role="dialog" aria-modal="true">
          <div className="sheet-handle" />
          <h3>🦙 {evIsEdit ? "Upravit událost" : "Nová událost"}</h3>
          <p className="sub">{evModalSub}</p>
          <div className="field">
            <label htmlFor="ev-title">Název</label>
            <input ref={eventTitleRef} id="ev-title" type="text" placeholder="např. Lamí jóga 🧘" maxLength={60} autoComplete="off" value={evTitle} onChange={e => setEvTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && saveEvent()} />
          </div>
          <div className="field">
            <label>Čas</label>
            <div className="time-row">
              <input type="time" value={evStart} onChange={e => setEvStart(e.target.value)} />
              <input type="time" value={evEnd} onChange={e => setEvEnd(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Barva</label>
            <ColorSwatches selected={evColor} onChange={setEvColor} />
          </div>
          <div className="sheet-actions">
            {evIsEdit && <button className="btn-secondary" onClick={deleteEvent}>Smazat</button>}
            <button className="btn-secondary" onClick={() => setEventModal(false)}>Zrušit</button>
            <button className="btn-primary" onClick={saveEvent}>Uložit</button>
          </div>
        </div>
      </div>

      {/* ══ MOVE SHEET ══ */}
      <div className={`scrim${moveModal ? " open" : ""}`} onClick={e => { if (e.target === e.currentTarget) setMoveModal(false); }}>
        <div className="sheet" role="dialog" aria-modal="true">
          <div className="sheet-handle" />
          <h3>Přesunout poznámku</h3>
          <p className="sub">Kam to bude patřit?</p>
          <div className="move-sheet-list">
            {COLS.map(c => {
              const task = tasks.find(t => t.id === movingTaskId);
              return (
                <button key={c.id} className={task?.col === c.id ? "current" : ""} onClick={() => { if (movingTaskId) moveTask(movingTaskId, c.id); }}>
                  <span className="dot" style={{ background: c.dot }} />
                  {c.label}
                </button>
              );
            })}
          </div>
          <div className="sheet-actions">
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setMoveModal(false)}>Zrušit</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────── TaskCard component ────────────────── */
function TaskCard({
  task, onStar, onDelete, onMovePrev, onMoveNext, onDragStart, onMoveSheet, onEdit,
}: {
  task: Task;
  onStar: () => void;
  onDelete: () => void;
  onMovePrev: () => void;
  onMoveNext: () => void;
  onDragStart: () => void;
  onMoveSheet: () => void;
  onEdit: () => void;
}) {
  const colIdx = COLS.findIndex(c => c.id === task.col);
  const tapStart = useRef(0);

  let dueClass = "";
  let dueLabel = "";
  if (task.due) {
    const d = new Date(task.due + "T00:00:00");
    const diff = Math.round((d.getTime() - startOfDay(new Date()).getTime()) / 86400000);
    dueClass = task.col !== "done" && diff < 0 ? "overdue" : task.col !== "done" && diff === 0 ? "today" : "";
    dueLabel = friendlyDate(task.due, task.time || undefined);
  }

  return (
    <div
      className={`card${task.starred ? " starred" : ""}`}
      data-color={task.color}
      draggable
      onDragStart={onDragStart}
      onTouchStart={() => { tapStart.current = Date.now(); }}
      onTouchEnd={e => { if (Date.now() - tapStart.current < 500 && !(e.target as Element).closest("button")) onMoveSheet(); }}
      onDoubleClick={e => { if (!(e.target as Element).closest("button")) onEdit(); }}
    >
      <div className="star-badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.95 6 6.55.95-4.75 4.65 1.1 6.5L12 17.6l-5.85 3 1.1-6.5L2.5 9.45 9.05 8.5z"/></svg>
      </div>
      <div className="card-head">
        <div className={`card-title${task.col === "done" ? " done" : ""}`}>{task.title}</div>
        <div className="card-actions">
          <button className={`icon-btn star${task.starred ? " on" : ""}`} aria-label="Důležité" aria-pressed={task.starred} onClick={e => { e.stopPropagation(); onStar(); }}>
            <StarSvg filled={task.starred} />
          </button>
          <button className="icon-btn delete" aria-label="Smazat" onClick={e => { e.stopPropagation(); onDelete(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
      {task.note && <div className="card-note">{task.note}</div>}
      {task.due && (
        <div className="card-meta">
          <span className={`due-chip${dueClass ? ` ${dueClass}` : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
            {dueLabel}
          </span>
        </div>
      )}
      <div className="move-row">
        <button className="move-btn" disabled={colIdx === 0} onClick={e => { e.stopPropagation(); onMovePrev(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          {colIdx > 0 ? COLS[colIdx - 1].short : ""}
        </button>
        <button className="move-btn" disabled={colIdx === COLS.length - 1} onClick={e => { e.stopPropagation(); onMoveNext(); }}>
          {colIdx < COLS.length - 1 ? COLS[colIdx + 1].short : ""}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}
