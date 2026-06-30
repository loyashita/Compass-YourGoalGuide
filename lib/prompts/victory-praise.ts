import { GoogleGenAI } from "@google/genai";

function getGemini(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return new GoogleGenAI({ apiKey: key });
}

export async function executeVictoryPraise(
  userId: string,
  goal: any,
  profile: any
): Promise<string> {
  const ai = getGemini();

  const coachingTone = profile?.coachingTone || "Supportive";
  const aiStyle = profile?.aiStyle || "Balanced";

  // Tone Guideline Setup
  let toneGuideline = "";
  if (coachingTone === "Tough Love") {
    toneGuideline = `COACHING TONE: LION'S PUSH (TOUGH LOVE)
- Start with a direct, punchy acknowledgment of the accomplishment (e.g., "Objective secured.", "You proved yourself on this one.").
- Be firm, direct, and push them to carry this momentum. Speak like a demanding coach who is proud but expects them to keep ascending.
- No soft, overly sweet fluff. Inspire them through action and raw discipline. Highlight that winners don't stop here.`;
  } else if (coachingTone === "Analytical") {
    toneGuideline = `COACHING TONE: TACTICAL STRATEGIST (ANALYTICAL)
- Treat this as an executive victory brief. Speak objectively, structurally, and logically.
- Focus on the metrics of accomplishment: 100% progress achieved, priority executed, phases locked down.
- Quantify their success, analyze why this setup worked, and record it as a tactical milestone.`;
  } else {
    toneGuideline = `COACHING TONE: EMPATHETIC GUIDE (SUPPORTIVE)
- Be incredibly warm, encouraging, celebratory, and full of heartfelt validation.
- Make them feel seen, appreciated, and proud. Celebrate the dedication, consistency, and daily grit.
- Gently remind them to rest and savor the victory before diving into the next mountain.`;
  }

  // Style Guideline Setup
  let styleGuideline = "";
  if (aiStyle === "Detailed") {
    styleGuideline = `RESPONSE STYLE: COMPREHENSIVE & MEMORABLE
- Provide a rich, memorable victory tribute with structured sections.
- Give a deep review of what this accomplishment means for their personal development and long-term trajectory.`;
  } else if (aiStyle === "Concise") {
    styleGuideline = `RESPONSE STYLE: ULTRA-CONCISE & HIGH-IMPACT
- Keep it extremely short (2-3 sentences max) but exceptionally high-impact.
- No fluff, pure distilled inspiration.`;
  } else {
    styleGuideline = `RESPONSE STYLE: BALANCED & DYNAMIC
- Provide a clear, strategic congratulatory opening, followed by a bulleted breakdown of "Lessons & Strengths Proven", and a final call-to-arms.
- Make it beautifully scannable and highly aesthetic.`;
  }

  const systemInstruction = `You are COMPASS, an elite AI personal executive coach.
Your job is to generate a custom, highly motivating, and deeply personal "Victory Speech / Honor Praise" for a user who has just successfully achieved 100% completion of their goal.

GOAL DETAILS:
- Title: "${goal.title}"
- Description: "${goal.description || "N/A"}"
- Category: "${goal.category}"
- Priority: "${goal.priority}"
- Target Deadline: "${goal.targetDate}"
- Confidence Index: ${goal.confidenceScore}/5

USER PROFILE:
- Preferred Coaching Tone: ${coachingTone}
- Preferred AI Style: ${aiStyle}
- Extra Context: ${profile?.extraContext || "None."}

${toneGuideline}

${styleGuideline}

Requirements:
1. Address the user directly.
2. Refer explicitly to the title of their goal: "${goal.title}".
3. Structure your response with elegant markdown (use headers, quotes, list items, or bold terms).
4. Deliver a speech that is uniquely personalized to their chosen coaching tone and style. 
5. Inspire profound pride and focus momentum. Avoid generic hollow platitudes. Speak with authority and custom insight.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Praise me for successfully completing my goal: "${goal.title}".`,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "You achieved your goal! Excellent work.";
  } catch (error: any) {
    console.error("Gemini call in executeVictoryPraise failed:", error);
    throw error;
  }
}

export function generateFallbackVictoryPraise(goal: any, profile: any): string {
  const coachingTone = profile?.coachingTone || "Supportive";
  
  if (coachingTone === "Tough Love") {
    return `### 🏆 Victory Log: ${goal.title} Secured.
> "The impediment to action advances action. What stands in the way becomes the way."

You marked this objective as **100% complete**. 

**The Coach's Verdict:**
You didn't flinch. You drew up the roadmap, and you executed. This wasn't luck—it was pure discipline. Celebrate for five minutes, write down what went right, and then find your next target. The grind never sleeps, and neither does your potential. 

*Onward.*`;
  } else if (coachingTone === "Analytical") {
    return `### 🏆 Performance Brief: ${goal.title} Fully Resolved
- **Objective State:** 100% Completed
- **Category:** ${goal.category}
- **Priority Class:** ${goal.priority}
- **Timeline Alignment:** Target date ${goal.targetDate} met.

**Tactical Retrospective:**
The system records a successful completion of "${goal.title}". By systematically checking off all phase action items, you maintained structural compliance. Your confidence scoring remained stable. Excellent operational execution. Use this template for your next operational sprint.`;
  } else {
    return `### 🏆 Congratulations! You Achieved "${goal.title}"!
> "Celebrate who you are becoming through the dedication you show to your growth."

You did it! You have successfully completed your goal. 

**A Message From Your Coach:**
I am so incredibly proud of you! You set your sights on "${goal.title}" and pushed forward with courage and consistency. Paving your roadmap, overcoming daily blockers, and achieving 100% is a beautiful testament to what you are capable of. Take a deep breath of satisfaction and celebrate yourself today. You have earned every bit of this triumph!`;
  }
}
