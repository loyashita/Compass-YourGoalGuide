import { GoogleGenAI } from "@google/genai";

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

export async function executeWeeklyReview(
  userId: string,
  profile: any,
  snapshot: any[],
  cognitiveOverload: number,
  userFeedback: string
): Promise<any> {
  const ai = getGemini();

  // Prompt Gemini to analyze sentiment and generate a comprehensive Weekly Assessment
  const systemInstruction = `You are COMPASS, an AI personal executive coach and sentiment analyst.
Your job is to generate a comprehensive, direct, and constructive Weekly Performance Assessment.

Key Responsibilities:
1. AUDIT COMPLETION VS PLANNED: Compare completed tasks vs overdue/upcoming tasks.
2. OVERLOAD REFLECTION: Incorporate the user's self-reported cognitive overload rating (scale 1-5, where 5 is extremely burned out).
3. SENTIMENT ANALYSIS: Analyze the tone and sentiment of the user's written feedback. Correlate this written feedback with a computed confidence score (Very Low, Low, Neutral, High, Very High) representing their mental/operational runway.
4. DYNAMIC ACTION PLAN: Formulate next week's tasks and pacing to avoid repeating past failures. Offer specific sequencing and scope modifications.

Ensure the assessment is structured with these exact markdown headers:
## 🎉 Wins This Week
(Highlight actual completed tasks with positive affirmation)

## ⚠️ Missed or Stalled
(Objectively pinpoint gaps and overdue tasks)

## 🧠 Cognitive & Sentiment Audit
(Output the detected sentiment, computed confidence score, and how their cognitive overload of ${cognitiveOverload}/5 influences their focus)

## 🎯 Dynamic Action Plan for Next Week
(Adjust next week's schedule to prevent burnout. Recommend specific, concrete sequencing actions, e.g., dropping or staggering tasks)

## 💬 Executive Coach Recommendation
(Deliver a supportive, encouraging, and highly specific closing coaching guidance)

Be direct, extremely specific to the user's goals, and encourage realistic pacing. Avoid generic platitudes. Only focus on listed academic/professional goals.`;

  const formattedPortfolio = (snapshot || []).map((g: any) => {
    return `Goal: ${g.title}
Priority: ${g.priority}
Deadline: ${g.targetDate}
Progress: ${g.progressPercentage}%
Tasks Completed:
${(g.tasksCompletedThisWeek || []).map((t: string) => `  - ${t}`).join("\n") || "  (None)"}
Tasks Overdue:
${(g.tasksOverdue || []).map((t: string) => `  - ${t}`).join("\n") || "  (None)"}
Tasks Due Next 7 Days:
${(g.tasksDueNext7Days || []).map((t: string) => `  - ${t}`).join("\n") || "  (None)"}
`;
  }).join("\n---\n");

  const userPrompt = `TODAY'S DATE: ${new Date().toISOString().split("T")[0]}
USER ROLE: ${profile?.role || "Student"}
COACHING STYLE: ${profile?.aiStyle || "Balanced"}
ADDITIONAL CONTEXT: ${profile?.extraContext || "None."}

COGNITIVE OVERLOAD RATING: ${cognitiveOverload}/5
USER'S REFLECTIVE JOURNAL/FEEDBACK:
"${userFeedback || "No written feedback provided."}"

ACTIVE GOALS PORTFOLIO SNAPSHOT:
${formattedPortfolio || "No goals logged."}

Generate the Weekly Assessment.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: userPrompt,
    config: {
      systemInstruction,
    },
  });

  return response.text || "Failed to generate weekly assessment.";
}
