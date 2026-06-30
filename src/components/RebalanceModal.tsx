import React, { useState, useEffect } from "react";
import { UserProfile, Goal, RebalanceHistory } from "../types";
import { db, doc, updateDoc, collection, addDoc, getDocs, query, where, orderBy } from "../lib/firebase";
import { 
  X, 
  Loader2, 
  ArrowUpRight, 
  ShieldCheck, 
  History, 
  ChevronRight, 
  Check, 
  Calendar, 
  AlertCircle, 
  ArrowRight,
  CheckSquare,
  Square,
  Edit3,
  Sliders,
  HelpCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { safeFetchJson } from "../lib/api";

interface RebalanceModalProps {
  profile: UserProfile;
  goals: Goal[];
  onClose: () => void;
  onGoalsUpdated?: () => void;
}

export default function RebalanceModal({ profile, goals, onClose, onGoalsUpdated }: RebalanceModalProps) {
  const [history, setHistory] = useState<RebalanceHistory[]>([]);
  const [activeStrategy, setActiveStrategy] = useState<RebalanceHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Active generation/action states
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"strategy" | "calibration">("strategy");

  // Interactive Calibration States
  const [proposedChanges, setProposedChanges] = useState<any[]>([]);
  const [selectedForApply, setSelectedForApply] = useState<Record<string, boolean>>({});
  const [applyingChanges, setApplyingChanges] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  // Fetch rebalance logs
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        const q = query(
          collection(db, "rebalance_history"),
          where("userId", "==", profile.userId),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() })) as RebalanceHistory[];
        setHistory(fetched);
        if (fetched.length > 0) {
          setActiveStrategy(fetched[0]);
        }
      } catch (err) {
        console.error("Failed to load rebalance history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [profile.userId]);

  // Load and parse proposed changes whenever the active strategy shifts
  useEffect(() => {
    if (activeStrategy) {
      try {
        const changes = (activeStrategy as any).proposedChanges 
          ? JSON.parse((activeStrategy as any).proposedChanges) 
          : [];
        setProposedChanges(changes);
        
        // Auto-select all proposed changes by default
        const initialSelected: Record<string, boolean> = {};
        changes.forEach((c: any) => {
          if (c.goalId) {
            initialSelected[c.goalId] = true;
          }
        });
        setSelectedForApply(initialSelected);
        setActiveTab("strategy");
      } catch (err) {
        console.error("Failed to parse proposed changes:", err);
        setProposedChanges([]);
        setSelectedForApply({});
      }
    } else {
      setProposedChanges([]);
      setSelectedForApply({});
    }
  }, [activeStrategy]);

  const handleTriggerRebalance = async () => {
    if (goals.length === 0) return;
    setGenerating(true);
    setError(null);
    setApplySuccess(null);

    try {
      // 1. Snapshot simple goal details for the strategist
      const activeGoals = goals.map(g => ({
        id: g.id,
        title: g.title,
        category: g.category,
        priority: g.priority,
        targetDate: g.targetDate,
        progressPercentage: g.progressPercentage,
        confidenceScore: g.confidenceScore
      }));

      // 2. Call server-side Express API
      const result = await safeFetchJson("/api/generate-rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.userId,
          activeGoals
        })
      });

      // 3. Save to database
      const newStrategy: Omit<RebalanceHistory, "id"> & { proposedChanges?: string } = {
        userId: profile.userId,
        content: result.content,
        goalsSnapshot: JSON.stringify(activeGoals),
        proposedChanges: JSON.stringify(result.proposedChanges || []),
        generatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, "rebalance_history"), newStrategy);
      const saved = { id: docRef.id, ...newStrategy } as RebalanceHistory;

      setHistory(prev => [saved, ...prev]);
      setActiveStrategy(saved);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while compiling rebalancing recommendations.");
    } finally {
      setGenerating(false);
    }
  };

  // Handle live editing of recommended parameter fields
  const handleUpdateChangeField = (goalId: string, field: string, value: any) => {
    setProposedChanges(prev =>
      prev.map(c => {
        if (c.goalId === goalId) {
          return { ...c, [field]: value };
        }
        return c;
      })
    );
  };

  const handleToggleSelected = (goalId: string) => {
    setSelectedForApply(prev => ({
      ...prev,
      [goalId]: !prev[goalId]
    }));
  };

  const handleApplyCalibration = async () => {
    const selectedIds = Object.keys(selectedForApply).filter(id => selectedForApply[id]);
    if (selectedIds.length === 0) {
      setError("Please select at least one goal rebalancing recommendation to implement.");
      return;
    }

    setApplyingChanges(true);
    setError(null);
    setApplySuccess(null);

    try {
      let updatedCount = 0;
      for (const change of proposedChanges) {
        if (!change.goalId || !selectedForApply[change.goalId]) continue;

        // Find match in current goals to preserve untouched fields
        const currentGoal = goals.find(g => g.id === change.goalId);
        if (!currentGoal) continue;

        const goalRef = doc(db, "goals", change.goalId);
        await updateDoc(goalRef, {
          priority: change.recommendedPriority,
          targetDate: change.recommendedDeadline,
          balanceNote: change.customNote || change.reason || "",
          updatedAt: new Date().toISOString()
        });
        updatedCount++;
      }

      setApplySuccess(`Successfully applied strategic rebalancing calibration to ${updatedCount} goal(s) in your active portfolio!`);
      if (onGoalsUpdated) {
        onGoalsUpdated();
      }
    } catch (err: any) {
      console.error("Failed to apply calibration:", err);
      setError(err.message || "Failed to update selected goals in the database.");
    } finally {
      setApplyingChanges(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-theme-bg-panel rounded-2xl border border-theme-border-main text-theme-text-main shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" id="rebalance-modal-card">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-theme-border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-theme-bg-accent" />
            <h2 className="text-xl font-bold text-theme-text-main font-display">
              COMPASS Portfolio Workload Rebalancing Strategist
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-theme-bg-card-hover rounded-lg transition cursor-pointer" id="close-rebalance-modal-btn">
            <X className="h-5 w-5 text-theme-text-muted hover:text-theme-text-main" />
          </button>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Left Panel: Historical Strategy Logs */}
          <div className="w-full md:w-80 border-r border-theme-border-subtle bg-theme-bg-panel p-4 flex flex-col overflow-y-auto shrink-0 animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-theme-text-muted uppercase tracking-wider flex items-center gap-1">
                <History className="h-3.5 w-3.5" /> Strategy History
              </span>
              <span className="text-xs font-mono font-bold text-theme-text-muted bg-theme-bg-card-hover px-1.5 py-0.5 rounded border border-theme-border-subtle">
                {history.length} audits
              </span>
            </div>

            <button
              onClick={handleTriggerRebalance}
              disabled={generating || goals.length === 0}
              className="w-full mb-4 inline-flex items-center justify-center gap-2 bg-theme-bg-accent text-theme-text-accent px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-theme-bg-accent-hover disabled:opacity-50 active:scale-95 transition shrink-0 cursor-pointer"
              id="trigger-rebalance-audit-btn"
            >
              {generating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing workload...
                </>
              ) : (
                <>
                  <Sliders className="h-3.5 w-3.5" /> Audit & Rebalance Focus
                </>
              )}
            </button>

            {loadingHistory ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 text-theme-text-muted animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-xs text-theme-text-muted">
                No rebalancing guidelines logged yet. Run an audit above.
              </div>
            ) : (
              <div className="space-y-2 flex-1">
                {history.map((hist) => {
                  const dateStr = new Date(hist.generatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  });
                  const isActive = activeStrategy?.id === hist.id;

                  return (
                    <button
                      key={hist.id}
                      onClick={() => setActiveStrategy(hist)}
                      className={`w-full text-left p-3 rounded-xl border transition-all text-xs flex justify-between items-center cursor-pointer ${
                        isActive
                          ? "border-theme-bg-accent bg-theme-bg-card-hover ring-1 ring-theme-bg-accent text-theme-text-main"
                          : "border-theme-border-main bg-theme-bg-panel text-theme-text-muted hover:border-theme-text-main hover:text-theme-text-main"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-theme-text-main block truncate">
                          Rebalance Audit: {dateStr}
                        </span>
                        <span className="text-[10px] text-theme-text-muted font-mono block mt-0.5">
                          {new Date(hist.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-theme-text-muted shrink-0 ml-1" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel: Selected Strategy Output with Interactive Tabs */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-between">
            <div className="w-full">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {applySuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{applySuccess}</span>
                </div>
              )}

              {generating && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 text-theme-bg-accent animate-spin mb-3" />
                  <h4 className="text-sm font-bold text-theme-text-main">Formulating Rebalancing Matrix...</h4>
                  <p className="text-xs text-theme-text-muted mt-1 max-w-sm text-center leading-relaxed">
                    COMPASS AI is evaluating deadline overlaps, priorities, and confidence indexes to map a realistic 2-week focal roadmap.
                  </p>
                </div>
              )}

              {!generating && activeStrategy && (
                <div className="animate-in fade-in duration-300">
                  
                  {/* Strategic Headers & Active Tabs */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-theme-border-subtle pb-3 mb-6">
                    <div className="flex items-center gap-1.5">
                      <ArrowUpRight className="h-4 w-4 text-theme-text-muted" />
                      <span className="text-xs font-mono font-semibold text-theme-text-muted uppercase tracking-wider">
                        Assessed: {new Date(activeStrategy.generatedAt).toLocaleString()}
                      </span>
                    </div>

                    {proposedChanges.length > 0 && (
                      <div className="flex gap-1 bg-theme-bg-card-hover p-0.5 rounded-lg text-xs font-semibold self-start md:self-auto border border-theme-border-subtle">
                        <button
                          type="button"
                          onClick={() => setActiveTab("strategy")}
                          className={`px-3 py-1 rounded-md transition cursor-pointer ${
                            activeTab === "strategy" 
                              ? "bg-theme-bg-panel text-theme-text-main shadow-xs border border-theme-border-subtle" 
                              : "text-theme-text-muted hover:text-theme-text-main"
                          }`}
                        >
                          💡 Strategy Report
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("calibration")}
                          className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === "calibration" 
                              ? "bg-theme-bg-panel text-theme-text-main shadow-xs border border-theme-border-subtle" 
                              : "text-theme-text-muted hover:text-theme-text-main"
                          }`}
                        >
                          Calibration Control
                          <span className="bg-theme-bg-accent text-theme-text-accent text-[10px] px-1.5 py-0.5 rounded-full font-mono scale-90">
                            {proposedChanges.length}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* TAB 1: STRATEGIC REPORT */}
                  {activeTab === "strategy" && (
                    <div className="space-y-6">
                      <div className="markdown-body text-sm leading-relaxed text-theme-text-main space-y-4">
                        <ReactMarkdown>{activeStrategy.content}</ReactMarkdown>
                      </div>

                      {proposedChanges.length > 0 && (
                        <div className="bg-theme-bg-card-hover rounded-2xl border border-theme-border-main p-5 mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-theme-text-main flex items-center gap-2">
                              <Sliders className="h-4 w-4 text-theme-bg-accent" /> Actionable Calibrations Ready
                            </h4>
                            <p className="text-xs text-theme-text-muted leading-relaxed max-w-xl">
                              COMPASS has drafted {proposedChanges.length} concrete parameter adjustments to realign your weekly schedule. Step into the Calibration room to edit and activate them.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab("calibration")}
                            className="inline-flex items-center gap-1.5 bg-theme-bg-accent text-theme-text-accent text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-theme-bg-accent-hover active:scale-95 transition whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Open Calibration Control <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: INTERACTIVE CALIBRATION CONTROL */}
                  {activeTab === "calibration" && (
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <h3 className="text-md font-bold text-theme-text-main font-display">
                          Calibrate Portfolio Parameters
                        </h3>
                        <p className="text-xs text-theme-text-muted max-w-2xl">
                          Toggle which recommended changes to commit. You can override recommended priorities and push target deadlines to suit your updated cognitive bandwidth.
                        </p>
                      </div>

                      <div className="space-y-4">
                        {proposedChanges.map((change) => {
                          const isSelected = !!selectedForApply[change.goalId];
                          const originalGoal = goals.find(g => g.id === change.goalId);

                          return (
                            <div 
                              key={change.goalId}
                              className={`border rounded-2xl p-5 transition ${
                                isSelected 
                                  ? "border-theme-bg-accent bg-theme-bg-card-hover ring-1 ring-theme-bg-accent shadow-xs" 
                                  : "border-theme-border-subtle bg-theme-bg-panel/40 opacity-60"
                              }`}
                            >
                              {/* Header Title with Select Checkbox */}
                              <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex items-start gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSelected(change.goalId)}
                                    className="p-1 hover:bg-theme-bg-panel rounded-lg transition shrink-0 mt-0.5 cursor-pointer"
                                    title={isSelected ? "Unselect to exclude this goal from apply" : "Select to include this goal in apply"}
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="h-5 w-5 text-theme-bg-accent fill-theme-bg-accent/10" />
                                    ) : (
                                      <Square className="h-5 w-5 text-theme-text-muted" />
                                    )}
                                  </button>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-sm font-bold text-theme-text-main">
                                        {change.goalTitle || "Objective Adjustment"}
                                      </h4>
                                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                        isSelected 
                                          ? "bg-green-500/10 text-green-400 border border-green-500/25" 
                                          : "bg-theme-bg-panel text-theme-text-muted border border-theme-border-subtle"
                                      }`}>
                                        {isSelected ? "Included in Apply" : "Excluded"}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-theme-text-muted font-bold uppercase tracking-wider mt-1">
                                      {originalGoal?.category || "Goal Portfolio"}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right text-[10px] text-theme-text-muted font-mono">
                                  Confidence Index: <strong className="text-theme-text-main">{originalGoal?.confidenceScore ? `${originalGoal.confidenceScore}/5` : "N/A"}</strong>
                                </div>
                              </div>

                              {/* Editable Fields Grid */}
                              <div className="space-y-4 pt-3 border-t border-dashed border-theme-border-subtle animate-in fade-in duration-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Priority selector */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
                                        Adjust Priority Level
                                      </label>
                                      <span className="text-[10px] text-theme-text-muted font-medium flex items-center gap-1">
                                        <Edit3 className="h-3 w-3" /> Edit Live
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-theme-text-muted line-through shrink-0 font-medium">
                                        {change.currentPriority}
                                      </span>
                                      <ArrowRight className="h-3 w-3 text-theme-text-muted shrink-0" />
                                      <select
                                        value={change.recommendedPriority}
                                        onChange={(e) => handleUpdateChangeField(change.goalId, "recommendedPriority", e.target.value)}
                                        className="block w-full rounded-xl border border-theme-border-main bg-theme-bg-panel px-3 py-2 text-theme-text-main text-xs font-semibold focus:border-theme-bg-accent focus:outline-none focus:ring-1 focus:ring-theme-bg-accent transition"
                                      >
                                        <option value="High">High Priority</option>
                                        <option value="Medium">Medium Priority</option>
                                        <option value="Low">Low Priority</option>
                                      </select>
                                    </div>
                                  </div>

                                  {/* Target date selector */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
                                        Adjust Target Deadline
                                      </label>
                                      <span className="text-[10px] text-theme-text-muted font-medium flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Edit Live
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-theme-text-muted line-through shrink-0 font-medium">
                                        {change.currentDeadline}
                                      </span>
                                      <ArrowRight className="h-3 w-3 text-theme-text-muted shrink-0" />
                                      <div className="relative flex-1">
                                        <input
                                          type="date"
                                          value={change.recommendedDeadline}
                                          onChange={(e) => handleUpdateChangeField(change.goalId, "recommendedDeadline", e.target.value)}
                                          className="block w-full rounded-xl border border-theme-border-main bg-theme-bg-panel px-3 py-2 text-theme-text-main text-xs font-semibold focus:border-theme-bg-accent focus:outline-none focus:ring-1 focus:ring-theme-bg-accent transition"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Strategic Rationale */}
                                <div className="bg-theme-bg-panel rounded-xl p-3.5 text-xs text-theme-text-muted border border-theme-border-subtle leading-relaxed italic">
                                  💡 <strong>AI Rebalance Rationale:</strong> {change.reason}
                                </div>

                                {/* Custom Balance Note */}
                                <div className="space-y-1.5">
                                  <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
                                    Calibration Commentary (Appears as Goal Balance Note)
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Add your personal notes or keep the AI rationale..."
                                    value={change.customNote !== undefined ? change.customNote : ""}
                                    onChange={(e) => handleUpdateChangeField(change.goalId, "customNote", e.target.value)}
                                    className="block w-full rounded-xl border border-theme-border-main bg-theme-bg-panel px-3 py-2.5 text-theme-text-main text-xs focus:border-theme-bg-accent focus:outline-none focus:ring-1 focus:ring-theme-bg-accent transition"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Apply CTA Section */}
                      <div className="bg-theme-bg-accent text-theme-text-accent rounded-2xl p-5 mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" /> Ready to calibrate portfolio?
                          </h4>
                          <p className="text-xs opacity-90 leading-relaxed max-w-xl">
                            Upon confirmation, COMPASS will write your customized priority levels and deadlines back to Firestore and log the change notes under your goals.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleApplyCalibration}
                          disabled={applyingChanges}
                          className="inline-flex items-center gap-2 bg-theme-bg-panel text-theme-text-main border border-theme-border-subtle text-xs font-bold px-6 py-3 rounded-xl hover:bg-theme-bg-card-hover active:scale-95 transition whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                          id="implement-rebalance-btn"
                        >
                          {applyingChanges ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin text-theme-text-main" /> Committing changes...
                            </>
                          ) : (
                            <>
                              Implement Selected Calibrations <Check className="h-4 w-4 text-theme-text-main" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {!generating && !activeStrategy && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="h-10 w-10 rounded-xl bg-theme-bg-card-hover border border-theme-border-subtle flex items-center justify-center mb-3">
                    <ShieldCheck className="h-5 w-5 text-theme-text-muted" />
                  </div>
                  <h4 className="text-sm font-bold text-theme-text-main">Your Rebalancing Analysis is Empty</h4>
                  <p className="text-xs text-theme-text-muted max-w-sm mt-1 leading-relaxed">
                    Click 'Audit & Rebalance Focus' on the left panel. COMPASS will review your active goals and build specific strategic guidelines to prevent overload.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
