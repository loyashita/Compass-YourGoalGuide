import { GoogleGenAI } from "@google/genai";
import { isGibberish } from "./validation";
import { validateRoadmapOutput, safeParseJSON } from "./validateOutput";

let aiInstance: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
}

/**
 * First Pass: Generates the raw roadmap based on the goal, user profile, and workload.
 */
async function generateRawRoadmap(goal: any, profile: any, existingGoals: any[]): Promise<any> {
  const ai = getGemini();

  const systemInstruction = `You are an expert personal coach and project planner.
Automatically translate a user's high-level goal into a concrete plan (Phases → Tasks → Resources).

CORE INSTRUCTIONS:
1. REALISTIC over OPTIMISTIC: Push back on under-scoped timelines (e.g. "learn ML in 2 weeks" or "master Economics in 3 days"). Set a realistic, grounded timeline even if it exceeds the user's stated target date.
2. SPECIFIC over VAGUE: Tasks must be actionable and concrete. "Research machine learning" is completely forbidden. "Read Chapter 1 of Hands-On Machine Learning with Scikit-Learn and write a summary of linear regression math" is required.
3. WORKLOAD-AWARE: Calibrate the number of tasks per phase based on the user's existing active goals portfolio. If they are heavily overloaded, generate a leaner, highly-sequenced roadmap with fewer concurrent tasks.
4. PHASE COUNT: Generates exactly 3 to 5 phases (which represents qualitative milestones, e.g., "Theory Baseline & Setup", "Core Implementation Sprints", "Polish & Integration"). Never use generic phase names like "Planning" or "Execution".
5. TASK COUNT: Place exactly 2 to 5 actionable tasks inside each phase.

JSON Response Schema:
{
  "error_unclear_goal_reason": null, // Set to a polite reason string if input is complete gibberish or unplannable, else null
  "phases": [
    {
      "title": "specific qualitative phase name",
      "description": "1-2 sentences on what this phase achieves",
      "order": 1,
      "estimated_duration": "e.g. 2 weeks",
      "suggested_start_date": "YYYY-MM-DD",
      "suggested_end_date": "YYYY-MM-DD",
      "tasks": [
        {
          "title": "specific completable action item",
          "priority": "high|medium|low",
          "suggested_due_date": "YYYY-MM-DD",
          "order": 1,
          "notes": "1-sentence clarifying tip or context"
        }
      ]
    }
  ],
  "resources": [
    {
      "title": "exact title of textbook, course, or tool",
      "type": "book|course|tool|video|article",
      "url": "real URL if confident it exists, else null",
      "description": "1 sentence on why this is useful for this goal"
    }
  ],
  "balance_note": "one sentence on how this goal fits with the existing active goals portfolio",
  "conflict_warning": "null, or a friendly overload warning if they have too many high-priority tasks in parallel",
  "timeline_warning": "null, or an honest push-back explaining why their timeline needs calibration"
}`;

  const userPrompt = `GOAL TO PLAN:
Title: ${goal.title}
Description: ${goal.description || "None."}
Category: ${goal.category}
Priority: ${goal.priority}
Target completion date: ${goal.targetDate || "No target date specified. Set a realistic and grounded timeline from today."}
Today's date: ${new Date().toISOString().split("T")[0]}

USER PROFILE:
Role: ${profile?.role || "Student"}
AI Coaching Style: ${profile?.aiStyle || "Balanced"}
Additional Context: ${profile?.extraContext || "None."}

EXISTING ACTIVE GOALS:
${
  existingGoals && existingGoals.length > 0
    ? existingGoals.map((g: any) => `- ${g.title} (Category: ${g.category}, Priority: ${g.priority}, Progress: ${g.progressPercentage}%)`).join("\n")
    : "None. This is their only active goal."
}

Generate the raw roadmap JSON. Return ONLY the JSON matching the specified schema.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: userPrompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
    },
  });

  const text = response.text?.trim() || "{}";
  return safeParseJSON(text);
}

/**
 * Second Pass: Verification and quality assessment of the roadmap.
 */
async function verifyAndCorrectRoadmap(rawRoadmap: any, goalTitle: string): Promise<any> {
  // If the first pass indicated an unclear/gibberish goal, skip verification
  if (rawRoadmap.error_unclear_goal_reason) {
    return rawRoadmap;
  }

  const ai = getGemini();

  const systemInstruction = `You are a critical quality assurance coach for goal roadmap designs.
You will receive a generated JSON roadmap for a user's goal.
Your job is to run a "Verification Pass" and correct any of the following issues:
1. FABRICATED RESOURCES: Verify if any textbooks, courses, or reference links are fabricated or do not exist. If they do not exist, replace them with widely recognized real-world references (e.g., standard textbooks like 'Hands-On Machine Learning', official MDN Docs, or MIT OpenCourseWare), or remove them entirely.
2. VAGUE TASKS: Look for vague, non-actionable tasks (e.g., 'Learn theory', 'Research topic', 'Study books'). Rewrite them into actionable, specific steps (e.g., 'Read Chapters 1 & 2 of the textbook and complete the review problem set').
3. PHASE/TASK BOUNDS: Ensure there are exactly 3 to 5 phases and exactly 2 to 5 tasks per phase.

Return the fully corrected and verified roadmap JSON matching the exact same schema. No additional text, explanations, or code fences.`;

  const userPrompt = `GOAL TITLE: ${goalTitle}

GENERATED ROADMAP JSON:
${JSON.stringify(rawRoadmap, null, 2)}

Provide the audited, corrected, and verified roadmap JSON matching the exact schema.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: userPrompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
    },
  });

  const text = response.text?.trim() || "{}";
  return safeParseJSON(text);
}

/**
 * Main Entry Point for Goal Roadmap Generation.
 */
export async function executeRoadmapGeneration(goal: any, profile: any, existingGoals: any[]): Promise<any> {
  const title = (goal.title || "").trim();

  // Heuristic Input Gibberish Detection
  if (isGibberish(title)) {
    return {
      error_unclear_goal_reason: "The goal title provided appears to be too short, unclear, or contains repetitive letters/gibberish. Please write a clear, meaningful goal so I can formulate a realistic roadmap for you.",
      phases: [],
      resources: [],
      balance_note: "Unable to analyze workload.",
      conflict_warning: null,
      timeline_warning: null
    };
  }

  try {
    // Pass 1: Generative Planning
    const rawRoadmap = await generateRawRoadmap(goal, profile, existingGoals);
    
    // Pass 2: Verification and Auto-Correction
    const verifiedRoadmap = await verifyAndCorrectRoadmap(rawRoadmap, title);
    
    // Apply Output Guardrails (caps, placeholding, type coerces)
    return validateRoadmapOutput(verifiedRoadmap);
  } catch (err) {
    console.error("Roadmap generation execution failed, trigger post-pass fallback:", err);
    throw err;
  }
}
