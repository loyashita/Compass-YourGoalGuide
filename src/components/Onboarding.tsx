import React, { useState } from "react";
import { UserProfile } from "../types";
import { db, doc, setDoc } from "../lib/firebase";
import { 
  Sparkles, 
  ArrowRight, 
  Check, 
  Brain, 
  Clock, 
  Activity, 
  Flame, 
  ShieldAlert, 
  ListTodo, 
  Compass,
  HelpCircle,
  Dumbbell,
  HeartHandshake,
  LineChart,
  Sun,
  Moon
} from "lucide-react";

interface OnboardingProps {
  userId: string;
  userEmail: string;
  onComplete: (profile: UserProfile) => void;
  isLightTheme: boolean;
  setIsLightTheme: (val: boolean) => void;
}

export default function Onboarding({ 
  userId, 
  userEmail, 
  onComplete,
  isLightTheme,
  setIsLightTheme
}: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserProfile["role"]>("Student");
  const [aiStyle, setAiStyle] = useState<UserProfile["aiStyle"]>("Balanced");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Academics", "Side Projects", "Personal"]);
  const [extraContext, setExtraContext] = useState("");
  
  // New Expanded Onboarding Questions
  const [blocker, setBlocker] = useState("Overwhelm");
  const [multitaskLevel, setMultitaskLevel] = useState("3-4 Balanced Sprints");
  const [coachingTone, setCoachingTone] = useState<'Tough Love' | 'Supportive' | 'Analytical'>("Supportive");
  const [peakFocusWindow, setPeakFocusWindow] = useState("Early Morning (5am - 9am)");
  const [habitFocus, setHabitFocus] = useState("Daily Checklist habit");
  const [workspaceVibe, setWorkspaceVibe] = useState("Quiet Solitude");

  const [loading, setLoading] = useState(false);

  const roles: UserProfile["role"][] = [
    "Student",
    "Early Career Professional",
    "Founder",
    "Researcher",
  ];

  const blockers = [
    {
      id: "Procrastination",
      label: "🕒 Procrastination",
      desc: "Starting tasks is hard; I delay execution until under extreme deadline pressure."
    },
    {
      id: "Overwhelm",
      label: "🤯 Overwhelm & Freeze",
      desc: "Too many ideas and tasks at once; I freeze up and struggle to decide what is next."
    },
    {
      id: "Vague Milestones",
      label: "🎯 Vague Milestones",
      desc: "I formulate major objectives easily, but struggle to break them into daily checklists."
    },
    {
      id: "Accountability",
      label: "🤝 Lack of Accountability",
      desc: "I start strong, but lose steam without regular status checks or gentle outer pushes."
    },
    {
      id: "Time Constraints",
      label: "⌛ Extreme Time Limits",
      desc: "My schedule is packed; finding focused blocks for deep, distraction-free work is tough."
    }
  ];

  const multitaskLevels = [
    {
      id: "1-2 Laser Focused",
      label: "1-2 Laser Focused Projects",
      desc: "I prefer driving one primary objective to the finish line before opening new tabs."
    },
    {
      id: "3-4 Balanced Sprints",
      label: "3-4 Multi-category Sprints",
      desc: "Dividing focus systematically between work/academics, health, and personal growth."
    },
    {
      id: "5+ Heavy Multitasking",
      label: "5+ Parallel Initiatives",
      desc: "Chronic overload. Constantly context-switching and reacting to competing priorities."
    }
  ];

  const coachingTones: { id: 'Tough Love' | 'Supportive' | 'Analytical'; label: string; desc: string; icon: any }[] = [
    {
      id: "Tough Love",
      label: "Lion's Push (Tough Love)",
      desc: "Direct and unyielding. Holds you accountable to deadlines, calls out stagnation, and demands action.",
      icon: Dumbbell
    },
    {
      id: "Supportive",
      label: "Empathetic Guide (Supportive)",
      desc: "Encouraging and warm. Focuses on reducing anxiety, celebrating small wins, and re-building confidence.",
      icon: HeartHandshake
    },
    {
      id: "Analytical",
      label: "Tactical Strategist (Analytical)",
      desc: "Objective and logical. Focuses strictly on sequencing, resource allocation, and workflow optimization.",
      icon: LineChart
    }
  ];

  const aiStyles: { value: UserProfile["aiStyle"]; label: string; desc: string }[] = [
    { value: "Detailed", label: "Comprehensive Diagnostics", desc: "Provides extensive context, background theories, and deep analytical breakdowns." },
    { value: "Balanced", label: "Balanced Milestones", desc: "Sells you just enough strategic context combined with actionable task checklists." },
    { value: "Concise", label: "Concise Execution Lists", desc: "Zero fluff. Short, direct, prioritized bullet points optimized for speed." },
  ];

  const categories = [
    "Academics",
    "Career",
    "Side Projects",
    "Learning",
    "Personal",
    "Health",
  ];

  const handleCategoryToggle = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length > 1) {
        setSelectedCategories(selectedCategories.filter(c => c !== cat));
      }
    } else {
      if (selectedCategories.length < 5) {
        setSelectedCategories([...selectedCategories, cat]);
      }
    }
  };

  const handleNext = () => {
    if (step < 6) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Synthesize rich responses into extraContext for backward compatibility and model prompt feeding
      const synthesizedContext = `
[User Profile Diagnostic Audit]
- Role: ${role}
- Major Execution Obstacle: ${blocker}
- Cognitive Workload Level: ${multitaskLevel}
- Advisor Tone Preference: ${coachingTone}
- Peak Focus Window: ${peakFocusWindow}
- Core Habit Goal: ${habitFocus}
- Environment Vibe: ${workspaceVibe}
- Background Summary: ${extraContext.trim() || "No additional text summary provided."}
      `.trim();

      const profileData: UserProfile = {
        userId,
        role,
        aiStyle,
        categoryTabs: selectedCategories,
        extraContext: synthesizedContext,
        blocker,
        multitaskLevel,
        coachingTone,
        peakFocusWindow,
        habitFocus,
        workspaceVibe,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "profiles", userId), profileData);
      onComplete(profileData);
    } catch (err) {
      console.error("Onboarding failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-bg-app relative flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans overflow-x-hidden transition-colors duration-300">
      {/* Top Right: Theme Switch Button */}
      <div className="absolute top-4 right-4 z-50">
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

      {/* Subtle concentric orbit lines in background to tie back to the landing art */}
      <section className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full border ${isLightTheme ? 'border-brown-300/30' : 'border-amber-900/20'}`} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border ${isLightTheme ? 'border-brown-300/20' : 'border-amber-900/15'}`} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border ${isLightTheme ? 'border-brown-300/10' : 'border-amber-900/10'}`} />
      </section>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center px-4 relative z-10">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-r from-[#5a3e25] to-[#996c42] text-white mb-4 shadow-lg border border-amber-500/20">
          <Compass className="h-6 w-6 animate-spin-slow" />
        </div>
        <h2 className="text-4xl font-serif font-medium tracking-tight text-theme-text-main select-none">
          Calibrate Your <span className="text-theme-text-muted-mono italic">Compass</span>
        </h2>
        <p className="mt-2 text-xs sm:text-sm font-mono tracking-wide uppercase text-theme-text-muted mx-auto leading-relaxed w-[700px] h-[50px]">
          Let's calibrate your personal goal operating system with a brief diagnostic questionnaire
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[700px] px-4 relative z-10">
        <div id="onboarding-form-card" className="w-[700px] bg-theme-bg-panel/90 py-8 px-6 border border-theme-border-main rounded-[2.5rem] shadow-2xl sm:px-10 backdrop-blur-md transition-colors duration-300">
          
          {/* Progress Indicator Dots & Steps */}
          <div className="relative mb-10">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full bg-theme-border-main h-0.5 rounded-full"></div>
            </div>
            <div className="relative flex justify-between">
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <div
                  key={s}
                  className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-mono font-bold transition-all duration-300 ${
                    s < step
                      ? "bg-theme-bg-accent text-theme-text-accent shadow-xs"
                      : s === step
                      ? "bg-theme-bg-accent text-theme-text-accent ring-4 ring-theme-bg-accent/20"
                      : "bg-theme-bg-card text-theme-text-muted/60 border border-theme-border-main"
                  }`}
                >
                  {s < step ? <Check className="h-4 w-4 stroke-[3px]" /> : s}
                </div>
              ))}
            </div>
          </div>
 
          {/* STEP 1: IDENTITY & ROLE */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-theme-text-muted-mono tracking-widest">Step 1 of 6</span>
                <h3 className="text-xl font-serif font-medium text-theme-text-main tracking-tight">
                  What is your primary commitment?
                </h3>
                <p className="text-xs text-theme-text-muted leading-relaxed">
                  COMPASS tailors its scheduling models to fit your specific weekly workload constraints.
                </p>
              </div>
 
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {roles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`p-4 text-left border rounded-2xl transition-all cursor-pointer ${
                      role === r
                        ? "border-theme-bg-accent bg-theme-bg-card-hover ring-1 ring-theme-bg-accent"
                        : "border-theme-border-subtle hover:border-theme-bg-accent/60 bg-theme-bg-card"
                    }`}
                  >
                    <span className={`block text-sm font-semibold ${role === r ? 'text-theme-text-muted-mono' : 'text-theme-text-main/80'}`}>{r}</span>
                  </button>
                ))}
              </div>
 
              <div className="space-y-2">
                <label htmlFor="extra" className="block text-[10px] font-mono font-bold text-theme-text-muted/80 uppercase tracking-wider">
                  Describe Your Context / Current Overload (Optional)
                </label>
                <textarea
                  id="extra"
                  rows={3}
                  className="mt-1 block w-full rounded-2xl border border-theme-border-subtle bg-theme-bg-app px-4 py-3 text-theme-text-main placeholder-theme-text-muted/30 focus:border-theme-bg-accent focus:outline-none focus:ring-1 focus:ring-theme-bg-accent text-sm"
                  placeholder="e.g. Student balancing full-time coursework with personal projects and exam preparation under tight deadlines."
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                />
              </div>
            </div>
          )}
 
          {/* STEP 2: FOCUS BLOCKERS DIAGNOSTIC */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-theme-text-muted-mono tracking-widest">Step 2 of 6</span>
                <h3 className="text-xl font-serif font-medium text-theme-text-main tracking-tight">
                  Identify your primary execution roadblock
                </h3>
                <p className="text-xs text-theme-text-muted leading-relaxed">
                  Knowing your typical point of failure helps COMPASS customize active warnings and interventions.
                </p>
              </div>
 
              <div className="space-y-3">
                {blockers.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBlocker(b.id)}
                    className={`w-full p-4 text-left border rounded-2xl transition-all flex justify-between items-center cursor-pointer ${
                      blocker === b.id
                        ? "border-theme-bg-accent bg-theme-bg-card-hover ring-1 ring-theme-bg-accent"
                        : "border-theme-border-subtle hover:border-theme-bg-accent/60 bg-theme-bg-card"
                    }`}
                  >
                    <div className="pr-4">
                      <span className={`block text-sm font-semibold ${blocker === b.id ? 'text-theme-text-muted-mono' : 'text-theme-text-main/90'}`}>{b.label}</span>
                      <span className="block text-xs text-theme-text-muted/80 mt-1 leading-relaxed">{b.desc}</span>
                    </div>
                    {blocker === b.id && (
                      <div className="h-5 w-5 rounded-full bg-theme-bg-accent flex items-center justify-center text-theme-text-accent shrink-0">
                        <Check className="h-3 w-3 stroke-[3px]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
 
          {/* STEP 3: COGNITIVE WORKLOAD & PRESSURE */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-theme-text-muted-mono tracking-widest">Step 3 of 6</span>
                <h3 className="text-xl font-serif font-medium text-theme-text-main tracking-tight">
                  What is your typical concurrency level?
                </h3>
                <p className="text-xs text-theme-text-muted leading-relaxed">
                  If you juggle multiple heavy goals, we activate severe workload alerts and portfolio rebalancing recommendations automatically.
                </p>
              </div>
 
              <div className="space-y-3">
                {multitaskLevels.map((ml) => (
                  <button
                    key={ml.id}
                    type="button"
                    onClick={() => setMultitaskLevel(ml.id)}
                    className={`w-full p-4 text-left border rounded-2xl transition-all flex justify-between items-center cursor-pointer ${
                      multitaskLevel === ml.id
                        ? "border-theme-bg-accent bg-theme-bg-card-hover ring-1 ring-theme-bg-accent"
                        : "border-theme-border-subtle hover:border-theme-bg-accent/60 bg-theme-bg-card"
                    }`}
                  >
                    <div className="pr-4">
                      <span className={`block text-sm font-semibold ${multitaskLevel === ml.id ? 'text-theme-text-muted-mono' : 'text-theme-text-main/90'}`}>{ml.label}</span>
                      <span className="block text-xs text-theme-text-muted/80 mt-1 leading-relaxed">{ml.desc}</span>
                    </div>
                    {multitaskLevel === ml.id && (
                      <div className="h-5 w-5 rounded-full bg-theme-bg-accent flex items-center justify-center text-theme-text-accent shrink-0">
                        <Check className="h-3 w-3 stroke-[3px]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
 
          {/* STEP 4: AI COACH TONE & STYLE */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-theme-text-muted-mono tracking-widest">Step 4 of 6</span>
                <h3 className="text-xl font-serif font-medium text-theme-text-main tracking-tight">
                  Calibrate your Coach's voice and verbosity
                </h3>
                <p className="text-xs text-theme-text-muted leading-relaxed">
                  Select a communication style that matches your psychological productivity triggers.
                </p>
              </div>
 
              {/* Coaching Tone */}
              <div className="space-y-3">
                <label className="block text-[10px] font-mono font-bold text-theme-text-muted/60 uppercase tracking-widest mb-2">
                  1. Coach Personality Tone
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {coachingTones.map((ct) => {
                    const IconComponent = ct.icon;
                    return (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() => setCoachingTone(ct.id)}
                        className={`p-4 text-left border rounded-2xl transition-all flex flex-col justify-between h-40 cursor-pointer ${
                          coachingTone === ct.id
                            ? "border-theme-bg-accent bg-theme-bg-card-hover ring-1 ring-theme-bg-accent"
                            : "border-theme-border-subtle hover:border-theme-bg-accent/60 bg-theme-bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <IconComponent className={`h-5 w-5 ${coachingTone === ct.id ? 'text-theme-text-muted-mono' : 'text-theme-text-muted/50'}`} />
                          {coachingTone === ct.id && (
                            <span className="h-4 w-4 bg-theme-bg-accent text-theme-text-accent rounded-full flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 stroke-[3px]" />
                            </span>
                          )}
                        </div>
                        <div>
                          <span className={`block text-xs font-bold ${coachingTone === ct.id ? 'text-theme-text-muted-mono' : 'text-theme-text-main/80'}`}>{ct.label}</span>
                          <span className="block text-[10px] text-theme-text-muted/60 mt-1 line-clamp-3 leading-relaxed">{ct.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
 
              {/* AI Details / Verbosity */}
              <div className="space-y-3 pt-4 border-t border-theme-border-subtle">
                <label className="block text-[10px] font-mono font-bold text-theme-text-muted/60 uppercase tracking-widest mb-2">
                  2. Detailed Diagnostics Verbosity
                </label>
                {aiStyles.map((style) => (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => setAiStyle(style.value)}
                    className={`w-full p-4 text-left border rounded-2xl transition-all flex justify-between items-center cursor-pointer ${
                      aiStyle === style.value
                        ? "border-theme-bg-accent bg-theme-bg-card-hover ring-1 ring-theme-bg-accent"
                        : "border-theme-border-subtle hover:border-theme-bg-accent/60 bg-theme-bg-card"
                    }`}
                  >
                    <div className="pr-4">
                      <span className={`block text-sm font-semibold ${aiStyle === style.value ? 'text-theme-text-muted-mono' : 'text-theme-text-main/90'}`}>{style.label}</span>
                      <span className="block text-xs text-theme-text-muted/80 mt-1 leading-relaxed">{style.desc}</span>
                    </div>
                    {aiStyle === style.value && (
                      <div className="h-5 w-5 rounded-full bg-theme-bg-accent flex items-center justify-center text-theme-text-accent shrink-0">
                        <Check className="h-3 w-3 stroke-[3px]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
 
          {/* STEP 5: DAILY FOCUS PATTERNS & HABITS */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-theme-text-muted-mono tracking-widest">Step 5 of 6</span>
                <h3 className="text-xl font-serif font-medium text-theme-text-main tracking-tight">
                  Calibrate your daily focus rhythms & habits
                </h3>
                <p className="text-xs text-theme-text-muted leading-relaxed">
                  COMPASS customizes streak timers and notifications based on your biological peak times and ideal environment.
                </p>
              </div>
 
              {/* Peak Focus Window */}
              <div className="space-y-3">
                <label className="block text-[10px] font-mono font-bold text-theme-text-muted/60 uppercase tracking-widest">
                  1. Peak Cognitive Window
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    "Early Morning (5am - 9am)",
                    "Deep Afternoon (1pm - 5pm)",
                    "Night Owl (9pm - 1am)"
                  ].map((windowOpt) => (
                    <button
                      key={windowOpt}
                      type="button"
                      onClick={() => setPeakFocusWindow(windowOpt)}
                      className={`p-3 text-left border rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        peakFocusWindow === windowOpt
                          ? "border-theme-bg-accent bg-theme-bg-card-hover text-theme-text-muted-mono"
                          : "border-theme-border-subtle hover:border-theme-bg-accent/60 bg-theme-bg-card text-theme-text-main/70"
                      }`}
                    >
                      {windowOpt}
                    </button>
                  ))}
                </div>
              </div>
 
              {/* Core Habit Goal */}
              <div className="space-y-3 pt-4 border-t border-theme-border-subtle">
                <label className="block text-[10px] font-mono font-bold text-theme-text-muted/60 uppercase tracking-widest">
                  2. Primary Daily Habit Goal
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    "Daily Checklist habit",
                    "AI Micro-reflection (5m)",
                    "Streak build-out"
                  ].map((habitOpt) => (
                    <button
                      key={habitOpt}
                      type="button"
                      onClick={() => setHabitFocus(habitOpt)}
                      className={`p-3 text-left border rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        habitFocus === habitOpt
                          ? "border-theme-bg-accent bg-theme-bg-card-hover text-theme-text-muted-mono"
                          : "border-theme-border-subtle hover:border-theme-bg-accent/60 bg-theme-bg-card text-theme-text-main/70"
                      }`}
                    >
                      {habitOpt}
                    </button>
                  ))}
                </div>
              </div>
 
              {/* Workspace Environment */}
              <div className="space-y-3 pt-4 border-t border-theme-border-subtle">
                <label className="block text-[10px] font-mono font-bold text-theme-text-muted/60 uppercase tracking-widest">
                  3. Performance Environment
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    "Quiet Solitude",
                    "Public Cafe / Buzz",
                    "Extreme Deadline Sprints"
                  ].map((vibeOpt) => (
                    <button
                      key={vibeOpt}
                      type="button"
                      onClick={() => setWorkspaceVibe(vibeOpt)}
                      className={`p-3 text-left border rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        workspaceVibe === vibeOpt
                          ? "border-theme-bg-accent bg-theme-bg-card-hover text-theme-text-muted-mono"
                          : "border-theme-border-subtle hover:border-theme-bg-accent/60 bg-theme-bg-card text-theme-text-main/70"
                      }`}
                    >
                      {vibeOpt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
 
          {/* STEP 6: HUBS & CATEGORIES */}
          {step === 6 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-theme-text-muted-mono tracking-widest">Step 6 of 6</span>
                <h3 className="text-xl font-serif font-medium text-theme-text-main tracking-tight">
                  Select your active category hubs
                </h3>
                <p className="text-xs text-theme-text-muted leading-relaxed">
                  Pick up to 5 categories to organize your life portfolio. These will display as your main dashboard navigation tabs.
                </p>
              </div>
 
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {categories.map((cat) => {
                  const selected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategoryToggle(cat)}
                      className={`p-4 text-center border rounded-2xl transition-all text-sm font-bold cursor-pointer ${
                        selected
                          ? "border-theme-bg-accent bg-theme-bg-accent text-theme-text-accent shadow-sm"
                          : "border-theme-border-subtle hover:border-theme-bg-accent/60 bg-theme-bg-card text-theme-text-main/70"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
 
              <p className="text-xs text-theme-text-muted/60 text-center font-semibold uppercase tracking-wider font-mono">
                Currently selected: {selectedCategories.length} of 5 categories
              </p>
            </div>
          )}
 
          {/* Footer Controls */}
          <div className="mt-8 flex justify-between items-center border-t border-theme-border-subtle pt-6">
            <button
              type="button"
              onClick={() => step > 1 && setStep(step - 1)}
              disabled={step === 1 || loading}
              className={`text-xs font-mono font-bold uppercase tracking-widest text-theme-text-muted/60 hover:text-theme-text-main transition cursor-pointer ${
                step === 1 ? "opacity-0 pointer-events-none" : ""
              }`}
            >
              Back
            </button>
 
            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-theme-bg-accent hover:bg-theme-bg-accent-hover text-theme-text-accent px-6 py-3 rounded-2xl text-xs font-mono font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md border border-theme-bg-accent/20 cursor-pointer"
            >
              {loading ? (
                "Calibrating..."
              ) : step === 6 ? (
                <>
                  Lock in Calibrations <Check className="h-4 w-4 stroke-[3px]" />
                </>
              ) : (
                <>
                  Continue <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
