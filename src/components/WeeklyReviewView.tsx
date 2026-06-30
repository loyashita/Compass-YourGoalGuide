import React, { useState, useEffect } from "react";
import { UserProfile, Goal, WeeklyReview } from "../types";
import { db, collection, addDoc, getDocs, query, where, orderBy } from "../lib/firebase";
import { Calendar, Compass, ChevronRight, Loader2, Award, History, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { safeFetchJson } from "../lib/api";

interface WeeklyReviewViewProps {
  profile: UserProfile;
  goals: Goal[];
}

export default function WeeklyReviewView({ profile, goals }: WeeklyReviewViewProps) {
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [activeReview, setActiveReview] = useState<WeeklyReview | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Generation States
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cognitiveOverload, setCognitiveOverload] = useState<number>(3);
  const [userFeedback, setUserFeedback] = useState<string>("");

  // Fetch reviews history
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoadingHistory(true);
        const q = query(
          collection(db, "weekly_reviews"),
          where("userId", "==", profile.userId),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() })) as WeeklyReview[];
        setReviews(fetched);
        if (fetched.length > 0) {
          setActiveReview(fetched[0]);
        }
      } catch (err) {
        console.error("Failed to load weekly reviews:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchReviews();
  }, [profile.userId]);

  const handleGenerateReview = async () => {
    setGenerating(true);
    setError(null);

    try {
      // 1. Gather snapshot
      const snapshot = await Promise.all(
        goals.map(async (g) => {
          // Fetch tasks for goal g
          const tasksRef = collection(db, "goals", g.id, "tasks");
          const snap = await getDocs(tasksRef);
          const tasks = snap.docs.map(d => d.data());

          const completed = tasks.filter(t => t.status === "completed").map(t => t.title);
          
          const today = new Date();
          const next7Days = new Date();
          next7Days.setDate(today.getDate() + 7);

          const overdue = tasks.filter(t => {
            if (t.status === "completed") return false;
            if (!t.suggestedDueDate) return false;
            return new Date(t.suggestedDueDate) < today;
          }).map(t => t.title);

          const dueNext7Days = tasks.filter(t => {
            if (t.status === "completed") return false;
            if (!t.suggestedDueDate) return false;
            const due = new Date(t.suggestedDueDate);
            return due >= today && due <= next7Days;
          }).map(t => t.title);

          return {
            title: g.title,
            priority: g.priority,
            targetDate: g.targetDate,
            progressPercentage: g.progressPercentage,
            confidenceScore: g.confidenceScore,
            tasksCompletedThisWeek: completed,
            tasksOverdue: overdue,
            tasksDueNext7Days: dueNext7Days,
          };
        })
      );

      // 2. Call Express endpoint
      const result = await safeFetchJson("/api/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.userId,
          profile,
          snapshot,
          cognitiveOverload,
          userFeedback,
        }),
      });

      // 3. Save review to Firestore
      const newReview: Omit<WeeklyReview, "id"> = {
        userId: profile.userId,
        content: result.content,
        goalsSnapshot: JSON.stringify(snapshot),
        generatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "weekly_reviews"), newReview);
      
      const savedReview = { id: docRef.id, ...newReview } as WeeklyReview;
      setReviews(prev => [savedReview, ...prev]);
      setActiveReview(savedReview);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to compile weekly review analytics.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div id="weekly-review-view" className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      {/* LEFT COLUMN: Review Generation & Logs List */}
      <div className="lg:col-span-1 bg-theme-bg-card border border-theme-border-main rounded-3xl p-5 shadow-xs flex flex-col gap-4 text-theme-text-main">
        <div className="flex items-center gap-2 pb-3 border-b border-theme-border-subtle">
          <div className="h-9 w-9 rounded-xl bg-theme-bg-accent text-theme-text-accent flex items-center justify-center">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-theme-text-main font-display">
              Weekly Reviews
            </h2>
            <p className="text-[10px] font-mono font-bold text-theme-text-muted uppercase tracking-wider">
              Diagnostic performance checks
            </p>
          </div>
        </div>

        {/* Interactive Self-Reflection Form (Cognitive Overload & Journal) */}
        <div className="bg-theme-bg-panel border border-theme-border-subtle rounded-2xl p-4 flex flex-col gap-3 shadow-3xs text-theme-text-main">
          <div>
            <label className="text-xs font-bold text-theme-text-main block">🧠 Cognitive Overload Index</label>
            <p className="text-[10px] text-theme-text-muted mt-0.5 mb-2 leading-tight">Rate your mental workload/stress level this week:</p>
            <div className="flex justify-between gap-1">
              {[1, 2, 3, 4, 5].map((level) => {
                const label = level === 1 ? "Calm" : level === 3 ? "Mod" : level === 5 ? "Burned" : "";
                const isSelected = cognitiveOverload === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setCognitiveOverload(level)}
                    className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-bold border transition-all active:scale-95 flex flex-col items-center justify-center cursor-pointer ${
                      isSelected
                        ? "bg-theme-bg-accent border-theme-bg-accent text-theme-text-accent shadow-2xs"
                        : "bg-theme-bg-card border-theme-border-subtle hover:bg-theme-bg-card-hover text-[#221712] dark:text-white"
                    }`}
                  >
                    <span>{level}</span>
                    {label && (
                      <span className={`text-[8px] font-normal leading-none mt-0.5 ${
                        isSelected ? "text-theme-text-accent/80" : "text-theme-text-muted"
                      }`}>
                        {label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-theme-text-main block">💬 Reflection Journal</label>
            <p className="text-[10px] text-theme-text-muted mt-0.5 mb-1.5 leading-tight">Describe any roadblocks, mental blocks, or highlights:</p>
            <textarea
              value={userFeedback}
              onChange={(e) => setUserFeedback(e.target.value)}
              placeholder="e.g., Felt overwhelmed by multitasking; struggled with time management but finished Chapter 1..."
              className="w-full h-16 p-2 rounded-xl text-xs border border-theme-border-subtle focus:border-theme-border-main focus:ring-1 focus:ring-theme-border-main outline-none bg-theme-bg-card text-theme-text-main placeholder-theme-text-muted/60 resize-none leading-relaxed"
            />
          </div>
        </div>

        <button
          onClick={handleGenerateReview}
          disabled={generating || goals.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 bg-theme-bg-accent text-theme-text-accent px-4 py-3 rounded-xl text-xs font-bold hover:bg-theme-bg-accent-hover disabled:opacity-50 active:scale-95 transition shadow-sm"
        >
          {generating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 
              <span>Assessing performance...</span>
            </>
          ) : (
            <>
              <Compass className="h-3.5 w-3.5" /> 
              <span>Generate Weekly Assessment</span>
            </>
          )}
        </button>

        {goals.length === 0 && (
          <p className="text-[10px] text-center text-theme-text-muted font-medium">
            You must formulate at least one goal to run assessments.
          </p>
        )}

        <div className="flex justify-between items-center mt-2 border-t border-theme-border-subtle pt-3">
          <span className="text-[10px] font-mono font-bold text-theme-text-muted uppercase tracking-wider flex items-center gap-1">
            <History className="h-3.5 w-3.5" /> Historical Audits
          </span>
          <span className="text-[10px] font-mono font-bold text-theme-text-main bg-theme-bg-panel border border-theme-border-subtle px-1.5 py-0.5 rounded">
            {reviews.length} logs
          </span>
        </div>

        {loadingHistory ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 text-theme-text-muted animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-theme-border-main rounded-2xl bg-theme-bg-panel/40 px-4 text-xs text-theme-text-muted">
            No audits compiled yet. Click the button above to begin.
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-[350px] lg:max-h-none flex-1">
            {reviews.map((rev) => {
              const dateStr = new Date(rev.generatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const isActive = activeReview?.id === rev.id;

              return (
                <button
                  key={rev.id}
                  onClick={() => setActiveReview(rev)}
                  className={`w-full text-left p-3 rounded-xl border transition-all text-xs flex justify-between items-center cursor-pointer ${
                    isActive
                      ? "border-theme-bg-accent bg-theme-bg-panel shadow-sm ring-1 ring-theme-bg-accent text-theme-text-main"
                      : "border-theme-border-subtle bg-theme-bg-card hover:bg-theme-bg-card-hover text-theme-text-main"
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-theme-text-main block truncate">
                      Assessment: {dateStr}
                    </span>
                    <span className="text-[10px] text-theme-text-muted font-mono block mt-0.5">
                      {new Date(rev.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-theme-text-muted shrink-0 ml-1" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT & CENTER PANEL: Selected Review Viewer (2 cols) */}
      <div className="lg:col-span-2 bg-theme-bg-card border border-theme-border-main rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col min-h-[450px] text-theme-text-main">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-400 text-xs rounded-xl flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {generating && (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-theme-bg-accent animate-spin mb-3" />
            <h4 className="text-sm font-bold text-theme-text-main">Formulating Performance Audit...</h4>
            <p className="text-xs text-theme-text-muted mt-1.5 max-w-sm text-center leading-relaxed">
              COMPASS is polling active task checklists, past deadlines, and re-calculating alignment stats to deliver customized recommendations.
            </p>
          </div>
        )}

        {!generating && activeReview && (
          <div className="space-y-4 animate-fade-in flex-1 flex flex-col">
            <div className="flex items-center gap-1.5 border-b border-theme-border-subtle pb-3">
              <Calendar className="h-4 w-4 text-theme-text-muted" />
              <span className="text-[10px] font-mono font-semibold text-theme-text-muted uppercase tracking-wider">
                Audit Timeline Generated: {new Date(activeReview.generatedAt).toLocaleString()}
              </span>
            </div>

            <div className="markdown-body text-xs text-theme-text-main space-y-4 leading-relaxed max-w-none prose prose-brown dark:prose-invert bg-theme-bg-panel border border-theme-border-subtle p-5 rounded-2xl shadow-2xs overflow-y-auto max-h-[500px]">
              <ReactMarkdown>{activeReview.content}</ReactMarkdown>
            </div>
          </div>
        )}

        {!generating && !activeReview && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div className="h-10 w-10 rounded-xl bg-theme-bg-panel flex items-center justify-center mb-3 border border-theme-border-subtle">
              <Award className="h-5 w-5 text-theme-text-muted" />
            </div>
            <h4 className="text-sm font-bold text-theme-text-main">Assessment Workspace Empty</h4>
            <p className="text-xs text-theme-text-muted max-w-sm mt-1.5 leading-relaxed">
              Click 'Generate Weekly Assessment' on the left sidebar to audit your current workload and formulate suggestions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
