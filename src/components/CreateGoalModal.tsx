import React, { useState } from "react";
import { UserProfile, Goal, GoalPhase, GoalTask, GoalResource } from "../types";
import { X, Sparkles, AlertCircle, Plus, Trash2, Check } from "lucide-react";
import { safeFetchJson } from "../lib/api";

interface CreateGoalModalProps {
  profile: UserProfile;
  existingGoals: Goal[];
  onClose: () => void;
  onSave: (goal: Omit<Goal, "id" | "userId" | "createdAt" | "updatedAt">, phases: any[], tasks: any[], resources: any[]) => Promise<void>;
}

export default function CreateGoalModal({ profile, existingGoals, onClose, onSave }: CreateGoalModalProps) {
  // Goal Input Form States
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(profile.categoryTabs[0] || "");
  const [priority, setPriority] = useState<Goal["priority"]>("Medium");
  const [targetDate, setTargetDate] = useState("");

  // AI Roadmap Preview States
  const [generating, setGenerating] = useState(false);
  const [roadmapPreview, setRoadmapPreview] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable Roadmap states (if user modifies them in preview)
  const [editedPhases, setEditedPhases] = useState<any[]>([]);
  const [editedResources, setEditedResources] = useState<any[]>([]);

  const todayStr = new Date().toISOString().split("T")[0];

  const handleGenerateRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetDate) return;

    setGenerating(true);
    setError(null);

    try {
      const result = await safeFetchJson("/api/generate-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.userId,
          goal: {
            title: title.trim(),
            description: description.trim(),
            category,
            priority,
            targetDate,
          },
          profile,
          existingGoals,
        }),
      });

      const roadmap = result.data;
      setRoadmapPreview(roadmap);
      
      // Seed editable structures
      setEditedPhases(roadmap.phases || []);
      setEditedResources(roadmap.resources || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while formulating the roadmap.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSetupManualRoadmap = () => {
    if (!title.trim() || !targetDate) {
      setError("Please fill in the Goal Title and Target Deadline before manually designing your roadmap.");
      return;
    }

    const defaultRoadmap = {
      phases: [
        {
          title: "Phase 1: Setup & Foundations",
          description: "Establish foundational goals, gather necessary tools, and complete setup.",
          order: 1,
          estimated_duration: "1 week",
          suggested_start_date: todayStr,
          suggested_end_date: targetDate,
          tasks: [
            { title: "Define roadmap objectives and outline key results", priority: "high", suggested_due_date: targetDate, order: 1 },
            { title: "Configure project workspace, folders, or environments", priority: "medium", suggested_due_date: targetDate, order: 2 }
          ]
        },
        {
          title: "Phase 2: Core Execution & Milestones",
          description: "Perform the core tasks and achieve primary milestones.",
          order: 2,
          estimated_duration: "2 weeks",
          suggested_start_date: todayStr,
          suggested_end_date: targetDate,
          tasks: [
            { title: "Draft first prototype or execute main tasks", priority: "high", suggested_due_date: targetDate, order: 1 },
            { title: "Refine results based on testing or feedback", priority: "medium", suggested_due_date: targetDate, order: 2 }
          ]
        }
      ],
      resources: [],
      balance_note: "Manually customized workload roadmap.",
      conflict_warning: null,
      timeline_warning: null
    };

    setRoadmapPreview(defaultRoadmap);
    setEditedPhases(defaultRoadmap.phases);
    setEditedResources([]);
    setError(null);
  };

  const handleAddPhase = () => {
    const updated = [...editedPhases];
    updated.push({
      title: `Phase ${updated.length + 1}: New Milestone`,
      description: "Describe what this phase achieves.",
      order: updated.length + 1,
      estimated_duration: "1 week",
      suggested_start_date: todayStr,
      suggested_end_date: targetDate,
      tasks: [
        { title: "", priority: "medium", suggested_due_date: targetDate, order: 1 }
      ]
    });
    setEditedPhases(updated);
  };

  const handleDeletePhase = (index: number) => {
    if (editedPhases.length <= 1) {
      setError("Your roadmap must have at least one phase.");
      return;
    }
    const updated = [...editedPhases];
    updated.splice(index, 1);
    const reassigned = updated.map((ph, idx) => ({
      ...ph,
      order: idx + 1
    }));
    setEditedPhases(reassigned);
  };

  const handlePhaseTitleChange = (index: number, val: string) => {
    const updated = [...editedPhases];
    updated[index].title = val;
    setEditedPhases(updated);
  };

  const handlePhaseDescChange = (index: number, val: string) => {
    const updated = [...editedPhases];
    updated[index].description = val;
    setEditedPhases(updated);
  };

  const handleTaskTitleChange = (phaseIndex: number, taskIndex: number, val: string) => {
    const updated = [...editedPhases];
    updated[phaseIndex].tasks[taskIndex].title = val;
    setEditedPhases(updated);
  };

  const handleAddTask = (phaseIndex: number) => {
    const updated = [...editedPhases];
    const tasks = updated[phaseIndex].tasks || [];
    tasks.push({
      title: "",
      priority: "medium",
      suggested_due_date: targetDate,
      order: tasks.length + 1,
      notes: null,
    });
    updated[phaseIndex].tasks = tasks;
    setEditedPhases(updated);
  };

  const handleDeleteTask = (phaseIndex: number, taskIndex: number) => {
    const updated = [...editedPhases];
    updated[phaseIndex].tasks.splice(taskIndex, 1);
    setEditedPhases(updated);
  };

  const handleSaveGoalAndRoadmap = async () => {
    if (!roadmapPreview) return;
    setSaving(true);
    setError(null);

    try {
      const goalDetails = {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: "active" as const,
        targetDate,
        progressPercentage: 0,
        confidenceScore: 3, // Start neutral
        balanceNote: roadmapPreview.balance_note || "",
        conflictWarning: roadmapPreview.conflict_warning || null,
        timelineWarning: roadmapPreview.timeline_warning || null,
      };

      await onSave(goalDetails, editedPhases, editedPhases, editedResources);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError("Failed to persist the goal portfolio documents.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-neutral-900 animate-pulse" />
            <h2 className="text-xl font-bold text-neutral-900 font-display">
              {roadmapPreview ? "Calibrate Generated Roadmap" : "Formulate New Goal"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg transition">
            <X className="h-5 w-5 text-neutral-400 hover:text-neutral-950" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-800 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!roadmapPreview ? (
            /* STAGE 1: FORM INPUTS */
            <form onSubmit={handleGenerateRoadmap} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700">Goal Title *</label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      placeholder="e.g. Complete my semester project"
                      className="mt-1 block w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-neutral-950 placeholder-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 sm:text-sm"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700">Description (Optional)</label>
                    <textarea
                      maxLength={500}
                      rows={4}
                      placeholder="e.g. Conduct research, design wireframes, write clean code, and run final tests."
                      className="mt-1 block w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-neutral-950 placeholder-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 sm:text-sm"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700">Category Tab</label>
                    <select
                      className="mt-1 block w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-neutral-950 bg-white focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 sm:text-sm"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {profile.categoryTabs.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700">Priority</label>
                      <select
                        className="mt-1 block w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-neutral-950 bg-white focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 sm:text-sm"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as Goal["priority"])}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-neutral-700">Target Deadline</label>
                      <input
                        type="date"
                        required
                        min={todayStr}
                        className="mt-1 block w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-neutral-950 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 sm:text-sm"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                      />
                    </div>
                  </div>


                </div>
              </div>

              <div className="flex justify-between items-center border-t border-neutral-100 pt-5 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-sm font-semibold text-neutral-700"
                >
                  Cancel
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={generating || !title.trim() || !targetDate}
                    onClick={handleSetupManualRoadmap}
                    className="inline-flex items-center gap-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-800 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition cursor-pointer"
                  >
                    Design Roadmap Manually
                  </button>
                  <button
                    type="submit"
                    disabled={generating || !title.trim() || !targetDate}
                    className="inline-flex items-center gap-2 bg-neutral-950 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 active:scale-95 transition cursor-pointer"
                  >
                    {generating ? "AI is plotting roadmap..." : "Generate AI Roadmap"}
                    <Sparkles className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* STAGE 2: ROADMAP PREVIEW & CUSTOMIZE */
            <div className="space-y-6">
              {/* Warnings and Notes */}
              {(roadmapPreview.conflict_warning || roadmapPreview.timeline_warning || roadmapPreview.balance_note) && (
                <div className="space-y-2">
                  {roadmapPreview.balance_note && (
                    <div className="p-3.5 bg-sky-50 border border-sky-100 text-sky-800 rounded-xl text-xs leading-relaxed">
                      <strong>AI Balance Assessment:</strong> {roadmapPreview.balance_note}
                    </div>
                  )}
                  {roadmapPreview.conflict_warning && (
                    <div className="p-3.5 bg-yellow-50 border border-yellow-100 text-yellow-800 rounded-xl text-xs leading-relaxed">
                      <strong>Overload Conflict Alert:</strong> {roadmapPreview.conflict_warning}
                    </div>
                  )}
                  {roadmapPreview.timeline_warning && (
                    <div className="p-3.5 bg-orange-50 border border-orange-100 text-orange-800 rounded-xl text-xs leading-relaxed">
                      <strong>Timeline Feasibility:</strong> {roadmapPreview.timeline_warning}
                    </div>
                  )}
                </div>
              )}

              {/* Phases and Tasks */}
              <div className="space-y-6">
                <h3 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-2 font-display">
                  Project Phases & Tasks
                </h3>

                {editedPhases.map((phase, pIdx) => (
                  <div key={pIdx} className="border border-neutral-200 rounded-xl p-5 bg-neutral-50/50 space-y-4">
                    {/* Phase Name Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2 flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Phase Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Phase 1: Setup & Foundations"
                            className="w-full text-sm font-bold bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 focus:border-neutral-950 text-neutral-950"
                            value={phase.title}
                            onChange={(e) => handlePhaseTitleChange(pIdx, e.target.value)}
                          />
                        </div>
                        {editedPhases.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeletePhase(pIdx)}
                            className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-red-600 border border-neutral-200 cursor-pointer h-9 shrink-0"
                            title="Delete this Phase"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Est. Duration</label>
                        <input
                          type="text"
                          placeholder="e.g. 1 week"
                          className="w-full text-xs font-mono bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 focus:border-neutral-950 text-neutral-900"
                          value={phase.estimated_duration || ""}
                          onChange={(e) => {
                            const updated = [...editedPhases];
                            updated[pIdx].estimated_duration = e.target.value;
                            setEditedPhases(updated);
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Milestone Description</label>
                      <input
                        type="text"
                        placeholder="e.g. Establish foundational goals, gather necessary tools, and complete setup."
                        className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 focus:border-neutral-950 text-neutral-900"
                        value={phase.description || ""}
                        onChange={(e) => handlePhaseDescChange(pIdx, e.target.value)}
                      />
                    </div>

                    {/* Task Sublist */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Tasks</span>
                        <button
                          type="button"
                          onClick={() => handleAddTask(pIdx)}
                          className="text-xs font-semibold text-neutral-950 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" /> Add Action Item
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {phase.tasks?.map((task: any, tIdx: number) => (
                          <div key={tIdx} className="flex gap-2 items-center bg-white border border-neutral-200 rounded-lg p-2.5 shadow-3xs hover:border-neutral-300 transition-colors">
                            <input
                              type="text"
                              placeholder="e.g. Set up development environment or read Chapter 1..."
                              className="flex-1 text-xs border border-neutral-300 focus:border-neutral-950 rounded-lg px-2.5 py-1.5 bg-neutral-50/50 hover:bg-white focus:bg-white transition text-neutral-950"
                              value={task.title}
                              onChange={(e) => handleTaskTitleChange(pIdx, tIdx, e.target.value)}
                            />
                            
                            <select
                              className="text-[10px] font-bold uppercase rounded border border-neutral-300 bg-neutral-50 p-1.5 font-mono shrink-0 text-neutral-800"
                              value={task.priority}
                              onChange={(e) => {
                                const updated = [...editedPhases];
                                updated[pIdx].tasks[tIdx].priority = e.target.value;
                                setEditedPhases(updated);
                              }}
                            >
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleDeleteTask(pIdx, tIdx)}
                              className="p-1.5 hover:bg-neutral-100 rounded text-neutral-400 hover:text-red-600 shrink-0 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Phase Milestone Button */}
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleAddPhase}
                    className="inline-flex items-center gap-2 border border-dashed border-neutral-300 hover:border-neutral-950 text-neutral-600 hover:text-neutral-950 px-5 py-3 rounded-xl text-sm font-semibold transition cursor-pointer bg-white shadow-3xs hover:shadow-2xs active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    Add Phase Milestone
                  </button>
                </div>
              </div>

              {/* Resources */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-2 font-display">
                  Recommended Existing Resources
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {editedResources.map((resItem, rIdx) => (
                    <div key={rIdx} className="border border-neutral-200 rounded-xl p-3 bg-neutral-50/50 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[9px] font-bold font-mono uppercase bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded">
                            {resItem.type}
                          </span>
                          <span className="text-xs font-semibold text-neutral-950 block truncate">{resItem.title}</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">{resItem.description}</p>
                      </div>
                      {resItem.url && (
                        <a
                          href={resItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono font-semibold text-blue-600 hover:underline mt-2 inline-block truncate"
                        >
                          {resItem.url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Controls */}
              <div className="flex justify-between items-center border-t border-neutral-100 pt-5 mt-6 shrink-0">
                <button
                  type="button"
                  onClick={() => setRoadmapPreview(null)}
                  className="text-sm font-semibold text-neutral-500 hover:text-neutral-950"
                >
                  Change Input Specs
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-sm font-semibold text-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGoalAndRoadmap}
                    disabled={saving}
                    className="inline-flex items-center gap-2 bg-neutral-950 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition"
                  >
                    {saving ? "Saving roadmap..." : "Confirm & Save Goal"}
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
