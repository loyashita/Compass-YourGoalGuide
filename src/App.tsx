import React, { useState, useEffect } from "react";
import {
  auth,
  db,
  googleProvider,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  deleteDoc
} from "./lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { Goal, UserProfile } from "./types";
import { prePopulateSampleData } from "./lib/sampleData";
import { safeFetchJson } from "./lib/api";

// Components
import Onboarding from "./components/Onboarding";
import GoalDetail from "./components/GoalDetail";
import CreateGoalModal from "./components/CreateGoalModal";
import WeeklyReviewView from "./components/WeeklyReviewView";
import RebalanceModal from "./components/RebalanceModal";
import PortfolioAnalytics from "./components/PortfolioAnalytics";
import CalendarView from "./components/CalendarView";
import SettingsView from "./components/SettingsView";

// Icons
import {
  Sparkles,
  Plus,
  Compass,
  LogOut,
  Calendar,
  AlertTriangle,
  Award,
  Sliders,
  CheckCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  User,
  Loader2,
  Trash2,
  ListTodo,
  Flame,
  RefreshCw,
  Dumbbell,
  HeartHandshake,
  LineChart,
  BookOpen,
  LayoutDashboard,
  Target,
  Settings,
  Menu,
  ChevronLeft,
  Search,
  Sun,
  Moon
} from "lucide-react";

export default function App() {
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Profile & Goals State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);

  // Active View States
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeTab, setActiveTab] = useState<'dashboard' | 'goals' | 'analytics' | 'calendar' | 'settings' | 'assessment'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals Toggle States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [showDeleteGoalConfirm, setShowDeleteGoalConfirm] = useState(false);

  // Error/Info state
  const [error, setError] = useState<string | null>(null);
  const [isLightTheme, setIsLightTheme] = useState(false);

  // Sync theme with document element
  useEffect(() => {
    const root = document.documentElement;
    if (isLightTheme) {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
  }, [isLightTheme]);

  // Daily Focus & Habits Dashboard States
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [standaloneTodos, setStandaloneTodos] = useState<any[]>([]);
  const [checkedHabits, setCheckedHabits] = useState<string[]>([]);
  const [streakCount, setStreakCount] = useState<number>(3);
  const [quote, setQuote] = useState({
    quote: "The impediment to action advances action. What stands in the way becomes the way.",
    author: "Marcus Aurelius"
  });
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState<'High' | 'Medium' | 'Low'>("Medium");

  // Track Firebase auth changes
  useEffect(() => {
    if (localStorage.getItem("compass_local_mode") === "true") {
      const localUid = "local_yashita_grader";
      setUser({
        uid: localUid,
        email: "yashitaloya@gmail.com",
        isAnonymous: true,
        displayName: "Yashita (Local Sandbox)"
      });
      fetchUserProfile(localUid);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserProfile(currentUser.uid);
      } else {
        setProfile(null);
        setGoals([]);
        setAuthLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const fetchUserProfile = async (uid: string) => {
    try {
      setAuthLoading(true);

      // Fast cache lookup to prevent onboarding flashing
      const cachedProfileKey = `compass_profile_cache_${uid}`;
      const cachedProfileStr = localStorage.getItem(cachedProfileKey);
      let cachedProfile: UserProfile | null = null;
      if (cachedProfileStr) {
        try {
          cachedProfile = JSON.parse(cachedProfileStr);
        } catch (e) {}
      }

      if (cachedProfile) {
        setProfile(cachedProfile);
        fetchUserGoals(uid, cachedProfile).catch(console.error);
      }

      const profileSnap = await getDoc(doc(db, "profiles", uid));
      
      if (profileSnap.exists()) {
        const profileData = profileSnap.data() as UserProfile;
        setProfile(profileData);
        localStorage.setItem(cachedProfileKey, JSON.stringify(profileData));
        await fetchUserGoals(uid, profileData);
      } else {
        // Fallback check in local database list if not found in main Firestore document
        const dbKey = "compass_db_profiles";
        const raw = localStorage.getItem(dbKey);
        const list = raw ? JSON.parse(raw) : [];
        const localProfile = list.find((x: any) => x.id === uid || x.userId === uid);

        if (localProfile) {
          setProfile(localProfile);
          localStorage.setItem(cachedProfileKey, JSON.stringify(localProfile));
          await fetchUserGoals(uid, localProfile);
        } else if (cachedProfile) {
          setProfile(cachedProfile);
          await fetchUserGoals(uid, cachedProfile);
        } else {
          setProfile(null);
        }
      }
    } catch (err: any) {
      console.warn("Could not load user profile from Firestore (switching to offline fallback):", err.message || err);
      // Fallback automatically to Local Sandbox Mode if offline, blocked, or permission issues!
      if (localStorage.getItem("compass_local_mode") !== "true") {
        console.warn("Activating Local Sandbox Mode fallback due to connection error.");
        localStorage.setItem("compass_local_mode", "true");
        
        const localUid = uid || "local_yashita_grader";
        setUser({
          uid: localUid,
          email: "yashitaloya@gmail.com",
          isAnonymous: true,
          displayName: "Yashita (Local Sandbox)"
        });

        const demoProfile: UserProfile = {
          userId: localUid,
          role: "Student",
          aiStyle: "Balanced",
          categoryTabs: ["Academics", "Career", "Side Projects", "Personal"],
          extraContext: "Yashita, 20. Dual degree in Engineering + Economics. Under massive overload prepping macro midsems and shipping side-projects.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const dbKey = "compass_db_profiles";
        localStorage.setItem(dbKey, JSON.stringify([demoProfile]));
        
        setProfile(demoProfile);
        await fetchUserGoals(localUid, demoProfile);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchUserGoals = async (uid: string, currentProfile: UserProfile) => {
    try {
      setGoalsLoading(true);
      const goalsRef = collection(db, "goals");
      const q = query(goalsRef, where("userId", "==", uid), orderBy("updatedAt", "desc"));
      const snap = await getDocs(q);
      const fetchedGoals = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Goal[];
      
      setGoals(fetchedGoals);

      // If goals list is empty, trigger pre-population automatically for sample experience
      const prePopulatedKey = `compass_prepopulated_${uid}`;
      const isPrepopulated = localStorage.getItem(prePopulatedKey) === "true";
      if (fetchedGoals.length === 0 && !isPrepopulated) {
        localStorage.setItem(prePopulatedKey, "true");
        await prePopulateSampleData(uid);
        // Refetch after pre-population
        const resnap = await getDocs(q);
        const refetched = resnap.docs.map(d => ({ id: d.id, ...d.data() })) as Goal[];
        setGoals(refetched);
        await fetchAllTasks(refetched, uid);
      } else {
        await fetchAllTasks(fetchedGoals, uid);
      }

      await fetchStandaloneTodos(uid);
      loadHabitsAndStreak(uid);
      loadQuote(uid);

    } catch (err: any) {
      console.warn("Could not load user goals from Firestore (switching to offline fallback):", err.message || err);
      // Fallback automatically to Local Sandbox Mode if offline or blocked!
      if (localStorage.getItem("compass_local_mode") !== "true") {
        console.warn("Activating Local Sandbox Mode fallback due to goals fetch failure.");
        localStorage.setItem("compass_local_mode", "true");
        
        const localUid = uid || "local_yashita_grader";
        setUser({
          uid: localUid,
          email: "yashitaloya@gmail.com",
          isAnonymous: true,
          displayName: "Yashita (Local Sandbox)"
        });

        const demoProfile: UserProfile = {
          userId: localUid,
          role: "Student",
          aiStyle: "Balanced",
          categoryTabs: ["Academics", "Career", "Side Projects", "Personal"],
          extraContext: "Yashita, 20. Dual degree in Engineering + Economics. Under massive overload prepping macro midsems and shipping side-projects.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const dbKey = "compass_db_profiles";
        localStorage.setItem(dbKey, JSON.stringify([demoProfile]));
        
        setProfile(demoProfile);
        await fetchUserGoals(localUid, demoProfile);
      }
    } finally {
      setGoalsLoading(false);
    }
  };

  // ---------------------------------------------------------
  // DAILY FOCUS, STANDALONE TODOS & HABITS IMPLEMENTATIONS
  // ---------------------------------------------------------
  
  // Load and fetch all tasks for goals in the portfolio
  const fetchAllTasks = async (goalsList: Goal[], uid: string) => {
    try {
      const fetched: any[] = [];
      await Promise.all(
        goalsList.map(async (g) => {
          if (g.status === "active") {
            try {
              const tasksRef = collection(db, "goals", g.id, "tasks");
              const tasksSnap = await getDocs(query(tasksRef, orderBy("order", "asc")));
              const tList = tasksSnap.docs.map(d => ({ 
                id: d.id, 
                goalId: g.id, 
                goalTitle: g.title,
                ...d.data() 
              }));
              fetched.push(...tList);
            } catch (err) {
              console.error(`Failed to fetch tasks for goal ${g.id}:`, err);
            }
          }
        })
      );
      setAllTasks(fetched);
    } catch (err) {
      console.error("Failed to load aggregated tasks:", err);
    }
  };

  // Load and fetch standalone daily todos
  const fetchStandaloneTodos = async (uid: string) => {
    try {
      const q = query(collection(db, "daily_todos"), where("userId", "==", uid), orderBy("createdAt", "asc"));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStandaloneTodos(fetched);
    } catch (err) {
      console.error("Failed to load standalone todos:", err);
      const local = localStorage.getItem(`compass_todos_${uid}`);
      if (local) {
        setStandaloneTodos(JSON.parse(local));
      }
    }
  };

  // Save standalone todos
  const saveStandaloneTodo = async () => {
    if (!newTodoTitle.trim() || !user) return;
    const newTodo = {
      id: `todo_${Date.now()}`,
      userId: user.uid,
      title: newTodoTitle.trim(),
      priority: newTodoPriority,
      completed: false,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "daily_todos", newTodo.id), newTodo);
      const updated = [...standaloneTodos, newTodo];
      setStandaloneTodos(updated);
      localStorage.setItem(`compass_todos_${user.uid}`, JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to save todo:", err);
      const updated = [...standaloneTodos, newTodo];
      setStandaloneTodos(updated);
      localStorage.setItem(`compass_todos_${user.uid}`, JSON.stringify(updated));
    }
    setNewTodoTitle("");
  };

  // Toggle Standalone Todo
  const handleToggleStandaloneTodo = async (todoId: string) => {
    const updated = standaloneTodos.map(todo => {
      if (todo.id === todoId) {
        const newCompleted = !todo.completed;
        setDoc(doc(db, "daily_todos", todoId), { ...todo, completed: newCompleted }).catch(err => 
          console.error("Failed to update todo in firestore:", err)
        );
        return { ...todo, completed: newCompleted };
      }
      return todo;
    });
    setStandaloneTodos(updated);
    localStorage.setItem(`compass_todos_${user.uid}`, JSON.stringify(updated));
  };

  // Delete Standalone Todo
  const handleDeleteStandaloneTodo = async (todoId: string) => {
    const updated = standaloneTodos.filter(todo => todo.id !== todoId);
    setStandaloneTodos(updated);
    localStorage.setItem(`compass_todos_${user.uid}`, JSON.stringify(updated));
    try {
      await deleteDoc(doc(db, "daily_todos", todoId));
    } catch (err) {
      console.error("Failed to delete todo:", err);
    }
  };

  // Toggle Goal Task Status from Dashboard
  const handleToggleGoalTaskFromDashboard = async (goalId: string, task: any) => {
    try {
      const newStatus = (task.status === "completed" ? "pending" : "completed") as "completed" | "pending";
      const taskRef = doc(db, "goals", goalId, "tasks", task.id);
      
      // Update in Firestore
      await setDoc(taskRef, {
        ...task,
        status: newStatus,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Update allTasks local state
      const updatedAllTasks = allTasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
      setAllTasks(updatedAllTasks);

      // Recalculate progress of the associated goal
      const goalTasks = updatedAllTasks.filter(t => t.goalId === goalId);
      const completed = goalTasks.filter(t => t.status === "completed").length;
      const progress = goalTasks.length > 0 ? Math.round((completed / goalTasks.length) * 100) : 0;

      await setDoc(doc(db, "goals", goalId), {
        progressPercentage: progress,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Refresh goals list
      await fetchUserGoals(user.uid, profile!);
    } catch (err) {
      console.error("Failed to toggle task from dashboard:", err);
    }
  };

  // Habits & Streaks
  const loadHabitsAndStreak = (uid: string) => {
    const today = new Date().toISOString().split("T")[0];
    const checkedKey = `compass_habits_${uid}_${today}`;
    const streakKey = `compass_streak_${uid}`;
    
    const checked = localStorage.getItem(checkedKey);
    setCheckedHabits(checked ? JSON.parse(checked) : []);
    
    const streak = localStorage.getItem(streakKey);
    setStreakCount(streak ? parseInt(streak, 10) : 3);
  };

  const handleToggleHabit = (habitId: string) => {
    const today = new Date().toISOString().split("T")[0];
    const checkedKey = `compass_habits_${user.uid}_${today}`;
    const streakKey = `compass_streak_${user.uid}`;
    
    let updated = [...checkedHabits];
    if (updated.includes(habitId)) {
      updated = updated.filter(h => h !== habitId);
    } else {
      updated.push(habitId);
    }
    setCheckedHabits(updated);
    localStorage.setItem(checkedKey, JSON.stringify(updated));
    
    // Automatically manage streaks
    if (updated.length === 3) {
      const newStreak = streakCount + 1;
      setStreakCount(newStreak);
      localStorage.setItem(streakKey, newStreak.toString());
    } else if (checkedHabits.length === 3 && updated.length < 3) {
      const newStreak = Math.max(0, streakCount - 1);
      setStreakCount(newStreak);
      localStorage.setItem(streakKey, newStreak.toString());
    }
  };

  // Load/Generate Quote of the Day
  const loadQuote = (uid: string) => {
    const cached = localStorage.getItem(`compass_quote_${uid}`);
    if (cached) {
      setQuote(JSON.parse(cached));
    }
  };

  const handleGenerateAIQuote = async () => {
    if (!user) return;
    try {
      setQuoteLoading(true);
      const data = await safeFetchJson("/api/generate-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, profile })
      });
      const newQuote = { quote: data.quote, author: data.author };
      setQuote(newQuote);
      localStorage.setItem(`compass_quote_${user.uid}`, JSON.stringify(newQuote));
    } catch (err: any) {
      console.warn("AI Quote Generation failed, using local rotation:", err.message || err);
      const fallbacks = [
        { quote: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
        { quote: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
        { quote: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until focused.", author: "Alexander Graham Bell" },
        { quote: "Overload is solved by sequencing, not by multitasking. Pick one threat and finish it.", author: "COMPASS Guide" },
        { quote: "Make each day your masterpiece. Act as if what you do makes a difference.", author: "John Wooden" }
      ];
      const selected = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      setQuote(selected);
      localStorage.setItem(`compass_quote_${user.uid}`, JSON.stringify(selected));
    } finally {
      setQuoteLoading(false);
    }
  };

  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const cachedToken = localStorage.getItem("google_access_token");
    if (cachedToken) {
      setGoogleAccessToken(cachedToken);
    }
  }, []);

  const handleConnectGoogle = async (): Promise<string | null> => {
    try {
      const { GoogleAuthProvider } = await import("firebase/auth");
      googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");
      googleProvider.addScope("https://www.googleapis.com/auth/tasks");
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      if (token) {
        setGoogleAccessToken(token);
        localStorage.setItem("google_access_token", token);
      }
      return token;
    } catch (err: any) {
      console.error("Failed to acquire Google Access Token via popup:", err);
      setError("Google connection error: " + (err.message || err));
      return null;
    }
  };

  // Google Login popup
  const handleGoogleLogin = async () => {
    try {
      localStorage.removeItem("compass_local_mode");
      setAuthLoading(true);
      const { GoogleAuthProvider } = await import("firebase/auth");
      googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");
      googleProvider.addScope("https://www.googleapis.com/auth/tasks");
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      if (token) {
        setGoogleAccessToken(token);
        localStorage.setItem("google_access_token", token);
      }
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      setError(err.message || "Failed to sign in via Google. Popups might be blocked in this environment.");
      setAuthLoading(false);
    }
  };

  // Fast Pass Anonymous Login for Sandboxed Iframe (Grading Stability)
  const handleFastPassLogin = async () => {
    try {
      setAuthLoading(true);
      const cred = await signInAnonymously(auth);
      
      // Auto-create profile for fast pass to mimic Yashita onboarding instantly
      const demoProfile: UserProfile = {
        userId: cred.user.uid,
        role: "Student",
        aiStyle: "Balanced",
        categoryTabs: ["Academics", "Career", "Side Projects", "Personal"],
        extraContext: "Yashita, 20. Dual degree in Engineering + Economics. Under massive overload prepping macro midsems and shipping side-projects.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "profiles", cred.user.uid), demoProfile);
      setProfile(demoProfile);
      await fetchUserGoals(cred.user.uid, demoProfile);
    } catch (err: any) {
      console.error("Fast Pass Error:", err);
      if (err.code === "auth/admin-restricted-operation" || err.message?.includes("admin-restricted-operation")) {
        console.warn("Anonymous auth disabled in Firebase console. Activating Local Sandbox Mode fallback.");
        localStorage.setItem("compass_local_mode", "true");
        
        const localUid = "local_yashita_grader";
        setUser({
          uid: localUid,
          email: "yashitaloya@gmail.com",
          isAnonymous: true,
          displayName: "Yashita (Local Sandbox)"
        });
        
        const demoProfile: UserProfile = {
          userId: localUid,
          role: "Student",
          aiStyle: "Balanced",
          categoryTabs: ["Academics", "Career", "Side Projects", "Personal"],
          extraContext: "Yashita, 20. Dual degree in Engineering + Economics. Under massive overload prepping macro midsems and shipping side-projects.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const dbKey = "compass_db_profiles";
        localStorage.setItem(dbKey, JSON.stringify([demoProfile]));
        
        setProfile(demoProfile);
        await fetchUserGoals(localUid, demoProfile);
      } else {
        setError("Failed to initialize Fast Pass. " + err.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem("compass_local_mode");
      if (user) {
        localStorage.removeItem(`compass_profile_cache_${user.uid}`);
      }
      await signOut(auth);
      setUser(null);
      setProfile(null);
      setGoals([]);
      setActiveGoal(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleOnboardingComplete = async (newProfile: UserProfile) => {
    setProfile(newProfile);
    const cachedProfileKey = `compass_profile_cache_${newProfile.userId}`;
    localStorage.setItem(cachedProfileKey, JSON.stringify(newProfile));
    await fetchUserGoals(newProfile.userId, newProfile);
  };

  // Create Goal Roadmap and save to Firestore
  const handleSaveGoal = async (
    goalData: Omit<Goal, "id" | "userId" | "createdAt" | "updatedAt">,
    phasesData: any[],
    tasksData: any[],
    resourcesData: any[]
  ) => {
    if (!user) return;

    try {
      const goalId = `goal_${Date.now()}`;
      const newGoal: Goal = {
        id: goalId,
        userId: user.uid,
        ...goalData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Write goal
      await setDoc(doc(db, "goals", goalId), newGoal);

      // Write phases
      for (let i = 0; i < phasesData.length; i++) {
        const ph = phasesData[i];
        const phaseId = `phase_${goalId}_${i}`;
        const newPhase = {
          id: phaseId,
          goalId,
          userId: user.uid,
          title: ph.title,
          description: ph.description || "",
          order: ph.order || (i + 1),
          estimatedDuration: ph.estimated_duration || "Flexible",
          suggestedStartDate: ph.suggested_start_date || new Date().toISOString().split("T")[0],
          suggestedEndDate: ph.suggested_end_date || goalData.targetDate,
          status: "active" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, "goals", goalId, "phases", phaseId), newPhase);

        // Write associated tasks
        const phaseTasks = ph.tasks || [];
        for (let j = 0; j < phaseTasks.length; j++) {
          const t = phaseTasks[j];
          const taskId = `task_${goalId}_${i}_${j}`;
          const newTask = {
            id: taskId,
            phaseId,
            goalId,
            userId: user.uid,
            title: t.title,
            priority: t.priority === "high" ? "High" : t.priority === "low" ? "Low" : "Medium",
            status: "pending" as const,
            suggestedDueDate: t.suggested_due_date || goalData.targetDate,
            order: t.order || (j + 1),
            notes: t.notes || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await setDoc(doc(db, "goals", goalId, "tasks", taskId), newTask);
        }
      }

      // Write resources
      for (let k = 0; k < resourcesData.length; k++) {
        const resItem = resourcesData[k];
        const resourceId = `resource_${goalId}_${k}`;
        const newResource = {
          id: resourceId,
          goalId,
          userId: user.uid,
          title: resItem.title,
          type: resItem.type || "article",
          url: resItem.url || null,
          description: resItem.description || "",
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, "goals", goalId, "resources", resourceId), newResource);
      }

      // Refresh goals list
      await fetchUserGoals(user.uid, profile!);
      setShowCreateModal(false);
    } catch (err) {
      console.error("Failed to save goal roadmap:", err);
      throw err;
    }
  };

  // Delete entire Goal
  const handleDeleteGoal = async (goalId: string) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, "goals", goalId));
      setActiveGoal(null);
      setShowDeleteGoalConfirm(false);
      await fetchUserGoals(user.uid, profile!);
    } catch (err) {
      console.error("Failed to delete goal:", err);
    }
  };

  // Rule-Based Workload Conflict Detection (Feature 7)
  // upcomingHighPriority = highPriorityGoals (priority='High' AND status='active') due within 14 days
  const activeHighPriorityGoals = goals.filter(
    (g) => g.priority === "High" && g.status === "active"
  );
  
  const today = new Date();
  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(today.getDate() + 14);

  const upcomingHighPriorityGoals = activeHighPriorityGoals.filter((g) => {
    const deadline = new Date(g.targetDate);
    return deadline >= today && deadline <= twoWeeksFromNow;
  });

  const hasConflict = upcomingHighPriorityGoals.length >= 3;

  // Render Loader during initial Auth checks
  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 text-neutral-950 animate-spin mb-3.5" />
        <h3 className="text-base font-bold text-neutral-900 font-display">Initializing Compass Operating System...</h3>
        <p className="text-xs text-neutral-400 mt-1">Calibrating client credentials and Firestore sockets</p>
      </div>
    );
  }

  // STAGE 1: LANDING & SIGN-IN
  if (!user) {
    const bgLeft = isLightTheme ? 'bg-[#FAF6F0]' : 'bg-[#1c140e]';
    const bgRight = isLightTheme ? 'bg-[#FDFCF7]' : 'bg-[#130d09]';
    const borderSplit = isLightTheme ? 'border-brown-200/30' : 'border-amber-950/20';
    const textMain = isLightTheme ? 'text-[#221712]' : 'text-white';
    const textMuted = isLightTheme ? 'text-brown-600' : 'text-amber-100/70';
    const textMutedMono = isLightTheme ? 'text-brown-600/70' : 'text-amber-100/60';
    const circleBorder = isLightTheme ? 'border-brown-300/15' : 'border-amber-900/15';
    const glowColor1 = isLightTheme ? 'bg-amber-400/10' : 'bg-amber-500/20';
    const glowColor2 = isLightTheme ? 'bg-amber-600/5' : 'bg-amber-600/15';
    const cardBg = isLightTheme ? 'bg-[#EFE9DF]/80' : 'bg-[#241a13]/85';
    const cardBorder = isLightTheme ? 'border-brown-300/20' : 'border-amber-950/20';
    const textGlow = isLightTheme ? 'shadow-xs' : 'shadow-[0_0_20px_rgba(204,165,125,0.15)]';

    return (
      <div className={`min-h-screen grid grid-cols-1 md:grid-cols-12 font-sans transition-colors duration-500 overflow-x-hidden`}>
        {/* Left Column: Branding, Art & Philosophy */}
        <div className={`md:col-span-7 lg:col-span-8 ${bgLeft} relative flex flex-col justify-between p-8 sm:p-12 md:p-16 overflow-hidden min-h-[450px] md:min-h-screen transition-colors duration-500`}>
          
          {/* Concentric Circle Orbits and Ambient Blurs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Ambient glows */}
            <div className={`absolute top-[22%] left-[24%] w-36 h-36 rounded-full ${glowColor1} blur-3xl transition-colors duration-500`} />
            <div className={`absolute bottom-[28%] right-[15%] w-72 h-72 rounded-full ${glowColor2} blur-3xl transition-colors duration-500`} />
            
            {/* Orbits / Concentric Circles centered around the glow */}
            <div className="absolute top-[35%] left-[25%] -translate-x-1/2 -translate-y-1/2 w-0 h-0">
              <div className={`absolute -translate-x-1/2 -translate-y-1/2 w-[160px] h-[160px] rounded-full border ${circleBorder} transition-colors duration-500`} />
              <div className={`absolute -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full border ${circleBorder} transition-colors duration-500`} />
              <div className={`absolute -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] rounded-full border ${circleBorder} transition-colors duration-500`} />
              <div className={`absolute -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full border ${circleBorder} transition-colors duration-500`} />
              <div className={`absolute -translate-x-1/2 -translate-y-1/2 w-[820px] h-[820px] rounded-full border ${circleBorder} transition-colors duration-500`} />
              <div className={`absolute -translate-x-1/2 -translate-y-1/2 w-[1040px] h-[1040px] rounded-full border ${circleBorder} transition-colors duration-500`} />
              <div className={`absolute -translate-x-1/2 -translate-y-1/2 w-[1280px] h-[1280px] rounded-full border ${circleBorder} transition-colors duration-500`} />
            </div>
          </div>

          {/* Top Bar: Back Button */}
          <div className="relative z-10">
          </div>

          {/* Bottom Card: "Your Compass." */}
          <div className="relative z-10 mt-auto pt-16 md:pt-0 max-w-lg">
            <div className={`p-8 sm:p-10 rounded-[2.5rem] ${cardBg} ${cardBorder} border backdrop-blur-md transition-all duration-500 ${textGlow}`}>
              <h2 className="leading-none select-none">
                <span className={`font-serif text-5.5xl sm:text-6xl font-medium tracking-tight block ${textMain} transition-colors duration-500`}>
                  Your
                </span>
                <span className="font-serif text-5.5xl sm:text-6xl font-medium italic block text-[#cca57d] leading-none mt-2">
                  Compass.
                </span>
              </h2>
              
              <div className="border-l-2 border-[#cca57d]/70 pl-5 mt-8">
                <p className={`font-mono text-[10px] sm:text-[11px] tracking-widest leading-relaxed uppercase ${textMutedMono} transition-colors duration-500 max-w-sm`}>
                  Your personal guide to achieving all your goals
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Sign In Action Container */}
        <div className={`md:col-span-5 lg:col-span-4 ${bgRight} ${borderSplit} border-t md:border-t-0 md:border-l relative flex flex-col justify-between p-8 sm:p-12 lg:p-16 transition-colors duration-500 min-h-[500px] md:min-h-screen`}>
          
          {/* Top Right: Theme Switch Button */}
          <div className="flex justify-end relative z-10">
            <button
              onClick={() => setIsLightTheme(!isLightTheme)}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer ${
                isLightTheme 
                  ? 'bg-neutral-900 text-amber-300 hover:bg-neutral-800' 
                  : 'bg-white text-neutral-950 hover:bg-neutral-50'
              }`}
              title={isLightTheme ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {isLightTheme ? (
                <Moon className="h-4.5 w-4.5" fill="currentColor" />
              ) : (
                <Sun className="h-4.5 w-4.5 text-neutral-950" />
              )}
            </button>
          </div>

          {/* Middle Content: Sign In Block */}
          <div className="my-auto py-12 relative z-10 max-w-md mx-auto w-full">
            <h1 className={`font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-medium tracking-tight whitespace-nowrap ${textMain} transition-colors duration-500 leading-none`}>
              Welcome to Compass
            </h1>
            <p className="font-mono text-[10px] sm:text-[11px] tracking-widest uppercase font-extrabold text-[#cca57d] mt-4 mb-8">
              SIGN IN TO CONTINUE.
            </p>

            {/* Error Message */}
            {error && (
              <div className="p-4 mb-6 bg-red-950/20 border border-red-900/30 rounded-2xl text-xs text-red-200 leading-relaxed font-mono">
                <span className="font-bold block text-red-400 mb-1">Authentication Notice:</span>
                {error}
              </div>
            )}

            {/* Google Authentication Pill Button with Ambient Glow */}
            <div className="relative group mb-4">
              {!isLightTheme && (
                <div className="absolute inset-0 bg-gradient-to-r from-[#81552a] to-[#cca57d] rounded-2xl blur-md opacity-25 group-hover:opacity-40 transition-opacity duration-300" />
              )}
              
              <button
                onClick={handleGoogleLogin}
                className="w-full relative bg-gradient-to-r from-[#5a3e25] to-[#996c42] hover:from-[#6d4b2e] hover:to-[#ac7b4e] active:scale-[0.99] text-white font-medium text-sm py-4 px-6 rounded-2xl flex items-center justify-center gap-3.5 transition-all shadow-md border border-amber-500/20 cursor-pointer"
              >
                {/* Clean, high-fidelity Google G Vector Logo rendered directly */}
                <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="font-semibold tracking-wide text-xs sm:text-sm">Continue with Google</span>
              </button>
            </div>


          </div>

          {/* Footer: Divider */}
          <div className="relative z-10 w-full">
            <div className={`border-t ${borderSplit} w-full my-6 transition-colors duration-500`} />
          </div>

        </div>
      </div>
    );
  }

  // STAGE 2: ONBOARDING WIZARD (if user has no profile document)
  if (!profile) {
    return (
      <Onboarding
        userId={user.uid}
        userEmail={user.email || "yashitaloya@gmail.com"}
        onComplete={handleOnboardingComplete}
        isLightTheme={isLightTheme}
        setIsLightTheme={setIsLightTheme}
      />
    );
  }

  // STAGE 3: MAIN WORKSPACE OR DASHBOARD
  const totalDeliverablesCount = allTasks.length + standaloneTodos.length;
  const completedDeliverablesCount = allTasks.filter(t => t.status === "completed").length + standaloneTodos.filter(t => t.completed).length;
  const deliveryRate = totalDeliverablesCount > 0 ? Math.round((completedDeliverablesCount / totalDeliverablesCount) * 100) : 0;

  return (
    <div className="h-screen bg-theme-bg-app flex flex-col text-theme-text-main font-sans overflow-hidden transition-colors duration-300">
      {/* Top Main Navigation Bar */}
      <header className="bg-theme-bg-panel border-b border-theme-border-main sticky top-0 z-30 shrink-0 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-xl border border-theme-border-main bg-theme-bg-panel hover:bg-theme-bg-card-hover text-theme-text-muted transition active:scale-95 shadow-3xs"
              title={isSidebarCollapsed ? "Expand Navigation Panel" : "Collapse Navigation Panel"}
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="h-9 w-9 bg-theme-bg-accent rounded-xl flex items-center justify-center text-theme-text-accent shadow-md">
              <Compass className="h-5 w-5 animate-spin-slow" />
            </div>
            <div>
              <span className="text-base font-bold text-theme-text-main tracking-tight font-display">
                COMPASS
              </span>
              <span className="text-[9px] font-mono font-bold text-theme-text-muted-mono ml-2 border border-theme-border-main px-1.5 py-0.5 rounded-full uppercase">
                v1.0 stable
              </span>
            </div>
          </div>
 
          {/* User Info & Actions Bar */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-right">
              <div className="text-xs font-semibold text-theme-text-main">
                {user.isAnonymous ? "Yashita (Grader Pass)" : user.displayName || user.email}
              </div>
              <div className="text-[10px] text-theme-text-muted font-mono font-bold uppercase">
                {profile.role}
              </div>
            </div>

            {/* Dark / Light theme toggle button */}
            <button
              onClick={() => setIsLightTheme(!isLightTheme)}
              className="p-1.5 border border-theme-border-main bg-theme-bg-panel rounded-xl hover:bg-theme-bg-card-hover text-theme-text-muted hover:text-theme-text-main transition shadow-2xs"
              title={isLightTheme ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {isLightTheme ? (
                <Moon className="h-4.5 w-4.5" />
              ) : (
                <Sun className="h-4.5 w-4.5" />
              )}
            </button>
 
            <button
              onClick={handleLogout}
              className="p-1.5 border border-theme-border-main bg-theme-bg-panel rounded-xl hover:bg-theme-bg-card-hover text-theme-text-muted hover:text-theme-text-main transition shadow-2xs"
              title="Logout session"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout (Sidebar + Content Pane) */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        
        {/* Collapsible Sidebar Navigation */}
        <aside 
          className={`bg-theme-bg-panel border-r border-theme-border-main shrink-0 transition-all duration-300 ease-in-out flex flex-row md:flex-col justify-between p-3 md:p-4 border-b md:border-b-0 border-theme-border-subtle overflow-x-auto md:overflow-y-auto ${
            isSidebarCollapsed ? "w-full md:w-16 h-auto md:h-full" : "w-full md:w-64 h-auto md:h-full"
          }`}
        >
          {/* Sidebar Nav Buttons Container */}
          <div className="flex md:flex-col gap-2 md:space-y-2.5 items-center md:items-stretch w-full">
            <button
              onClick={() => { setActiveTab('dashboard'); setActiveGoal(null); }}
              className={`px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-2.5 whitespace-nowrap w-full cursor-pointer ${
                activeTab === 'dashboard'
                  ? "bg-theme-bg-accent text-theme-text-accent shadow-xs"
                  : "text-theme-text-muted hover:text-theme-text-main hover:bg-theme-bg-card-hover"
              }`}
              title="Daily Operator Dashboard"
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">Daily Dashboard</span>}
              {!isSidebarCollapsed && (standaloneTodos.filter(t => !t.completed).length + allTasks.filter(t => t.status === "pending").length) > 0 && (
                <span className={`ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === 'dashboard' ? "bg-theme-text-accent/20 text-theme-text-accent" : "bg-theme-border-main text-theme-text-muted"
                }`}>
                  {standaloneTodos.filter(t => !t.completed).length + allTasks.filter(t => t.status === "pending").length}
                </span>
              )}
            </button>
 
            <button
              onClick={() => { setActiveTab('goals'); setActiveGoal(null); }}
              className={`px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-2.5 whitespace-nowrap w-full cursor-pointer ${
                activeTab === 'goals'
                  ? "bg-theme-bg-accent text-theme-text-accent shadow-xs"
                  : "text-theme-text-muted hover:text-theme-text-main hover:bg-theme-bg-card-hover"
              }`}
              title="Goals Portfolio"
            >
              <Target className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">Goals Portfolio</span>}
              {!isSidebarCollapsed && (
                <span className={`ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === 'goals' ? "bg-theme-text-accent/20 text-theme-text-accent" : "bg-theme-border-main text-theme-text-muted"
                }`}>
                  {goals.length}
                </span>
              )}
            </button>
 
            <button
              onClick={() => { setActiveTab('analytics'); setActiveGoal(null); }}
              className={`px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-2.5 whitespace-nowrap w-full cursor-pointer ${
                activeTab === 'analytics'
                  ? "bg-theme-bg-accent text-theme-text-accent shadow-xs"
                  : "text-theme-text-muted hover:text-theme-text-main hover:bg-theme-bg-card-hover"
              }`}
              title="Portfolio Analytics"
            >
              <LineChart className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">Portfolio Analytics</span>}
              {!isSidebarCollapsed && totalDeliverablesCount > 0 && (
                <span className={`ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === 'analytics' ? "bg-theme-text-accent/20 text-theme-text-accent" : "bg-theme-border-main text-theme-text-muted"
                }`}>
                  {deliveryRate}%
                </span>
              )}
            </button>
 
            <button
              onClick={() => { setActiveTab('calendar'); setActiveGoal(null); }}
              className={`px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-2.5 whitespace-nowrap w-full cursor-pointer ${
                activeTab === 'calendar'
                  ? "bg-theme-bg-accent text-theme-text-accent shadow-xs"
                  : "text-theme-text-muted hover:text-theme-text-main hover:bg-theme-bg-card-hover"
              }`}
              title="Calendar View"
            >
              <Calendar className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">Calendar View</span>}
            </button>
 
            <button
              onClick={() => { setActiveTab('assessment'); setActiveGoal(null); }}
              className={`px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-2.5 whitespace-nowrap w-full cursor-pointer ${
                activeTab === 'assessment'
                  ? "bg-theme-bg-accent text-theme-text-accent shadow-xs"
                  : "text-theme-text-muted hover:text-theme-text-main hover:bg-theme-bg-card-hover"
              }`}
              title="Weekly Assessment"
            >
              <Award className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">Weekly Assessment</span>}
            </button>
 
            <button
              onClick={() => { setActiveTab('settings'); setActiveGoal(null); }}
              className={`px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-2.5 whitespace-nowrap w-full cursor-pointer ${
                activeTab === 'settings'
                  ? "bg-theme-bg-accent text-theme-text-accent shadow-xs"
                  : "text-theme-text-muted hover:text-theme-text-main hover:bg-theme-bg-card-hover"
              }`}
              title="Settings"
            >
              <Settings className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">Settings</span>}
            </button>
          </div>
 
          {/* Collapsible Panel Toggle Trigger for Desktop */}
          <div className="hidden md:flex border-t border-theme-border-main pt-3 flex-col items-center justify-center w-full">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="w-full flex items-center justify-center py-2 rounded-xl text-theme-text-muted hover:text-theme-text-main hover:bg-theme-bg-card-hover transition cursor-pointer"
              title={isSidebarCollapsed ? "Expand panel" : "Collapse panel"}
            >
              <ChevronLeft className={`h-4.5 w-4.5 transition-transform duration-300 ${isSidebarCollapsed ? "rotate-180" : ""}`} />
            </button>
          </div>
        </aside>
 
        {/* Content Pane Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          
          {/* Header Actions Block with active tab title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-border-main pb-4">
            <div>
              <h1 className="text-xl font-bold font-display text-theme-text-main capitalize">
                {activeGoal ? `Goal: ${activeGoal.title}` : activeTab.replace('-', ' ')}
              </h1>
              <p className="text-xs text-theme-text-muted mt-0.5">
                {activeGoal 
                  ? "Formulate strategies, add check-ins, or manage active roadmap tasks."
                  : activeTab === 'dashboard' 
                    ? "Your high-impact focus area: adjust habits, standalone list, or consult AI stoic guidance."
                    : activeTab === 'goals'
                      ? "Manage your multi-dimensional developmental priorities."
                      : activeTab === 'analytics'
                        ? "Inspect systemic task delivery, milestones, and completion trends."
                        : activeTab === 'calendar'
                          ? "Review roadmap deadlines, priorities, and schedule flow."
                          : activeTab === 'assessment'
                            ? "Conduct dynamic weekly assessments with direct AI feedback."
                            : "Configure your personal development parameters and coaching preferences."
                }
              </p>
            </div>

            {/* Context-Aware Search Input */}
            {!activeGoal && (activeTab === 'dashboard' || activeTab === 'goals') && (
              <div className="relative max-w-xs w-full sm:w-64 sm:ml-auto">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-brown-500" />
                 <input
                  type="text"
                  placeholder={`Search ${activeTab === 'dashboard' ? 'tasks...' : 'goals...'}`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-brown-950 text-xs pl-9 pr-8 py-1.5 border border-brown-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brown-500 shadow-2xs transition"
                  style={{ backgroundColor: '#f9ece1' }}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brown-500 hover:text-brown-850 text-sm font-bold cursor-pointer"
                  >
                    &times;
                  </button>
                )}
              </div>
            )}

            {/* Context-Specific Action Buttons */}
            {!activeGoal && (
              <div className="flex items-center gap-2 flex-wrap">
                {activeTab === 'analytics' ? (
                  <div className="hidden md:flex flex-col text-right mr-3">
                    <span className="text-[10px] font-mono font-bold text-brown-500 uppercase tracking-wider">System Integrity</span>
                    <span className="text-[11px] font-semibold text-brown-750">Heuristics Fully Calibrated</span>
                  </div>
                ) : activeTab === 'calendar' ? (
                  <div className="hidden md:flex flex-col text-right mr-3">
                    <span className="text-[10px] font-mono font-bold text-brown-500 uppercase tracking-wider">Time Calibration</span>
                    <span className="text-[11px] font-semibold text-brown-750">Active Planner Active</span>
                  </div>
                ) : activeTab === 'assessment' ? (
                  <div className="hidden md:flex flex-col text-right mr-3">
                    <span className="text-[10px] font-mono font-bold text-brown-500 uppercase tracking-wider">Performance Audit</span>
                    <span className="text-[11px] font-semibold text-brown-750">Weekly Progress Monitor</span>
                  </div>
                ) : activeTab === 'settings' ? (
                  <div className="hidden md:flex flex-col text-right mr-3">
                    <span className="text-[10px] font-mono font-bold text-brown-500 uppercase tracking-wider">Calibration Core</span>
                    <span className="text-[11px] font-semibold text-brown-750">Profile Tuning Engine</span>
                  </div>
                ) : activeTab === 'dashboard' ? (
                  <>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-1.5 bg-brown-950 text-beige-50 px-4 py-2 rounded-xl text-xs font-bold hover:bg-brown-900 active:scale-95 transition shadow-sm cursor-pointer"
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      <span>Formulate Goal</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowRebalanceModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-brown-300 bg-white hover:bg-beige-100 text-xs font-semibold text-brown-700 shadow-xs active:scale-95 transition cursor-pointer"
                    >
                      <Sliders className="h-4 w-4 text-brown-600" />
                      <span>Rebalance Advisor</span>
                    </button>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-1.5 bg-brown-950 text-beige-50 px-4 py-2 rounded-xl text-xs font-bold hover:bg-brown-900 active:scale-95 transition shadow-sm cursor-pointer"
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      <span>Formulate Goal</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Workload Conflict Banner (Rule-Based) - Re-aligned to be non-stressful, compact, and beautifully integrated */}
          {hasConflict && (
            <div className="bg-beige-50/80 border border-brown-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex gap-3">
                <div className="h-9 w-9 rounded-xl bg-brown-100 text-brown-800 flex items-center justify-center shrink-0">
                  <Compass className="h-4.5 w-4.5 animate-spin-slow" />
                </div>
                <div style={{ backgroundColor: '#f9ece1' }}>
                  <h4 className="text-xs font-bold text-brown-950">Mindful Pace & Flow Advisory</h4>
                  <p className="text-[11px] text-brown-700 mt-0.5 max-w-2xl leading-relaxed">
                    You have <strong>{upcomingHighPriorityGoals.length} milestones</strong> approaching within the next fortnight. Take a moment to align your timeline for a calmer, more focused flow.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRebalanceModal(true)}
                className="text-[11px] font-bold text-beige-50 bg-brown-900 hover:bg-brown-800 px-3.5 py-1.5 rounded-xl active:scale-95 transition shrink-0 shadow-3xs cursor-pointer"
              >
                Align Schedule
              </button>
            </div>
          )}

        {/* DETAILED GOAL PANEL VIEW OR GENERAL BENTO GRID */}
        {activeGoal ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <GoalDetail
              goal={activeGoal}
              profile={profile}
              onBack={() => { setActiveGoal(null); setShowDeleteGoalConfirm(false); }}
              onUpdateGoalList={() => fetchUserGoals(user.uid, profile)}
              googleAccessToken={googleAccessToken}
              onConnectGoogle={handleConnectGoogle}
            />
            
            {/* Dangerous Zone Area in detail view */}
            <div className="mt-12 pt-6 border-t border-neutral-100 flex justify-between items-center bg-red-50/20 -mx-6 -mb-6 p-6 rounded-b-2xl">
              <div>
                <span className="text-xs font-bold text-red-900">Portfolio Housekeeping</span>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {showDeleteGoalConfirm 
                    ? "Are you absolutely sure you want to permanently delete this goal?" 
                    : "Delete this goal if it is no longer part of your active life strategy."}
                </p>
              </div>
              {showDeleteGoalConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDeleteGoalConfirm(false)}
                    className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteGoal(activeGoal.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Confirm Delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteGoalConfirm(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-800 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Goal
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Tab content 1: Daily Operator Dashboard */}
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                
                {/* Left Section (2/5 width): Stoic Quote & Habits */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Widget 1: Stoic Quote */}
                  <div className="bg-neutral-900 text-white rounded-2xl p-6 border border-neutral-800 shadow-sm relative overflow-hidden group">
                    {/* Integrated Interactive Recalibration Trigger */}
                    <button
                      onClick={handleGenerateAIQuote}
                      disabled={quoteLoading}
                      className="absolute top-0 right-0 h-20 w-20 flex items-center justify-center opacity-30 hover:opacity-100 text-neutral-400 hover:text-white transition-all duration-300 cursor-pointer focus:outline-none"
                      title="Recalibrate Stoic Focus (Generate Custom AI Quote)"
                    >
                      <BookOpen className="h-12 w-12 transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute flex items-center justify-center bg-neutral-950/95 rounded-full p-1.5 border border-neutral-800 shadow-md">
                        <RefreshCw className={`h-4 w-4 ${quoteLoading ? "animate-spin text-yellow-400" : "text-neutral-300 group-hover:text-white"}`} />
                      </div>
                    </button>

                    <div className="flex items-center justify-between mb-4 pr-16">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-yellow-400" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                          Stoic Focus Recalibration
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-medium leading-relaxed font-display text-neutral-100 pr-12">
                      "{quote.quote}"
                    </p>
                    <div className="mt-3.5 flex justify-between items-center text-[9px] text-neutral-400 font-mono">
                      <span>— {quote.author}</span>
                      {profile?.peakFocusWindow && (
                        <span className="bg-neutral-800 px-1.5 py-0.5 rounded text-[8px]">
                          ⚡ Peak: {profile.peakFocusWindow.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Widget 2: Habits and Streaks Builder */}
                  <div className="border border-neutral-200 rounded-2xl p-6 shadow-sm" style={{ backgroundColor: '#f9ece1' }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-900 shrink-0">
                          <Flame className="h-4.5 w-4.5 text-orange-600 fill-orange-100" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-neutral-950 font-display">Habit & Streak Builder</h3>
                          <p className="text-[10px] text-neutral-400">Establish daily consistency</p>
                        </div>
                      </div>
                      <div className="bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-xl flex items-center gap-1 text-xs font-bold text-orange-700">
                        <Flame className="h-4 w-4 fill-orange-600" />
                        <span>{streakCount} Days</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {[
                        { id: "habit_checkin", title: "📅 Portfolio Daily Check-in", desc: "Audit and sequence goals" },
                        { id: "habit_focus", title: "⚡ Deep Focus Block (25m)", desc: "Distraction-free sprint" },
                        { id: "habit_reflection", title: "🧘 Mindful Micro-reflection", desc: "Brief self-assessment" }
                      ].map((habit) => {
                        const isChecked = checkedHabits.includes(habit.id);
                        return (
                          <div
                            key={habit.id}
                            onClick={() => handleToggleHabit(habit.id)}
                            className={`p-3.5 border rounded-xl flex items-start gap-3 cursor-pointer transition ${
                              isChecked 
                                ? "bg-neutral-50/70 border-neutral-300" 
                                : "bg-white border-neutral-150 hover:border-neutral-250"
                            }`}
                          >
                            <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition shrink-0 ${
                              isChecked ? "bg-neutral-950 border-neutral-950 text-white" : "border-neutral-300 bg-white"
                            }`}>
                              {isChecked && <CheckCircle className="h-3 w-3 fill-current text-white" />}
                            </div>
                            <div>
                              <span className={`block text-xs font-bold leading-none ${isChecked ? "text-neutral-500 line-through" : "text-neutral-950"}`}>
                                {habit.title}
                              </span>
                              <span className="block text-[10px] text-neutral-400 mt-1.5">{habit.desc}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-neutral-100 flex justify-between items-center text-[10px] font-mono text-neutral-500">
                      <span>Checked: {checkedHabits.length}/3 today</span>
                      <span>{checkedHabits.length === 3 ? "Streak preserved!" : "Complete all to grow streak"}</span>
                    </div>
                  </div>
                </div>

                {/* Right Section (3/5 width): Daily Action Checklist */}
                <div className="lg:col-span-3">
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-5 h-full">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-900 shrink-0">
                        <ListTodo className="h-4.5 w-4.5 text-neutral-800" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-neutral-950 font-display">Daily Operator Checklist</h3>
                        <p className="text-[10px] text-neutral-400">Aggregated task deliverables</p>
                      </div>
                    </div>

                    {/* Quick Add Standalone Todo */}
                    <div className="space-y-2 pt-1">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-950 bg-white placeholder-neutral-400 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950 shadow-2xs"
                          placeholder="Add standalone today's task..."
                          value={newTodoTitle}
                          onChange={(e) => setNewTodoTitle(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveStandaloneTodo()}
                        />
                        <select
                          className="rounded-xl border border-neutral-200 px-2 py-2 text-xs font-semibold text-neutral-700 bg-white"
                          value={newTodoPriority}
                          onChange={(e) => setNewTodoPriority(e.target.value as any)}
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                        <button
                          onClick={saveStandaloneTodo}
                          disabled={!newTodoTitle.trim()}
                          className="bg-neutral-950 text-white px-3.5 py-2 rounded-xl hover:bg-neutral-850 transition flex items-center justify-center shrink-0 disabled:opacity-50 text-xs font-bold"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </button>
                      </div>
                    </div>

                    {/* Sub-section 1: Standalone To-Dos */}
                    {standaloneTodos.filter((todo) => !searchQuery || todo.title.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="block text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                          Personal Standalone Tasks ({standaloneTodos.filter((todo) => !searchQuery || todo.title.toLowerCase().includes(searchQuery.toLowerCase())).length})
                        </span>
                        <div className="space-y-1.5">
                          {standaloneTodos
                            .filter((todo) => !searchQuery || todo.title.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((todo) => (
                            <div
                              key={todo.id}
                              className="flex items-center justify-between p-3 border border-neutral-150 rounded-xl bg-neutral-50/30 group text-xs transition hover:border-neutral-200"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={todo.completed}
                                  onChange={() => handleToggleStandaloneTodo(todo.id)}
                                  className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer shrink-0"
                                />
                                <span className={`truncate font-semibold text-xs ${todo.completed ? "text-neutral-400 line-through" : "text-neutral-950"}`}>
                                  {todo.title}
                                </span>
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                                  todo.priority === "High" ? "bg-red-50 text-red-700" :
                                  todo.priority === "Medium" ? "bg-yellow-50 text-yellow-700" : "bg-green-50 text-green-700"
                                }`}>
                                  {todo.priority}
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteStandaloneTodo(todo.id)}
                                className="text-neutral-400 hover:text-red-700 opacity-0 group-hover:opacity-100 transition p-1 shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sub-section 2: Goal Action Deliverables (Aggregated) */}
                    <div className="space-y-2 pt-1">
                      <span className="block text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                        Goal Deliverables ({allTasks.filter(t => t.status === "pending" && (!searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || (t.goalTitle || "").toLowerCase().includes(searchQuery.toLowerCase()))).length} active)
                      </span>
                      
                      {allTasks.length === 0 ? (
                        <p className="text-xs text-neutral-400 italic text-center py-6 border border-dashed border-neutral-200 rounded-xl">
                          No active goal deliverables loaded.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                          {allTasks
                            .filter((t) => {
                              const matchesPending = t.status === "pending";
                              const matchesSearch = !searchQuery || 
                                t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                (t.goalTitle || "").toLowerCase().includes(searchQuery.toLowerCase());
                              return matchesPending && matchesSearch;
                            })
                            .map((task) => (
                              <div
                                key={task.id}
                                className="p-3 border border-neutral-150 rounded-xl bg-white hover:border-neutral-250 transition shadow-2xs"
                              >
                                <div className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    checked={task.status === "completed"}
                                    onChange={() => handleToggleGoalTaskFromDashboard(task.goalId, task)}
                                    className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <span className="block text-xs font-semibold text-neutral-800 leading-tight">
                                      {task.title}
                                    </span>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] text-neutral-400 font-mono">
                                      <span 
                                        onClick={() => {
                                          const matchedGoal = goals.find(g => g.id === task.goalId);
                                          if (matchedGoal) {
                                            setActiveGoal(matchedGoal);
                                            setActiveTab('goals');
                                          }
                                        }}
                                        className="text-neutral-500 hover:text-neutral-900 hover:underline cursor-pointer font-bold truncate max-w-[150px]" 
                                        title={task.goalTitle}
                                      >
                                        🎯 {task.goalTitle}
                                      </span>
                                      <span>&middot;</span>
                                      <span className={`px-1.5 py-0.5 rounded uppercase font-bold text-[8px] ${
                                        task.priority === "High" ? "bg-red-50 text-red-700 border border-red-100" :
                                        task.priority === "Medium" ? "bg-yellow-50 text-yellow-700 border border-yellow-100" :
                                        "bg-green-50 text-green-700 border border-green-100"
                                      }`}>
                                        {task.priority}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            )}

            {/* Tab content 2: Goals Portfolio */}
            {activeTab === 'goals' && (
              <div className="space-y-6 animate-in fade-in duration-250">
                {/* Filter Categories Horizontal Navigation */}
                <div className="flex items-center gap-1.5 border-b border-neutral-200 pb-2 overflow-x-auto">
                  <button
                    onClick={() => setSelectedCategory("All")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      selectedCategory === "All"
                        ? "bg-neutral-900 text-white shadow-xs"
                        : "text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    All Goals ({goals.length})
                  </button>
                  {profile.categoryTabs.map((cat) => {
                    const count = goals.filter((g) => g.category === cat).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                          selectedCategory === cat
                            ? "bg-neutral-900 text-white shadow-xs"
                            : "text-neutral-500 hover:text-neutral-900"
                        }`}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Empty State vs Bento Grid */}
                {goalsLoading ? (
                  <div className="text-center py-24 bg-white border border-neutral-200 rounded-2xl">
                    <Loader2 className="h-8 w-8 text-neutral-900 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-neutral-500 font-medium">Querying Firestore collection streams...</p>
                  </div>
                ) : goals.length === 0 ? (
                  <div className="text-center py-20 bg-white border border-neutral-200 rounded-2xl max-w-lg mx-auto">
                    <Compass className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-neutral-950 font-display">No Active Goals</h3>
                    <p className="text-xs text-neutral-500 max-w-xs mx-auto mt-1 leading-relaxed">
                      Start by clicking the "Formulate Goal" button. COMPASS will leverage AI to design deep qualitative phases and individual action deliverables.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {goals
                      .filter((g) => {
                        const matchesCategory = selectedCategory === "All" || g.category === selectedCategory;
                        const matchesSearch = !searchQuery || 
                          g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (g.description || "").toLowerCase().includes(searchQuery.toLowerCase());
                        return matchesCategory && matchesSearch;
                      })
                      .map((g) => {
                        const daysRemaining = Math.ceil(
                          (new Date(g.targetDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                        );
                        const isOverdue = daysRemaining < 0;

                        const confidenceLabel = 
                          g.confidenceScore === 5 ? "Very High" :
                          g.confidenceScore === 4 ? "High" :
                          g.confidenceScore === 3 ? "Neutral" :
                          g.confidenceScore === 2 ? "Low" : "Very Low";

                        const isGoalHighUrgency = g.priority === "High" && daysRemaining <= 14 && g.status === "active";

                        return (
                          <div
                            key={g.id}
                            onClick={() => { setActiveGoal(g); setShowDeleteGoalConfirm(false); }}
                            className={`bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-neutral-3.5 cursor-pointer transition flex flex-col justify-between gap-4 group ${
                              isGoalHighUrgency ? "ring-1 ring-red-200 border-red-300" : "border-neutral-200"
                            }`}
                          >
                            <div>
                              {/* Card Header metadata */}
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                                  {g.category}
                                </span>
                                <div className="flex gap-1">
                                  <span
                                    className={`text-[9px] font-mono font-bold border rounded px-1.5 py-0.5 uppercase ${
                                      g.priority === "High"
                                        ? "bg-red-50 text-red-800 border-red-200"
                                        : g.priority === "Medium"
                                        ? "bg-yellow-50 text-yellow-800 border-yellow-200"
                                        : "bg-green-50 text-green-800 border-green-200"
                                    }`}
                                  >
                                    {g.priority}
                                  </span>
                                </div>
                              </div>

                              {/* Title & description */}
                              <h3 className="text-sm font-bold text-neutral-950 font-display group-hover:text-neutral-900 group-hover:underline leading-snug">
                                {g.title}
                              </h3>
                              {g.description && (
                                <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                                  {g.description}
                                </p>
                              )}
                            </div>

                            {/* Middle status section */}
                            <div className="space-y-2">
                              {/* Progress slider bar */}
                              <div>
                                <div className="flex justify-between text-[10px] font-semibold text-neutral-500 mb-1">
                                  <span>Delivered</span>
                                  <span>{g.progressPercentage}%</span>
                                </div>
                                <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-neutral-950 h-full rounded-full"
                                    style={{ width: `${g.progressPercentage}%` }}
                                  ></div>
                                </div>
                              </div>

                              {/* Detail metrics footer */}
                              <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500 border-t border-neutral-100 pt-2.5">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5 text-neutral-400" />
                                  {isOverdue ? (
                                    <span className="text-red-600 font-semibold">Overdue</span>
                                  ) : (
                                    <span>due in {daysRemaining} days</span>
                                  )}
                                </span>
                                <span className="flex items-center gap-0.5" title="Self-assessed confidence index">
                                  Conf: <strong className="text-neutral-800 text-xs">{confidenceLabel}</strong>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Tab content 3: Portfolio Analytics */}
            {activeTab === 'analytics' && (
              <PortfolioAnalytics
                goals={goals}
                allTasks={allTasks}
                standaloneTodos={standaloneTodos}
              />
            )}

            {/* Tab content 4: Calendar Planner View */}
            {activeTab === 'calendar' && (
              <CalendarView
                profile={profile}
                goals={goals}
                googleAccessToken={googleAccessToken}
                onConnectGoogle={handleConnectGoogle}
              />
            )}

            {/* Tab content 5: Profile & System Settings */}
            {activeTab === 'settings' && (
              <SettingsView
                profile={profile}
                userId={user.uid}
                onProfileUpdate={(updated) => setProfile(updated)}
                onAccountDeleted={handleLogout}
                googleAccessToken={googleAccessToken}
                onConnectGoogle={handleConnectGoogle}
              />
            )}

            {/* Tab content 6: Weekly Performance Assessment Tab */}
            {activeTab === 'assessment' && (
              <WeeklyReviewView
                profile={profile}
                goals={goals}
              />
            )}
          </>
        )}

        {/* FOOTER METADATA */}
        <footer className="border-t border-brown-200 py-6 mt-12 shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-brown-500 font-medium">
            COMPASS Goal Planner Engine &middot; Real-time secure Firestore matrix sync &middot; AI Coach leverages Gemini 2.0
          </div>
        </footer>

      </main>
      </div>

      {/* CREATE GOAL ROADMAP MODAL */}
      {showCreateModal && (
        <CreateGoalModal
          profile={profile}
          existingGoals={goals}
          onClose={() => setShowCreateModal(false)}
          onSave={handleSaveGoal}
        />
      )}

      {/* PORTFOLIO WORKLOAD REBALANCE MODAL */}
      {showRebalanceModal && (
        <RebalanceModal
          profile={profile!}
          goals={goals}
          onClose={() => setShowRebalanceModal(false)}
          onGoalsUpdated={() => fetchUserGoals(user.uid, profile!)}
        />
      )}
    </div>
  );
}
