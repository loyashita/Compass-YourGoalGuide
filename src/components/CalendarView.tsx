import React, { useState, useEffect } from "react";
import { UserProfile, Goal, CalendarEvent } from "../types";
import { db, collection, getDocs, addDoc, deleteDoc, doc, query, where, updateDoc } from "../lib/firebase";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Clock, 
  AlertCircle, 
  Check, 
  X, 
  RefreshCw,
  Loader2
} from "lucide-react";
import { syncCalendarEventToGoogle, deleteCalendarEventFromGoogle, syncTaskToGoogle, deleteTaskFromGoogle, GoogleAuthError } from "../lib/googleSync";

interface CalendarViewProps {
  profile: UserProfile;
  goals: Goal[];
  googleAccessToken: string | null;
  onConnectGoogle: () => Promise<string | null>;
  onDisconnectGoogle?: () => void;
}

export default function CalendarView({ profile, goals, googleAccessToken, onConnectGoogle, onDisconnectGoogle }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Form States
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CalendarEvent["type"]>("Fixed Task");
  const [eventDate, setEventDate] = useState(selectedDate);
  const [associatedGoalId, setAssociatedGoalId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all user's calendar events
  useEffect(() => {
    fetchEvents();
  }, [profile.userId]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "calendar_events"),
        where("userId", "==", profile.userId)
      );
      const snap = await getDocs(q);
      const fetched = snap.docs.map((d: any) => ({
        id: d.id,
        ...d.data(),
      })) as CalendarEvent[];
      setEvents(fetched);
    } catch (err) {
      console.error("Failed to load calendar events:", err);
    } finally {
      setLoading(false);
    }
  };

  const [syncingAll, setSyncingAll] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // States for individual event-level sync status
  const [eventSyncStatus, setEventSyncStatus] = useState<Record<string, "loading" | "success" | "error" | null>>({});

  const handleSyncError = (err: any, customMessage: string) => {
    console.error(customMessage, err);
    if (err instanceof GoogleAuthError || err.status === 401 || err.message?.includes("401") || err.message?.includes("UNAUTHENTICATED")) {
      if (onDisconnectGoogle) onDisconnectGoogle();
      alert("Your Google session has expired or is invalid. Please reconnect your Google account by clicking Sync again.");
    } else {
      alert(`${customMessage}: ${err.message || err}`);
    }
  };

  const handleSyncEventToCalendar = async (ev: CalendarEvent) => {
    setEventSyncStatus(prev => ({ ...prev, [`${ev.id}-cal`]: "loading" }));
    try {
      let tokenToUse = googleAccessToken;
      if (!tokenToUse) {
        tokenToUse = await onConnectGoogle();
        if (!tokenToUse) {
          setEventSyncStatus(prev => ({ ...prev, [`${ev.id}-cal`]: "error" }));
          return;
        }
      }

      const gId = await syncCalendarEventToGoogle(ev, tokenToUse);
      if (gId) {
        await updateDoc(doc(db, "calendar_events", ev.id), { googleEventId: gId });
        setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, googleEventId: gId } : e));
        setEventSyncStatus(prev => ({ ...prev, [`${ev.id}-cal`]: "success" }));
        setTimeout(() => {
          setEventSyncStatus(prev => ({ ...prev, [`${ev.id}-cal`]: null }));
        }, 3000);
      }
    } catch (err: any) {
      setEventSyncStatus(prev => ({ ...prev, [`${ev.id}-cal`]: "error" }));
      handleSyncError(err, "Failed to sync event to Google Calendar");
    }
  };

  const handleSyncEventToTasks = async (ev: CalendarEvent) => {
    setEventSyncStatus(prev => ({ ...prev, [`${ev.id}-tasks`]: "loading" }));
    try {
      let tokenToUse = googleAccessToken;
      if (!tokenToUse) {
        tokenToUse = await onConnectGoogle();
        if (!tokenToUse) {
          setEventSyncStatus(prev => ({ ...prev, [`${ev.id}-tasks`]: "error" }));
          return;
        }
      }

      // Map CalendarEvent to virtual GoalTask for syncing to Google Tasks
      const virtualTask = {
        id: ev.id,
        phaseId: "calendar",
        goalId: ev.associatedGoalId || "calendar",
        userId: ev.userId,
        title: ev.title,
        priority: "Medium" as const,
        status: "pending" as const,
        suggestedDueDate: ev.date,
        order: 0,
        notes: ev.description,
        createdAt: ev.createdAt,
        updatedAt: new Date().toISOString(),
        googleTaskId: ev.googleTaskId || null
      };

      const gId = await syncTaskToGoogle(virtualTask, tokenToUse);
      if (gId) {
        await updateDoc(doc(db, "calendar_events", ev.id), { googleTaskId: gId });
        setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, googleTaskId: gId } : e));
        setEventSyncStatus(prev => ({ ...prev, [`${ev.id}-tasks`]: "success" }));
        setTimeout(() => {
          setEventSyncStatus(prev => ({ ...prev, [`${ev.id}-tasks`]: null }));
        }, 3000);
      }
    } catch (err: any) {
      setEventSyncStatus(prev => ({ ...prev, [`${ev.id}-tasks`]: "error" }));
      handleSyncError(err, "Failed to sync event to Google Tasks");
    }
  };

  const handleSyncAllToGoogle = async () => {
    if (!googleAccessToken) {
      try {
        const token = await onConnectGoogle();
        if (!token) {
          setError("Google connection was not completed.");
          return;
        }
      } catch (err: any) {
        setError("Failed to connect: " + err.message);
        return;
      }
    }

    setSyncingAll(true);
    setSyncMessage("Syncing slots with Google Calendar...");
    try {
      const tokenToUse = googleAccessToken || (await onConnectGoogle());
      if (!tokenToUse) {
        throw new Error("Could not acquire Google access token");
      }

      let count = 0;
      const updatedEvents = [...events];
      for (let i = 0; i < updatedEvents.length; i++) {
        const ev = updatedEvents[i];
        if (!ev.googleEventId) {
          const gId = await syncCalendarEventToGoogle(ev, tokenToUse);
          if (gId) {
            ev.googleEventId = gId;
            await updateDoc(doc(db, "calendar_events", ev.id), { googleEventId: gId });
            count++;
          }
        }
      }
      setEvents(updatedEvents);
      setSyncMessage(`Successfully synced ${count} new events to Google Calendar!`);
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err: any) {
      handleSyncError(err, "Sync failed");
    } finally {
      setSyncingAll(false);
    }
  };

  // Date helper calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // First day of the month
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Number of days in current month
  const totalDays = new Date(year, month + 1, 0).getDate();
  // Number of days in previous month
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.toISOString().split("T")[0]);
  };

  const selectDay = (day: number) => {
    const formattedMonth = String(month + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
    setSelectedDate(dateStr);
    setEventDate(dateStr);
    setError(null);
  };

  // Get color styles for different event types
  const getTypeStyles = (evtType: CalendarEvent["type"]) => {
    switch (evtType) {
      case "Exam":
        return {
          bg: "bg-[var(--evt-exam-bg)] border-[var(--evt-exam-border)]",
          pill: "bg-[var(--evt-exam-text)] text-theme-bg-panel",
          text: "text-[var(--evt-exam-text)]",
          border: "border-l-4 border-[var(--evt-exam-text)]"
        };
      case "Submission":
        return {
          bg: "bg-[var(--evt-submission-bg)] border-[var(--evt-submission-border)]",
          pill: "bg-[var(--evt-submission-text)] text-theme-bg-panel",
          text: "text-[var(--evt-submission-text)]",
          border: "border-l-4 border-[var(--evt-submission-text)]"
        };
      case "Deadline":
        return {
          bg: "bg-[var(--evt-deadline-bg)] border-[var(--evt-deadline-border)]",
          pill: "bg-[var(--evt-deadline-text)] text-theme-bg-panel",
          text: "text-[var(--evt-deadline-text)]",
          border: "border-l-4 border-[var(--evt-deadline-text)]"
        };
      case "Fixed Task":
        return {
          bg: "bg-[var(--evt-fixed-bg)] border-[var(--evt-fixed-border)]",
          pill: "bg-[var(--evt-fixed-text)] text-theme-bg-panel",
          text: "text-[var(--evt-fixed-text)]",
          border: "border-l-4 border-[var(--evt-fixed-text)]"
        };
      default:
        return {
          bg: "bg-[var(--evt-other-bg)] border-[var(--evt-other-border)]",
          pill: "bg-[var(--evt-other-text)] text-theme-bg-panel",
          text: "text-[var(--evt-other-text)]",
          border: "border-l-4 border-[var(--evt-other-text)]"
        };
    }
  };

  // Handle Create or Update Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Event title is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const eventData: Omit<CalendarEvent, "id"> = {
        userId: profile.userId,
        title: title.trim(),
        description: description.trim(),
        type,
        date: eventDate,
        associatedGoalId: associatedGoalId || undefined,
        createdAt: new Date().toISOString(),
        googleEventId: editingEvent?.googleEventId || null
      };

      if (profile.googleCalendarSyncEnabled && googleAccessToken) {
        try {
          const tempEv: CalendarEvent = {
            id: editingEvent ? editingEvent.id : "",
            ...eventData
          };
          const gId = await syncCalendarEventToGoogle(tempEv, googleAccessToken);
          eventData.googleEventId = gId;
        } catch (gErr: any) {
          console.warn("Google Calendar Sync failed during save:", gErr);
          if (gErr instanceof GoogleAuthError || gErr.status === 401 || gErr.message?.includes("401") || gErr.message?.includes("UNAUTHENTICATED")) {
            if (onDisconnectGoogle) onDisconnectGoogle();
          }
        }
      }

      if (editingEvent) {
        // Update Event
        await updateDoc(doc(db, "calendar_events", editingEvent.id), eventData);
        setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? { ...ev, ...eventData } : ev));
      } else {
        // Create Event
        const docRef = await addDoc(collection(db, "calendar_events"), eventData);
        setEvents(prev => [...prev, { id: docRef.id, ...eventData }]);
      }

      // Reset form states
      setTitle("");
      setDescription("");
      setType("Fixed Task");
      setAssociatedGoalId("");
      setEditingEvent(null);
      setShowAddForm(false);
    } catch (err: any) {
      console.error("Error saving calendar event:", err);
      setError(err.message || "Failed to save calendar event.");
    } finally {
      setSubmitting(false);
    }
  };

  // Start Edit Mode
  const startEdit = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setTitle(ev.title);
    setDescription(ev.description || "");
    setType(ev.type);
    setEventDate(ev.date);
    setAssociatedGoalId(ev.associatedGoalId || "");
    setShowAddForm(true);
    setError(null);
  };

  // Handle Delete Event
  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm("Are you sure you want to delete this calendar event?")) return;
    try {
      const targetEvent = events.find(ev => ev.id === eventId);
      if (googleAccessToken) {
        if (targetEvent?.googleEventId) {
          try {
            await deleteCalendarEventFromGoogle(targetEvent.googleEventId, googleAccessToken);
          } catch (gErr: any) {
            console.warn("Google Calendar delete failed:", gErr);
            if (gErr instanceof GoogleAuthError || gErr.status === 401 || gErr.message?.includes("401") || gErr.message?.includes("UNAUTHENTICATED")) {
              if (onDisconnectGoogle) onDisconnectGoogle();
            }
          }
        }
        if (targetEvent?.googleTaskId) {
          try {
            await deleteTaskFromGoogle(targetEvent.googleTaskId, googleAccessToken);
          } catch (gErr: any) {
            console.warn("Google Tasks delete failed:", gErr);
            if (gErr instanceof GoogleAuthError || gErr.status === 401 || gErr.message?.includes("401") || gErr.message?.includes("UNAUTHENTICATED")) {
              if (onDisconnectGoogle) onDisconnectGoogle();
            }
          }
        }
      }
      await deleteDoc(doc(db, "calendar_events", eventId));
      setEvents(prev => prev.filter(ev => ev.id !== eventId));
    } catch (err) {
      console.error("Failed to delete event:", err);
    }
  };

  // Events filtered for the currently selected day
  const selectedDayEvents = events.filter(ev => ev.date === selectedDate);

  // Generate grid days
  const calendarCells = [];

  // Previous month fill days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevDay = prevMonthTotalDays - i;
    calendarCells.push({
      day: prevDay,
      isCurrentMonth: false,
      dateString: "" // skip rendering list events in prev month cells
    });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const formattedMonth = String(month + 1).padStart(2, "0");
    const formattedDay = String(d).padStart(2, "0");
    const dateString = `${year}-${formattedMonth}-${formattedDay}`;
    calendarCells.push({
      day: d,
      isCurrentMonth: true,
      dateString
    });
  }

  // Next month fill days to complete 6-row grid (42 cells)
  const remainingCells = 42 - calendarCells.length;
  for (let d = 1; d <= remainingCells; d++) {
    calendarCells.push({
      day: d,
      isCurrentMonth: false,
      dateString: ""
    });
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div id="calendar-view-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      {/* LEFT & CENTER: Calendar Board (2 cols) */}
      <div id="calendar-board" className="lg:col-span-2 bg-theme-bg-card border border-theme-border-main rounded-3xl p-5 shadow-xs flex flex-col gap-4 text-theme-text-main">
        {/* Calendar Header with Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-theme-border-subtle">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-theme-bg-accent text-theme-text-accent flex items-center justify-center">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-theme-text-main font-display">
                {monthNames[month]} {year}
              </h2>
              <p className="text-[10px] font-mono font-bold text-theme-text-muted uppercase tracking-wider">
                Fixed Tasks, Exams & Deadlines Planner
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end self-end sm:self-auto">
            {profile.googleCalendarSyncEnabled && (
              <div className="flex items-center gap-2 border border-brown-200 rounded-xl bg-white px-3 py-1.5 text-xs shadow-3xs">
                <span className="text-[9px] font-mono text-brown-500 font-bold uppercase tracking-wider">Google Calendar:</span>
                {syncingAll ? (
                  <span className="text-[9px] text-brown-600 animate-pulse flex items-center gap-1 font-bold">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Syncing...
                  </span>
                ) : (
                  <button
                    onClick={handleSyncAllToGoogle}
                    className="text-[9px] text-brown-800 hover:text-brown-950 font-bold flex items-center gap-1 cursor-pointer transition"
                    title="Export unsynced local events to your connected Google Calendar"
                  >
                    <RefreshCw className="h-3 w-3 text-brown-600" /> Sync Events
                  </button>
                )}
              </div>
            )}

            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl border border-theme-border-main bg-theme-bg-panel hover:bg-theme-bg-card-hover text-theme-text-main transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-theme-border-main bg-theme-bg-panel hover:bg-theme-bg-card-hover text-theme-text-main transition cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl border border-theme-border-main bg-theme-bg-panel hover:bg-theme-bg-card-hover text-theme-text-main transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Days of Week Row */}
        <div className="grid grid-cols-7 text-center text-xs font-bold text-theme-text-muted border-b border-theme-border-subtle pb-2">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Monthly Grid */}
        <div className="grid grid-cols-7 gap-1 bg-theme-bg-panel p-1.5 rounded-2xl border border-theme-border-main">
          {calendarCells.map((cell, idx) => {
            const isSelected = cell.dateString === selectedDate;
            const isToday = cell.dateString === todayStr;
            const dayEvents = cell.dateString ? events.filter(e => e.date === cell.dateString) : [];

            return (
              <button
                key={idx}
                disabled={!cell.isCurrentMonth}
                onClick={() => cell.day && selectDay(cell.day)}
                className={`min-h-[76px] sm:min-h-[96px] p-1 rounded-xl text-left flex flex-col justify-between transition-all relative select-none cursor-pointer ${
                  !cell.isCurrentMonth
                    ? "opacity-25 bg-theme-bg-panel/50 cursor-not-allowed"
                    : isSelected
                    ? "bg-theme-bg-accent text-theme-text-accent ring-2 ring-theme-border-main shadow-md"
                    : isToday
                    ? "bg-theme-bg-card-hover border border-theme-border-main text-theme-text-main font-semibold"
                    : "bg-theme-bg-card hover:bg-theme-bg-card-hover border border-theme-border-subtle text-theme-text-main"
                }`}
              >
                {/* Date Label */}
                <div className="flex justify-between items-center w-full">
                  <span className={`text-[11px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                    isToday && !isSelected ? "bg-theme-bg-accent text-theme-text-accent" : ""
                  }`}>
                    {cell.day}
                  </span>

                  {dayEvents.length > 0 && cell.isCurrentMonth && (
                    <span className={`text-[9px] font-mono font-bold px-1 rounded-sm ${
                      isSelected ? "bg-black/20 text-theme-text-accent" : "bg-theme-bg-card-hover text-theme-text-muted"
                    }`}>
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Day Mini-Events list (desktop optimized) */}
                <div className="w-full mt-1 flex-1 flex flex-col gap-0.5 overflow-hidden justify-end">
                  {cell.isCurrentMonth && dayEvents.slice(0, 3).map((e, eIdx) => {
                    const styles = getTypeStyles(e.type);
                    return (
                      <div
                        key={eIdx}
                        className={`hidden sm:block text-[9px] font-medium truncate px-1 py-0.5 rounded-sm leading-tight border ${
                          isSelected 
                            ? "bg-white/10 text-beige-50 border-white/20" 
                            : `${styles.bg} ${styles.text} border-brown-200/50`
                        }`}
                      >
                        {e.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="hidden sm:block text-[8px] font-mono text-center font-bold opacity-75">
                      + {dayEvents.length - 3} more
                    </div>
                  )}

                  {/* Mobile event tiny indicators */}
                  <div className="flex sm:hidden gap-0.5 justify-center mt-auto pb-0.5">
                    {cell.isCurrentMonth && dayEvents.map((e, eIdx) => {
                      const styles = getTypeStyles(e.type);
                      return (
                        <span 
                          key={eIdx} 
                          className={`w-1.5 h-1.5 rounded-full ${styles.pill}`} 
                        />
                      );
                    })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: Selected Date Details & Events Action Panel (1 col) */}
      <div id="calendar-sidebar" className="bg-theme-bg-card border border-theme-border-main rounded-3xl p-5 shadow-xs flex flex-col gap-5 text-theme-text-main">
        {/* Header containing selected date */}
        <div className="border-b border-theme-border-subtle pb-3">
          <span className="text-[10px] font-mono font-bold text-theme-text-muted uppercase tracking-wider block">
            Selected Timeline Slot
          </span>
          <h3 className="text-base font-bold text-theme-text-main font-display mt-0.5">
            {new Date(selectedDate).toLocaleDateString("en-US", {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </h3>
        </div>

        {syncMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 text-xs rounded-2xl border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 animate-fade-in shadow-2xs">
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{syncMessage}</span>
          </div>
        )}

        {error && !showAddForm && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-400 text-xs rounded-2xl border border-red-200 dark:border-red-900/50 flex items-center gap-2 animate-fade-in shadow-2xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form to Add/Edit Event */}
        {showAddForm ? (
          <form onSubmit={handleSaveEvent} className="bg-theme-bg-panel border border-theme-border-subtle p-4 rounded-2xl flex flex-col gap-3.5 shadow-sm animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-theme-text-main flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-theme-text-muted" />
                {editingEvent ? "Edit Slot Event" : "Create Slot Event"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingEvent(null);
                  setTitle("");
                  setDescription("");
                }}
                className="p-1 rounded-lg hover:bg-theme-bg-card-hover text-theme-text-muted hover:text-theme-text-main"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-mono font-bold text-theme-text-muted uppercase mb-1">
                Event Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Midterm Exam or Final Presentation"
                className="w-full text-xs rounded-xl border border-theme-border-main bg-theme-bg-panel text-theme-text-main p-2.5 outline-none focus:bg-theme-bg-card focus:ring-1 focus:ring-theme-border-main placeholder-theme-text-muted"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono font-bold text-theme-text-muted uppercase mb-1">
                  Type *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CalendarEvent["type"])}
                  className="w-full text-xs rounded-xl border border-theme-border-main bg-theme-bg-panel text-theme-text-main p-2.5 outline-none focus:bg-theme-bg-card focus:ring-1 focus:ring-theme-border-main"
                >
                  <option value="Fixed Task" className="bg-white dark:bg-[#1c140e] text-[#221712] dark:text-white">Fixed Task</option>
                  <option value="Exam" className="bg-white dark:bg-[#1c140e] text-[#221712] dark:text-white">Exam</option>
                  <option value="Submission" className="bg-white dark:bg-[#1c140e] text-[#221712] dark:text-white">Submission</option>
                  <option value="Deadline" className="bg-white dark:bg-[#1c140e] text-[#221712] dark:text-white">Deadline</option>
                  <option value="Other" className="bg-white dark:bg-[#1c140e] text-[#221712] dark:text-white">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-theme-text-muted uppercase mb-1">
                  Target Date *
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-theme-border-main bg-theme-bg-panel text-theme-text-main p-2.5 outline-none focus:bg-theme-bg-card focus:ring-1 focus:ring-theme-border-main"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-theme-text-muted uppercase mb-1">
                Description / Syllabus
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Syllabus coverage, location, weighting, room number etc..."
                className="w-full text-xs rounded-xl border border-theme-border-main bg-theme-bg-panel text-theme-text-main p-2.5 outline-none focus:bg-theme-bg-card focus:ring-1 focus:ring-theme-border-main h-16 resize-none placeholder-theme-text-muted"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-theme-text-muted uppercase mb-1">
                Associate with Goal (Optional)
              </label>
              <select
                value={associatedGoalId}
                onChange={(e) => setAssociatedGoalId(e.target.value)}
                className="w-full text-xs rounded-xl border border-theme-border-main bg-theme-bg-panel text-theme-text-main p-2.5 outline-none focus:bg-theme-bg-card focus:ring-1 focus:ring-theme-border-main"
              >
                <option value="" className="bg-white dark:bg-[#1c140e] text-[#221712] dark:text-white">No Associated Goal</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id} className="bg-white dark:bg-[#1c140e] text-[#221712] dark:text-white">{g.title}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-theme-bg-accent text-theme-text-accent rounded-xl text-xs font-bold hover:bg-theme-bg-accent-hover active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>{editingEvent ? "Save Changes" : "Save Event"}</span>
            </button>
          </form>
        ) : (
          <button
            onClick={() => {
              setEventDate(selectedDate);
              setShowAddForm(true);
            }}
            className="w-full py-2.5 bg-theme-bg-accent text-theme-text-accent rounded-xl text-xs font-bold hover:bg-theme-bg-accent-hover active:scale-95 transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Event for {new Date(selectedDate).toLocaleDateString("en-US", { month: 'short', day: 'numeric' })}</span>
          </button>
        )}

        {/* List of Events on Selected Day */}
        <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto">
          <span className="text-[10px] font-mono font-bold text-theme-text-muted uppercase tracking-wider">
            Events Scheduled ({selectedDayEvents.length})
          </span>

          {loading ? (
            <div className="text-center py-6 text-xs text-theme-text-muted">
              Loading calendar events...
            </div>
          ) : selectedDayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-theme-border-main rounded-2xl bg-theme-bg-panel/40 px-4">
              <CalendarIcon className="h-8 w-8 text-theme-text-muted mb-1.5" />
              <p className="text-xs font-medium text-theme-text-main">No events on this date</p>
              <p className="text-[10px] text-theme-text-muted mt-0.5 leading-normal">
                Deadlines, exams, submissions, and fixed tasks will show up here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedDayEvents.map((ev) => {
                const styles = getTypeStyles(ev.type);
                const linkedGoal = goals.find(g => g.id === ev.associatedGoalId);

                return (
                  <div
                    key={ev.id}
                    className={`bg-theme-bg-panel border border-theme-border-subtle p-3 rounded-2xl flex flex-col gap-2 relative group hover:border-theme-border-main transition shadow-2xs ${styles.border}`}
                  >
                    <div className="flex justify-between items-start pr-12">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${styles.pill}`}>
                            {ev.type}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-theme-text-main mt-1.5 leading-tight">
                          {ev.title}
                        </h4>
                      </div>

                      {/* Floating actions */}
                      <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
                        <button
                          onClick={() => startEdit(ev)}
                          className="p-1 rounded-lg hover:bg-theme-bg-card-hover text-theme-text-muted hover:text-theme-text-main transition cursor-pointer"
                          title="Edit event"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-theme-text-muted hover:text-red-600 transition cursor-pointer"
                          title="Delete event"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {ev.description && (
                      <p className="text-[11px] text-theme-text-main leading-normal bg-theme-bg-app p-2 rounded-xl border border-theme-border-subtle font-sans">
                        {ev.description}
                      </p>
                    )}

                    {linkedGoal && (
                      <div className="flex items-center gap-1 text-[9px] text-theme-text-muted font-semibold bg-theme-bg-app py-1 px-2 rounded-lg border border-theme-border-subtle self-start">
                        <BookOpen className="h-3 w-3 shrink-0 text-theme-text-muted" />
                        <span>Goal: {linkedGoal.title}</span>
                      </div>
                    )}

                    {/* Event Google Sync Options */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1 pt-2 border-t border-theme-border-subtle">
                      {/* Sync to Google Calendar */}
                      {ev.googleEventId ? (
                        <button
                          type="button"
                          onClick={() => handleSyncEventToCalendar(ev)}
                          disabled={eventSyncStatus[`${ev.id}-cal`] === "loading"}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150/40 hover:border-emerald-400 transition cursor-pointer"
                          title="Resync this event to Google Calendar"
                        >
                          {eventSyncStatus[`${ev.id}-cal`] === "loading" ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                          <span>Google Cal</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSyncEventToCalendar(ev)}
                          disabled={eventSyncStatus[`${ev.id}-cal`] === "loading"}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold text-theme-text-muted hover:text-theme-text-main bg-theme-bg-panel border border-theme-border-subtle hover:border-theme-border-main transition cursor-pointer"
                          title="Sync this event to Google Calendar"
                        >
                          {eventSyncStatus[`${ev.id}-cal`] === "loading" ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            <CalendarIcon className="h-2.5 w-2.5 text-theme-text-muted" />
                          )}
                          <span>+ Google Cal</span>
                        </button>
                      )}

                      {/* Sync to Google Tasks */}
                      {ev.googleTaskId ? (
                        <button
                          type="button"
                          onClick={() => handleSyncEventToTasks(ev)}
                          disabled={eventSyncStatus[`${ev.id}-tasks`] === "loading"}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150/40 hover:border-emerald-400 transition cursor-pointer"
                          title="Resync this event to Google Tasks"
                        >
                          {eventSyncStatus[`${ev.id}-tasks`] === "loading" ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                          <span>Google Tasks</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSyncEventToTasks(ev)}
                          disabled={eventSyncStatus[`${ev.id}-tasks`] === "loading"}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold text-theme-text-muted hover:text-theme-text-main bg-theme-bg-panel border border-theme-border-subtle hover:border-theme-border-main transition cursor-pointer"
                          title="Sync this event to Google Tasks"
                        >
                          {eventSyncStatus[`${ev.id}-tasks`] === "loading" ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-2.5 w-2.5 text-theme-text-muted" />
                          )}
                          <span>+ Google Tasks</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
