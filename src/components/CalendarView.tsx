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
  Sparkles,
  RefreshCw
} from "lucide-react";
import { syncCalendarEventToGoogle, deleteCalendarEventFromGoogle } from "../lib/googleSync";

interface CalendarViewProps {
  profile: UserProfile;
  goals: Goal[];
  googleAccessToken: string | null;
  onConnectGoogle: () => Promise<string | null>;
}

export default function CalendarView({ profile, goals, googleAccessToken, onConnectGoogle }: CalendarViewProps) {
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

  const handleSyncAllToGoogle = async () => {
    if (!profile.googleCalendarSyncEnabled) {
      setError("Please enable Google Calendar Sync in Settings first.");
      return;
    }
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
      console.error(err);
      setError("Sync failed: " + (err.message || err));
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
          bg: "bg-red-50 hover:bg-red-100 border-red-200",
          pill: "bg-red-600 text-white",
          text: "text-red-800",
          border: "border-l-4 border-red-500"
        };
      case "Submission":
        return {
          bg: "bg-blue-50 hover:bg-blue-100 border-blue-200",
          pill: "bg-blue-600 text-white",
          text: "text-blue-800",
          border: "border-l-4 border-blue-500"
        };
      case "Deadline":
        return {
          bg: "bg-amber-50 hover:bg-amber-100 border-amber-200",
          pill: "bg-amber-600 text-white",
          text: "text-amber-800",
          border: "border-l-4 border-amber-500"
        };
      case "Fixed Task":
        return {
          bg: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
          pill: "bg-emerald-600 text-white",
          text: "text-emerald-800",
          border: "border-l-4 border-emerald-500"
        };
      default:
        return {
          bg: "bg-purple-50 hover:bg-purple-100 border-purple-200",
          pill: "bg-purple-600 text-white",
          text: "text-purple-800",
          border: "border-l-4 border-purple-500"
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
          // Just log but let user save locally if sync fails
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
      if (targetEvent?.googleEventId && profile.googleCalendarSyncEnabled && googleAccessToken) {
        try {
          await deleteCalendarEventFromGoogle(targetEvent.googleEventId, googleAccessToken);
        } catch (gErr) {
          console.warn("Google Calendar delete failed:", gErr);
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
      <div id="calendar-board" className="lg:col-span-2 bg-beige-50 border border-brown-200 rounded-3xl p-5 shadow-xs flex flex-col gap-4">
        {/* Calendar Header with Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-brown-100">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-brown-900 text-beige-50 flex items-center justify-center">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-brown-950 font-display">
                {monthNames[month]} {year}
              </h2>
              <p className="text-[10px] font-mono font-bold text-brown-500 uppercase tracking-wider">
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
              className="p-1.5 rounded-xl border border-brown-200 bg-white hover:bg-beige-100 text-brown-700 transition"
              title="Previous Month"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-brown-200 bg-white hover:bg-beige-100 text-brown-800 transition"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl border border-brown-200 bg-white hover:bg-beige-100 text-brown-700 transition"
              title="Next Month"
            >
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Days of Week Row */}
        <div className="grid grid-cols-7 text-center text-xs font-bold text-brown-500 border-b border-brown-100/60 pb-2">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Monthly Grid */}
        <div className="grid grid-cols-7 gap-1 bg-brown-100/30 p-1.5 rounded-2xl border border-brown-100">
          {calendarCells.map((cell, idx) => {
            const isSelected = cell.dateString === selectedDate;
            const isToday = cell.dateString === todayStr;
            const dayEvents = cell.dateString ? events.filter(e => e.date === cell.dateString) : [];

            return (
              <button
                key={idx}
                disabled={!cell.isCurrentMonth}
                onClick={() => cell.day && selectDay(cell.day)}
                className={`min-h-[76px] sm:min-h-[96px] p-1 rounded-xl text-left flex flex-col justify-between transition-all relative select-none ${
                  !cell.isCurrentMonth
                    ? "opacity-25 bg-neutral-100/50 cursor-not-allowed"
                    : isSelected
                    ? "bg-brown-900 text-beige-50 ring-2 ring-brown-800 shadow-md"
                    : isToday
                    ? "bg-brown-150/70 border border-brown-300 text-brown-950 font-semibold"
                    : "bg-white hover:bg-beige-100 border border-brown-100/50 text-brown-900"
                }`}
              >
                {/* Date Label */}
                <div className="flex justify-between items-center w-full">
                  <span className={`text-[11px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                    isToday && !isSelected ? "bg-brown-900 text-white" : ""
                  }`}>
                    {cell.day}
                  </span>

                  {dayEvents.length > 0 && cell.isCurrentMonth && (
                    <span className={`text-[9px] font-mono font-bold px-1 rounded-sm ${
                      isSelected ? "bg-beige-50/20 text-beige-50" : "bg-brown-150 text-brown-700"
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
      <div id="calendar-sidebar" className="bg-beige-50 border border-brown-200 rounded-3xl p-5 shadow-xs flex flex-col gap-5">
        {/* Header containing selected date */}
        <div className="border-b border-brown-100 pb-3">
          <span className="text-[10px] font-mono font-bold text-brown-500 uppercase tracking-wider block">
            Selected Timeline Slot
          </span>
          <h3 className="text-base font-bold text-brown-950 font-display mt-0.5">
            {new Date(selectedDate).toLocaleDateString("en-US", {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </h3>
        </div>

        {syncMessage && (
          <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-2xl border border-emerald-200 flex items-center gap-2 animate-fade-in shadow-2xs">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{syncMessage}</span>
          </div>
        )}

        {error && !showAddForm && (
          <div className="p-3 bg-red-50 text-red-800 text-xs rounded-2xl border border-red-200 flex items-center gap-2 animate-fade-in shadow-2xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form to Add/Edit Event */}
        {showAddForm ? (
          <form onSubmit={handleSaveEvent} className="bg-white border border-brown-150 p-4 rounded-2xl flex flex-col gap-3.5 shadow-sm animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brown-950 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-brown-600" />
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
                className="p-1 rounded-lg hover:bg-beige-100 text-brown-400 hover:text-brown-700"
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
              <label className="block text-[10px] font-mono font-bold text-brown-500 uppercase mb-1">
                Event Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Midterm Exam or Final Presentation"
                className="w-full text-xs rounded-xl border-brown-200 bg-neutral-50 p-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-brown-600"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono font-bold text-brown-500 uppercase mb-1">
                  Type *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CalendarEvent["type"])}
                  className="w-full text-xs rounded-xl border-brown-200 bg-neutral-50 p-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-brown-600"
                >
                  <option value="Fixed Task">Fixed Task</option>
                  <option value="Exam">Exam</option>
                  <option value="Submission">Submission</option>
                  <option value="Deadline">Deadline</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-brown-500 uppercase mb-1">
                  Target Date *
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full text-xs rounded-xl border-brown-200 bg-neutral-50 p-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-brown-600"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-brown-500 uppercase mb-1">
                Description / Syllabus
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Syllabus coverage, location, weighting, room number etc..."
                className="w-full text-xs rounded-xl border-brown-200 bg-neutral-50 p-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-brown-600 h-16 resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-brown-500 uppercase mb-1">
                Associate with Goal (Optional)
              </label>
              <select
                value={associatedGoalId}
                onChange={(e) => setAssociatedGoalId(e.target.value)}
                className="w-full text-xs rounded-xl border-brown-200 bg-neutral-50 p-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-brown-600"
              >
                <option value="">No Associated Goal</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-brown-900 text-white rounded-xl text-xs font-bold hover:bg-brown-850 active:scale-95 transition flex items-center justify-center gap-1.5"
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
            className="w-full py-2.5 bg-brown-900 text-white rounded-xl text-xs font-bold hover:bg-brown-850 active:scale-95 transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Event for {new Date(selectedDate).toLocaleDateString("en-US", { month: 'short', day: 'numeric' })}</span>
          </button>
        )}

        {/* List of Events on Selected Day */}
        <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto">
          <span className="text-[10px] font-mono font-bold text-brown-500 uppercase tracking-wider">
            Events Scheduled ({selectedDayEvents.length})
          </span>

          {loading ? (
            <div className="text-center py-6 text-xs text-brown-500">
              Loading calendar events...
            </div>
          ) : selectedDayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-brown-200 rounded-2xl bg-white/40 px-4">
              <CalendarIcon className="h-8 w-8 text-brown-300 mb-1.5" />
              <p className="text-xs font-medium text-brown-600">No events on this date</p>
              <p className="text-[10px] text-brown-500 mt-0.5 leading-normal">
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
                    className={`bg-white border border-brown-150 p-3 rounded-2xl flex flex-col gap-2 relative group hover:border-brown-300 transition shadow-2xs ${styles.border}`}
                  >
                    <div className="flex justify-between items-start pr-12">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${styles.pill}`}>
                            {ev.type}
                          </span>
                          {ev.googleEventId && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-150 flex items-center gap-0.5" title="Synchronized with Google Calendar">
                              Google Synced
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-brown-950 mt-1.5 leading-tight">
                          {ev.title}
                        </h4>
                      </div>

                      {/* Floating actions */}
                      <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
                        <button
                          onClick={() => startEdit(ev)}
                          className="p-1 rounded-lg hover:bg-beige-100 text-brown-500 hover:text-brown-800 transition"
                          title="Edit event"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="p-1 rounded-lg hover:bg-red-50 text-brown-400 hover:text-red-700 transition"
                          title="Delete event"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {ev.description && (
                      <p className="text-[11px] text-brown-600 leading-normal bg-neutral-50/50 p-2 rounded-xl border border-neutral-100 font-sans">
                        {ev.description}
                      </p>
                    )}

                    {linkedGoal && (
                      <div className="flex items-center gap-1 text-[9px] text-brown-500 font-semibold bg-beige-100/50 py-1 px-2 rounded-lg self-start">
                        <BookOpen className="h-3 w-3 shrink-0 text-brown-600" />
                        <span>Goal: {linkedGoal.title}</span>
                      </div>
                    )}
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
