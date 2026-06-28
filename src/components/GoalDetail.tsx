import React, { useState, useEffect, useRef } from "react";
import { UserProfile, Goal, GoalPhase, GoalTask, GoalResource, GoalChat, GoalCheckIn, CheckInSchedule } from "../types";
import { safeFetchJson } from "../lib/api";
import {
  db,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  where,
} from "../lib/firebase";
import {
  ArrowLeft,
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle,
  HelpCircle,
  Send,
  Loader2,
  Trash,
  Check,
  Edit2,
  Lock,
  Clock,
  Settings,
  Activity,
  Play,
  AlertTriangle,
  ListTodo,
  RefreshCw
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { syncTaskToGoogle, deleteTaskFromGoogle } from "../lib/googleSync";

interface GoalDetailProps {
  goal: Goal;
  profile: UserProfile;
  onBack: () => void;
  onUpdateGoalList: () => void;
  googleAccessToken: string | null;
  onConnectGoogle: () => Promise<string | null>;
}

export default function GoalDetail({ 
  goal, 
  profile, 
  onBack, 
  onUpdateGoalList,
  googleAccessToken,
  onConnectGoogle
}: GoalDetailProps) {
  // Goal Data States
  const [currentGoal, setCurrentGoal] = useState<Goal>(goal);
  const [phases, setPhases] = useState<GoalPhase[]>([]);
  const [tasks, setTasks] = useState<GoalTask[]>([]);
  const [resources, setResources] = useState<GoalResource[]>([]);
  const [chats, setChats] = useState<GoalChat[]>([]);
  const [loading, setLoading] = useState(true);

  // Interaction States
  const [confidenceScore, setConfidenceScore] = useState<number>(goal.confidenceScore);
  const [status, setStatus] = useState<'active' | 'completed'>(goal.status);
  const [activeTab, setActiveTab] = useState<'roadmap' | 'chat' | 'resources' | 'checkins'>('roadmap');

  // Daily Check-In States
  const [checkIns, setCheckIns] = useState<GoalCheckIn[]>([]);
  const [schedule, setSchedule] = useState<CheckInSchedule | null>(null);
  const [generatingCheckIn, setGeneratingCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  // New Custom Task Form States
  const [showAddTaskPhaseId, setShowAddTaskPhaseId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>("Medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState(goal.targetDate);

  // Edit Task States
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskPriority, setEditingTaskPriority] = useState<'High' | 'Medium' | 'Low'>("Medium");

  // Chat Panel States
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  const confidenceOptions = [
    { score: 1, label: "Very Low" },
    { score: 2, label: "Low" },
    { score: 3, label: "Neutral" },
    { score: 4, label: "Good" },
    { score: 5, label: "Very High" },
  ];

  // Fetch all sub-records
  useEffect(() => {
    const fetchGoalData = async () => {
      try {
        setLoading(true);

        // 1. Phases
        const phasesSnap = await getDocs(
          query(collection(db, "goals", goal.id, "phases"), orderBy("order", "asc"))
        );
        const fetchedPhases = phasesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as GoalPhase[];
        setPhases(fetchedPhases);

        // 2. Tasks
        const tasksSnap = await getDocs(
          query(collection(db, "goals", goal.id, "tasks"), orderBy("order", "asc"))
        );
        const fetchedTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() })) as GoalTask[];
        setTasks(fetchedTasks);

        // 3. Resources
        const resourcesSnap = await getDocs(collection(db, "goals", goal.id, "resources"));
        const fetchedResources = resourcesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as GoalResource[];
        setResources(fetchedResources);

        // 4. Chats
        const chatsSnap = await getDocs(
          query(collection(db, "goals", goal.id, "chats"), orderBy("createdAt", "asc"))
        );
        const fetchedChats = chatsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as GoalChat[];
        setChats(fetchedChats);

        // 5. Daily Check-ins
        const checkInsSnap = await getDocs(collection(db, "goals", goal.id, "daily_checkins"));
        const fetchedCheckIns = checkInsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as GoalCheckIn[];
        fetchedCheckIns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCheckIns(fetchedCheckIns);

        // 6. Schedule
        const scheduleSnap = await getDocs(collection(db, "goals", goal.id, "schedules"));
        if (!scheduleSnap.empty) {
          setSchedule(scheduleSnap.docs[0].data() as CheckInSchedule);
        } else {
          const defaultSchedule: CheckInSchedule = {
            goalId: goal.id,
            userId: profile.userId,
            enabled: true,
            time: "08:00",
            frequency: "daily",
            lastRunAt: null,
            updatedAt: new Date().toISOString()
          };
          await setDoc(doc(db, "goals", goal.id, "schedules", "daily"), defaultSchedule);
          setSchedule(defaultSchedule);
        }

      } catch (err) {
        console.error("Failed to load goal details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGoalData();
  }, [goal.id]);

  // Update Check-In Status (Pending / Completed / Postponed)
  const handleUpdateCheckInStatus = async (checkInId: string, newStatus: 'completed' | 'postponed' | 'pending') => {
    try {
      const checkInRef = doc(db, "goals", goal.id, "daily_checkins", checkInId);
      await updateDoc(checkInRef, { status: newStatus });
      setCheckIns(prev => prev.map(c => c.id === checkInId ? { ...c, status: newStatus } : c));
    } catch (err) {
      console.error("Failed to update check-in status:", err);
    }
  };

  // Toggle Schedule Enabled / Disabled
  const handleToggleSchedule = async () => {
    if (!schedule) return;
    try {
      const newEnabled = !schedule.enabled;
      const scheduleRef = doc(db, "goals", goal.id, "schedules", "daily");
      await updateDoc(scheduleRef, { enabled: newEnabled, updatedAt: new Date().toISOString() });
      setSchedule(prev => prev ? { ...prev, enabled: newEnabled } : null);
    } catch (err) {
      console.error("Failed to toggle schedule:", err);
    }
  };

  // Update Schedule Time
  const handleUpdateScheduleTime = async (newTime: string) => {
    if (!schedule) return;
    try {
      const scheduleRef = doc(db, "goals", goal.id, "schedules", "daily");
      await updateDoc(scheduleRef, { time: newTime, updatedAt: new Date().toISOString() });
      setSchedule(prev => prev ? { ...prev, time: newTime } : null);
    } catch (err) {
      console.error("Failed to update schedule time:", err);
    }
  };

  // Trigger Autonomous Check-In (Manual Simulation)
  const handleTriggerDailyCheckIn = async () => {
    if (generatingCheckIn) return;
    setGeneratingCheckIn(true);
    setCheckInError(null);

    try {
      const result = await safeFetchJson("/api/generate-daily-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.userId,
          goal: currentGoal,
          profile,
          tasks,
          schedule
        })
      });

      const diagnostic = result.data;

      const checkInId = `checkin_${Date.now()}`;
      const newCheckIn: GoalCheckIn = {
        id: checkInId,
        goalId: goal.id,
        userId: profile.userId,
        date: new Date().toISOString().split("T")[0],
        coachingStyle: profile.aiStyle,
        diagnosticSentiment: diagnostic.diagnosticSentiment,
        coachingReflection: diagnostic.coachingReflection,
        suggestedActionToday: diagnostic.suggestedActionToday,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "goals", goal.id, "daily_checkins", checkInId), newCheckIn);

      const scheduleRef = doc(db, "goals", goal.id, "schedules", "daily");
      await updateDoc(scheduleRef, { lastRunAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

      setSchedule(prev => prev ? { ...prev, lastRunAt: new Date().toISOString() } : null);
      setCheckIns(prev => [newCheckIn, ...prev]);

    } catch (err: any) {
      console.error(err);
      setCheckInError(err.message || "COMPASS was unable to formulate a daily check-in. Please try again.");
    } finally {
      setGeneratingCheckIn(false);
    }
  };

  // Scroll to bottom of chats
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chats, activeTab]);

  // Helper: Recalculate and Save Goal Progress %
  const updateProgressState = async (updatedTasks: GoalTask[]) => {
    if (updatedTasks.length === 0) return;
    const completed = updatedTasks.filter(t => t.status === "completed").length;
    const progress = Math.round((completed / updatedTasks.length) * 100);

    const goalRef = doc(db, "goals", goal.id);
    await updateDoc(goalRef, {
      progressPercentage: progress,
      updatedAt: new Date().toISOString()
    });

    setCurrentGoal(prev => ({
      ...prev,
      progressPercentage: progress
    }));

    onUpdateGoalList();
  };

  // 1. Toggle Task Status
  const handleToggleTask = async (task: GoalTask) => {
    try {
      const newStatus = (task.status === "completed" ? "pending" : "completed") as "completed" | "pending";
      let updatedGoogleTaskId = task.googleTaskId || null;

      if (profile.googleTasksSyncEnabled && googleAccessToken) {
        try {
          const updatedTaskObject = { ...task, status: newStatus };
          updatedGoogleTaskId = await syncTaskToGoogle(updatedTaskObject, googleAccessToken);
        } catch (gErr) {
          console.warn("Google Tasks toggle sync failed:", gErr);
        }
      }

      const taskRef = doc(db, "goals", goal.id, "tasks", task.id);
      await updateDoc(taskRef, {
        status: newStatus,
        googleTaskId: updatedGoogleTaskId,
        updatedAt: new Date().toISOString()
      });

      const updatedTasks = tasks.map(t => t.id === task.id ? { ...t, status: newStatus, googleTaskId: updatedGoogleTaskId || undefined } : t);
      setTasks(updatedTasks);
      await updateProgressState(updatedTasks);
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  // 2. Add custom task
  const handleAddCustomTask = async (phaseId: string) => {
    if (!newTaskTitle.trim()) return;

    try {
      const taskId = `task_${Date.now()}`;
      const newTaskDoc: GoalTask = {
        id: taskId,
        phaseId,
        goalId: goal.id,
        userId: profile.userId,
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        status: "pending",
        suggestedDueDate: newTaskDueDate || goal.targetDate,
        order: tasks.filter(t => t.phaseId === phaseId).length + 1,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (profile.googleTasksSyncEnabled && googleAccessToken) {
        try {
          const gId = await syncTaskToGoogle(newTaskDoc, googleAccessToken);
          if (gId) {
            newTaskDoc.googleTaskId = gId;
          }
        } catch (gErr) {
          console.warn("Google Tasks add sync failed:", gErr);
        }
      }

      await setDoc(doc(db, "goals", goal.id, "tasks", taskId), newTaskDoc);

      const updatedTasks = [...tasks, newTaskDoc];
      setTasks(updatedTasks);
      await updateProgressState(updatedTasks);

      // Reset
      setNewTaskTitle("");
      setShowAddTaskPhaseId(null);
    } catch (err) {
      console.error("Failed to add task:", err);
    }
  };

  // 3. Edit task details
  const handleSaveEditTask = async (taskId: string) => {
    if (!editingTaskTitle.trim()) return;

    try {
      const task = tasks.find(t => t.id === taskId);
      let updatedGoogleTaskId = task?.googleTaskId || null;

      if (task && profile.googleTasksSyncEnabled && googleAccessToken) {
        try {
          const updatedTaskObject = { ...task, title: editingTaskTitle.trim(), priority: editingTaskPriority };
          updatedGoogleTaskId = await syncTaskToGoogle(updatedTaskObject, googleAccessToken);
        } catch (gErr) {
          console.warn("Google Tasks edit sync failed:", gErr);
        }
      }

      const taskRef = doc(db, "goals", goal.id, "tasks", taskId);
      await updateDoc(taskRef, {
        title: editingTaskTitle.trim(),
        priority: editingTaskPriority,
        googleTaskId: updatedGoogleTaskId,
        updatedAt: new Date().toISOString()
      });

      const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, title: editingTaskTitle.trim(), priority: editingTaskPriority, googleTaskId: updatedGoogleTaskId || undefined } : t);
      setTasks(updatedTasks);
      setEditingTaskId(null);
    } catch (err) {
      console.error("Failed to edit task:", err);
    }
  };

  // 4. Delete task
  const handleDeleteTask = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task?.googleTaskId && profile.googleTasksSyncEnabled && googleAccessToken) {
        try {
          await deleteTaskFromGoogle(task.googleTaskId, googleAccessToken);
        } catch (gErr) {
          console.warn("Google Tasks delete sync failed:", gErr);
        }
      }

      await deleteDoc(doc(db, "goals", goal.id, "tasks", taskId));
      const updatedTasks = tasks.filter(t => t.id !== taskId);
      setTasks(updatedTasks);
      await updateProgressState(updatedTasks);
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const [syncingTasks, setSyncingTasks] = useState(false);
  const [taskSyncMsg, setTaskSyncMsg] = useState<string | null>(null);

  const handleSyncAllTasksToGoogle = async () => {
    if (!profile.googleTasksSyncEnabled) {
      alert("Please enable Google Tasks Sync in Settings first.");
      return;
    }
    if (!googleAccessToken) {
      try {
        const token = await onConnectGoogle();
        if (!token) return;
      } catch (err: any) {
        alert("Failed to connect Google account: " + err.message);
        return;
      }
    }

    setSyncingTasks(true);
    setTaskSyncMsg("Syncing roadmap tasks with Google Tasks...");
    try {
      const tokenToUse = googleAccessToken || (await onConnectGoogle());
      if (!tokenToUse) throw new Error("Could not acquire Google access token");

      let count = 0;
      const updatedTasks = [...tasks];
      for (let i = 0; i < updatedTasks.length; i++) {
        const t = updatedTasks[i];
        if (!t.googleTaskId) {
          const gId = await syncTaskToGoogle(t, tokenToUse);
          if (gId) {
            t.googleTaskId = gId;
            const taskRef = doc(db, "goals", goal.id, "tasks", t.id);
            await updateDoc(taskRef, { googleTaskId: gId });
            count++;
          }
        }
      }
      setTasks(updatedTasks);
      setTaskSyncMsg(`Successfully exported ${count} new tasks to Google Tasks!`);
      setTimeout(() => setTaskSyncMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setTaskSyncMsg("Sync failed: " + (err.message || err));
      setTimeout(() => setTaskSyncMsg(null), 4000);
    } finally {
      setSyncingTasks(false);
    }
  };

  // 5. Update Confidence Score
  const handleUpdateConfidence = async (score: number) => {
    try {
      setConfidenceScore(score);
      const goalRef = doc(db, "goals", goal.id);
      await updateDoc(goalRef, {
        confidenceScore: score,
        updatedAt: new Date().toISOString()
      });
      setCurrentGoal(prev => ({ ...prev, confidenceScore: score }));
      onUpdateGoalList();
    } catch (err) {
      console.error("Failed to update confidence:", err);
    }
  };

  // 6. Update Goal Status (Active vs Completed)
  const handleUpdateStatus = async (newStatus: 'active' | 'completed') => {
    try {
      setStatus(newStatus);
      const goalRef = doc(db, "goals", goal.id);
      await updateDoc(goalRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      setCurrentGoal(prev => ({ ...prev, status: newStatus }));
      onUpdateGoalList();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // 7. Chat submit
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || sendingChat) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setSendingChat(true);
    setChatError(null);

    try {
      // Create user message document locally and in Firestore
      const userChatDoc: GoalChat = {
        goalId: goal.id,
        userId: profile.userId,
        role: "user",
        content: userMessage,
        createdAt: new Date().toISOString()
      };
      
      const chatsRef = collection(db, "goals", goal.id, "chats");
      const userDocRef = await addDoc(chatsRef, userChatDoc);
      setChats(prev => [...prev, { id: userDocRef.id, ...userChatDoc }]);

      // Call Express API
      const historyToSend = chats.slice(-19).map(c => ({ role: c.role, content: c.content }));

      const result = await safeFetchJson("/api/goal-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.userId,
          goal: currentGoal,
          profile,
          phases,
          tasks,
          history: historyToSend,
          message: userMessage
        })
      });

      // Save AI reply
      const aiChatDoc: GoalChat = {
        goalId: goal.id,
        userId: profile.userId,
        role: "model",
        content: result.reply,
        createdAt: new Date().toISOString()
      };

      const aiDocRef = await addDoc(chatsRef, aiChatDoc);
      setChats(prev => [...prev, { id: aiDocRef.id, ...aiChatDoc }]);

    } catch (err: any) {
      console.error(err);
      setChatError(err.message || "COMPASS was unable to formulate a coaching response. Please try again.");
    } finally {
      setSendingChat(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-neutral-900 animate-spin mb-3" />
        <p className="text-sm text-neutral-500 font-medium">Assembling goal portfolio matrix...</p>
      </div>
    );
  }

  // Calculate stats
  const completedTaskCount = tasks.filter(t => t.status === "completed").length;
  const totalTaskCount = tasks.length;

  return (
    <div className="space-y-6 text-theme-text-main">
      {/* Detail Header & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme-border-subtle pb-5">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-theme-bg-card-hover border border-theme-border-main rounded-xl transition text-theme-text-muted hover:text-theme-text-main shrink-0 mt-0.5"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-theme-text-muted bg-theme-bg-card-hover border border-theme-border-main rounded-full px-2.5 py-0.5">
                {currentGoal.category}
              </span>
              <span
                className={`text-[10px] font-mono font-bold border rounded-full px-2.5 py-0.5 ${
                  currentGoal.priority === "High"
                    ? "bg-red-950/25 text-red-400 border-red-900/40"
                    : currentGoal.priority === "Medium"
                    ? "bg-yellow-950/25 text-yellow-400 border-yellow-900/40"
                    : "bg-green-950/25 text-green-400 border-green-900/40"
                }`}
              >
                {currentGoal.priority} Priority
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-theme-text-main font-display mt-2 leading-tight">
              {currentGoal.title}
            </h1>
            {currentGoal.description && (
              <p className="text-sm text-theme-text-muted mt-1 max-w-2xl leading-relaxed">
                {currentGoal.description}
              </p>
            )}
          </div>
        </div>

        {/* Goal Meta Widgets (Status & Confidence) */}
        <div className="flex flex-col sm:flex-row gap-3.5 shrink-0 bg-theme-bg-panel border border-theme-border-main rounded-2xl p-4 md:self-start">
          {/* Status Select */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">Goal Progress State</span>
            <div className="flex gap-1.5 bg-theme-bg-card-hover p-1 rounded-xl">
              <button
                onClick={() => handleUpdateStatus("active")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                  status === "active"
                    ? "bg-theme-bg-card text-theme-text-main shadow-sm"
                    : "text-theme-text-muted hover:text-theme-text-main"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => handleUpdateStatus("completed")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                  status === "completed"
                    ? "bg-theme-bg-accent text-theme-text-accent shadow-sm"
                    : "text-theme-text-muted hover:text-theme-text-main"
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Confidence Picker */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">My Confidence Score</span>
            <div className="flex items-center gap-1">
              {confidenceOptions.map((opt) => (
                <button
                  key={opt.score}
                  onClick={() => handleUpdateConfidence(opt.score)}
                  title={opt.label}
                  className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold transition-all transform active:scale-90 border ${
                    confidenceScore === opt.score
                      ? "bg-theme-bg-accent text-theme-text-accent border-theme-bg-accent scale-110 shadow-sm font-bold"
                      : "bg-theme-bg-card text-theme-text-muted border-theme-border-main hover:border-theme-text-muted opacity-75 hover:opacity-100"
                  }`}
                >
                  {opt.score}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Goal Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Progress percent block */}
        <div className="bg-theme-bg-card border border-theme-border-main rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-theme-text-muted">Progress Completed</span>
            <span className="text-lg font-bold font-mono text-theme-text-main">
              {currentGoal.progressPercentage}%
            </span>
          </div>
          <div className="w-full bg-theme-bg-card-hover h-2.5 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-theme-bg-accent h-full rounded-full transition-all duration-500"
              style={{ width: `${currentGoal.progressPercentage}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-theme-text-muted-mono mt-2">
            Completed {completedTaskCount} of {totalTaskCount} total roadmap deliverables
          </div>
        </div>

        {/* Deadline block */}
        <div className="bg-theme-bg-card border border-theme-border-main rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="h-10 w-10 bg-theme-bg-card-hover border border-theme-border-subtle rounded-xl flex items-center justify-center text-theme-text-muted shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-theme-text-muted block">Target Completion Date</span>
            <span className="text-sm font-semibold font-mono text-theme-text-main block mt-0.5">
              {currentGoal.targetDate}
            </span>
            <span className="text-[10px] text-theme-text-muted-mono">
              {new Date(currentGoal.targetDate) < new Date() ? "Expired" : "Targeting future delivery"}
            </span>
          </div>
        </div>

        {/* Coaching Vibe block */}
        <div className="bg-theme-bg-card border border-theme-border-main rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="h-10 w-10 bg-theme-bg-card-hover border border-theme-border-subtle rounded-xl flex items-center justify-center text-theme-text-muted shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-theme-text-muted block">Coaching Tone Calibrated</span>
            <span className="text-sm font-semibold text-theme-text-main block mt-0.5">
              {profile.aiStyle} Coach
            </span>
            <span className="text-[10px] text-theme-text-muted-mono block truncate">
              Answering as {profile.role} focus strategist
            </span>
          </div>
        </div>
      </div>

      {/* Balance Notes / Warnings (if any exists) */}
      {(currentGoal.balanceNote || currentGoal.conflictWarning || currentGoal.timelineWarning) && (
        <div className="bg-theme-bg-card-hover border border-theme-border-main rounded-2xl p-4 space-y-2 text-xs leading-relaxed">
          {currentGoal.balanceNote && (
            <p className="text-sky-800 dark:text-sky-300">
              <strong>Workload Fit:</strong> {currentGoal.balanceNote}
            </p>
          )}
          {currentGoal.conflictWarning && (
            <p className="text-yellow-800 dark:text-yellow-300">
              <strong>Overload Alert:</strong> {currentGoal.conflictWarning}
            </p>
          )}
          {currentGoal.timelineWarning && (
            <p className="text-orange-800 dark:text-orange-300">
              <strong>Timeline Analysis:</strong> {currentGoal.timelineWarning}
            </p>
          )}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-theme-border-main">
        <nav className="flex space-x-6">
          {[
            { id: "roadmap", label: "Structured Roadmap" },
            { id: "chat", label: `COMPASS Coach Chat (${chats.length})` },
            { id: "resources", label: "Recommended Resources" },
            { id: "checkins", label: "Daily Coach Check-ins" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-theme-bg-accent text-theme-text-main font-bold"
                  : "border-transparent text-theme-text-muted hover:text-theme-text-main"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ACTIVE TAB VIEWS */}
      <div className="space-y-6">
        {/* 1. ROADMAP VIEW */}
        {activeTab === "roadmap" && (
          <div className="space-y-6">
            {profile.googleTasksSyncEnabled && (
              <div className="bg-white border border-brown-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <h4 className="text-xs font-bold text-brown-950 flex items-center gap-1.5">
                    <ListTodo className="h-4 w-4 text-brown-600" />
                    Google Tasks Sync is Enabled
                  </h4>
                  <p className="text-[11px] text-brown-600 mt-0.5 leading-normal">
                    COMPASS automatically syncs action items to your Google Tasks. Feel free to run a manual bulk sync anytime.
                  </p>
                </div>
                {taskSyncMsg ? (
                  <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-150 animate-pulse">
                    {taskSyncMsg}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSyncAllTasksToGoogle}
                    disabled={syncingTasks}
                    className="py-1.5 px-3 bg-brown-900 hover:bg-brown-850 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                  >
                    {syncingTasks ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    <span>Sync Roadmap Tasks</span>
                  </button>
                )}
              </div>
            )}

            {phases.length === 0 ? (
              <div className="text-center py-10 bg-theme-bg-card border border-theme-border-main rounded-2xl">
                <p className="text-sm text-theme-text-muted">No phases defined for this roadmap.</p>
              </div>
            ) : (
              phases.map((phase) => {
                const phaseTasks = tasks.filter((t) => t.phaseId === phase.id);
                const isPhaseComplete = phaseTasks.length > 0 && phaseTasks.every((t) => t.status === "completed");

                return (
                  <div
                    key={phase.id}
                    className={`bg-theme-bg-card border rounded-2xl shadow-sm overflow-hidden transition-all duration-300 ${
                      isPhaseComplete ? "border-theme-border-main opacity-80" : "border-theme-border-main"
                    }`}
                  >
                    {/* Phase Header */}
                    <div className="px-5 py-4 border-b border-theme-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-theme-bg-card-hover/40">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-theme-text-main font-display">
                            Phase {phase.order}: {phase.title}
                          </h3>
                          {isPhaseComplete && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono text-green-600 bg-green-950/20 border border-green-900/40 rounded-full px-2 py-0.5">
                              <Check className="h-3 w-3" /> Fully Delivered
                            </span>
                          )}
                        </div>
                        {phase.description && (
                          <p className="text-xs text-theme-text-muted mt-1">{phase.description}</p>
                        )}
                      </div>
                      <div className="text-xs font-mono font-medium text-theme-text-muted shrink-0">
                        {phase.estimatedDuration || "Flexible Schedule"}
                      </div>
                    </div>

                    {/* Phase Tasks Checklist */}
                    <div className="divide-y divide-theme-border-subtle px-5">
                      {phaseTasks.length === 0 ? (
                        <div className="py-5 text-center text-xs text-theme-text-muted-mono">
                          No tasks allocated to this phase.
                        </div>
                      ) : (
                        phaseTasks.map((task) => {
                          const isEditing = editingTaskId === task.id;

                          return (
                            <div
                              key={task.id}
                              className="py-3.5 flex items-start justify-between gap-3 group animate-in fade-in duration-200"
                            >
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {/* Checkbox */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleTask(task)}
                                  className={`mt-0.5 h-4.5 w-4.5 rounded-md border flex items-center justify-center transition shrink-0 ${
                                    task.status === "completed"
                                      ? "bg-theme-bg-accent border-theme-bg-accent text-theme-text-accent"
                                      : "border-theme-border-main hover:border-theme-text-muted bg-theme-bg-card"
                                  }`}
                                >
                                  {task.status === "completed" && <Check className="h-3.5 w-3.5" />}
                                </button>

                                {/* Task Details / Editing Mode */}
                                {isEditing ? (
                                  <div className="flex-1 space-y-2 bg-theme-bg-card-hover p-2 rounded-xl border border-theme-border-main">
                                    <input
                                      type="text"
                                      className="w-full text-xs font-medium border border-theme-border-main rounded-lg px-2.5 py-1.5 bg-theme-bg-card text-theme-text-main"
                                      value={editingTaskTitle}
                                      onChange={(e) => setEditingTaskTitle(e.target.value)}
                                    />
                                    <div className="flex items-center gap-3">
                                      <select
                                        className="text-[10px] font-bold uppercase rounded border border-theme-border-main bg-theme-bg-card text-theme-text-main px-2 py-1"
                                        value={editingTaskPriority}
                                        onChange={(e) => setEditingTaskPriority(e.target.value as any)}
                                      >
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditTask(task.id)}
                                        className="text-[11px] font-bold text-blue-500 hover:underline"
                                      >
                                        Save changes
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingTaskId(null)}
                                        className="text-[11px] font-bold text-theme-text-muted hover:underline"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="min-w-0">
                                    <span
                                      className={`text-sm font-medium block leading-normal ${
                                        task.status === "completed"
                                          ? "text-theme-text-muted-mono line-through"
                                          : "text-theme-text-main"
                                      }`}
                                    >
                                      {task.title}
                                    </span>
                                    {task.notes && (
                                      <span className="text-[11px] text-theme-text-muted block mt-0.5">
                                        {task.notes}
                                      </span>
                                    )}
                                    <div className="flex items-center gap-2 flex-wrap mt-1">
                                      {task.suggestedDueDate && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-theme-text-muted-mono">
                                          <Calendar className="h-3 w-3" /> Due {task.suggestedDueDate}
                                        </span>
                                      )}
                                      {task.googleTaskId && (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150" title="Synchronized with Google Tasks">
                                          Google Tasks Synced
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Task Control Actions */}
                              {!isEditing && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 self-center">
                                  <button
                                    onClick={() => {
                                      setEditingTaskId(task.id);
                                      setEditingTaskTitle(task.title);
                                      setEditingTaskPriority(task.priority);
                                    }}
                                    className="p-1 hover:bg-theme-bg-card-hover rounded-lg text-theme-text-muted hover:text-theme-text-main"
                                    title="Edit action item"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="p-1 hover:bg-theme-bg-card-hover rounded-lg text-theme-text-muted hover:text-red-500"
                                    title="Delete action item"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Add Custom Task Subform */}
                    <div className="bg-theme-bg-card-hover/40 px-5 py-3 border-t border-theme-border-subtle">
                      {showAddTaskPhaseId === phase.id ? (
                        <div className="space-y-3 p-3 bg-theme-bg-card border border-theme-border-main rounded-xl">
                          <div>
                            <input
                              type="text"
                              required
                              placeholder="Describe specific, completable task..."
                              className="w-full text-xs font-medium border border-theme-border-main rounded-lg px-2.5 py-2 placeholder-theme-text-muted-mono bg-theme-bg-card text-theme-text-main focus:outline-none focus:border-theme-bg-accent"
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-theme-text-muted">Task Priority</label>
                              <select
                                className="w-full text-xs border border-theme-border-main rounded-lg p-1.5 bg-theme-bg-card text-theme-text-main"
                                value={newTaskPriority}
                                onChange={(e) => setNewTaskPriority(e.target.value as any)}
                              >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-theme-text-muted">Due Date</label>
                              <input
                                type="date"
                                className="w-full text-xs border border-theme-border-main rounded-lg p-1 bg-theme-bg-card text-theme-text-main"
                                value={newTaskDueDate}
                                onChange={(e) => setNewTaskDueDate(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2 border-t border-theme-border-subtle">
                            <button
                              type="button"
                              onClick={() => setShowAddTaskPhaseId(null)}
                              className="px-3 py-1.5 text-xs font-bold text-theme-text-muted hover:text-theme-text-main"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddCustomTask(phase.id)}
                              className="px-3.5 py-1.5 text-xs font-bold bg-theme-bg-accent text-theme-text-accent rounded-lg hover:bg-theme-bg-accent-hover"
                            >
                              Add Deliverable
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddTaskPhaseId(phase.id);
                            setNewTaskDueDate(goal.targetDate);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-theme-text-muted hover:text-theme-text-main transition"
                        >
                          <Plus className="h-4 w-4" /> Add custom deliverable to Phase {phase.order}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2. CHAT VIEW */}
        {activeTab === "chat" && (
          <div className="border border-theme-border-main bg-theme-bg-card rounded-2xl shadow-sm h-[550px] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 border-b border-theme-border-subtle bg-theme-bg-card-hover flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-ping"></div>
                <span className="text-xs font-bold text-theme-text-main font-display">
                  Active Coaching Session with COMPASS AI
                </span>
              </div>
              <span className="text-[10px] text-theme-text-muted-mono font-mono">
                Model: gemini-3.5-flash
              </span>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Welcome message */}
              <div className="flex gap-3 max-w-[85%] animate-in fade-in duration-300">
                <div className="h-8 w-8 rounded-lg bg-theme-bg-accent text-theme-text-accent flex items-center justify-center font-bold text-xs shrink-0">
                  C
                </div>
                <div className="bg-theme-bg-card-hover text-theme-text-main rounded-2xl px-4 py-3 text-sm leading-relaxed">
                  <p className="font-semibold text-theme-text-main mb-1">Welcome to your COMPASS Workspace.</p>
                  I have analyzed your roadmap progress for <strong>"{currentGoal.title}"</strong>. Our records indicate your current progress sits at <strong>{currentGoal.progressPercentage}% complete</strong> with a <strong>{confidenceOptions.find(o => o.score === confidenceScore)?.label}</strong> confidence index.
                  <br className="mb-2" />
                  Ask me about timeline recovery, task priority calibration, or how to re-schedule specific milestones around your active deliverables. What blocker are we tackling today?
                </div>
              </div>

              {chats.map((chat, idx) => {
                const isUser = chat.role === "user";
                return (
                  <div
                    key={idx}
                    className={`flex gap-3 max-w-[85%] animate-in fade-in duration-300 ${
                      isUser ? "ml-auto flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isUser ? "bg-theme-bg-card-hover text-theme-text-muted" : "bg-theme-bg-accent text-theme-text-accent"
                      }`}
                    >
                      {isUser ? "Y" : "C"}
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? "bg-theme-bg-accent text-theme-text-accent"
                          : "bg-theme-bg-card-hover text-theme-text-main"
                      }`}
                    >
                      <div className="markdown-body">
                        <ReactMarkdown>{chat.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                );
              })}

              {sendingChat && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="h-8 w-8 rounded-lg bg-theme-bg-accent text-theme-text-accent flex items-center justify-center font-bold text-xs shrink-0 animate-pulse">
                    C
                  </div>
                  <div className="bg-theme-bg-card-hover text-theme-text-muted rounded-2xl px-4 py-3 text-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-theme-text-muted" />
                    COMPASS is assessing deliverables matrix...
                  </div>
                </div>
              )}

              {chatError && (
                <div className="p-3 bg-red-950/20 border border-red-900/40 text-red-400 rounded-xl text-xs">
                  {chatError}
                </div>
              )}

              <div ref={chatBottomRef}></div>
            </div>

            {/* Input Panel */}
            <form onSubmit={handleSendChatMessage} className="p-3 border-t border-theme-border-subtle bg-theme-bg-card-hover flex gap-2">
              <input
                type="text"
                placeholder="Ask COMPASS for a focused action-item or timeline recovery schedule..."
                className="flex-1 bg-theme-bg-card border border-theme-border-main text-theme-text-main rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-theme-bg-accent focus:ring-1 focus:ring-theme-bg-accent"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={sendingChat}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || sendingChat}
                className="bg-theme-bg-accent text-theme-text-accent p-2.5 rounded-xl hover:bg-theme-bg-accent-hover disabled:opacity-50 transition shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* 3. RESOURCES VIEW */}
        {activeTab === "resources" && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-theme-text-main font-display">
              AI Aggregated Study Material & References
            </h3>
            {resources.length === 0 ? (
              <div className="text-center py-10 bg-theme-bg-card border border-theme-border-main rounded-2xl">
                <p className="text-sm text-theme-text-muted">No resources matched to this goal.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resources.map((resItem) => (
                  <div
                    key={resItem.id}
                    className="bg-theme-bg-card border border-theme-border-main rounded-2xl p-5 shadow-sm hover:border-theme-text-muted transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold font-mono uppercase bg-theme-bg-card-hover border border-theme-border-subtle text-theme-text-muted px-2.5 py-0.5 rounded-full">
                          {resItem.type}
                        </span>
                        <h4 className="font-bold text-sm text-theme-text-main truncate">{resItem.title}</h4>
                      </div>
                      <p className="text-xs text-theme-text-muted leading-relaxed mb-4">
                        {resItem.description}
                      </p>
                    </div>
                    {resItem.url && (
                      <a
                        href={resItem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono font-semibold text-blue-500 hover:underline flex items-center gap-1 mt-auto"
                      >
                        Visit Reference Link &rarr;
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. DAILY COACH CHECK-INS VIEW */}
        {activeTab === "checkins" && (
          <div className="space-y-6">
            {/* Autonomous Configuration Panel */}
            <div className="bg-theme-bg-card border border-theme-border-main rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-theme-text-main" />
                    <h3 className="font-bold text-base text-theme-text-main">
                      Autonomous Coach Scheduling
                    </h3>
                  </div>
                  <p className="text-xs text-theme-text-muted leading-relaxed max-w-xl">
                    When enabled, the COMPASS coach automatically performs a comprehensive status audit of your goal, milestones, and pending checklist items to deliver a hyper-focused action plan every morning.
                  </p>
                </div>

                {/* Quick Toggle Controls */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold text-theme-text-muted">
                    {schedule?.enabled ? "Scheduler Active" : "Scheduler Idle"}
                  </span>
                  <button
                    onClick={handleToggleSchedule}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      schedule?.enabled ? "bg-theme-bg-accent" : "bg-theme-bg-card-hover"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-theme-bg-card shadow ring-0 transition duration-200 ease-in-out ${
                        schedule?.enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="border-t border-theme-border-subtle mt-6 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-2">
                    Check-in Frequency
                  </label>
                  <div className="flex items-center gap-2 text-sm font-semibold text-theme-text-main bg-theme-bg-card border border-theme-border-main rounded-xl px-3.5 py-2">
                    <Activity className="h-4 w-4 text-theme-text-muted-mono" />
                    Every Morning (Daily)
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-2">
                    Preferred Local Time
                  </label>
                  <input
                    type="time"
                    value={schedule?.time || "08:00"}
                    onChange={(e) => handleUpdateScheduleTime(e.target.value)}
                    className="w-full text-sm font-semibold text-theme-text-main bg-theme-bg-card border border-theme-border-main rounded-xl px-3.5 py-2 focus:ring-1 focus:ring-theme-bg-accent focus:border-theme-bg-accent outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleTriggerDailyCheckIn}
                    disabled={generatingCheckIn || !schedule?.enabled}
                    className="w-full bg-theme-bg-accent hover:bg-theme-bg-accent-hover disabled:bg-theme-bg-card-hover disabled:text-theme-text-muted-mono text-theme-text-accent font-semibold text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    {generatingCheckIn ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing Goal...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-current" />
                        Trigger Daily Run Now
                      </>
                    )}
                  </button>
                </div>
              </div>

              {checkInError && (
                <div className="bg-red-950/20 text-red-400 text-xs p-3.5 rounded-xl border border-red-900/40 mt-4 font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  {checkInError}
                </div>
              )}
            </div>

            {/* Check-In History Section */}
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-theme-text-main uppercase tracking-wider">
                Daily Coaching History
              </h3>

              {checkIns.length === 0 ? (
                <div className="text-center py-12 bg-theme-bg-card border border-theme-border-main rounded-2xl">
                  <Clock className="h-8 w-8 text-theme-text-muted-mono mx-auto mb-3" />
                  <h4 className="font-bold text-theme-text-main text-sm">No Coach Check-ins Logged</h4>
                  <p className="text-xs text-theme-text-muted mt-1 max-w-sm mx-auto leading-relaxed">
                    Once scheduled run triggers or you simulate a daily run above, the AI coach diagnostics cards will display here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {checkIns.map((checkIn) => {
                    // Sentiment Badge styles
                    let badgeBg = "bg-theme-bg-card-hover border-theme-border-main text-theme-text-muted";
                    if (checkIn.diagnosticSentiment === "Excellent") {
                      badgeBg = "bg-emerald-950/25 border-emerald-900/40 text-emerald-400";
                    } else if (checkIn.diagnosticSentiment === "On Track") {
                      badgeBg = "bg-sky-950/25 border-sky-900/40 text-sky-400";
                    } else if (checkIn.diagnosticSentiment === "Under Pressure") {
                      badgeBg = "bg-amber-950/25 border-amber-900/40 text-amber-400";
                    } else if (checkIn.diagnosticSentiment === "Overloaded") {
                      badgeBg = "bg-orange-950/25 border-orange-900/40 text-orange-400";
                    } else if (checkIn.diagnosticSentiment === "Stalled") {
                      badgeBg = "bg-rose-950/25 border-rose-900/40 text-rose-400";
                    }

                    return (
                      <div
                        key={checkIn.id}
                        className="bg-theme-bg-card border border-theme-border-main rounded-2xl p-6 shadow-sm hover:border-theme-text-muted transition duration-150"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold text-theme-text-muted-mono">
                              {new Date(checkIn.createdAt).toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeBg}`}>
                              {checkIn.diagnosticSentiment}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs font-medium text-theme-text-muted">
                            <Sparkles className="h-3 w-3" />
                            {checkIn.coachingStyle} Style
                          </div>
                        </div>

                        {/* Reflection Block */}
                        <p className="text-sm text-theme-text-muted leading-relaxed mb-5">
                          {checkIn.coachingReflection}
                        </p>

                        {/* Proposed Focused Action Today */}
                        <div className="bg-theme-bg-card-hover border border-theme-border-subtle rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono font-bold uppercase text-theme-text-muted-mono block tracking-wider">
                              🎯 Suggested Action Item
                            </span>
                            <span className="text-sm font-semibold text-theme-text-main leading-tight">
                              {checkIn.suggestedActionToday}
                            </span>
                          </div>

                          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                            {checkIn.status === "pending" ? (
                              <>
                                <button
                                  onClick={() => handleUpdateCheckInStatus(checkIn.id, "completed")}
                                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Mark Completed
                                </button>
                                <button
                                  onClick={() => handleUpdateCheckInStatus(checkIn.id, "postponed")}
                                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-theme-bg-card-hover hover:bg-theme-bg-card border border-theme-border-main text-theme-text-muted text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Postpone
                                </button>
                              </>
                            ) : checkIn.status === "completed" ? (
                              <div className="flex items-center gap-1 bg-emerald-950/30 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-900/40 text-xs font-bold">
                                <Check className="h-3.5 w-3.5" />
                                Action Completed
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
                                <span className="text-xs text-theme-text-muted-mono italic">Postponed</span>
                                <button
                                  onClick={() => handleUpdateCheckInStatus(checkIn.id, "pending")}
                                  className="text-xs text-blue-500 hover:underline font-semibold"
                                >
                                  Re-activate
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
