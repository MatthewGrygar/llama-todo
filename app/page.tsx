"use client";
import { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════ TYPES ═══════════ */
type Col      = "todo" | "doing" | "done";
type Color    = "lilac"|"pink"|"mint"|"peach"|"sky"|"lemon"|"rose"|"coral"|"teal"|"indigo"|"sage"|"mauve";
type CalMode  = "day"|"week"|"month";
type ViewType = "tasks"|"today"|"calendar";

interface Task {
  id: string; title: string; note: string;
  due: string; time: string;
  col: Col; color: Color; starred: boolean; created: number;
  order?: number;
}
interface CalEvent {
  id: string; title: string; date: string;
  start: number; end: number; color: Color;
}
interface ReminderAlert { id: string; title: string; type: "task"|"event"; minutesLeft: number; }

/* ═══════════ CONSTANTS ═══════════ */
const COLS: { id: Col; label: string; short: string; dot: string }[] = [
  { id: "todo",  label: "To Do 📋",       short: "To Do",       dot: "#C4A6F2" },
  { id: "doing", label: "Probíhá ⚡",     short: "Probíhá",     dot: "#F6B8E0" },
  { id: "done",  label: "Hotovo ✅",       short: "Hotovo",      dot: "#9ADCBD" },
];

const COLORS: { id: Color; bg: string; border: string; name: string }[] = [
  { id: "lilac",  bg: "#E8DCFF", border: "#C4A6F2", name: "Lila" },
  { id: "pink",   bg: "#FFD6EC", border: "#F6B8E0", name: "Růžová" },
  { id: "mint",   bg: "#CDF0DD", border: "#9ADCBD", name: "Mint" },
  { id: "peach",  bg: "#FFE0C4", border: "#FFBF8A", name: "Broskvová" },
  { id: "sky",    bg: "#C9E1FF", border: "#8FC3FF", name: "Modrá" },
  { id: "lemon",  bg: "#FFEBA0", border: "#FFD84D", name: "Citronová" },
  { id: "rose",   bg: "#FFC1CC", border: "#FF8A9B", name: "Červená" },
  { id: "coral",  bg: "#FFD1B8", border: "#FFA07A", name: "Korálová" },
  { id: "teal",   bg: "#B2EBE0", border: "#4DB6AC", name: "Tyrkysová" },
  { id: "indigo", bg: "#C5CAE9", border: "#7986CB", name: "Indigová" },
  { id: "sage",   bg: "#C8E6C9", border: "#81C784", name: "Šalvějová" },
  { id: "mauve",  bg: "#E1BEE7", border: "#BA68C8", name: "Fialová" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/* ═══════════ HELPERS ═══════════ */
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
const pad2 = (n: number) => String(n).padStart(2,"0");

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function sameDate(a: Date, b: Date) { return ymd(a) === ymd(b); }

function fmtHour(h: number) {
  const ap = h < 12 ? "AM" : "PM";
  const hh = h===0 ? 12 : h>12 ? h-12 : h;
  return `${hh} ${ap}`;
}
function fmtHourShort(h: number) {
  return `${h===0?12:h>12?h-12:h}${h<12?"a":"p"}`;
}
function parseTimeToHour(s: string) {
  if (!s) return null;
  const [h,m] = s.split(":").map(Number);
  return h + m/60;
}
function hourToStr(h: number) { return `${pad2(Math.floor(h))}:${pad2(Math.round((h%1)*60))}`; }

function friendlyDate(iso: string, time?: string) {
  if (!iso) return "";
  const d = new Date(iso+"T00:00:00");
  const diff = Math.round((d.getTime() - startOfDay(new Date()).getTime()) / 86400000);
  let s = "";
  if (diff===0) s = "Dnes";
  else if (diff===1) s = "Zítra";
  else if (diff===-1) s = "Včera";
  else if (diff>0 && diff<7) s = d.toLocaleDateString("cs-CZ",{weekday:"long"});
  else s = d.toLocaleDateString("cs-CZ",{day:"numeric",month:"short"});
  return time ? `${s} ${time}` : s;
}

function colorOf(id: Color) { return COLORS.find(c=>c.id===id)||COLORS[0]; }

function load<T>(key: string, fb: T): T {
  if (typeof window==="undefined") return fb;
  try { return JSON.parse(localStorage.getItem(key)||"null") ?? fb; }
  catch { return fb; }
}
function save<T>(key: string, v: T) {
  if (typeof window!=="undefined") localStorage.setItem(key,JSON.stringify(v));
}

/* ═══════════ SEED DATA ═══════════ */
function seedTasks(): Task[] {
  const d = (n: number) => { const x=new Date(); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
  return [
    { id:uid(), title:"Učesat lamu 🦙",         note:"Jemný kartáč — minule jí to cuchalo.",           due:d(0), time:"10:00", col:"todo",  color:"lilac", starred:true,  created:Date.now()-3e5 },
    { id:uid(), title:"Nové ovesné seno",          note:"",                                                due:d(2), time:"",     col:"todo",  color:"peach", starred:false, created:Date.now()-2e5 },
    { id:uid(), title:"Sticker pack design",       note:"4 samolepky: kafe, jóga, sníh, kniha",          due:d(1), time:"14:00", col:"doing", color:"pink",  starred:false, created:Date.now()-1e5 },
    { id:uid(), title:"Odepsat Lile",              note:"Ohledně výletu na louku příští sobotu",          due:"",   time:"",     col:"doing", color:"sky",   starred:false, created:Date.now()-9e4 },
    { id:uid(), title:"Zastříhnout kopýtka",       note:"",                                                due:d(-1),time:"",    col:"done",  color:"mint",  starred:false, created:Date.now()-2e6 },
  ];
}
function seedEvents(): CalEvent[] {
  const s = (n:number) => ymd(addDays(startOfDay(new Date()),n));
  return [
    { id:uid(), title:"Morning oat-cino ☕", date:s(0), start:8,  end:9,  color:"peach" },
    { id:uid(), title:"Design review",       date:s(0), start:11, end:12, color:"lilac" },
    { id:uid(), title:"Llama yoga 🧘",       date:s(1), start:7,  end:8,  color:"mint"  },
    { id:uid(), title:"Pasture walk",        date:s(2), start:15, end:17, color:"pink"  },
  ];
}

/* ═══════════ SUB-COMPONENTS ═══════════ */
/* ═══════════ LOGO COMPONENTS ═══════════ */
function LlamaMark({ size = 40, tone = "color" }: { size?: number; tone?: "color"|"white"|"ink" }) {
  const filters = { color:"none", white:"brightness(0) invert(1)", ink:"brightness(0) saturate(0%) opacity(0.9)" };
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      style={{ display:"block", filter:filters[tone], overflow:"visible", flexShrink:0 }}>
      <defs>
        <linearGradient id={`lamaFur-${tone}`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0"    stopColor="#cdb8ee"/>
          <stop offset="0.38" stopColor="#e1a4d6"/>
          <stop offset="0.72" stopColor="#aa7cdb"/>
          <stop offset="1"    stopColor="#825fcc"/>
        </linearGradient>
      </defs>
      <path fillRule="evenodd" fill={tone==="color" ? `url(#lamaFur-${tone})` : "currentColor"} d="
        M37 15 C35 8 39 4 44 6 C47 8 48 13 48 19
        C50 15 52 12 55 11 C59 9 63 12 63 18
        C64 22 63 27 64 31 C70 32 77 37 83 44
        C86 47 85 52 81 53 C83 56 79 59 74 60
        C72 63 71 66 70 69 C69 76 68 82 66 88
        C56 91 46 90 39 86 C33 84 28 80 35 77
        C30 75 26 70 35 67 C30 65 26 60 36 57
        C31 55 27 50 37 47 C32 45 28 39 38 37
        C35 32 35 25 36 20 C36 18 36 16 37 15 Z
        M64 34 C60 38 59 43 60 47 C57 49 54 51 54 55
        C55 58 59 60 64 60 C69 60 73 58 76 56
        C79 54 80 51 79 49 C76 46 71 44 68 44
        C67 41 66 36 64 34 Z"/>
      <path d="M67 56 C70 57 73 56 76 54" fill="none" stroke={tone==="color"?"#9a6fd0":"currentColor"} strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="61" cy="45" r="3.4" fill={tone==="color"?"#6a4ab0":"currentColor"}/>
    </svg>
  );
}

function LlamaWordmark({ size = 20 }: { size?: number }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", fontWeight:700, fontSize:size, letterSpacing:"-0.03em", lineHeight:1 }}>
      <span style={{ color:"#7d56c0" }}>lama</span>
      <span style={{
        display:"inline-flex", width:"0.58em", height:"0.58em",
        borderRadius:"0.16em", background:"#3a57b4", flexShrink:0,
        alignItems:"center", justifyContent:"center",
        margin:"0 0.18em", transform:"translateY(-0.02em)",
      }}>
        <svg width="62%" height="62%" viewBox="0 0 24 24">
          <path d="M5 13 l4 4 l10 -11" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      <span style={{ color:"#2a2540" }}>todo</span>
    </span>
  );
}

function StarSvg({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled?"currentColor":"none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 2.5l2.95 6 6.55.95-4.75 4.65 1.1 6.5L12 17.6l-5.85 3 1.1-6.5L2.5 9.45 9.05 8.5z"/>
    </svg>
  );
}

function ColorPicker({ selected, onChange }: { selected: Color; onChange: (c:Color)=>void }) {
  return (
    <div className="color-swatches">
      {COLORS.map(c => (
        <button key={c.id} type="button"
          className={`swatch${selected===c.id?" active":""}`}
          style={{ background: c.bg, outlineColor: c.border }}
          aria-label={c.name} title={c.name}
          onClick={() => onChange(c.id)}
        />
      ))}
    </div>
  );
}

function IosStatus() {
  const [t, setT] = useState("9:41");
  useEffect(() => {
    const upd = () => { const n=new Date(); setT(`${n.getHours()}:${pad2(n.getMinutes())}`); };
    upd(); const id=setInterval(upd,30000); return ()=>clearInterval(id);
  }, []);
  return (
    <div className="ios-status">
      <span style={{fontWeight:700}}>{t}</span>
      <span className="ios-right">
        <svg width="16" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx=".6"/><rect x="4.5" y="5" width="3" height="6" rx=".6"/><rect x="9" y="3" width="3" height="8" rx=".6"/><rect x="13.5" y="0" width="3" height="11" rx=".6"/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1 4.5a10 10 0 0 1 13 0"/><path d="M3.5 7a6 6 0 0 1 8 0"/><circle cx="7.5" cy="9.5" r="1" fill="currentColor" stroke="none"/></svg>
        <svg width="25" height="12" viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="22" height="11" rx="2.5" stroke="currentColor" strokeOpacity=".4"/><rect x="24" y="4" width="1.5" height="4" rx=".5" fill="currentColor" fillOpacity=".4"/><rect x="2" y="2" width="16" height="8" rx="1.4" fill="currentColor"/></svg>
      </span>
    </div>
  );
}

/* ═══════════ MAIN APP ═══════════ */
export default function App() {
  /* ── state ── */
  const [tasks,     setTasksRaw]  = useState<Task[]>([]);
  const [events,    setEventsRaw] = useState<CalEvent[]>([]);
  const [view,      setView]      = useState<ViewType>("tasks");
  const [calMode,   setCalMode]   = useState<CalMode>("month");
  const [calDate,   setCalDate]   = useState<Date>(() => startOfDay(new Date()));
  const [greeting,  setGreeting]  = useState("Pohodově a produktivně ✨");

  /* task modal */
  const [taskModal, setTaskModal] = useState(false);
  const [editId,    setEditId]    = useState<string|null>(null);
  const [tTitle,    setTTitle]    = useState("");
  const [tNote,     setTNote]     = useState("");
  const [tDue,      setTDue]      = useState("");
  const [tTime,     setTTime]     = useState("");
  const [tColor,    setTColor]    = useState<Color>("lilac");
  const [tStarred,  setTStarred]  = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  /* event modal */
  const [evModal,   setEvModal]   = useState(false);
  const [evEditId,  setEvEditId]  = useState<string|null>(null);
  const [evTitle,   setEvTitle]   = useState("");
  const [evDate,    setEvDate]    = useState("");
  const [evStart,   setEvStart]   = useState("08:00");
  const [evEnd,     setEvEnd]     = useState("09:00");
  const [evColor,   setEvColor]   = useState<Color>("lilac");
  const evTitleRef = useRef<HTMLInputElement>(null);

  /* move sheet */
  const [moveModal, setMoveModal] = useState(false);
  const [moveId,    setMoveId]    = useState<string|null>(null);

  /* filter */
  const [filter, setFilter] = useState<"all"|Col>("all");

  /* reminder */
  const [reminder, setReminder] = useState<ReminderAlert|null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  /* drag-to-reorder */
  const dragState = useRef<{ id: string; col: Col } | null>(null);
  const dragId = useRef<string|null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; before: boolean } | null>(null);

  /* ── init ── */
  useEffect(() => {
    const stored = load<Task[]|null>("llama.tasks.v2", null);
    if (!stored) { const s=seedTasks(); setTasksRaw(s); save("llama.tasks.v2",s); }
    else setTasksRaw(stored.map(t => ({ ...t, time: t.time??"", color: t.color||"lilac" as Color })));

    const storedEv = load<CalEvent[]|null>("llama.events.v2", null);
    if (!storedEv) { const s=seedEvents(); setEventsRaw(s); save("llama.events.v2",s); }
    else setEventsRaw(storedEv);

    const h = new Date().getHours();
    setGreeting(h<5?"Pozdní noc, lamo 🌙":h<12?"Dobré ráno, lamo ☀️":h<17?"Odpolední makot ✨":h<21?"Pohodový večer 🌸":"Čas se zklidnit 🌙");

    if (typeof window!=="undefined" && "Notification" in window && Notification.permission==="default")
      Notification.requestPermission();
  }, []);

  /* ── reminders ── */
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const nowMin = now.getHours()*60 + now.getMinutes();
      const today = ymd(startOfDay(now));
      const bucket = Math.floor(nowMin/5);

      for (const ev of events) {
        if (ev.date===today) {
          const diff = ev.start*60 - nowMin;
          const key = `ev-${ev.id}-${bucket}`;
          if (diff>0 && diff<=30 && !notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            setReminder({ id:key, title:ev.title, type:"event", minutesLeft:Math.round(diff) });
            if ("Notification" in window && Notification.permission==="granted")
              new Notification(`⏰ Za ${Math.round(diff)} min: ${ev.title}`, { body:"Lama To-Do" });
          }
        }
      }
      for (const t of tasks) {
        if (t.due===today && t.time && t.col!=="done") {
          const h = parseTimeToHour(t.time);
          if (h==null) continue;
          const diff = h*60 - nowMin;
          const key = `task-${t.id}-${bucket}`;
          if (diff>0 && diff<=30 && !notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            setReminder({ id:key, title:t.title, type:"task", minutesLeft:Math.round(diff) });
            if ("Notification" in window && Notification.permission==="granted")
              new Notification(`⏰ Za ${Math.round(diff)} min: ${t.title}`, { body:"Lama To-Do" });
          }
        }
      }
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [events, tasks]);

  /* ── persistence ── */
  const setTasks = useCallback((fn: (prev:Task[])=>Task[]) => {
    setTasksRaw(prev => { const next=fn(prev); save("llama.tasks.v2",next); return next; });
  }, []);
  const setEvents = useCallback((fn: (prev:CalEvent[])=>CalEvent[]) => {
    setEventsRaw(prev => { const next=fn(prev); save("llama.events.v2",next); return next; });
  }, []);

  /* ── task actions ── */
  function openCreateTask() {
    setEditId(null); setTTitle(""); setTNote(""); setTDue(""); setTTime("");
    setTColor("lilac"); setTStarred(false);
    setTaskModal(true); setTimeout(()=>titleRef.current?.focus(),250);
  }
  function openEditTask(t: Task) {
    setEditId(t.id); setTTitle(t.title); setTNote(t.note);
    setTDue(t.due); setTTime(t.time); setTColor(t.color); setTStarred(t.starred);
    setTaskModal(true); setTimeout(()=>titleRef.current?.focus(),250);
  }
  function saveTask() {
    const title = tTitle.trim(); if (!title) { titleRef.current?.focus(); return; }
    if (editId) {
      setTasks(prev => prev.map(t => t.id===editId ? {...t,title,note:tNote.trim(),due:tDue,time:tTime,color:tColor,starred:tStarred} : t));
    } else {
      setTasks(prev => [...prev,{id:uid(),title,note:tNote.trim(),due:tDue,time:tTime,col:"todo",color:tColor,starred:tStarred,created:Date.now()}]);
    }
    setTaskModal(false);
  }
  function deleteTask(id: string) { setTasks(prev=>prev.filter(t=>t.id!==id)); }
  function moveTaskDir(id: string, col: Col) { setTasks(prev=>prev.map(t=>t.id===id?{...t,col}:t)); }

  function handleDragStart(id: string, col: Col) {
    dragId.current = id;
    dragState.current = { id, col };
    setDropTarget(null);
  }
  function handleCardDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault(); e.stopPropagation();
    if (!dragState.current || dragState.current.id === targetId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    setDropTarget(prev => (prev?.id === targetId && prev?.before === before) ? prev : { id: targetId, before });
  }
  function handleCardDrop(e: React.DragEvent, targetId: string, targetCol: Col) {
    e.preventDefault(); e.stopPropagation();
    if (!dragState.current) return;
    const { id: draggedId } = dragState.current;
    if (draggedId === targetId) { setDropTarget(null); return; }
    const before = dropTarget?.before ?? true;
    setTasks(prev => {
      const dragged = prev.find(t=>t.id===draggedId); if (!dragged) return prev;
      let list = prev.filter(t=>t.id!==draggedId);
      const ti = list.findIndex(t=>t.id===targetId); if (ti===-1) return prev;
      list.splice(before ? ti : ti+1, 0, { ...dragged, col: targetCol });
      const base = Date.now(); let ci = 0;
      return list.map(t => t.col===targetCol ? {...t, order: base + (ci++)*100} : t);
    });
    dragState.current = null; dragId.current = null; setDropTarget(null);
  }
  function handleColumnDrop(e: React.DragEvent, col: Col) {
    if ((e.target as Element).closest('.card')) return;
    if (!dragState.current) return;
    moveTaskDir(dragState.current.id, col);
    dragState.current = null; dragId.current = null; setDropTarget(null);
  }

  /* ── event actions ── */
  function openCreateEvent(date?: Date, hour?: number) {
    const d = date || startOfDay(new Date());
    const h = hour ?? new Date().getHours();
    setEvEditId(null); setEvTitle("");
    setEvDate(ymd(d)); setEvStart(hourToStr(h)); setEvEnd(hourToStr(Math.min(h+1,23)));
    setEvColor("lilac"); setEvModal(true);
    setTimeout(()=>evTitleRef.current?.focus(),250);
  }
  function openEditEvent(ev: CalEvent) {
    setEvEditId(ev.id); setEvTitle(ev.title); setEvDate(ev.date);
    setEvStart(hourToStr(ev.start)); setEvEnd(hourToStr(ev.end)); setEvColor(ev.color);
    setEvModal(true);
  }
  function saveEvent() {
    const title = evTitle.trim(); if (!title) { evTitleRef.current?.focus(); return; }
    const start = parseTimeToHour(evStart)!;
    let end = parseTimeToHour(evEnd) ?? start+1;
    if (end<=start) end = start+1;
    if (evEditId) {
      setEvents(prev=>prev.map(e=>e.id===evEditId?{...e,title,date:evDate,start,end,color:evColor}:e));
    } else {
      setEvents(prev=>[...prev,{id:uid(),title,date:evDate,start,end,color:evColor}]);
    }
    setEvModal(false);
  }
  function deleteEvent(id: string) { setEvents(prev=>prev.filter(e=>e.id!==id)); setEvModal(false); }

  /* ── fab action ── */
  function fabAction() {
    if (view==="calendar") openCreateEvent();
    else openCreateTask();
  }

  /* ── calendar ── */
  const today = startOfDay(new Date());
  const todayStr = ymd(today);

  const calDays = calMode==="week"
    ? Array.from({length:7},(_,i)=>addDays(startOfWeek(calDate),i))
    : calMode==="day" ? [calDate] : [];

  const calGridCols = calMode==="week"
    ? "44px repeat(7, minmax(80px,1fr))"
    : "44px 1fr";

  const dowLabels = ["Ne","Po","Út","St","Čt","Pá","So"];
  const firstOfMonth = new Date(calDate.getFullYear(), calDate.getMonth(), 1);
  const monthCells = Array.from({length:42},(_,i)=>addDays(startOfWeek(firstOfMonth),i));

  function calTitle() {
    if (calMode==="week") {
      const s=startOfWeek(calDate), e=addDays(s,6);
      return s.getMonth()===e.getMonth()
        ? s.toLocaleDateString("cs-CZ",{month:"long",year:"numeric"})
        : `${s.toLocaleDateString("cs-CZ",{month:"short"})} – ${e.toLocaleDateString("cs-CZ",{month:"short",year:"numeric"})}`;
    }
    if (calMode==="day") return calDate.toLocaleDateString("cs-CZ",{weekday:"long",day:"numeric",month:"long"});
    return calDate.toLocaleDateString("cs-CZ",{month:"long",year:"numeric"});
  }
  function calSub() {
    if (calMode==="month") return "Měsíční přehled";
    if (calMode==="week") return `Týden od ${startOfWeek(calDate).toLocaleDateString("cs-CZ",{day:"numeric",month:"short"})}`;
    return calDate.toLocaleDateString("cs-CZ",{day:"numeric",month:"long",year:"numeric"});
  }
  function calNav(dir: 1|-1) {
    if (calMode==="month") setCalDate(new Date(calDate.getFullYear(),calDate.getMonth()+dir,1));
    else setCalDate(addDays(calDate,(calMode==="week"?7:1)*dir));
  }

  /* ── calendar scroll ── */
  const calScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view==="calendar" && calMode!=="month" && calScrollRef.current) {
      const now = new Date();
      const targetH = calDays.some(d=>sameDate(d,now)) ? Math.max(0,now.getHours()-1) : 7;
      calScrollRef.current.scrollTop = targetH*52;
    }
  }, [view,calMode,calDate]); // eslint-disable-line

  /* ── now line ── */
  const [nowMinute, setNowMinute] = useState(0);
  useEffect(()=>{
    const upd = ()=>{const n=new Date(); setNowMinute(n.getHours()*60+n.getMinutes());};
    upd(); const id=setInterval(upd,60000); return ()=>clearInterval(id);
  },[]);

  /* ── sorted tasks ── */
  function sorted(col: Col) {
    return tasks.filter(t=>t.col===col).sort((a,b)=>{
      if (a.starred !== b.starred) return (b.starred?1:0)-(a.starred?1:0);
      return (a.order ?? a.created) - (b.order ?? b.created);
    });
  }
  const counts = { all:tasks.length, todo:0, doing:0, done:0 };
  tasks.forEach(t=>counts[t.col]++);
  const todayTasks = tasks.filter(t=>t.due===todayStr);

  /* ────────────────── RENDER ────────────────── */
  return (
    <>
    <div className="app">
      <IosStatus />

      {/* Desktop header */}
      <header>
        <LlamaMark size={32} tone="color"/>
        <div className="header-brand">
          <LlamaWordmark size={16}/>
          <p>{greeting}</p>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main>

        {/* ══ TASKS ══ */}
        <section className={`view${view==="tasks"?" active":""}`}>
          <div className="view-toolbar">
            <h2 className="view-title">Moje poznámky</h2>
            <span className="view-count">{tasks.length}</span>
          </div>
          <div className="filter-bar">
            {(["all","todo","doing","done"] as const).map(f=>(
              <button key={f} className={`filter-btn${filter===f?" active":""}`} onClick={()=>setFilter(f)}>
                {f==="all"?"Vše":f==="todo"?"To Do":f==="doing"?"Probíhá":"Hotovo"}
                <span className="fc">{counts[f]}</span>
              </button>
            ))}
          </div>
          <div className="board" data-filter={filter}>
            {COLS.map(col=>{
              const items = sorted(col.id);
              const show = filter==="all" || filter===col.id;
              return (
                <div key={col.id} className="column" data-col={col.id}
                  style={{ display: show?"":"none" }}
                  onDragOver={e=>e.preventDefault()}
                  onDrop={e=>handleColumnDrop(e, col.id)}
                >
                  <div className="column-head">
                    <span>{col.label}</span>
                    <span className="badge">{items.length}</span>
                  </div>
                  <div className="column-list">
                    {items.length===0
                      ? <div className="empty-col" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragState.current){moveTaskDir(dragState.current.id,col.id);dragState.current=null;dragId.current=null;}}}>
                          {col.id==="todo"?"Přetáhni sem nebo přidej úkol":col.id==="doing"?"Teď nic neběží":"Zatím nic hotového"}
                        </div>
                      : items.map(t=>(
                        <TaskCard key={t.id} task={t}
                          dropBefore={dropTarget?.id===t.id&&dropTarget.before}
                          dropAfter={dropTarget?.id===t.id&&!dropTarget.before}
                          onStar={()=>setTasks(prev=>prev.map(x=>x.id===t.id?{...x,starred:!x.starred}:x))}
                          onDelete={()=>deleteTask(t.id)}
                          onEdit={()=>openEditTask(t)}
                          onMoveSheet={()=>{setMoveId(t.id);setMoveModal(true);}}
                          onMovePrev={()=>{const ci=COLS.findIndex(c=>c.id===t.col);if(ci>0)moveTaskDir(t.id,COLS[ci-1].id);}}
                          onMoveNext={()=>{const ci=COLS.findIndex(c=>c.id===t.col);if(ci<COLS.length-1)moveTaskDir(t.id,COLS[ci+1].id);}}
                          onDragStart={()=>handleDragStart(t.id, col.id)}
                          onCardDragOver={e=>handleCardDragOver(e, t.id)}
                          onCardDrop={e=>handleCardDrop(e, t.id, col.id)}
                          onDragEnd={()=>{dragState.current=null;dragId.current=null;setDropTarget(null);}}
                        />
                      ))
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ══ TODAY ══ */}
        <section className={`view${view==="today"?" active":""}`}>
          <div className="view-toolbar">
            <h2 className="view-title">Dnešní úkoly</h2>
            <span className="view-count">{todayTasks.length}</span>
          </div>
          {todayTasks.length===0 ? (
            <div className="today-empty">
              <div className="today-empty-icon">🦙</div>
              <h3>Na dnes nic</h3>
              <p>Výborně! Nebo přidej úkol s dnešním datem.</p>
            </div>
          ) : (
            <div className="board">
              {COLS.map(col=>{
                const items = todayTasks.filter(t=>t.col===col.id).sort((a,b)=>(b.starred?1:0)-(a.starred?1:0));
                return (
                  <div key={col.id} className="column" data-col={col.id}>
                    <div className="column-head">
                      <span>{col.label}</span>
                      <span className="badge">{items.length}</span>
                    </div>
                    <div className="column-list">
                      {items.length===0
                        ? <div className="empty-col">Žádné na dnes</div>
                        : items.map(t=>(
                          <TaskCard key={t.id} task={t}
                            onStar={()=>setTasks(prev=>prev.map(x=>x.id===t.id?{...x,starred:!x.starred}:x))}
                            onDelete={()=>deleteTask(t.id)}
                            onEdit={()=>openEditTask(t)}
                            onMoveSheet={()=>{setMoveId(t.id);setMoveModal(true);}}
                            onMovePrev={()=>{const ci=COLS.findIndex(c=>c.id===t.col);if(ci>0)moveTaskDir(t.id,COLS[ci-1].id);}}
                            onMoveNext={()=>{const ci=COLS.findIndex(c=>c.id===t.col);if(ci<COLS.length-1)moveTaskDir(t.id,COLS[ci+1].id);}}
                            onDragStart={()=>handleDragStart(t.id, col.id)}
                            onCardDragOver={e=>handleCardDragOver(e, t.id)}
                            onCardDrop={e=>handleCardDrop(e, t.id, col.id)}
                            onDragEnd={()=>{dragState.current=null;dragId.current=null;setDropTarget(null);}}
                          />
                        ))
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ══ CALENDAR ══ */}
        <section className={`view${view==="calendar"?" active":""}`}>
          <div className="cal-bar">
            <div className="cal-nav">
              <button className="nav-btn" onClick={()=>calNav(-1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button className="nav-btn" onClick={()=>setCalDate(startOfDay(new Date()))}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button className="nav-btn" onClick={()=>calNav(1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
            <div className="cal-title-wrap">
              <div className="cal-title">{calTitle()}</div>
              <div className="cal-subtitle">{calSub()}</div>
            </div>
            <div className="cal-modes">
              {(["day","week","month"] as CalMode[]).map(m=>(
                <button key={m} className={`cal-mode-btn${calMode===m?" active":""}`} onClick={()=>setCalMode(m)}>
                  {m==="day"?"Den":m==="week"?"Týden":"Měsíc"}
                </button>
              ))}
            </div>
          </div>

          <div className="cal-scroll" ref={calScrollRef}>
            {/* Day / Week */}
            {calMode!=="month" && (
              <>
                {/* Day headers */}
                <div className="day-header-row" style={{gridTemplateColumns:calGridCols}}>
                  <div className="time-corner"/>
                  {calDays.map((d,i)=>(
                    <div key={i} className={`day-header${sameDate(d,today)?" today":""}`}
                      onClick={()=>{setCalDate(startOfDay(d));setCalMode("day");}}>
                      <span className="dname">{d.toLocaleDateString("cs-CZ",{weekday:"short"})}</span>
                      <span className="dnum">{d.getDate()}</span>
                    </div>
                  ))}
                </div>

                {/* All-day row */}
                {calDays.some(d=>tasks.some(t=>t.due===ymd(d)&&!t.time&&t.col!=="done")) && (
                  <div className="allday-row" style={{gridTemplateColumns:calGridCols}}>
                    <div className="allday-lbl">Celý den</div>
                    {calDays.map((d,di)=>{
                      const at = tasks.filter(t=>t.due===ymd(d)&&!t.time&&t.col!=="done");
                      return (
                        <div key={di} className="allday-col">
                          {at.map(t=>{const c=colorOf(t.color);return(
                            <div key={t.id} className="allday-chip"
                              style={{background:c.bg,borderLeft:`2.5px solid ${c.border}`}}
                              onClick={()=>openEditTask(t)}>
                              ✓ {t.title}
                            </div>
                          );})}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Time grid */}
                <div className="grid-wrap" style={{gridTemplateColumns:calGridCols}}>
                  <div className="time-col">
                    {HOURS.map(h=><div key={h} className="hour-lbl">{h===0?"":fmtHour(h)}</div>)}
                  </div>
                  {calDays.map((day,di)=>{
                    const dayEvs = events.filter(ev=>ev.date===ymd(day));
                    const dayTasks = tasks.filter(t=>t.due===ymd(day)&&t.time&&t.col!=="done");
                    const isToday = sameDate(day,today);
                    return (
                      <div key={di} className={`day-col${isToday?" today-col":""}`}>
                        {HOURS.map(h=><div key={h} className="hour-cell" onClick={()=>openCreateEvent(day,h)}/>)}
                        {dayEvs.map(ev=>{
                          const c=colorOf(ev.color);
                          return <div key={ev.id} className="cal-event"
                            style={{background:c.bg,borderLeft:`3px solid ${c.border}`,top:ev.start*52,height:Math.max((ev.end-ev.start)*52-2,22)}}
                            onClick={e=>{e.stopPropagation();openEditEvent(ev);}}>
                            <span className="ev-name">{ev.title}</span>
                            <span className="ev-time">{fmtHourShort(ev.start)}–{fmtHourShort(ev.end)}</span>
                          </div>;
                        })}
                        {dayTasks.map(t=>{
                          const h=parseTimeToHour(t.time)??9;
                          const c=colorOf(t.color);
                          return <div key={t.id} className="cal-event task-ev"
                            style={{background:c.bg,borderLeft:`3px solid ${c.border}`,top:h*52,height:46}}
                            onClick={e=>{e.stopPropagation();openEditTask(t);}}>
                            <span className="ev-name">✓ {t.title}</span>
                            <span className="ev-time">{t.time}</span>
                          </div>;
                        })}
                        {isToday && <div className="now-line" style={{top:(nowMinute/60)*52}}/>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Month */}
            {calMode==="month" && (
              <div className="month-wrap">
                <div className="month-dow">{dowLabels.map(l=><div key={l}>{l}</div>)}</div>
                <div className="month-grid">
                  {monthCells.map((d,i)=>{
                    const ds=ymd(d);
                    const dayEvs   = events.filter(ev=>ev.date===ds);
                    const dayTasks = tasks.filter(t=>t.due===ds&&t.col!=="done");
                    const isOther  = d.getMonth()!==calDate.getMonth();
                    const isToday2 = sameDate(d,today);
                    const items = [
                      ...dayTasks.map(t=>({key:`t-${t.id}`,label:t.title,c:colorOf(t.color),isTask:true,obj:t})),
                      ...dayEvs.map(ev=>({key:`e-${ev.id}`,label:ev.title,c:colorOf(ev.color),isTask:false,obj:ev})),
                    ];
                    return (
                      <div key={i} className={`month-cell${isOther?" other-month":""}${isToday2?" today":""}`}
                        onClick={()=>{setCalDate(startOfDay(d));setCalMode("day");}}>
                        <div className="mday">{d.getDate()}</div>
                        <div className="mevents">
                          {items.slice(0,3).map(item=>(
                            <div key={item.key} className="mchip"
                              style={{background:item.c.bg,borderLeft:`2px solid ${item.c.border}`}}
                              onClick={e=>{e.stopPropagation();item.isTask?openEditTask(item.obj as Task):openEditEvent(item.obj as CalEvent);}}>
                              {item.isTask?"✓ ":""}{item.label}
                            </div>
                          ))}
                          {items.length>3 && <div className="mmore">+{items.length-3}</div>}
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

      {/* ══ SIDEBAR / TABBAR ══ */}
      <nav className="tabbar">
        {/* Desktop branding */}
        <div className="sidebar-top">
          <LlamaMark size={36} tone="color"/>
          <div>
            <LlamaWordmark size={14}/>
            <div className="sidebar-greet">{greeting}</div>
          </div>
        </div>

        {/* Nav tabs */}
        <button className={`tab${view==="tasks"?" active":""}`} onClick={()=>setView("tasks")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9h8M8 13h5M8 17h7"/></svg>
          Poznámky
        </button>
        <button className={`tab${view==="today"?" active":""}`} onClick={()=>setView("today")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          Dnes
        </button>
        <button className={`tab${view==="calendar"?" active":""}`} onClick={()=>setView("calendar")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
          Kalendář
        </button>

        {/* Desktop add button */}
        <button className="sidebar-add" onClick={fabAction}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          {view==="calendar"?"Nová událost":"Nový úkol"}
        </button>

        {/* Desktop hint */}
        <div className="sidebar-hint">
          <span className="sidebar-hint-icon">🦙</span>
          <span>Úkoly s termínem se automaticky zobrazí v kalendáři.</span>
        </div>
      </nav>

      {/* Mobile FAB */}
      <button className="mobile-fab" onClick={fabAction} aria-label="Přidat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    </div>

    {/* ══ REMINDER ══ */}
    {reminder && (
      <div className="reminder">
        <div className="reminder-icon">⏰</div>
        <div className="reminder-body">
          <div className="reminder-title">{reminder.title}</div>
          <div className="reminder-sub">{reminder.type==="task"?"Úkol":"Událost"} · za {reminder.minutesLeft} min</div>
        </div>
        <button className="reminder-close" onClick={()=>setReminder(null)}>✕</button>
      </div>
    )}

    {/* ══ TASK MODAL ══ */}
    <div className={`scrim${taskModal?" open":""}`} onClick={e=>{if(e.target===e.currentTarget)setTaskModal(false);}}>
      <div className="sheet">
        <div className="sheet-handle"/>
        <h3>{editId?"✏️ Upravit úkol":"🦙 Nový úkol"}</h3>
        <p className="sub">Co by si lama ráda odbavila?</p>
        <div className="field">
          <label>Název</label>
          <input ref={titleRef} type="text" placeholder="např. Zalít kaktusy" maxLength={80}
            value={tTitle} onChange={e=>setTTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveTask()}/>
        </div>
        <div className="field">
          <label>Poznámka <span className="field-hint">(volitelné)</span></label>
          <textarea placeholder="Detaily, kontext…" maxLength={500} value={tNote} onChange={e=>setTNote(e.target.value)}/>
        </div>
        <div className="field">
          <label>Datum <span className="field-hint">(volitelné)</span></label>
          <input type="date" value={tDue} onChange={e=>{setTDue(e.target.value);if(!e.target.value)setTTime("");}}/>
        </div>
        {tDue && (
          <div className="field">
            <label>Čas</label>
            <div className="time-toggle">
              <button type="button" className={`time-toggle-btn${!tTime?" active":""}`} onClick={()=>setTTime("")}>Celý den</button>
              <button type="button" className={`time-toggle-btn${tTime?" active":""}`} onClick={()=>setTTime(tTime||"09:00")}>Konkrétní čas</button>
            </div>
            {tTime && <input type="time" value={tTime} onChange={e=>setTTime(e.target.value)}/>}
          </div>
        )}
        <div className="field">
          <label>Barva</label>
          <ColorPicker selected={tColor} onChange={setTColor}/>
        </div>
        <div className="field">
          <button type="button" className={`star-toggle${tStarred?" on":""}`} onClick={()=>setTStarred(v=>!v)}>
            <span className="star-icon"><StarSvg filled={tStarred}/></span>
            <span className="label-stack">
              <span>Důležité</span>
              <small>Připnout nahoře v To Do</small>
            </span>
          </button>
        </div>
        <div className="sheet-actions">
          {editId && <button className="btn-secondary danger" onClick={()=>{deleteTask(editId);setTaskModal(false);}}>Smazat</button>}
          <button className="btn-secondary" onClick={()=>setTaskModal(false)}>Zrušit</button>
          <button className="btn-primary" onClick={saveTask}>Uložit</button>
        </div>
      </div>
    </div>

    {/* ══ EVENT MODAL ══ */}
    <div className={`scrim${evModal?" open":""}`} onClick={e=>{if(e.target===e.currentTarget)setEvModal(false);}}>
      <div className="sheet">
        <div className="sheet-handle"/>
        <h3>{evEditId?"✏️ Upravit událost":"📅 Nová událost"}</h3>
        <p className="sub">{evDate ? new Date(evDate+"T00:00:00").toLocaleDateString("cs-CZ",{weekday:"long",day:"numeric",month:"long"}) : ""}</p>
        <div className="field">
          <label>Název</label>
          <input ref={evTitleRef} type="text" placeholder="např. Lamí jóga 🧘" maxLength={60}
            value={evTitle} onChange={e=>setEvTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEvent()}/>
        </div>
        <div className="field">
          <label>Datum</label>
          <input type="date" value={evDate} onChange={e=>setEvDate(e.target.value)}/>
        </div>
        <div className="field">
          <label>Čas</label>
          <div className="time-row">
            <input type="time" value={evStart} onChange={e=>setEvStart(e.target.value)}/>
            <input type="time" value={evEnd}   onChange={e=>setEvEnd(e.target.value)}/>
          </div>
        </div>
        <div className="field">
          <label>Barva</label>
          <ColorPicker selected={evColor} onChange={setEvColor}/>
        </div>
        <div className="sheet-actions">
          {evEditId && <button className="btn-secondary danger" onClick={()=>evEditId&&deleteEvent(evEditId)}>Smazat</button>}
          <button className="btn-secondary" onClick={()=>setEvModal(false)}>Zrušit</button>
          <button className="btn-primary" onClick={saveEvent}>Uložit</button>
        </div>
      </div>
    </div>

    {/* ══ MOVE SHEET ══ */}
    <div className={`scrim${moveModal?" open":""}`} onClick={e=>{if(e.target===e.currentTarget)setMoveModal(false);}}>
      <div className="sheet">
        <div className="sheet-handle"/>
        <h3>Přesunout úkol</h3>
        <p className="sub">Kam patří?</p>
        <div className="move-list">
          {COLS.map(c=>{
            const t = tasks.find(t=>t.id===moveId);
            return (
              <button key={c.id} className={`move-item${t?.col===c.id?" current":""}`}
                onClick={()=>{if(moveId){moveTaskDir(moveId,c.id);setMoveModal(false);}}}>
                <span className="move-dot" style={{background:c.dot}}/>
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="sheet-actions">
          <button className="btn-secondary" style={{flex:1}} onClick={()=>setMoveModal(false)}>Zrušit</button>
        </div>
      </div>
    </div>
    </>
  );
}

/* ═══════════ TASK CARD ═══════════ */
function TaskCard({ task, dropBefore, dropAfter, onStar, onDelete, onEdit, onMoveSheet, onMovePrev, onMoveNext, onDragStart, onCardDragOver, onCardDrop, onDragEnd }:{
  task: Task;
  dropBefore?: boolean; dropAfter?: boolean;
  onStar:()=>void; onDelete:()=>void; onEdit:()=>void;
  onMoveSheet:()=>void; onMovePrev:()=>void; onMoveNext:()=>void;
  onDragStart:()=>void;
  onCardDragOver?:(e:React.DragEvent)=>void;
  onCardDrop?:(e:React.DragEvent)=>void;
  onDragEnd?:()=>void;
}) {
  const colIdx = COLS.findIndex(c=>c.id===task.col);
  const tapStart = useRef(0);

  let dueClass="", dueLabel="";
  if (task.due) {
    const d = new Date(task.due+"T00:00:00");
    const diff = Math.round((d.getTime()-startOfDay(new Date()).getTime())/86400000);
    dueClass = task.col!=="done"&&diff<0?"overdue":task.col!=="done"&&diff===0?"today":"";
    dueLabel = friendlyDate(task.due, task.time||undefined);
  }

  return (
    <div className={`card${dropBefore?" drop-before":""}${dropAfter?" drop-after":""}`}
      data-color={task.color}
      draggable
      onDragStart={onDragStart}
      onDragOver={onCardDragOver}
      onDrop={onCardDrop}
      onDragEnd={onDragEnd}
      onTouchStart={()=>{tapStart.current=Date.now();}}
      onTouchEnd={e=>{if(Date.now()-tapStart.current<500&&!(e.target as Element).closest("button"))onMoveSheet();}}
      onDoubleClick={e=>{if(!(e.target as Element).closest("button"))onEdit();}}
    >
      <div className="star-badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.95 6 6.55.95-4.75 4.65 1.1 6.5L12 17.6l-5.85 3 1.1-6.5L2.5 9.45 9.05 8.5z"/></svg></div>
      <div className="card-head">
        <div className={`card-title${task.col==="done"?" done":""}`}>{task.title}</div>
        <div className="card-actions">
          <button className={`icon-btn star${task.starred?" on":""}`} onClick={e=>{e.stopPropagation();onStar();}}>
            <StarSvg filled={task.starred}/>
          </button>
          <button className="icon-btn delete" onClick={e=>{e.stopPropagation();onDelete();}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
      {task.note && <div className="card-note">{task.note}</div>}
      {task.due && (
        <div className="card-meta">
          <span className={`due-chip${dueClass?` ${dueClass}`:""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
            {dueLabel}
          </span>
        </div>
      )}
      <div className="move-row">
        <button className="move-btn" disabled={colIdx===0} onClick={e=>{e.stopPropagation();onMovePrev();}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          {colIdx>0?COLS[colIdx-1].short:""}
        </button>
        <button className="move-btn" disabled={colIdx===COLS.length-1} onClick={e=>{e.stopPropagation();onMoveNext();}}>
          {colIdx<COLS.length-1?COLS[colIdx+1].short:""}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}
