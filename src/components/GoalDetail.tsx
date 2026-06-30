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
  Compass,
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
  RefreshCw,
  Mic,
  MicOff,
  Trophy,
  Award,
  Medal
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  syncTaskToGoogle,
  deleteTaskFromGoogle,
  syncCalendarEventToGoogle,
  deleteCalendarEventFromGoogle,
  GoogleAuthError,
} from "../lib/googleSync";

interface GoalDetailProps {
  goal: Goal;
  profile: UserProfile;
  onBack: () => void;
  onUpdateGoalList: () => void;
  googleAccessToken: string | null;
  onConnectGoogle: () => Promise<string | null>;
  onDisconnectGoogle?: () => void;
}

export default function GoalDetail({ 
  goal, 
  profile, 
  onBack, 
  onUpdateGoalList,
  googleAccessToken,
  onConnectGoogle,
  onDisconnectGoogle
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
  const [editingTaskNotes, setEditingTaskNotes] = useState<string>("");

  // Voice Note Recording States
  const [recordingTaskId, setRecordingTaskId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTranscript, setRecordingTranscript] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Stop Recording Helper
  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("Speech recognition stop failed:", err);
      }
    }
    setIsRecording(false);
  };

  // Start Recording Helper
  const startRecording = async (taskId: string) => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setSpeechError("Speech recognition is not supported in this browser. Please use Google Chrome or Safari.");
      return;
    }

    setRecordingTaskId(taskId);
    setRecordingTranscript("");
    setSpeechError(null);
    setIsRecording(true);

    // Explicitly request microphone permission first using standard MediaDevices API.
    // This reliably triggers the browser's native permission popup on both preview and deployed sites.
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately stop the tracks to release the microphone lock so SpeechRecognition can bind to it
        stream.getTracks().forEach(track => track.stop());
      } catch (mediaErr: any) {
        console.warn("Microphone permission prompt failed or was denied:", mediaErr);
        if (mediaErr.name === "NotAllowedError" || mediaErr.name === "PermissionDeniedError" || mediaErr.message?.includes("denied")) {
          setSpeechError("Microphone permission was denied. Please check your browser settings or click the camera/mic icon in the URL bar to allow microphone access.");
        } else {
          setSpeechError(`Microphone access error: ${mediaErr.message || mediaErr}`);
        }
        setIsRecording(false);
        return;
      }
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }

      const rec = new SpeechRecognitionClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsRecording(true);
      };

      rec.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setRecordingTranscript(currentTranscript);
      };

      rec.onerror = (event: any) => {
        console.warn("Speech recognition notice (non-fatal):", event.error);
        if (event.error === "not-allowed") {
          setSpeechError("Microphone permission denied or blocked by iframe security restrictions. If you are using the embedded preview, please click the 'Open in New Tab' button in the top-right corner of the screen to grant microphone access.");
        } else {
          setSpeechError(`Speech recognition error: ${event.error}`);
        }
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err: any) {
      console.warn("Speech recognition initialization notice (non-fatal):", err);
      setSpeechError("Failed to initialize speech recognition.");
      setIsRecording(false);
    }
  };

  // Save voice note directly to Firestore and local state
  const handleSaveDirectVoiceNote = async (taskId: string, transcript: string, mode: 'append' | 'overwrite' = 'append') => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      let newNotes = transcript.trim();
      if (mode === 'append' && task.notes) {
        newNotes = `${task.notes}\n${newNotes}`;
      }

      let updatedGoogleTaskId = task.googleTaskId || null;

      if (profile.googleTasksSyncEnabled && googleAccessToken) {
        try {
          const updatedTaskObject = { ...task, notes: newNotes };
          updatedGoogleTaskId = await syncTaskToGoogle(updatedTaskObject, googleAccessToken);
        } catch (gErr: any) {
          console.warn("Google Tasks voice note sync failed:", gErr);
          if (gErr instanceof GoogleAuthError || gErr.status === 401 || gErr.message?.includes("401") || gErr.message?.includes("UNAUTHENTICATED")) {
            if (onDisconnectGoogle) onDisconnectGoogle();
          }
        }
      }

      const taskRef = doc(db, "goals", goal.id, "tasks", taskId);
      await updateDoc(taskRef, {
        notes: newNotes,
        googleTaskId: updatedGoogleTaskId,
        updatedAt: new Date().toISOString()
      });

      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes: newNotes, googleTaskId: updatedGoogleTaskId || undefined } : t));
    } catch (err) {
      console.error("Failed to save direct voice note:", err);
    }
  };

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

        // Sync progress percentage with actual tasks in db if out of sync
        if (fetchedTasks.length > 0) {
          const completed = fetchedTasks.filter(t => t.status === "completed").length;
          const calculatedProgress = Math.round((completed / fetchedTasks.length) * 100);
          if (goal.progressPercentage !== calculatedProgress) {
            const goalRef = doc(db, "goals", goal.id);
            await updateDoc(goalRef, {
              progressPercentage: calculatedProgress,
              updatedAt: new Date().toISOString()
            });
            setCurrentGoal(prev => ({
              ...prev,
              progressPercentage: calculatedProgress
            }));
            onUpdateGoalList();
          }
        }

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
        } catch (gErr: any) {
          console.warn("Google Tasks toggle sync failed:", gErr);
          if (gErr instanceof GoogleAuthError || gErr.status === 401 || gErr.message?.includes("401") || gErr.message?.includes("UNAUTHENTICATED")) {
            if (onDisconnectGoogle) onDisconnectGoogle();
          }
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
        } catch (gErr: any) {
          console.warn("Google Tasks add sync failed:", gErr);
          if (gErr instanceof GoogleAuthError || gErr.status === 401 || gErr.message?.includes("401") || gErr.message?.includes("UNAUTHENTICATED")) {
            if (onDisconnectGoogle) onDisconnectGoogle();
          }
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

      const finalNotes = editingTaskNotes.trim() || null;

      if (task && profile.googleTasksSyncEnabled && googleAccessToken) {
        try {
          const updatedTaskObject = { ...task, title: editingTaskTitle.trim(), priority: editingTaskPriority, notes: finalNotes };
          updatedGoogleTaskId = await syncTaskToGoogle(updatedTaskObject, googleAccessToken);
        } catch (gErr: any) {
          console.warn("Google Tasks edit sync failed:", gErr);
          if (gErr instanceof GoogleAuthError || gErr.status === 401 || gErr.message?.includes("401") || gErr.message?.includes("UNAUTHENTICATED")) {
            if (onDisconnectGoogle) onDisconnectGoogle();
          }
        }
      }

      const taskRef = doc(db, "goals", goal.id, "tasks", taskId);
      await updateDoc(taskRef, {
        title: editingTaskTitle.trim(),
        priority: editingTaskPriority,
        notes: finalNotes,
        googleTaskId: updatedGoogleTaskId,
        updatedAt: new Date().toISOString()
      });

      const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, title: editingTaskTitle.trim(), priority: editingTaskPriority, notes: finalNotes, googleTaskId: updatedGoogleTaskId || undefined } : t);
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
        } catch (gErr: any) {
          console.warn("Google Tasks delete sync failed:", gErr);
          if (gErr instanceof GoogleAuthError || gErr.status === 401 || gErr.message?.includes("401") || gErr.message?.includes("UNAUTHENTICATED")) {
            if (onDisconnectGoogle) onDisconnectGoogle();
          }
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
  const [syncingTasksCal, setSyncingTasksCal] = useState(false);
  const [taskCalSyncMsg, setTaskCalSyncMsg] = useState<string | null>(null);

  // States for individual task-level sync status
  const [taskSyncStatus, setTaskSyncStatus] = useState<Record<string, 'loading' | 'success' | 'error' | null>>({});
  // States for phase-level sync status
  const [phaseSyncStatus, setPhaseSyncStatus] = useState<Record<string, 'loading' | 'success' | null>>({});

  const handleSyncError = (err: any, customMessage: string) => {
    console.error(customMessage, err);
    if (err instanceof GoogleAuthError || err.status === 401 || err.message?.includes("401") || err.message?.includes("UNAUTHENTICATED")) {
      if (onDisconnectGoogle) onDisconnectGoogle();
      alert("Your Google session has expired or is invalid. Please reconnect your Google account by clicking Sync again.");
    } else {
      alert(`${customMessage}: ${err.message || err}`);
    }
  };

  const handleSyncTaskToGoogleTasks = async (task: GoalTask) => {
    setTaskSyncStatus(prev => ({ ...prev, [`${task.id}-tasks`]: 'loading' }));
    try {
      let tokenToUse = googleAccessToken;
      if (!tokenToUse) {
        tokenToUse = await onConnectGoogle();
        if (!tokenToUse) {
          setTaskSyncStatus(prev => ({ ...prev, [`${task.id}-tasks`]: 'error' }));
          return;
        }
      }

      const gId = await syncTaskToGoogle(task, tokenToUse);
      if (gId) {
        const taskRef = doc(db, "goals", goal.id, "tasks", task.id);
        await updateDoc(taskRef, { googleTaskId: gId });
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, googleTaskId: gId } : t));
        setTaskSyncStatus(prev => ({ ...prev, [`${task.id}-tasks`]: 'success' }));
        setTimeout(() => {
          setTaskSyncStatus(prev => ({ ...prev, [`${task.id}-tasks`]: null }));
        }, 3000);
      }
    } catch (err: any) {
      setTaskSyncStatus(prev => ({ ...prev, [`${task.id}-tasks`]: 'error' }));
      handleSyncError(err, "Failed to sync task to Google Tasks");
    }
  };

  const handleSyncTaskToGoogleCalendar = async (task: GoalTask) => {
    setTaskSyncStatus(prev => ({ ...prev, [`${task.id}-cal`]: 'loading' }));
    try {
      let tokenToUse = googleAccessToken;
      if (!tokenToUse) {
        tokenToUse = await onConnectGoogle();
        if (!tokenToUse) {
          setTaskSyncStatus(prev => ({ ...prev, [`${task.id}-cal`]: 'error' }));
          return;
        }
      }

      // Map GoalTask to virtual CalendarEvent
      const virtualEvent = {
        id: task.id,
        userId: task.userId,
        title: `${goal.title}: ${task.title}`,
        description: task.notes || `Roadmap task for goal: ${goal.title}.\nPriority: ${task.priority}\nStatus: ${task.status}`,
        type: 'Fixed Task' as const,
        date: task.suggestedDueDate || goal.targetDate || new Date().toISOString().split('T')[0],
        associatedGoalId: task.goalId,
        createdAt: task.createdAt,
        googleEventId: task.googleEventId || null
      };

      const gId = await syncCalendarEventToGoogle(virtualEvent, tokenToUse);
      if (gId) {
        const taskRef = doc(db, "goals", goal.id, "tasks", task.id);
        await updateDoc(taskRef, { googleEventId: gId });
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, googleEventId: gId } : t));
        setTaskSyncStatus(prev => ({ ...prev, [`${task.id}-cal`]: 'success' }));
        setTimeout(() => {
          setTaskSyncStatus(prev => ({ ...prev, [`${task.id}-cal`]: null }));
        }, 3000);
      }
    } catch (err: any) {
      setTaskSyncStatus(prev => ({ ...prev, [`${task.id}-cal`]: 'error' }));
      handleSyncError(err, "Failed to sync task to Google Calendar");
    }
  };

  const handleSyncPhaseTasks = async (phaseId: string, target: 'tasks' | 'calendar') => {
    setPhaseSyncStatus(prev => ({ ...prev, [`${phaseId}-${target}`]: 'loading' }));
    try {
      let tokenToUse = googleAccessToken;
      if (!tokenToUse) {
        tokenToUse = await onConnectGoogle();
        if (!tokenToUse) {
          setPhaseSyncStatus(prev => ({ ...prev, [`${phaseId}-${target}`]: null }));
          return;
        }
      }

      const phaseTasks = tasks.filter(t => t.phaseId === phaseId);
      if (phaseTasks.length === 0) {
        alert("No tasks in this phase to sync.");
        setPhaseSyncStatus(prev => ({ ...prev, [`${phaseId}-${target}`]: null }));
        return;
      }

      const updatedTasks = [...tasks];
      let syncCount = 0;

      for (let i = 0; i < updatedTasks.length; i++) {
        const t = updatedTasks[i];
        if (t.phaseId !== phaseId) continue;

        if (target === 'tasks') {
          const gId = await syncTaskToGoogle(t, tokenToUse);
          if (gId) {
            t.googleTaskId = gId;
            const taskRef = doc(db, "goals", goal.id, "tasks", t.id);
            await updateDoc(taskRef, { googleTaskId: gId });
            syncCount++;
          }
        } else if (target === 'calendar') {
          const virtualEvent = {
            id: t.id,
            userId: t.userId,
            title: `${goal.title}: ${t.title}`,
            description: t.notes || `Roadmap task for goal: ${goal.title}.\nPriority: ${t.priority}\nStatus: ${t.status}`,
            type: 'Fixed Task' as const,
            date: t.suggestedDueDate || goal.targetDate || new Date().toISOString().split('T')[0],
            associatedGoalId: t.goalId,
            createdAt: t.createdAt,
            googleEventId: t.googleEventId || null
          };

          const gId = await syncCalendarEventToGoogle(virtualEvent, tokenToUse);
          if (gId) {
            t.googleEventId = gId;
            const taskRef = doc(db, "goals", goal.id, "tasks", t.id);
            await updateDoc(taskRef, { googleEventId: gId });
            syncCount++;
          }
        }
      }

      setTasks(updatedTasks);
      setPhaseSyncStatus(prev => ({ ...prev, [`${phaseId}-${target}`]: 'success' }));
      setTimeout(() => {
        setPhaseSyncStatus(prev => ({ ...prev, [`${phaseId}-${target}`]: null }));
      }, 3500);

      alert(`Successfully synced ${syncCount} tasks to Google ${target === 'tasks' ? 'Tasks' : 'Calendar'}!`);
    } catch (err: any) {
      setPhaseSyncStatus(prev => ({ ...prev, [`${phaseId}-${target}`]: null }));
      handleSyncError(err, `Failed to sync phase tasks to Google ${target}`);
    }
  };

  const handleSyncAllTasksToGoogle = async () => {
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
      handleSyncError(err, "Sync failed");
      setTaskSyncMsg("Sync failed. Google session may have expired.");
      setTimeout(() => setTaskSyncMsg(null), 4000);
    } finally {
      setSyncingTasks(false);
    }
  };

  const handleSyncAllTasksToGoogleCalendar = async () => {
    if (!googleAccessToken) {
      try {
        const token = await onConnectGoogle();
        if (!token) return;
      } catch (err: any) {
        alert("Failed to connect Google account: " + err.message);
        return;
      }
    }

    setSyncingTasksCal(true);
    setTaskCalSyncMsg("Syncing roadmap tasks with Google Calendar...");
    try {
      const tokenToUse = googleAccessToken || (await onConnectGoogle());
      if (!tokenToUse) throw new Error("Could not acquire Google access token");

      let count = 0;
      const updatedTasks = [...tasks];
      for (let i = 0; i < updatedTasks.length; i++) {
        const t = updatedTasks[i];
        if (!t.googleEventId) {
          const virtualEvent = {
            id: t.id,
            userId: t.userId,
            title: `${goal.title}: ${t.title}`,
            description: t.notes || `Roadmap task for goal: ${goal.title}.\nPriority: ${t.priority}\nStatus: ${t.status}`,
            type: 'Fixed Task' as const,
            date: t.suggestedDueDate || goal.targetDate || new Date().toISOString().split('T')[0],
            associatedGoalId: t.goalId,
            createdAt: t.createdAt,
            googleEventId: null
          };

          const gId = await syncCalendarEventToGoogle(virtualEvent, tokenToUse);
          if (gId) {
            t.googleEventId = gId;
            const taskRef = doc(db, "goals", goal.id, "tasks", t.id);
            await updateDoc(taskRef, { googleEventId: gId });
            count++;
          }
        }
      }
      setTasks(updatedTasks);
      setTaskCalSyncMsg(`Successfully synced ${count} tasks to Google Calendar!`);
      setTimeout(() => setTaskCalSyncMsg(null), 4000);
    } catch (err: any) {
      handleSyncError(err, "Calendar sync failed");
      setTaskCalSyncMsg("Calendar sync failed. Google session may have expired.");
      setTimeout(() => setTaskCalSyncMsg(null), 4000);
    } finally {
      setSyncingTasksCal(false);
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
  const progressPercentage = totalTaskCount > 0 ? Math.round((completedTaskCount / totalTaskCount) * 100) : 0;

  return (
    <div className="space-y-6 text-theme-text-main">
      {/* Detail Header & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 border-b border-theme-border-subtle pb-6">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-theme-bg-card-hover border border-theme-border-main rounded-xl transition text-theme-text-muted hover:text-theme-text-main shrink-0 mt-1 cursor-pointer"
            title="Go back to portfolio"
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
                    ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30"
                    : currentGoal.priority === "Medium"
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30"
                    : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30"
                }`}
              >
                {currentGoal.priority} Priority
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-theme-text-main font-display mt-2 leading-tight">
              {currentGoal.title}
            </h1>
            {currentGoal.description && (
              <p className="text-sm text-theme-text-muted mt-2 max-w-2xl leading-relaxed">
                {currentGoal.description}
              </p>
            )}
          </div>
        </div>

        {/* Goal Meta Widgets (Status & Confidence) */}
        <div className="flex flex-col sm:flex-row gap-4 shrink-0 bg-theme-bg-card-hover/40 border border-theme-border-main rounded-2xl p-4 md:self-start shadow-xs">
          {/* Status Select */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">Goal Progress State</span>
            <div className="flex gap-1 bg-theme-bg-card p-1 rounded-xl border border-theme-border-main/50">
              <button
                onClick={() => handleUpdateStatus("active")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  status === "active"
                    ? "bg-theme-bg-accent text-theme-text-accent shadow-2xs font-bold"
                    : "text-theme-text-muted hover:text-theme-text-main"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => handleUpdateStatus("completed")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  status === "completed"
                    ? "bg-theme-bg-accent text-theme-text-accent shadow-2xs font-bold"
                    : "text-theme-text-muted hover:text-theme-text-main"
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Confidence Picker */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">My Confidence Score</span>
            <div className="flex items-center gap-1.5">
              {confidenceOptions.map((opt) => (
                <button
                  key={opt.score}
                  onClick={() => handleUpdateConfidence(opt.score)}
                  title={opt.label}
                  className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold transition-all transform active:scale-90 border cursor-pointer ${
                    confidenceScore === opt.score
                      ? "bg-theme-bg-accent text-theme-text-accent border-theme-bg-accent scale-105 shadow-xs"
                      : "bg-theme-bg-card text-theme-text-muted border-theme-border-main hover:border-theme-text-main"
                  }`}
                >
                  {opt.score}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Goal Summary Statistics - Streamlined & Focused 2-Column Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Progress percent block */}
        <div className="bg-theme-bg-card border border-theme-border-main rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-theme-text-muted">Progress Completed</span>
              <span className="text-xl font-bold font-mono text-theme-text-main">
                {progressPercentage}%
              </span>
            </div>
            
            {/* Timeline Progress Bar with Notch Indicators at 25%, 50%, and 75% */}
            <div className="w-full bg-theme-bg-card-hover h-2 rounded-full relative mt-3 mb-4 overflow-visible">
              <div
                className="bg-theme-bg-accent h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              ></div>

              {/* 25% Notch */}
              <div 
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full border-2 transition-all duration-300 flex items-center justify-center ${
                  progressPercentage >= 25 
                    ? "bg-amber-500 border-amber-600 dark:border-amber-400 scale-110 shadow-xs" 
                    : "bg-theme-bg-card border-theme-border-main"
                }`}
                style={{ left: '25%' }}
                title="25% Milestone"
              >
                <div className={`h-1 w-1 rounded-full ${progressPercentage >= 25 ? "bg-white" : "bg-theme-text-muted/50"}`} />
              </div>

              {/* 50% Notch */}
              <div 
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full border-2 transition-all duration-300 flex items-center justify-center ${
                  progressPercentage >= 50 
                    ? "bg-neutral-500 border-neutral-600 dark:border-neutral-400 scale-110 shadow-xs" 
                    : "bg-theme-bg-card border-theme-border-main"
                }`}
                style={{ left: '50%' }}
                title="50% Milestone"
              >
                <div className={`h-1 w-1 rounded-full ${progressPercentage >= 50 ? "bg-white" : "bg-theme-text-muted/50"}`} />
              </div>

              {/* 75% Notch */}
              <div 
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full border-2 transition-all duration-300 flex items-center justify-center ${
                  progressPercentage >= 75 
                    ? "bg-beige-500 border-beige-600 scale-110 shadow-xs" 
                    : "bg-theme-bg-card border-theme-border-main"
                }`}
                style={{ left: '75%' }}
                title="75% Milestone"
              >
                <div className={`h-1 w-1 rounded-full ${progressPercentage >= 75 ? "bg-white" : "bg-theme-text-muted/50"}`} />
              </div>
            </div>

            <div className="text-[10px] font-mono text-theme-text-muted-mono mt-4">
              Completed {completedTaskCount} of {totalTaskCount} total roadmap deliverables
            </div>
          </div>

          {/* Granular Milestone Badges / Mini-Trophies Section */}
          <div className="mt-4 pt-4 border-t border-theme-border-main/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider flex items-center gap-1">
                <Trophy className="h-3 w-3 text-beige-500" />
                Completion Milestones
              </span>
              <span className="text-[10px] font-mono font-bold text-theme-text-muted">
                {progressPercentage >= 75 ? "3/3 Unlocked" : progressPercentage >= 50 ? "2/3 Unlocked" : progressPercentage >= 25 ? "1/3 Unlocked" : "0/3 Unlocked"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* 25% - Initiator */}
              <div 
                className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-300 relative group cursor-help ${
                  progressPercentage >= 25
                    ? "bg-amber-500/5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:scale-105"
                    : "bg-theme-bg-card-hover border-theme-border-subtle opacity-40 hover:opacity-60"
                }`}
                title={
                  progressPercentage >= 25 
                    ? "25% Completed: Initiator Badge unlocked!" 
                    : `Locked: Complete 25% of roadmap deliverables (${Math.max(1, Math.ceil(totalTaskCount * 0.25))} tasks required)`
                }
              >
                <div className={`p-1.5 rounded-lg mb-1 transition-transform group-hover:scale-110 ${
                  progressPercentage >= 25 
                    ? "bg-amber-500/10 text-amber-500" 
                    : "bg-neutral-500/10 text-neutral-400"
                }`}>
                  <Award className="h-4 w-4" />
                </div>
                <span className="text-[9px] font-bold font-mono">25%</span>
                <span className="text-[8px] font-medium leading-tight text-theme-text-muted mt-0.5 line-clamp-1">Initiator</span>
                {progressPercentage >= 25 && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                )}
              </div>

              {/* 50% - Halftime */}
              <div 
                className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-300 relative group cursor-help ${
                  progressPercentage >= 50
                    ? "bg-neutral-500/10 border-neutral-500/30 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-500/15 hover:scale-105"
                    : "bg-theme-bg-card-hover border-theme-border-subtle opacity-40 hover:opacity-60"
                }`}
                title={
                  progressPercentage >= 50 
                    ? "50% Completed: Halftime Badge unlocked!" 
                    : `Locked: Complete 50% of roadmap deliverables (${Math.max(1, Math.ceil(totalTaskCount * 0.5))} tasks required)`
                }
              >
                <div className={`p-1.5 rounded-lg mb-1 transition-transform group-hover:scale-110 ${
                  progressPercentage >= 50 
                    ? "bg-neutral-500/20 text-neutral-500 dark:text-neutral-300" 
                    : "bg-neutral-500/10 text-neutral-400"
                }`}>
                  <Medal className="h-4 w-4" />
                </div>
                <span className="text-[9px] font-bold font-mono">50%</span>
                <span className="text-[8px] font-medium leading-tight text-theme-text-muted mt-0.5 line-clamp-1">Halftime</span>
                {progressPercentage >= 50 && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-500"></span>
                  </span>
                )}
              </div>

              {/* 75% - Striver */}
              <div 
                className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-300 relative group cursor-help ${
                  progressPercentage >= 75
                    ? "bg-beige-500/10 border-beige-500/30 text-beige-500 hover:bg-beige-500/15 hover:scale-105"
                    : "bg-theme-bg-card-hover border-theme-border-subtle opacity-40 hover:opacity-60"
                }`}
                title={
                  progressPercentage >= 75 
                    ? "75% Completed: Elite Striver Badge unlocked!" 
                    : `Locked: Complete 75% of roadmap deliverables (${Math.max(1, Math.ceil(totalTaskCount * 0.75))} tasks required)`
                }
              >
                <div className={`p-1.5 rounded-lg mb-1 transition-transform group-hover:scale-110 ${
                  progressPercentage >= 75 
                    ? "bg-beige-500/20 text-beige-500" 
                    : "bg-neutral-500/10 text-neutral-400"
                }`}>
                  <Trophy className="h-4 w-4" />
                </div>
                <span className="text-[9px] font-bold font-mono">75%</span>
                <span className="text-[8px] font-medium leading-tight text-theme-text-muted mt-0.5 line-clamp-1">Striver</span>
                {progressPercentage >= 75 && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-beige-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-beige-500"></span>
                  </span>
                )}
              </div>
            </div>

            {/* Motivational Coaching Feedback */}
            <div className="bg-theme-bg-card-hover/50 border border-theme-border-main/40 rounded-xl p-2.5 text-[10px] font-medium text-theme-text-main flex items-center gap-2 transition-all duration-300">
              <span className="text-xs">
                {progressPercentage >= 100 ? "👑" : progressPercentage >= 75 ? "🚀" : progressPercentage >= 50 ? "🔥" : progressPercentage >= 25 ? "🎉" : "💡"}
              </span>
              <p className="leading-snug">
                {progressPercentage >= 100 
                  ? "Pure Gold! 100% Goal Completed. Summon your AI Victory Tribute in the Trophy Room!"
                  : progressPercentage >= 75 
                  ? "Phenomenal! 75% Elite Striver Milestone crossed. Just one final push left!"
                  : progressPercentage >= 50 
                  ? "Incredible! 50% Halftime Milestone reached. You're halfway to success!"
                  : progressPercentage >= 25 
                  ? "Awesome! 25% Initiator Milestone unlocked. Keep building momentum!"
                  : "Complete your first few deliverables to unlock the 25% Initiator Badge!"
                }
              </p>
            </div>
          </div>
        </div>

        {/* Deadline block */}
        <div className="bg-theme-bg-card border border-theme-border-main rounded-2xl p-5 flex items-center gap-4 shadow-xs">
          <div className="h-11 w-11 bg-theme-bg-card-hover border border-theme-border-subtle rounded-xl flex items-center justify-center text-theme-text-muted shrink-0">
            <Calendar className="h-5 w-5 text-theme-text-muted" />
          </div>
          <div>
            <span className="text-xs font-bold text-theme-text-muted block">Target Completion Date</span>
            <span className="text-base font-bold font-mono text-theme-text-main block mt-0.5">
              {currentGoal.targetDate || "No Deadline"}
            </span>
            <span className="text-[10px] font-mono text-theme-text-muted-mono block mt-1">
              {!currentGoal.targetDate ? "Flexible timeline" : (new Date(currentGoal.targetDate) < new Date() ? "Expired" : "Targeting future delivery")}
            </span>
          </div>
        </div>
      </div>

      {/* Balance Notes / Warnings (if any exists) - Redesigned for Exceptional Visibility & Theme Integration */}
      {(currentGoal.balanceNote || currentGoal.conflictWarning || currentGoal.timelineWarning) && (
        <div className="space-y-3">
          {currentGoal.balanceNote && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-150 dark:border-blue-900/25 rounded-2xl p-4 flex items-start gap-3 text-xs shadow-3xs">
              <span className="text-base leading-none select-none">💡</span>
              <div className="space-y-1">
                <span className="font-bold text-blue-900 dark:text-blue-300">Workload Fit Advisory</span>
                <p className="text-blue-800 dark:text-blue-200/95 leading-relaxed">{currentGoal.balanceNote}</p>
              </div>
            </div>
          )}
          {currentGoal.conflictWarning && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-150 dark:border-amber-900/25 rounded-2xl p-4 flex items-start gap-3 text-xs shadow-3xs">
              <span className="text-base leading-none select-none">⚠️</span>
              <div className="space-y-1">
                <span className="font-bold text-amber-900 dark:text-amber-300">Overload Alert</span>
                <p className="text-amber-800 dark:text-amber-200/95 leading-relaxed">{currentGoal.conflictWarning}</p>
              </div>
            </div>
          )}
          {currentGoal.timelineWarning && (
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-150 dark:border-orange-900/25 rounded-2xl p-4 flex items-start gap-3 text-xs shadow-3xs">
              <span className="text-base leading-none select-none">⏳</span>
              <div className="space-y-1">
                <span className="font-bold text-orange-900 dark:text-orange-300">Timeline Analysis</span>
                <p className="text-orange-800 dark:text-orange-200/95 leading-relaxed">{currentGoal.timelineWarning}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs Navigation - High-Contrast and Spacious */}
      <div className="border-b border-theme-border-main mt-4">
        <nav className="flex space-x-6 overflow-x-auto">
          {[
            { id: "roadmap", label: "Structured Roadmap" },
            { id: "chat", label: `COMPASS Coach Chat (${chats.length})` },
            { id: "resources", label: "Recommended Resources" },
            { id: "checkins", label: "Daily Coach Check-ins" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
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
            <div className="bg-theme-bg-panel border border-theme-border-main rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-theme-text-main flex items-center gap-1.5">
                  <RefreshCw className="h-4 w-4 text-theme-text-muted animate-spin-slow" />
                  Google Integration & Sync Center
                </h4>
                <p className="text-[11px] text-theme-text-muted leading-normal">
                  Sync your learning roadmap and execution milestones directly to Google Calendar and Google Tasks.
                </p>
                {!googleAccessToken && (
                  <p className="text-[10px] text-amber-500 font-medium">
                    ⚠️ Google Account not connected. Click a sync button to connect your account.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {taskSyncMsg ? (
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-xl border border-emerald-150 animate-pulse">
                    {taskSyncMsg}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSyncAllTasksToGoogle}
                    disabled={syncingTasks}
                    className="py-1.5 px-3 bg-theme-bg-accent hover:bg-theme-bg-accent-hover text-theme-text-accent rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {syncingTasks ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListTodo className="h-3.5 w-3.5" />}
                    <span>Sync Roadmap to Tasks</span>
                  </button>
                )}

                {taskCalSyncMsg ? (
                  <span className="text-[11px] text-blue-800 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/20 px-2.5 py-1 rounded-xl border border-blue-150 animate-pulse">
                    {taskCalSyncMsg}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSyncAllTasksToGoogleCalendar}
                    disabled={syncingTasksCal}
                    className="py-1.5 px-3 bg-theme-bg-accent hover:bg-theme-bg-accent-hover text-theme-text-accent rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {syncingTasksCal ? <Loader2 className="h-3 w-3 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
                    <span>Sync Roadmap to Calendar</span>
                  </button>
                )}
              </div>
            </div>

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
                      <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                        <div className="text-xs font-mono font-medium text-theme-text-muted">
                          {phase.estimatedDuration || "Flexible Schedule"}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSyncPhaseTasks(phase.id, "tasks")}
                            disabled={phaseSyncStatus[`${phase.id}-tasks`] === "loading"}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-theme-border-subtle bg-theme-bg-panel hover:bg-theme-bg-card-hover text-[10px] font-bold text-theme-text-main transition cursor-pointer"
                            title="Sync all tasks in this phase to Google Tasks"
                          >
                            {phaseSyncStatus[`${phase.id}-tasks`] === "loading" ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : phaseSyncStatus[`${phase.id}-tasks`] === "success" ? (
                              <Check className="h-2.5 w-2.5 text-emerald-500" />
                            ) : (
                              <ListTodo className="h-2.5 w-2.5 text-theme-text-muted" />
                            )}
                            <span>+ Tasks</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleSyncPhaseTasks(phase.id, "calendar")}
                            disabled={phaseSyncStatus[`${phase.id}-calendar`] === "loading"}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-theme-border-subtle bg-theme-bg-panel hover:bg-theme-bg-card-hover text-[10px] font-bold text-theme-text-main transition cursor-pointer"
                            title="Sync all tasks in this phase to Google Calendar"
                          >
                            {phaseSyncStatus[`${phase.id}-calendar`] === "loading" ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : phaseSyncStatus[`${phase.id}-calendar`] === "success" ? (
                              <Check className="h-2.5 w-2.5 text-emerald-500" />
                            ) : (
                              <Calendar className="h-2.5 w-2.5 text-theme-text-muted" />
                            )}
                            <span>+ Calendar</span>
                          </button>
                        </div>
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
                                  <div className="flex-1 space-y-3 bg-theme-bg-card-hover p-3 rounded-xl border border-theme-border-main">
                                    <div>
                                      <label className="text-[10px] font-bold uppercase text-theme-text-muted mb-1 block">Task Title</label>
                                      <input
                                        type="text"
                                        className="w-full text-xs font-medium border border-theme-border-main rounded-lg px-2.5 py-1.5 bg-theme-bg-card text-theme-text-main"
                                        value={editingTaskTitle}
                                        onChange={(e) => setEditingTaskTitle(e.target.value)}
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="text-[10px] font-bold uppercase text-theme-text-muted mb-1 block">Task Notes (Voice or Typed)</label>
                                      <textarea
                                        rows={2}
                                        placeholder="Add task details, notes, or record brief voice notes..."
                                        className="w-full text-xs border border-theme-border-main rounded-lg px-2.5 py-1.5 bg-theme-bg-card text-theme-text-main focus:outline-none focus:border-theme-bg-accent font-sans"
                                        value={editingTaskNotes}
                                        onChange={(e) => setEditingTaskNotes(e.target.value)}
                                      />
                                    </div>

                                    {/* Mic recording widget when inside edit mode */}
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isRecording && recordingTaskId === task.id) {
                                              stopRecording();
                                              if (recordingTranscript) {
                                                setEditingTaskNotes(prev => prev ? prev + "\n" + recordingTranscript : recordingTranscript);
                                              }
                                              setRecordingTaskId(null);
                                            } else {
                                              startRecording(task.id);
                                            }
                                          }}
                                          className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                                            isRecording && recordingTaskId === task.id
                                              ? "bg-red-500 hover:bg-red-600 text-white border-red-500 animate-pulse"
                                              : "bg-theme-bg-card hover:bg-theme-bg-card-hover text-theme-text-main border-theme-border-main"
                                          }`}
                                        >
                                          {isRecording && recordingTaskId === task.id ? (
                                            <>
                                              <MicOff className="h-3.5 w-3.5" />
                                              <span>Stop Recording</span>
                                            </>
                                          ) : (
                                            <>
                                              <Mic className="h-3.5 w-3.5" />
                                              <span>Record Voice Note</span>
                                            </>
                                          )}
                                        </button>
                                        
                                        {isRecording && recordingTaskId === task.id && (
                                          <span className="text-[10px] text-red-500 font-semibold animate-pulse">
                                            🎙️ Listening...
                                          </span>
                                        )}
                                      </div>

                                      {isRecording && recordingTaskId === task.id && (
                                        <div className="bg-theme-bg-card border border-theme-border-subtle p-2 rounded-lg text-[11px] text-theme-text-main italic min-h-[1.5rem]">
                                          {recordingTranscript || "Start speaking. The microphone is active..."}
                                        </div>
                                      )}

                                      {speechError && recordingTaskId === task.id && (
                                        <div className="text-[10px] text-red-500 font-semibold">
                                          ⚠️ {speechError}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-theme-border-subtle">
                                      <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-bold uppercase text-theme-text-muted">Priority:</label>
                                        <select
                                          className="text-[10px] font-bold uppercase rounded border border-theme-border-main bg-theme-bg-card text-theme-text-main px-2 py-1"
                                          value={editingTaskPriority}
                                          onChange={(e) => setEditingTaskPriority(e.target.value as any)}
                                        >
                                          <option value="High">High</option>
                                          <option value="Medium">Medium</option>
                                          <option value="Low">Low</option>
                                        </select>
                                      </div>
                                      
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setEditingTaskId(null)}
                                          className="px-3 py-1.5 text-xs font-bold text-theme-text-muted hover:text-theme-text-main"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveEditTask(task.id)}
                                          className="px-3.5 py-1.5 text-xs font-bold bg-theme-bg-accent text-theme-text-accent rounded-lg hover:bg-theme-bg-accent-hover"
                                        >
                                          Save Changes
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="min-w-0 flex-1">
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
                                      <span className="text-[11px] text-theme-text-muted block mt-0.5 whitespace-pre-wrap">
                                        {task.notes}
                                      </span>
                                    )}

                                    {/* Inline recording widget for direct voice notes outside edit mode */}
                                    {isRecording && recordingTaskId === task.id && !isEditing && (
                                      <div className="mt-2.5 bg-red-500/5 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 rounded-xl p-3 space-y-2 max-w-lg">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                            <span className="relative flex h-2 w-2">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                            </span>
                                            <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                                              Recording brief voice note...
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              stopRecording();
                                              setRecordingTaskId(null);
                                            }}
                                            className="text-[10px] font-bold text-theme-text-muted hover:text-theme-text-main"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                        
                                        <div className="bg-theme-bg-card border border-theme-border-subtle p-2.5 rounded-lg text-[11px] italic min-h-[2rem] text-theme-text-main leading-relaxed">
                                          {recordingTranscript || "Speak clearly now... Web Speech API is capturing your audio."}
                                        </div>

                                        {recordingTranscript && (
                                          <div className="flex justify-end gap-1.5 pt-1">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                stopRecording();
                                                handleSaveDirectVoiceNote(task.id, recordingTranscript, "overwrite");
                                                setRecordingTaskId(null);
                                              }}
                                              className="px-2.5 py-1 text-[10px] font-bold bg-theme-bg-panel hover:bg-theme-bg-card-hover text-theme-text-main border border-theme-border-main rounded"
                                            >
                                              Overwrite Note
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                stopRecording();
                                                handleSaveDirectVoiceNote(task.id, recordingTranscript, "append");
                                                setRecordingTaskId(null);
                                              }}
                                              className="px-2.5 py-1 text-[10px] font-bold bg-theme-bg-accent text-theme-text-accent rounded hover:bg-theme-bg-accent-hover"
                                            >
                                              Save & Append
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {speechError && recordingTaskId === task.id && !isEditing && (
                                      <div className="mt-2 text-xs text-red-500 font-semibold bg-red-500/5 border border-red-200 dark:border-red-900/30 rounded-lg p-2 max-w-lg">
                                        ⚠️ {speechError}
                                      </div>
                                    )}

                                    <div className="flex items-center gap-2.5 flex-wrap mt-1.5">
                                      {task.suggestedDueDate && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-theme-text-muted-mono">
                                          <Calendar className="h-3 w-3" /> Due {task.suggestedDueDate}
                                        </span>
                                      )}
                                      
                                      {/* Google Tasks Sync Indicator / Button */}
                                      {task.googleTaskId ? (
                                        <button
                                          type="button"
                                          onClick={() => handleSyncTaskToGoogleTasks(task)}
                                          disabled={taskSyncStatus[`${task.id}-tasks`] === 'loading'}
                                          className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-150/40 hover:border-emerald-400 transition cursor-pointer"
                                          title="Resync this task to Google Tasks"
                                        >
                                          {taskSyncStatus[`${task.id}-tasks`] === 'loading' ? (
                                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                          ) : (
                                            <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                                          )}
                                          <span>Google Tasks</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleSyncTaskToGoogleTasks(task)}
                                          disabled={taskSyncStatus[`${task.id}-tasks`] === 'loading'}
                                          className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-theme-text-muted hover:text-theme-text-main bg-theme-bg-panel border border-theme-border-subtle hover:border-theme-border-main px-1.5 py-0.5 rounded transition cursor-pointer"
                                          title="Sync this task to Google Tasks"
                                        >
                                          {taskSyncStatus[`${task.id}-tasks`] === 'loading' ? (
                                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                          ) : (
                                            <ListTodo className="h-2.5 w-2.5 text-theme-text-muted" />
                                          )}
                                          <span>+ Google Tasks</span>
                                        </button>
                                      )}

                                      {/* Google Calendar Sync Indicator / Button */}
                                      {task.googleEventId ? (
                                        <button
                                          type="button"
                                          onClick={() => handleSyncTaskToGoogleCalendar(task)}
                                          disabled={taskSyncStatus[`${task.id}-cal`] === 'loading'}
                                          className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded border border-blue-150/40 hover:border-blue-400 transition cursor-pointer"
                                          title="Resync this task to Google Calendar"
                                        >
                                          {taskSyncStatus[`${task.id}-cal`] === 'loading' ? (
                                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                          ) : (
                                            <Check className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                                          )}
                                          <span>Google Cal</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleSyncTaskToGoogleCalendar(task)}
                                          disabled={taskSyncStatus[`${task.id}-cal`] === 'loading'}
                                          className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-theme-text-muted hover:text-theme-text-main bg-theme-bg-panel border border-theme-border-subtle hover:border-theme-border-main px-1.5 py-0.5 rounded transition cursor-pointer"
                                          title="Sync this task to Google Calendar"
                                        >
                                          {taskSyncStatus[`${task.id}-cal`] === 'loading' ? (
                                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                          ) : (
                                            <Calendar className="h-2.5 w-2.5 text-theme-text-muted" />
                                          )}
                                          <span>+ Google Cal</span>
                                        </button>
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
                                      if (isRecording && recordingTaskId === task.id) {
                                        stopRecording();
                                        if (recordingTranscript) {
                                          handleSaveDirectVoiceNote(task.id, recordingTranscript, "append");
                                        }
                                        setRecordingTaskId(null);
                                      } else {
                                        startRecording(task.id);
                                      }
                                    }}
                                    className={`p-1 hover:bg-theme-bg-card-hover rounded-lg transition-all cursor-pointer ${
                                      isRecording && recordingTaskId === task.id
                                        ? "text-red-500 bg-red-500/10 animate-pulse scale-110 font-bold"
                                        : "text-theme-text-muted hover:text-theme-text-main"
                                    }`}
                                    title={isRecording && recordingTaskId === task.id ? "Stop recording and append" : "Quick record audio note"}
                                  >
                                    {isRecording && recordingTaskId === task.id ? (
                                      <MicOff className="h-3.5 w-3.5 text-red-500" />
                                    ) : (
                                      <Mic className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingTaskId(task.id);
                                      setEditingTaskTitle(task.title);
                                      setEditingTaskPriority(task.priority);
                                      setEditingTaskNotes(task.notes || "");
                                    }}
                                    className="p-1 hover:bg-theme-bg-card-hover rounded-lg text-theme-text-muted hover:text-theme-text-main cursor-pointer"
                                    title="Edit action item"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="p-1 hover:bg-theme-bg-card-hover rounded-lg text-theme-text-muted hover:text-red-500 cursor-pointer"
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
                  I have analyzed your roadmap progress for <strong>"{currentGoal.title}"</strong>. Our records indicate your current progress sits at <strong>{progressPercentage}% complete</strong> with a <strong>{confidenceOptions.find(o => o.score === confidenceScore)?.label}</strong> confidence index.
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
                            <Award className="h-3 w-3" />
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
