import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import {
  TrendingUp,
  Award,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  BarChart2,
  Calendar,
  Flame,
  Zap,
  Target,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Clock,
  Compass
} from "lucide-react";
import { Goal } from "../types";

interface PortfolioAnalyticsProps {
  goals: Goal[];
  allTasks: any[];
  standaloneTodos: any[];
}

export default function PortfolioAnalytics({
  goals,
  allTasks,
  standaloneTodos
}: PortfolioAnalyticsProps) {
  
  // 1. High-level Metrics Calculation
  const totalGoals = goals.length;
  const activeGoals = goals.filter(g => g.status === "active");
  const completedGoals = goals.filter(g => g.status === "completed");
  const avgProgress = totalGoals > 0 
    ? Math.round(goals.reduce((acc, g) => acc + (g.progressPercentage || 0), 0) / totalGoals) 
    : 0;

  // Task Deliverables calculations (Goal Tasks)
  const totalGoalTasks = allTasks.length;
  const completedGoalTasks = allTasks.filter(t => t.status === "completed").length;
  const pendingGoalTasks = allTasks.filter(t => t.status === "pending").length;

  // Standalone Todo calculations
  const totalStandalone = standaloneTodos.length;
  const completedStandalone = standaloneTodos.filter(t => t.completed).length;
  const pendingStandalone = standaloneTodos.filter(t => !t.completed).length;

  // Aggregated Deliverables
  const totalDeliverables = totalGoalTasks + totalStandalone;
  const totalCompletedDeliverables = completedGoalTasks + completedStandalone;
  const totalPendingDeliverables = pendingGoalTasks + pendingStandalone;
  const taskCompletionRate = totalDeliverables > 0 
    ? Math.round((totalCompletedDeliverables / totalDeliverables) * 100) 
    : 0;

  // Confidence Score Stats
  const activeWithConfidence = activeGoals.filter(g => g.confidenceScore !== undefined);
  const avgConfidence = activeWithConfidence.length > 0
    ? (activeWithConfidence.reduce((acc, g) => acc + g.confidenceScore, 0) / activeWithConfidence.length).toFixed(1)
    : "0.0";
  
  const confidenceScoreNum = parseFloat(avgConfidence);
  const confidenceEmoji = 
    confidenceScoreNum >= 4.5 ? "Excellent" :
    confidenceScoreNum >= 3.5 ? "On Track" :
    confidenceScoreNum >= 2.5 ? "Balanced" :
    confidenceScoreNum >= 1.5 ? "Fragile" : "Overloaded";

  // 2. Chart Dataset A: Average Progress and Goals count per Category
  const categories = Array.from(new Set(goals.map(g => g.category)));
  const categoryData = categories.map(cat => {
    const catGoals = goals.filter(g => g.category === cat);
    const avgProg = catGoals.reduce((acc, g) => acc + (g.progressPercentage || 0), 0) / catGoals.length;
    const avgConf = catGoals.reduce((acc, g) => acc + (g.confidenceScore || 0), 0) / catGoals.length;
    return {
      name: cat,
      "Average Progress (%)": Math.round(avgProg),
      "Average Confidence": parseFloat(avgConf.toFixed(1)),
      "Goals Count": catGoals.length
    };
  });

  // 3. Chart Dataset B: Task Priority Breakdown
  const highPriorityTasks = allTasks.filter(t => t.priority === "High").length + standaloneTodos.filter(t => t.priority === "High").length;
  const medPriorityTasks = allTasks.filter(t => t.priority === "Medium").length + standaloneTodos.filter(t => t.priority === "Medium").length;
  const lowPriorityTasks = allTasks.filter(t => t.priority === "Low").length + standaloneTodos.filter(t => t.priority === "Low").length;

  const priorityDataset = [
    { name: "High Priority", value: highPriorityTasks, color: "#816350" }, // Darkest Earth Brown
    { name: "Medium Priority", value: medPriorityTasks, color: "#af9784" }, // Muted Sand Brown
    { name: "Low Priority", value: lowPriorityTasks, color: "#ebdcc3" }   // Light Beige Brown
  ].filter(p => p.value > 0);

  // 4. Chart Dataset C: Target Deadlines & Confidence mapping
  const timelineDataset = activeGoals
    .filter(g => g.targetDate && g.targetDate.trim() !== "")
    .map(g => {
      const daysRemaining = Math.ceil(
        (new Date(g.targetDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
      );
      return {
        title: g.title.length > 25 ? g.title.substring(0, 25) + "..." : g.title,
        "Progress (%)": g.progressPercentage,
        "Confidence Score (x20)": g.confidenceScore * 20,
        "Days Left": daysRemaining > 0 ? daysRemaining : 0
      };
    })
    .sort((a, b) => a["Days Left"] - b["Days Left"]);

  // 5. Intelligent Rule-Based Strategic Diagnostics (AI Coaching Assistant)
  const diagnostics: { type: "danger" | "warning" | "success" | "info"; title: string; desc: string; tip: string }[] = [];

  // Rules Engine
  const bottleneckGoals = activeGoals.filter(g => g.priority === "High" && g.progressPercentage < 30);
  if (bottleneckGoals.length > 0) {
    diagnostics.push({
      type: "danger",
      title: "Active High-Priority Bottleneck",
      desc: `You have ${bottleneckGoals.length} high-priority goal(s) currently stalled under 30% progress (including "${bottleneckGoals[0].title}").`,
      tip: "We recommend using the 'Rebalance Advisor' to split these major deliverables into hyper-focused micro-steps."
    });
  }

  const lowConfidenceGoals = activeGoals.filter(g => g.confidenceScore <= 2);
  if (lowConfidenceGoals.length > 0) {
    diagnostics.push({
      type: "warning",
      title: "Confidence Score Regression",
      desc: `Confidence is dangerously low on ${lowConfidenceGoals.length} active goal(s). Under stress, human operator completion rates decline.`,
      tip: "Reduce multitask load. Focus purely on one key goal until progress exceeds 50% to rebuild emotional momentum."
    });
  }

  const highMomentumGoals = activeGoals.filter(g => g.progressPercentage >= 70 && g.confidenceScore >= 4);
  if (highMomentumGoals.length > 0) {
    diagnostics.push({
      type: "success",
      title: "High-Momentum Sprints",
      desc: `Your goal "${highMomentumGoals[0].title}" has excellent progress (${highMomentumGoals[0].progressPercentage}%) and strong confidence!`,
      tip: "Maintain this high focus! Lock down distractions to deliver this goal fully over the next few consecutive days."
    });
  }

  // Check if overload across categories
  const academicsOverload = goals.filter(g => g.category === "Academics" && g.status === "active").length;
  if (academicsOverload >= 4) {
    diagnostics.push({
      type: "info",
      title: "Academic Workload Concentration",
      desc: `You have ${academicsOverload} active Academics goals. This heavy concentration creates scheduling friction with other areas.`,
      tip: "Be comfortable scheduling side projects or personal tasks in sequence, rather than attempting to balance all at once."
    });
  }

  if (diagnostics.length === 0) {
    diagnostics.push({
      type: "success",
      title: "System Calibrated & Balanced",
      desc: "All portfolio indicators show stable performance metrics. No severe workload conflicts or confidence anomalies detected.",
      tip: "Excellent execution. Continue checking in daily and maintaining your habit streaks to reinforce consistency."
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. KEY ANALYTIC METRICS BOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Metric 1 */}
        <div className="bg-theme-bg-card border border-theme-border-main p-5 rounded-2xl shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold text-theme-text-muted-mono uppercase tracking-wider">
              Goal Completion Rate
            </span>
            <div className="h-7 w-7 rounded-lg bg-theme-bg-card-hover flex items-center justify-center text-theme-text-muted">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold font-display text-theme-text-main">
              {totalGoals > 0 ? Math.round((completedGoals.length / totalGoals) * 100) : 0}%
            </span>
            <span className="text-[10px] text-theme-text-muted font-mono">
              ({completedGoals.length}/{totalGoals} goals)
            </span>
          </div>
          <div className="mt-2.5">
            <div className="w-full bg-theme-bg-card-hover h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-theme-bg-accent h-full rounded-full transition-all duration-500"
                style={{ width: `${totalGoals > 0 ? (completedGoals.length / totalGoals) * 100 : 0}%` }}
              ></div>
            </div>
            <span className="block text-[9px] text-theme-text-muted-mono font-medium mt-1.5">
              Average Progress across all: <strong>{avgProgress}%</strong>
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-theme-bg-card border border-theme-border-main p-5 rounded-2xl shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold text-theme-text-muted-mono uppercase tracking-wider">
              Task Delivery Index (TDI)
            </span>
            <div className="h-7 w-7 rounded-lg bg-theme-bg-card-hover flex items-center justify-center text-theme-text-muted">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold font-display text-theme-text-main">
              {taskCompletionRate}%
            </span>
            <span className="text-[10px] text-theme-text-muted font-mono">
              ({totalCompletedDeliverables}/{totalDeliverables} items)
            </span>
          </div>
          <div className="mt-2.5">
            <div className="w-full bg-theme-bg-card-hover h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-theme-bg-accent h-full rounded-full transition-all duration-500"
                style={{ width: `${taskCompletionRate}%` }}
              ></div>
            </div>
            <span className="block text-[9px] text-theme-text-muted-mono font-medium mt-1.5">
              Goal Tasks: <strong>{completedGoalTasks}/{totalGoalTasks}</strong> &middot; Standalone: <strong>{completedStandalone}/{totalStandalone}</strong>
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-theme-bg-card border border-theme-border-main p-5 rounded-2xl shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold text-theme-text-muted-mono uppercase tracking-wider">
              Strategic Confidence
            </span>
            <div className="h-7 w-7 rounded-lg bg-theme-bg-card-hover flex items-center justify-center text-theme-text-muted">
              <Compass className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold font-display text-theme-text-main">
              {avgConfidence}
            </span>
            <span className="text-[10px] text-theme-text-muted font-mono">
              / 5.0 rating
            </span>
          </div>
          <div className="mt-2 text-[10px] font-mono font-bold text-theme-text-muted flex items-center gap-1.5 bg-theme-bg-card-hover border border-theme-border-subtle px-2 py-1 rounded-lg">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                confidenceScoreNum >= 3.5 ? "bg-green-400" : confidenceScoreNum >= 2.5 ? "bg-yellow-400" : "bg-red-400"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                confidenceScoreNum >= 3.5 ? "bg-green-500" : confidenceScoreNum >= 2.5 ? "bg-yellow-500" : "bg-red-500"
              }`}></span>
            </span>
            <span>Status: {confidenceEmoji}</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-theme-bg-card border border-theme-border-main p-5 rounded-2xl shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold text-theme-text-muted-mono uppercase tracking-wider">
              Deliverables Pending
            </span>
            <div className="h-7 w-7 rounded-lg bg-theme-bg-card-hover flex items-center justify-center text-theme-text-main">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold font-display text-red-600 dark:text-red-400">
              {totalPendingDeliverables}
            </span>
            <span className="text-[10px] text-theme-text-muted font-mono">
              active tasks
            </span>
          </div>
          <div className="mt-2 text-[9px] text-theme-text-muted-mono leading-normal">
            Sequence these into focus blocks instead of multitasking to optimize cognitive resource limits.
          </div>
        </div>

      </div>

      {/* 2. RECHARTS INTERACTIVE VISUALIZATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart A: Goal Progress & Confidence by Category */}
        <div className="lg:col-span-2 bg-theme-bg-card border border-theme-border-main p-6 rounded-2xl shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-theme-text-main font-display">Category Progression Mapping</h3>
            <p className="text-[10px] text-theme-text-muted">Compares progress percentage and average confidence across strategic themes</p>
          </div>
          
          {categoryData.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center border border-dashed border-theme-border-subtle rounded-xl text-xs text-theme-text-muted italic">
              No categories populated to graph.
            </div>
          ) : (
            <div className="w-full">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-theme-border-subtle opacity-50" />
                  <XAxis 
                    dataKey="name" 
                    stroke="currentColor" 
                    className="text-theme-text-muted-mono"
                    fontSize={10} 
                    fontFamily="JetBrains Mono" 
                  />
                  <YAxis 
                    stroke="currentColor" 
                    className="text-theme-text-muted-mono"
                    fontSize={10} 
                    fontFamily="JetBrains Mono" 
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "var(--bg-panel)", 
                      borderColor: "var(--border-main)", 
                      borderRadius: "12px",
                      fontSize: "11px",
                      color: "var(--text-main)"
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: "10px", fontFamily: "Inter", paddingTop: "10px" }}
                    verticalAlign="bottom"
                  />
                  <Bar dataKey="Average Progress (%)" fill="var(--text-muted)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Average Confidence" fill="var(--bg-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart B: Pending Tasks Priority Breakdown (Pie Chart) */}
        <div className="bg-theme-bg-card border border-theme-border-main p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-theme-text-main font-display">Task Priority Distribution</h3>
            <p className="text-[10px] text-theme-text-muted">Breakdown of pending goal deliverables and standalone tasks</p>
          </div>

          {priorityDataset.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center border border-dashed border-theme-border-subtle rounded-xl text-xs text-theme-text-muted italic">
              No pending tasks available.
            </div>
          ) : (
            <div className="relative flex-1 flex flex-col items-center justify-center my-2">
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={priorityDataset}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {priorityDataset.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "var(--bg-panel)", 
                      borderColor: "var(--border-main)", 
                      borderRadius: "12px",
                      fontSize: "11px",
                      color: "var(--text-main)"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Custom Legend to match brown theme */}
              <div className="w-full flex justify-center gap-4 mt-2">
                {priorityDataset.map((item, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="text-[10px] font-semibold text-theme-text-muted">{item.name} ({item.value})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-theme-bg-card-hover border border-theme-border-subtle p-3 rounded-xl text-[10px] leading-relaxed text-theme-text-muted">
            <strong>Cognitive Tip:</strong> Address <em>High Priority</em> tasks first in your peak focus window to reduce cognitive overhead and friction.
          </div>
        </div>

      </div>

      {/* 3. TIMELINE & PROGRESS SCATTER AREA */}
      <div className="bg-theme-bg-card border border-theme-border-main p-6 rounded-2xl shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-theme-text-main font-display">Milestone Deadlines & Confidence Velocity</h3>
          <p className="text-[10px] text-theme-text-muted">Goals sorted by urgency (left to right) with progress comparison and self-reported confidence index</p>
        </div>

        {timelineDataset.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center border border-dashed border-theme-border-subtle rounded-xl text-xs text-theme-text-muted italic">
            No active goals available to plot timeline.
          </div>
        ) : (
          <div className="w-full">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timelineDataset} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--text-muted)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--text-muted)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--bg-accent)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--bg-accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-theme-border-subtle opacity-50" />
                <XAxis 
                  dataKey="title" 
                  stroke="currentColor" 
                  className="text-theme-text-muted-mono"
                  fontSize={9} 
                  fontFamily="Inter"
                  tickLine={false}
                />
                <YAxis 
                  stroke="currentColor" 
                  className="text-theme-text-muted-mono"
                  fontSize={10} 
                  fontFamily="JetBrains Mono" 
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "var(--bg-panel)", 
                    borderColor: "var(--border-main)", 
                    borderRadius: "12px",
                    fontSize: "11px",
                    color: "var(--text-main)"
                  }}
                />
                <Area type="monotone" dataKey="Progress (%)" stroke="var(--text-muted)" fillOpacity={1} fill="url(#colorProgress)" />
                <Area type="monotone" dataKey="Confidence Score (x20)" stroke="var(--bg-accent)" fillOpacity={1} fill="url(#colorConfidence)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 4. AI STRATEGIC COACHING DIAGNOSTICS */}
      <div className="bg-theme-bg-card border border-theme-border-main rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-theme-bg-accent text-theme-text-accent flex items-center justify-center">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-theme-text-main font-display">AI Coach Strategic Diagnostic</h3>
            <p className="text-[10px] text-theme-text-muted">Real-time heuristics monitoring your workload integrity</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {diagnostics.map((diag, index) => (
            <div 
              key={index}
              className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                diag.type === "danger" ? "bg-[var(--alert-danger-bg)] border-[var(--alert-danger-border)]" :
                diag.type === "warning" ? "bg-[var(--alert-warning-bg)] border-[var(--alert-warning-border)]" :
                diag.type === "success" ? "bg-[var(--alert-success-bg)] border-[var(--alert-success-border)]" :
                "bg-theme-bg-card-hover border-theme-border-subtle"
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  {diag.type === "danger" && <AlertTriangle className="h-4.5 w-4.5 text-[var(--alert-danger-text)]" />}
                  {diag.type === "warning" && <AlertTriangle className="h-4.5 w-4.5 text-[var(--alert-warning-text)]" />}
                  {diag.type === "success" && <ShieldCheck className="h-4.5 w-4.5 text-[var(--alert-success-text)]" />}
                  {diag.type === "info" && <Compass className="h-4.5 w-4.5 text-theme-text-muted-mono" />}
                  
                  <span className={`text-xs font-bold ${
                    diag.type === "danger" ? "text-[var(--alert-danger-text)]" :
                    diag.type === "warning" ? "text-[var(--alert-warning-text)]" :
                    diag.type === "success" ? "text-[var(--alert-success-text)]" :
                    "text-theme-text-main"
                  }`}>
                    {diag.title}
                  </span>
                </div>
                <p className="text-xs text-theme-text-main leading-relaxed">
                  {diag.desc}
                </p>
              </div>
              
              <div className="text-[10px] font-medium leading-relaxed bg-theme-bg-app border border-dashed rounded-lg border-theme-border-main p-2.5 mt-1">
                <span className="font-bold text-theme-text-main">Recommendation: </span>
                <span className="text-theme-text-muted">{diag.tip}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
