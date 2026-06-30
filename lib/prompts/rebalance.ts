import { GoogleGenAI } from "@google/genai";
import { safeParseJSON } from "../ai/validateOutput";

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

export async function executeRebalance(userId: string, activeGoals: any[], profile: any): Promise<any> {
  const ai = getGemini();

  const coachingTone = profile?.coachingTone || "Supportive";
  const aiStyle = profile?.aiStyle || "Balanced";

  // Tone Guideline Setup
  let toneGuideline = "";
  if (coachingTone === "Tough Love") {
    toneGuideline = `COACHING TONE: LION'S PUSH (TOUGH LOVE)
- Be extremely direct, firm, and high-agency.
- Gently but clearly point out over-scoping or planning fallacies.
- Challenge low-impact multitasking and push heavily for hard sequential pruning. No sugarcoating.`;
  } else if (coachingTone === "Analytical") {
    toneGuideline = `COACHING TONE: TACTICAL STRATEGIST (ANALYTICAL)
- Be objective, cool, and highly structured.
- Frame workload rebalancing as an operational capacity/optimization task.
- Present precise mathematical, log-based, or schedule justifications for pruning and sequencing.`;
  } else {
    toneGuideline = `COACHING TONE: EMPATHETIC GUIDE (SUPPORTIVE)
- Be warm, supportive, validating, and compassionate.
- Focus on psychological well-being, healthy boundaries, and reducing cognitive overwhelm.
- Emphasize sustainable pace and slow, steady build consistency.`;
  }

  // Style Guideline Setup
  let styleGuideline = "";
  if (aiStyle === "Detailed") {
    styleGuideline = `RESPONSE STYLE: COMPREHENSIVE & DEEP-DIVE
- Provide rich, deeply detailed assessment sections with conceptual background explanations.
- Write robust, thorough paragraphs describing the logic for each strategy.`;
  } else if (aiStyle === "Concise") {
    styleGuideline = `RESPONSE STYLE: ULTRA-CONCISE & DIRECT
- Keep sentences short, dense, and straight to the point.
- Eliminate all preamble or introductory filler; use direct, action-focused bullets.`;
  } else {
    styleGuideline = `RESPONSE STYLE: BALANCED & STRATEGIC
- Combine clear, strategic contextual summaries with highly actionable checklists.
- Balance depth with extreme visual scannability.`;
  }

  const systemInstruction = `You are COMPASS, an elite AI workload strategist designed to solve the "productivity trap" (adding more tasks than possible).

Analyse ALL active goals together and recommend exactly THREE distinct strategic solutions:
1. SEQUENCE: Push back low-priority deadlines, stagger schedules, or serialise milestones instead of multitasking.
2. OUTSOURCE: Identify tasks that can be delegated, automated, or solved using existing pre-built tools and packages (e.g. using prebuilt templates or libraries instead of coding from scratch).
3. PRUNE: Identify low-impact tasks or stretch-goals to drop entirely from their active list to reduce cognitive load.

Be specific and practical. Use the real goal titles and IDs passed to you.
Structure your assessment with clear markdown headers (e.g., ## ⏸️ Sequence Strategy, ## 🛠️ Outsource Strategy, ## ✂️ Prune Strategy).

USER PREFERENCES:
Preferred Tone: ${coachingTone}
Preferred Style: ${aiStyle}

${toneGuideline}

${styleGuideline}

Your response MUST be in structured JSON format. Respond ONLY with valid JSON.
JSON Schema:
{
  "content": "A detailed, structured strategic rebalancing assessment in Markdown with clear headers explaining the Sequence, Outsource, and Prune strategies, fully respecting the requested tone/style preferences.",
  "proposedChanges": [
    {
      "goalId": "exact string match of goal ID passed in",
      "goalTitle": "exact string match of goal title passed in",
      "currentPriority": "High|Medium|Low",
      "recommendedPriority": "High|Medium|Low",
      "currentDeadline": "YYYY-MM-DD",
      "recommendedDeadline": "YYYY-MM-DD",
      "reason": "1-sentence strategic rationale for this proposed priority or deadline shift under these 3 strategies."
    }
  ]
}`;

  const formattedGoals = activeGoals.map((g: any) => {
    return `- Goal ID: ${g.id || "unknown"}
  Title: ${g.title}
  Category: ${g.category}
  Priority: ${g.priority}
  Deadline: ${g.targetDate || g.deadline}
  Progress: ${g.progressPercentage}%
  Confidence Score (1-5): ${g.confidenceScore}`;
  }).join("\n\n");

  const userPrompt = `ACTIVE GOALS PORTFOLIO:
${formattedGoals || "No active goals currently logged."}

USER PROFILE:
Role: ${profile?.role || "Student"}
AI Coaching Style: ${profile?.aiStyle || "Balanced"}
Additional Context: ${profile?.extraContext || "None."}

Today's date: ${new Date().toISOString().split("T")[0]}

Please provide a structured workload rebalancing assessment and strategic proposedChanges in JSON.`;

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
