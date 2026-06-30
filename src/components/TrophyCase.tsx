import React, { useState, useEffect, useRef } from "react";
import { 
  Trophy, 
  Award, 
  Medal, 
  Crown, 
  Flame, 
  CheckCircle, 
  Lock, 
  Unlock, 
  MessageSquareCode, 
  Hourglass, 
  Briefcase, 
  GraduationCap, 
  Heart, 
  Globe, 
  ChevronRight,
  TrendingUp,
  Target
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { Goal, UserProfile } from "../types";
import { db, collection, query, where, getDocs } from "../lib/firebase";

interface TrophyCaseProps {
  userId: string;
  goals: Goal[];
  profile: UserProfile | null;
  allTasks: any[];
  weeklyReviewsCount?: number;
  rebalanceAuditsCount?: number;
}

// 8 Unlockable Milestones
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: any;
  requirementCheck: (goals: Goal[], tasks: any[], reviewsCount: number, auditsCount: number, streak: number) => boolean;
  xpReward: number;
}

const ACHIEVEMENTS_LIST: Achievement[] = [
  {
    id: "first_blood",
    title: "First Blood",
    description: "Mark your first action item or task as complete.",
    icon: CheckCircle,
    requirementCheck: (_, tasks) => tasks.filter(t => t.status === "completed").length >= 1,
    xpReward: 30,
  },
  {
    id: "strategic_architect",
    title: "Strategic Architect",
    description: "Formulate 3 or more total goals in your portfolio.",
    icon: Target,
    requirementCheck: (goals) => goals.length >= 3,
    xpReward: 50,
  },
  {
    id: "victory_catalyst",
    title: "Victory Catalyst",
    description: "Successfully achieve 100% completion of any goal.",
    icon: Trophy,
    requirementCheck: (goals) => goals.some(g => g.progressPercentage === 100 || g.status === "completed"),
    xpReward: 150,
  },
  {
    id: "high_stakes_crusher",
    title: "High Stakes Crusher",
    description: "Complete a 'High' priority goal to 100% completion.",
    icon: Crown,
    requirementCheck: (goals) => goals.some(g => (g.progressPercentage === 100 || g.status === "completed") && g.priority === "High"),
    xpReward: 100,
  },
  {
    id: "overload_navigator",
    title: "Overload Navigator",
    description: "Execute at least 1 AI workload rebalance audit.",
    icon: TrendingUp,
    requirementCheck: (_, __, ___, auditsCount) => auditsCount >= 1,
    xpReward: 60,
  },
  {
    id: "weekly_oracle",
    title: "Weekly Oracle",
    description: "Complete at least one comprehensive Weekly Review.",
    icon: MessageSquareCode,
    requirementCheck: (_, __, reviewsCount) => reviewsCount >= 1,
    xpReward: 80,
  },
  {
    id: "zen_consistency",
    title: "Zen Consistency",
    description: "Maintain a focus habit streak of 5 or more days.",
    icon: Flame,
    requirementCheck: (_, __, ___, ____, streak) => streak >= 5,
    xpReward: 100,
  },
  {
    id: "polymath_maestro",
    title: "Polymath Maestro",
    description: "Distribute your portfolio across 3 or more distinct categories.",
    icon: Globe,
    requirementCheck: (goals) => new Set(goals.map(g => g.category)).size >= 3,
    xpReward: 100,
  }
];

export default function TrophyCase({
  userId,
  goals,
  profile,
  allTasks,
  weeklyReviewsCount = 0,
  rebalanceAuditsCount = 0,
}: TrophyCaseProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTab, setActiveTab] = useState<"trophies" | "achievements">("trophies");
  
  const [dbReviewsCount, setDbReviewsCount] = useState(weeklyReviewsCount);
  const [dbAuditsCount, setDbAuditsCount] = useState(rebalanceAuditsCount);

  // Persisted AI Victory Praises State
  const [victoryPraises, setVictoryPraises] = useState<Record<string, string>>({});
  const [loadingPraiseId, setLoadingPraiseId] = useState<string | null>(null);
  const [selectedGoalPraise, setSelectedGoalPraise] = useState<{ goalTitle: string; content: string } | null>(null);
  const [streakCount, setStreakCount] = useState<number>(0);

  // Fetch counts from DB
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const reviewsQ = query(collection(db, "weekly_reviews"), where("userId", "==", userId));
        const reviewsSnap = await getDocs(reviewsQ);
        setDbReviewsCount(reviewsSnap.docs.length);

        const auditsQ = query(collection(db, "rebalance_history"), where("userId", "==", userId));
        const auditsSnap = await getDocs(auditsQ);
        setDbAuditsCount(auditsSnap.docs.length);
      } catch (err) {
        console.error("Error fetching achievement metric counts from firestore:", err);
      }
    };
    if (userId) {
      fetchCounts();
    }
  }, [userId, weeklyReviewsCount, rebalanceAuditsCount]);

  // Load praises from localStorage
  useEffect(() => {
    const cachedPraises = localStorage.getItem(`compass_praises_${userId}`);
    if (cachedPraises) {
      try {
        setVictoryPraises(JSON.parse(cachedPraises));
      } catch (err) {
        console.error("Failed to parse cached victory praises", err);
      }
    }
    const habitsList = ["habit_checkin", "habit_focus", "habit_reflection"];
    const streaks = habitsList.map((hId) => {
      const val = localStorage.getItem(`compass_habit_streak_${userId}_${hId}`);
      return val ? parseInt(val, 10) : null;
    });
    
    if (streaks.some(s => s !== null)) {
      const maxStreak = Math.max(...streaks.map(s => s || 0));
      setStreakCount(maxStreak);
    } else {
      const localStreak = localStorage.getItem(`compass_streak_${userId}`);
      setStreakCount(localStreak ? parseInt(localStreak, 10) : 0);
    }
  }, [userId]);

  // Compute Completed Items
  const completedGoals = goals.filter(
    (g) => g.progressPercentage === 100 || g.status === "completed"
  );
  const completedTasksCount = allTasks.filter((t) => t.status === "completed").length;

  // XP calculation
  // 100 XP per completed goal
  // 15 XP per completed task
  // 10 XP per day of streak
  // Add completed achievements rewards
  const baseGoalXP = completedGoals.length * 100;
  const baseTaskXP = completedTasksCount * 15;
  const streakXP = streakCount * 10;
  
  // Compute unlocked achievements XP
  let unlockedAchievementsXP = 0;
  const unlockedCount = ACHIEVEMENTS_LIST.reduce((acc, ach) => {
    const isUnlocked = ach.requirementCheck(goals, allTasks, dbReviewsCount, dbAuditsCount, streakCount);
    if (isUnlocked) {
      unlockedAchievementsXP += ach.xpReward;
      return acc + 1;
    }
    return acc;
  }, 0);

  const totalXP = baseGoalXP + baseTaskXP + streakXP + unlockedAchievementsXP;
  
  // Level & Rank config
  // Let's say level is Math.floor(totalXP / 250) + 1
  const xpPerLevel = 250;
  const currentLevel = Math.floor(totalXP / xpPerLevel) + 1;
  const nextLevelXP = currentLevel * xpPerLevel;
  const currentLevelBaseXP = (currentLevel - 1) * xpPerLevel;
  const xpInCurrentLevel = totalXP - currentLevelBaseXP;
  const progressPercentage = Math.min(100, Math.floor((xpInCurrentLevel / xpPerLevel) * 100));

  const getRankName = (lvl: number) => {
    if (lvl <= 1) return "Focus Novice";
    if (lvl === 2) return "Steady Builder";
    if (lvl === 3) return "Strategic Planner";
    if (lvl === 4) return "Peak Producer";
    if (lvl === 5) return "Mindful Alchemist";
    if (lvl === 6) return "Flow Master";
    if (lvl === 7) return "Sovereign Operator";
    if (lvl === 8) return "Time Lord";
    if (lvl === 9) return "Zen Archmage";
    return "Unshakable Zen Master";
  };

  // Custom Confetti Engine
  const triggerConfetti = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#cca57d", "#dfcaa7", "#967a67", "#816350", "#dfd8cf", "#fdfcf7", "#cca57d"];
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
    }> = [];

    // Spawn bottom left and bottom right
    const spawnCount = 120;
    for (let i = 0; i < spawnCount; i++) {
      const fromLeft = Math.random() > 0.5;
      particles.push({
        x: fromLeft ? 0 : canvas.width,
        y: canvas.height - 20,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: fromLeft ? Math.random() * 12 + 6 : -(Math.random() * 12 + 6),
        speedY: -(Math.random() * 15 + 10),
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 6 - 3,
      });
    }

    let animationFrameId: number;
    const update = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.speedY += 0.35; // gravity
        p.speedX *= 0.98; // friction
        p.rotation += p.rotationSpeed;

        if (p.y < canvas.height) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          // draw rectangle or diamond
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      if (alive) {
        animationFrameId = requestAnimationFrame(update);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    update();
  };

  // Trigger celebration confetti once on load if goals exist
  useEffect(() => {
    if (completedGoals.length > 0) {
      setTimeout(() => triggerConfetti(), 400);
    }
  }, [completedGoals.length]);

  // Request custom AI Victory speech
  const handleFetchVictoryPraise = async (goal: Goal) => {
    if (loadingPraiseId) return;
    setLoadingPraiseId(goal.id);

    try {
      const response = await fetch("/api/ai/victory-praise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          goal,
          profile,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch victory toast");
      }

      const data = await response.json();
      const updatedPraises = {
        ...victoryPraises,
        [goal.id]: data.content,
      };

      setVictoryPraises(updatedPraises);
      localStorage.setItem(`compass_praises_${userId}`, JSON.stringify(updatedPraises));
      setSelectedGoalPraise({ goalTitle: goal.title, content: data.content });
      triggerConfetti();
    } catch (err: any) {
      console.error(err);
      // Fallback local tribute in case API fails
      let fallbackText = `### 🏆 Triumph Verified: ${goal.title}\n\nYou've done it! You reached 100% progress. COMPASS honors your rigorous execution, focus, and strategic alignment in the "${goal.category}" vertical. Maintain this tempo for your remaining active roadmaps.`;
      const updatedPraises = {
        ...victoryPraises,
        [goal.id]: fallbackText,
      };
      setVictoryPraises(updatedPraises);
      localStorage.setItem(`compass_praises_${userId}`, JSON.stringify(updatedPraises));
      setSelectedGoalPraise({ goalTitle: goal.title, content: fallbackText });
    } finally {
      setLoadingPraiseId(null);
    }
  };

  const getTrophyStyle = (priority: Goal["priority"]) => {
    switch (priority) {
      case "High":
        return {
          icon: Crown,
          glow: "shadow-[0_0_20px_rgba(204,165,125,0.4)] border-beige-500/70 bg-gradient-to-br from-brown-900/60 via-brown-950/80 to-brown-900/40",
          iconColor: "text-beige-500 animate-pulse",
          label: "Aurum Crown Trophy",
          badgeBg: "bg-beige-500/10 text-beige-300 border-beige-500/30",
        };
      case "Medium":
        return {
          icon: Medal,
          glow: "shadow-[0_0_15px_rgba(223,202,167,0.25)] border-brown-300/60 bg-gradient-to-br from-brown-900/40 via-brown-950/70 to-brown-900/20",
          iconColor: "text-brown-300",
          label: "Argent Medal Trophy",
          badgeBg: "bg-brown-300/10 text-brown-150 border-brown-300/30",
        };
      case "Low":
      default:
        return {
          icon: Award,
          glow: "shadow-[0_0_10px_rgba(150,122,103,0.15)] border-brown-400/40 bg-gradient-to-br from-brown-950/90 to-brown-900/40",
          iconColor: "text-brown-400",
          label: "Bronze Shield Trophy",
          badgeBg: "bg-brown-500/5 text-brown-400 border-brown-500/20",
        };
    }
  };

  return (
    <div className="relative min-h-[500px]">
      {/* Overlay Canvas for Confetti */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      />

      {/* Header Profile Progress banner */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-brown-200/50 bg-brown-100/5 px-6 py-6 shadow-3xs dark:border-brown-850/80 dark:bg-brown-950/40">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 h-32 w-32 rounded-full bg-beige-500/5 blur-3xl dark:bg-beige-500/10" />
        
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-beige-500/10 text-beige-500 border border-beige-500/30 shadow-3xs">
              <Trophy className="h-7 w-7" />
              <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brown-700 text-[10px] font-bold text-white shadow-3xs">
                {currentLevel}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-bold text-theme-text-main">
                  Focus Operating Level {currentLevel}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-beige-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-beige-500 border border-beige-500/20">
                  {getRankName(currentLevel)}
                </span>
              </div>
              <p className="mt-1 text-xs text-theme-text-muted">
                Keep checking off action items and achieving roadmaps to elevate your focus tier.
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-sm">
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-theme-text-muted">Total Focus EXP: {totalXP} XP</span>
              <span className="text-theme-text-main font-bold">Level {currentLevel + 1} ({nextLevelXP} XP)</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-brown-150 dark:bg-brown-900 border border-brown-200/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brown-500 to-beige-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-theme-text-muted/70 mt-1">
              <span>{xpInCurrentLevel} / {xpPerLevel} XP current tier</span>
              <span>{progressPercentage}% complete</span>
            </div>
          </div>
        </div>

        {/* Small motivational stats deck */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-brown-200/20 pt-5 sm:grid-cols-4">
          <div className="text-center sm:text-left">
            <span className="block text-[10px] uppercase font-mono tracking-wider text-theme-text-muted/60">Achieved Roadmaps</span>
            <span className="font-display text-xl font-bold text-theme-text-main">{completedGoals.length}</span>
          </div>
          <div className="text-center sm:text-left">
            <span className="block text-[10px] uppercase font-mono tracking-wider text-theme-text-muted/60">Milestones Crushed</span>
            <span className="font-display text-xl font-bold text-theme-text-main">{completedTasksCount}</span>
          </div>
          <div className="text-center sm:text-left">
            <span className="block text-[10px] uppercase font-mono tracking-wider text-theme-text-muted/60">Achievements Unlocked</span>
            <span className="font-display text-xl font-bold text-theme-text-main">{unlockedCount} / {ACHIEVEMENTS_LIST.length}</span>
          </div>
          <div className="text-center sm:text-left">
            <span className="block text-[10px] uppercase font-mono tracking-wider text-theme-text-muted/60">Current Focus Streak</span>
            <span className="inline-flex items-center gap-1 font-display text-xl font-bold text-beige-500">
              <Flame className="h-5 w-5 fill-current" /> {streakCount} Days
            </span>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="mb-6 flex border-b border-brown-200/20">
        <button
          onClick={() => setActiveTab("trophies")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "trophies"
              ? "border-beige-500 text-theme-text-main font-bold"
              : "border-transparent text-theme-text-muted hover:text-theme-text-main"
          }`}
        >
          <Trophy className="h-4 w-4" />
          Goal Trophy Room ({completedGoals.length})
        </button>
        <button
          onClick={() => setActiveTab("achievements")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "achievements"
              ? "border-beige-500 text-theme-text-main font-bold"
              : "border-transparent text-theme-text-muted hover:text-theme-text-main"
          }`}
        >
          <Award className="h-4 w-4" />
          Focus Badge Deck ({unlockedCount}/{ACHIEVEMENTS_LIST.length})
        </button>
      </div>

      {/* Main View Grid */}
      <AnimatePresence mode="wait">
        {activeTab === "trophies" ? (
          <motion.div
            key="trophies-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {completedGoals.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brown-200/50 py-16 px-4 text-center dark:border-brown-850/80">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brown-100/50 text-brown-400 dark:bg-brown-950/60 mb-4">
                  <Trophy className="h-8 w-8 stroke-[1.5]" />
                </div>
                <h3 className="font-display text-lg font-bold text-theme-text-main">Your Trophy Case is Waiting</h3>
                <p className="mt-2 max-w-sm text-xs text-theme-text-muted">
                  No goals have reached 100% completion yet. Pour active daily effort into your roadmaps, check off milestones, and claim your permanent golden trophies.
                </p>
                <div className="mt-6 flex gap-3 text-[11px] text-theme-text-muted/85 font-semibold bg-beige-500/5 px-4 py-2.5 rounded-full border border-beige-500/10">
                  <span className="flex items-center gap-1 text-beige-500"><Crown className="h-3 w-3" /> Gold Award:</span> Complete High Priority Goals
                  <span className="text-brown-400">|</span>
                  <span className="flex items-center gap-1 text-brown-300"><Medal className="h-3 w-3" /> Silver Award:</span> Complete Medium Priority
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">
                    Permanently Locked Achievements
                  </h3>
                  <button
                    onClick={triggerConfetti}
                    className="flex items-center gap-1.5 rounded-xl border border-brown-200/80 bg-white/50 px-3 py-1 text-xs font-bold text-theme-text-main shadow-3xs transition hover:bg-white dark:border-brown-800 dark:bg-brown-900/40 dark:hover:bg-brown-900"
                  >
                    <Award className="h-3 w-3 text-beige-500" />
                    Sound Celebration Horn
                  </button>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {completedGoals.map((goal, idx) => {
                    const style = getTrophyStyle(goal.priority);
                    const TrophyIcon = style.icon;
                    const hasPraise = !!victoryPraises[goal.id];

                    return (
                      <motion.div
                        key={goal.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        className={`relative overflow-hidden rounded-2xl border px-5 py-5 flex flex-col justify-between group ${style.glow}`}
                      >
                        {/* Decorative sparkle backdrop */}
                        <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10 group-hover:opacity-20 transition duration-300">
                          <TrophyIcon className="h-28 w-28" />
                        </div>

                        <div>
                          {/* Trophy Badge Row */}
                          <div className="flex items-center justify-between mb-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${style.badgeBg}`}>
                              <TrophyIcon className="h-3.5 w-3.5 fill-current" />
                              {style.label}
                            </span>
                            <span className="text-[10px] font-mono text-theme-text-muted/60">
                              Achieved: {new Date(goal.updatedAt || goal.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric', day: 'numeric' })}
                            </span>
                          </div>

                          <h4 className="font-display text-base font-bold text-theme-text-main line-clamp-1 group-hover:text-beige-500 transition">
                            {goal.title}
                          </h4>
                          <p className="mt-1 text-xs text-theme-text-muted line-clamp-2 h-8">
                            {goal.description || "Completed with impeccable strategic pacing."}
                          </p>

                          {/* Stat indicators */}
                          <div className="mt-4 flex items-center gap-4 border-t border-brown-200/10 pt-3 text-[11px] text-theme-text-muted/80">
                            <div>
                              <span className="font-mono text-theme-text-muted font-semibold">Priority:</span> {goal.priority}
                            </div>
                            <div className="h-3 w-px bg-brown-200/20" />
                            <div>
                              <span className="font-mono text-theme-text-muted font-semibold">Type:</span> {goal.category}
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-brown-200/10 flex flex-col gap-2">
                          {hasPraise ? (
                            <button
                              onClick={() => setSelectedGoalPraise({ goalTitle: goal.title, content: victoryPraises[goal.id] })}
                              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-beige-500/10 hover:bg-beige-500/20 text-beige-500 border border-beige-500/20 py-2 text-xs font-bold transition"
                            >
                              <MessageSquareCode className="h-3.5 w-3.5 text-beige-500" />
                              Read COMPASS Praise
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFetchVictoryPraise(goal)}
                              disabled={loadingPraiseId !== null}
                              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-brown-700/80 hover:bg-brown-700 text-white dark:bg-brown-600/80 dark:hover:bg-brown-600/100 py-2 text-xs font-bold transition disabled:opacity-50"
                            >
                              {loadingPraiseId === goal.id ? (
                                <>
                                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                  Summoning Praise...
                                </>
                              ) : (
                                <>
                                  <MessageSquareCode className="h-3.5 w-3.5 text-beige-400" />
                                  Claim AI Coach Speech
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="achievements-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-theme-text-main">Compass Accomplishment Milestones</h3>
                <p className="text-xs text-theme-text-muted">Unlock these special coaching achievements to gain high XP boosts and cement your legacy.</p>
              </div>
              <div className="rounded-xl bg-beige-500/10 px-3 py-1.5 text-xs font-bold text-beige-500 border border-beige-500/20">
                Unlocked: {unlockedCount} / {ACHIEVEMENTS_LIST.length}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ACHIEVEMENTS_LIST.map((ach) => {
                const isUnlocked = ach.requirementCheck(goals, allTasks, dbReviewsCount, dbAuditsCount, streakCount);
                const Icon = ach.icon;

                return (
                  <div
                    key={ach.id}
                    className={`relative overflow-hidden rounded-xl border p-4 flex flex-col justify-between transition-all duration-300 ${
                      isUnlocked
                        ? "border-beige-500/50 bg-gradient-to-br from-brown-100/5 to-beige-500/5 shadow-3xs"
                        : "border-brown-200/30 bg-brown-100/2 dark:border-brown-850/20 dark:bg-brown-950/10 opacity-75"
                    }`}
                  >
                    <div>
                      {/* Icon & Lock indicator */}
                      <div className="flex items-center justify-between mb-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                          isUnlocked 
                            ? "bg-beige-500/10 text-beige-500 border-beige-500/20"
                            : "bg-brown-100 dark:bg-brown-950 text-theme-text-muted/40 border-transparent"
                        }`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          {isUnlocked ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-beige-500">
                              <Unlock className="h-3 w-3" /> Unlocked
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-mono text-theme-text-muted/50">
                              <Lock className="h-3 w-3 text-theme-text-muted/30" /> Locked
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-theme-text-main">{ach.title}</h4>
                      <p className="mt-1 text-xs text-theme-text-muted line-clamp-3">
                        {ach.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-brown-200/10 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-theme-text-muted/60">Reward:</span>
                      <span className={`font-bold ${isUnlocked ? "text-beige-500" : "text-theme-text-muted/50"}`}>
                        +{ach.xpReward} EXP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Speech Modal */}
      <AnimatePresence>
        {selectedGoalPraise && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-brown-200/80 bg-white p-6 shadow-xl dark:border-brown-850/80 dark:bg-brown-900"
            >
              <div className="absolute top-0 right-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-beige-500/10 blur-2xl" />
              
              <div className="flex items-center gap-2 mb-4 text-beige-500">
                <Trophy className="h-6 w-6 stroke-[1.5]" />
                <h3 className="font-display text-lg font-bold text-theme-text-main">
                  COMPASS Victory Tribute
                </h3>
              </div>

              <div className="prose prose-sm dark:prose-invert max-h-[350px] overflow-y-auto pr-2 markdown-body text-xs text-theme-text-main/90 leading-relaxed border border-brown-200/40 bg-brown-100/5 dark:border-brown-850/50 dark:bg-brown-950/30 p-4 rounded-xl">
                <ReactMarkdown>{selectedGoalPraise.content}</ReactMarkdown>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-brown-200/20 pt-4">
                <span className="text-[10px] font-mono text-theme-text-muted/70">
                  Goal: "{selectedGoalPraise.goalTitle}"
                </span>
                <button
                  onClick={() => setSelectedGoalPraise(null)}
                  className="rounded-xl bg-brown-700 hover:bg-brown-800 text-white dark:bg-brown-600 dark:hover:bg-brown-500 px-5 py-2 text-xs font-bold transition shadow-3xs"
                >
                  Dismiss Tribute
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
