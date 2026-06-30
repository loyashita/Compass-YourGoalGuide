import React, { useState } from "react";
import { UserProfile } from "../types";
import { db, doc, setDoc, deleteDoc } from "../lib/firebase";
import { 
  Settings, 
  User, 
  Trash2, 
  Check, 
  Brain, 
  Flame, 
  ShieldAlert, 
  Sliders, 
  Compass, 
  AlertTriangle,
  Loader2,
  HeartHandshake,
  Dumbbell,
  LineChart,
  HelpCircle,
  Calendar,
  ListTodo,
  RefreshCw
} from "lucide-react";

interface SettingsViewProps {
  profile: UserProfile;
  userId: string;
  onProfileUpdate: (updated: UserProfile) => void;
  onAccountDeleted: () => void;
  googleAccessToken: string | null;
  onConnectGoogle: () => Promise<string | null>;
  onDisconnectGoogle?: () => void;
}

export default function SettingsView({ 
  profile, 
  userId, 
  onProfileUpdate, 
  onAccountDeleted,
  googleAccessToken,
  onConnectGoogle,
  onDisconnectGoogle
}: SettingsViewProps) {
  // State variables synchronized with user's profile
  const [role, setRole] = useState<UserProfile["role"]>(profile.role || "Student");
  const [aiStyle, setAiStyle] = useState<UserProfile["aiStyle"]>(profile.aiStyle || "Balanced");
  const [coachingTone, setCoachingTone] = useState<UserProfile["coachingTone"]>(profile.coachingTone || "Supportive");
  const [blocker, setBlocker] = useState(profile.blocker || "Overwhelm");
  const [multitaskLevel, setMultitaskLevel] = useState(profile.multitaskLevel || "3-4 Balanced Sprints");
  const [peakFocusWindow, setPeakFocusWindow] = useState(profile.peakFocusWindow || "Early Morning (5am - 9am)");
  const [habitFocus, setHabitFocus] = useState(profile.habitFocus || "Daily Checklist habit");
  const [workspaceVibe, setWorkspaceVibe] = useState(profile.workspaceVibe || "Quiet Solitude");
  const [googleCalendarSyncEnabled, setGoogleCalendarSyncEnabled] = useState(profile.googleCalendarSyncEnabled || false);
  const [googleTasksSyncEnabled, setGoogleTasksSyncEnabled] = useState(profile.googleTasksSyncEnabled || false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(profile.categoryTabs || ["Academics", "Side Projects", "Personal"]);
  const [extraContext, setExtraContext] = useState(() => {
    if (!profile.extraContext) return "";
    const match = profile.extraContext.match(/- Background Summary:\s*(.*)/s);
    if (match) {
      const summary = match[1].trim();
      return summary === "No additional text summary provided." ? "" : summary;
    }
    return profile.extraContext;
  }); // extra manual override context

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const roles: UserProfile["role"][] = ["Student", "Early Career Professional", "Founder", "Researcher"];
  const categories = ["Academics", "Career", "Side Projects", "Learning", "Personal", "Health"];

  const blockers = [
    "Procrastination",
    "Overwhelm",
    "Vague Milestones",
    "Accountability",
    "Time Constraints"
  ];

  const coachingTones: { id: UserProfile["coachingTone"]; label: string; icon: any }[] = [
    { id: "Tough Love", label: "Lion's Push (Tough Love)", icon: Dumbbell },
    { id: "Supportive", label: "Empathetic Guide (Supportive)", icon: HeartHandshake },
    { id: "Analytical", label: "Tactical Strategist (Analytical)", icon: LineChart }
  ];

  const aiStyles: { value: UserProfile["aiStyle"]; label: string; desc: string }[] = [
    { value: "Detailed", label: "Detailed", desc: "Deep analytical context and background theories." },
    { value: "Balanced", label: "Balanced", desc: "Strategic context combined with actionable checklists." },
    { value: "Concise", label: "Concise", desc: "Short, direct, prioritized bullet points." }
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

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
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

      const updatedProfile: UserProfile = {
        ...profile,
        role,
        aiStyle,
        coachingTone,
        blocker,
        multitaskLevel,
        peakFocusWindow,
        habitFocus,
        workspaceVibe,
        googleCalendarSyncEnabled,
        googleTasksSyncEnabled,
        categoryTabs: selectedCategories,
        extraContext: synthesizedContext,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "profiles", userId), updatedProfile);
      onProfileUpdate(updatedProfile);
      setSuccessMsg("Settings updated successfully!");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error("Failed to update profile settings:", err);
      setErrorMsg(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setErrorMsg(null);

    try {
      // 1. Delete user profile from database
      await deleteDoc(doc(db, "profiles", userId));
      
      // 2. Clear local storage mode details
      localStorage.removeItem("compass_local_mode");
      localStorage.removeItem(`compass_quote_${userId}`);
      
      onAccountDeleted();
    } catch (err: any) {
      console.error("Failed to delete account:", err);
      setErrorMsg(err.message || "Failed to delete account profile.");
      setDeleting(false);
    }
  };

  return (
    <div id="settings-view-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      {/* COLUMN 1 & 2: Edit Form Settings */}
      <form onSubmit={handleSaveSettings} className="lg:col-span-2 bg-theme-bg-card border border-theme-border-main rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col gap-6 text-theme-text-main">
        <div className="flex items-center gap-2 pb-3 border-b border-theme-border-subtle">
          <div className="h-9 w-9 rounded-xl bg-theme-bg-accent text-theme-text-accent flex items-center justify-center">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-theme-text-main font-display">
              Workspace Calibration Settings
            </h2>
            <p className="text-[10px] font-mono font-bold text-theme-text-muted uppercase tracking-wider">
              Tune your diagnostic, AI advisor styling and detail goals
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2 shadow-2xs">
            <Check className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 flex items-center gap-2 shadow-2xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Roles and Categories */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-mono font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
              Current Focus Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserProfile["role"])}
              className="w-full text-xs rounded-xl border border-theme-border-main bg-theme-bg-panel text-theme-text-main p-2.5 outline-none focus:ring-1 focus:ring-theme-border-main"
              required
            >
              {roles.map(r => (
                <option key={r} value={r} className="bg-white dark:bg-[#1c140e] text-[#221712] dark:text-white">{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
              Primary Coaching Tone
            </label>
            <div className="grid grid-cols-3 gap-2">
              {coachingTones.map((t) => {
                const Icon = t.icon;
                const isSelected = coachingTone === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCoachingTone(t.id!)}
                    className={`p-2 rounded-xl border text-[10px] font-semibold flex flex-col items-center gap-1 text-center transition ${
                      isSelected
                        ? "bg-theme-bg-accent border-theme-bg-accent text-theme-text-accent shadow-xs"
                        : "bg-theme-bg-panel border-theme-border-main hover:bg-theme-bg-card-hover text-theme-text-main"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{t.id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* AI Style */}
        <div>
          <label className="block text-[11px] font-mono font-bold text-theme-text-muted uppercase tracking-wider mb-2">
            AI Assistant Communication Detail Style
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {aiStyles.map((style) => {
              const isSelected = aiStyle === style.value;
              return (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => setAiStyle(style.value)}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${
                    isSelected
                      ? "bg-theme-bg-accent border-theme-bg-accent text-theme-text-accent shadow-xs"
                      : "bg-theme-bg-panel border-theme-border-main hover:bg-theme-bg-card-hover text-theme-text-main"
                  }`}
                >
                  <span className="text-xs font-bold">{style.label}</span>
                  <span className={`text-[10px] leading-tight ${isSelected ? "text-theme-text-accent/80" : "text-theme-text-muted"}`}>
                    {style.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Diagnostic parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-mono font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
              Major Execution Obstacle
            </label>
            <select
              value={blocker}
              onChange={(e) => setBlocker(e.target.value)}
              className="w-full text-xs rounded-xl border border-theme-border-main bg-theme-bg-panel text-theme-text-main p-2.5 outline-none focus:ring-1 focus:ring-theme-border-main"
            >
              {blockers.map(b => (
                <option key={b} value={b} className="bg-white dark:bg-[#1c140e] text-[#221712] dark:text-white">{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
              Cognitive Workload Level
            </label>
            <select
              value={multitaskLevel}
              onChange={(e) => setMultitaskLevel(e.target.value)}
              className="w-full text-xs rounded-xl border border-theme-border-main bg-theme-bg-panel text-theme-text-main p-2.5 outline-none focus:ring-1 focus:ring-theme-border-main"
            >
              <option value="1-2 Laser Focused" className="bg-white dark:bg-[#1c140e] text-[#221712] dark:text-white">1-2 Laser Focused Projects</option>
              <option value="3-4 Balanced Sprints" className="bg-white dark:bg-[#1c140e] text-[#221712] dark:text-white">3-4 Balanced Sprints</option>
              <option value="5+ Heavy Multitasking" className="bg-white dark:bg-[#1c140e] text-[#221712] dark:text-white">5+ Heavy Multitasking</option>
            </select>
          </div>
        </div>

        {/* Focus Window and Vibe */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-mono font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
              Peak Focus Window
            </label>
            <input
              type="text"
              value={peakFocusWindow}
              onChange={(e) => setPeakFocusWindow(e.target.value)}
              className="w-full text-xs rounded-xl border border-theme-border-main bg-theme-bg-panel text-theme-text-main p-2.5 outline-none focus:ring-1 focus:ring-theme-border-main placeholder-theme-text-muted"
              placeholder="e.g. Late Night (10pm - 2am)"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
              Core Habit focus
            </label>
            <input
              type="text"
              value={habitFocus}
              onChange={(e) => setHabitFocus(e.target.value)}
              className="w-full text-xs rounded-xl border border-theme-border-main bg-theme-bg-panel text-theme-text-main p-2.5 outline-none focus:ring-1 focus:ring-theme-border-main placeholder-theme-text-muted"
              placeholder="e.g. Pomodoro breaks every 45m"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
              Workspace Vibe
            </label>
            <input
              type="text"
              value={workspaceVibe}
              onChange={(e) => setWorkspaceVibe(e.target.value)}
              className="w-full text-xs rounded-xl border border-theme-border-main bg-theme-bg-panel text-theme-text-main p-2.5 outline-none focus:ring-1 focus:ring-theme-border-main placeholder-theme-text-muted"
              placeholder="e.g. Ambient lofi background"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div>
          <label className="block text-[11px] font-mono font-bold text-theme-text-muted uppercase tracking-wider mb-2">
            Active Portfolio Categories (Select up to 5)
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryToggle(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                    isSelected
                      ? "bg-theme-bg-accent border-theme-bg-accent text-theme-text-accent shadow-xs"
                      : "bg-theme-bg-panel border-theme-border-main hover:bg-theme-bg-card-hover text-theme-text-main"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Extra Manual Context */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-[11px] font-mono font-bold text-theme-text-muted uppercase tracking-wider">
              Extra Manual Text Summary (Overriding)
            </label>
            <span className="text-[10px] text-theme-text-muted-mono font-medium">Appends to AI Context Payload</span>
          </div>
          <textarea
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder="Add any additional details about your goals, exams, or custom instructions that COMPASS AI should know..."
            className="w-full text-xs rounded-xl border border-theme-border-main bg-theme-bg-panel text-theme-text-main p-3 outline-none focus:ring-1 focus:ring-theme-border-main h-20 resize-none font-sans placeholder-theme-text-muted"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-theme-bg-accent hover:bg-theme-bg-accent-hover text-theme-text-accent rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs active:scale-95"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving Calibration Settings...</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              <span>Save Calibration & Rediagnose</span>
            </>
          )}
        </button>
      </form>

      {/* COLUMN 3: AI Context Profile & Delete Account Card */}
      <div id="settings-sidebar" className="flex flex-col gap-6">
        {/* SECTION: AI Context Mirror Profile */}
        <div className="bg-theme-bg-accent text-theme-text-accent rounded-3xl p-5 shadow-xs flex flex-col gap-4 border border-theme-border-main">
          <div className="flex items-center gap-2 pb-2.5 border-b border-theme-text-accent/20">
            <Brain className="h-5 w-5 text-yellow-300 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold font-display">AI Context Mirror</h3>
              <p className="text-[9px] font-mono font-bold text-theme-text-accent/70 uppercase tracking-wider">
                What the AI advisor knows about you
              </p>
            </div>
          </div>

          <p className="text-xs text-theme-text-accent/90 leading-relaxed">
            COMPASS uses this tailored profile context during every daily diagnostic, roadmap generation, weekly review, and active chat session to craft bespoke coaching strategies.
          </p>

          <div className="space-y-3 bg-black/20 p-3.5 rounded-2xl border border-theme-text-accent/20 font-sans text-xs">
            <div className="flex justify-between border-b border-theme-text-accent/10 pb-1.5">
              <span className="text-theme-text-accent/70 font-semibold text-[10px] uppercase font-mono">My Identity</span>
              <span className="font-bold text-theme-text-accent">{role}</span>
            </div>

            <div className="flex justify-between border-b border-theme-text-accent/10 pb-1.5">
              <span className="text-theme-text-accent/70 font-semibold text-[10px] uppercase font-mono">Style</span>
              <span className="font-bold text-theme-text-accent">{aiStyle} Detail</span>
            </div>

            <div className="flex justify-between border-b border-theme-text-accent/10 pb-1.5">
              <span className="text-theme-text-accent/70 font-semibold text-[10px] uppercase font-mono">Tone style</span>
              <span className="font-bold text-theme-text-accent">{coachingTone}</span>
            </div>

            <div className="flex justify-between border-b border-theme-text-accent/10 pb-1.5">
              <span className="text-theme-text-accent/70 font-semibold text-[10px] uppercase font-mono">Obstacle</span>
              <span className="font-bold text-theme-text-accent truncate max-w-[120px]" title={blocker}>{blocker}</span>
            </div>

            <div className="flex justify-between border-b border-theme-text-accent/10 pb-1.5">
              <span className="text-theme-text-accent/70 font-semibold text-[10px] uppercase font-mono">Cognitive Load</span>
              <span className="font-bold text-theme-text-accent truncate max-w-[120px]" title={multitaskLevel}>{multitaskLevel}</span>
            </div>

            <div className="flex justify-between border-b border-theme-text-accent/10 pb-1.5">
              <span className="text-theme-text-accent/70 font-semibold text-[10px] uppercase font-mono">Peak Focus</span>
              <span className="font-bold text-theme-text-accent">{peakFocusWindow}</span>
            </div>

            <div className="flex justify-between border-b border-theme-text-accent/10 pb-1.5">
              <span className="text-theme-text-accent/70 font-semibold text-[10px] uppercase font-mono">Vibe</span>
              <span className="font-bold text-theme-text-accent">{workspaceVibe}</span>
            </div>

            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-theme-text-accent/70 font-semibold text-[10px] uppercase font-mono">Active Tab Categories</span>
              <div className="flex flex-wrap gap-1">
                {selectedCategories.map(cat => (
                  <span key={cat} className="bg-theme-bg-accent-hover text-[10px] px-2 py-0.5 rounded-md font-medium">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-black/10 p-3 rounded-2xl border border-theme-text-accent/10 text-[10px] leading-relaxed text-theme-text-accent/70">
            <strong>System prompt metadata:</strong> Synthesized audit logs and current date/time are combined with this configuration context during server-side LLM inference triggers.
          </div>
        </div>

        {/* SECTION: Google Workspace Integration */}
        <div id="google-integration-card" className="bg-theme-bg-card border border-theme-border-main rounded-3xl p-5 shadow-xs flex flex-col gap-4 text-theme-text-main">
          <div className="flex items-center gap-2 pb-2.5 border-b border-theme-border-subtle">
            <div className="h-7 w-7 bg-theme-bg-accent text-theme-text-accent rounded-lg flex items-center justify-center font-bold text-xs">G</div>
            <div>
              <h3 className="text-xs font-bold text-theme-text-main font-display">Google Workspace Sync</h3>
              <p className="text-[9px] font-mono font-bold text-theme-text-muted uppercase tracking-wider">
                Connect Calendar & Tasks
              </p>
            </div>
          </div>

          <p className="text-[11px] text-theme-text-muted leading-relaxed">
            Automatically export your exams, homework deadlines, and structured roadmap milestones into Google Calendar and Google Tasks.
          </p>

          <div className="flex flex-col gap-2.5">
            {/* Calendar Switch */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-theme-bg-panel hover:bg-theme-bg-card-hover border border-theme-border-subtle cursor-pointer transition select-none">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-theme-text-muted" />
                <span className="text-xs font-semibold text-theme-text-main">Google Calendar</span>
              </div>
              <input
                type="checkbox"
                checked={googleCalendarSyncEnabled}
                onChange={(e) => setGoogleCalendarSyncEnabled(e.target.checked)}
                className="rounded text-theme-bg-accent focus:ring-theme-bg-accent h-4 w-4 border-theme-border-main"
              />
            </label>

            {/* Tasks Switch */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-theme-bg-panel hover:bg-theme-bg-card-hover border border-theme-border-subtle cursor-pointer transition select-none">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-theme-text-muted" />
                <span className="text-xs font-semibold text-theme-text-main">Google Tasks</span>
              </div>
              <input
                type="checkbox"
                checked={googleTasksSyncEnabled}
                onChange={(e) => setGoogleTasksSyncEnabled(e.target.checked)}
                className="rounded text-theme-bg-accent focus:ring-theme-bg-accent h-4 w-4 border-theme-border-main"
              />
            </label>
          </div>

          {/* Connection Trigger Button */}
          {(googleCalendarSyncEnabled || googleTasksSyncEnabled) && (
            <div className="pt-1.5 border-t border-theme-border-subtle mt-1 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-theme-text-muted uppercase tracking-wider">
                <span>Auth status:</span>
                {googleAccessToken ? (
                  <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">Connected</span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">Needs Connection</span>
                )}
              </div>

              {!googleAccessToken ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await onConnectGoogle();
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="w-full py-2 bg-theme-bg-accent text-theme-text-accent rounded-xl text-xs font-bold hover:bg-theme-bg-accent-hover active:scale-95 transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 animate-pulse" />
                  <span>Connect Google Account</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50/50 dark:bg-emerald-950/10 p-2 rounded-xl border border-emerald-100 dark:border-emerald-900/40 leading-normal">
                    ✓ Connected! Settings will be applied and synchronized when you click <strong>Save Calibration & Rediagnose</strong>.
                  </div>
                  {onDisconnectGoogle && (
                    <button
                      type="button"
                      onClick={onDisconnectGoogle}
                      className="w-full py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-700 dark:text-red-400 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Disconnect Google Account</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION: Account Lifecycle / Danger Zone */}
        <div className="bg-red-50 border border-red-200 rounded-3xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-red-100">
            <ShieldAlert className="h-5 w-5 text-red-600 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-red-950 font-display">Danger Zone</h3>
              <p className="text-[9px] font-mono font-bold text-red-500 uppercase tracking-wider">
                Permanent Data Actions
              </p>
            </div>
          </div>

          <p className="text-xs text-red-800 leading-normal">
            Deleting your profile will permanently wipe your focus calibration parameters, custom categories, and coaching configurations from our databases.
          </p>

          {showDeleteConfirm ? (
            <div className="bg-white border border-red-200 p-4 rounded-2xl flex flex-col gap-3 animate-fade-in shadow-xs">
              <p className="text-xs font-bold text-red-950 leading-relaxed">
                ⚠️ THIS ACTION IS ENTIRELY IRREVERSIBLE!
              </p>
              <p className="text-[10px] text-neutral-600 leading-relaxed">
                Confirming will completely erase your profile configuration. You will need to re-onboard if you return to COMPASS.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="py-1.5 bg-neutral-100 hover:bg-neutral-250 text-neutral-800 rounded-xl text-[10px] font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1"
                >
                  {deleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  <span>Delete Profile</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2 bg-white hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-red-200 shadow-2xs"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Profile & Clear Data</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
