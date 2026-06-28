/**
 * Aggressively extracts and parses a JSON block from any AI conversational response.
 * Handles markdown fences, preambles, and trailing conversational text.
 */
export function safeParseJSON(text: string): any {
  if (!text) return {};
  
  let cleaned = text.trim();
  
  // Strip markdown code fences if present
  if (cleaned.includes("```")) {
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleaned = match[1].trim();
    }
  }
  
  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // If that fails, find the first '{' or '[' and last '}' or ']'
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonCandidate);
      } catch (innerError) {
        // Try array parsing
        const firstBracket = cleaned.indexOf("[");
        const lastBracket = cleaned.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          try {
            const jsonCandidate = cleaned.substring(firstBracket, lastBracket + 1);
            return JSON.parse(jsonCandidate);
          } catch (arrayError) {
            // If all fails, throw error
          }
        }
      }
    }
    throw new Error("Failed to parse valid JSON from AI output.");
  }
}

/**
 * Sanitizes an input string to strip out HTML tags and prevent Cross-Site Scripting (XSS).
 */
export function sanitizeHTML(text: any): string {
  if (typeof text !== "string") {
    if (text === null || text === undefined) return "";
    return String(text);
  }
  // Remove scripts, styles and HTML tags
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

/**
 * Coerces goal priority string to exact 'High' | 'Medium' | 'Low' type.
 */
export function coercePriority(p: any): 'High' | 'Medium' | 'Low' {
  if (!p || typeof p !== "string") return "Medium";
  const pLower = p.toLowerCase();
  if (pLower.includes("hi")) return "High";
  if (pLower.includes("lo")) return "Low";
  return "Medium";
}

/**
 * Coerces task priority string to exact 'high' | 'medium' | 'low' type.
 */
export function coerceTaskPriority(p: any): 'high' | 'medium' | 'low' {
  if (!p || typeof p !== "string") return "medium";
  const pLower = p.toLowerCase();
  if (pLower.includes("hi")) return "high";
  if (pLower.includes("lo")) return "low";
  return "medium";
}

/**
 * Caps an array at a hard limit.
 */
export function capArray<T>(arr: T[] | null | undefined, limit: number): T[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr.slice(0, limit);
}

/**
 * Applies full output guardrails to a generated roadmap.
 */
export function validateRoadmapOutput(raw: any): any {
  const result: any = {};
  
  // Unclear goal reason
  result.error_unclear_goal_reason = raw.error_unclear_goal_reason 
    ? sanitizeHTML(raw.error_unclear_goal_reason) 
    : null;
    
  if (result.error_unclear_goal_reason) {
    result.phases = [];
    result.resources = [];
    return result;
  }

  // 1. Phases
  // Generates 3-5 phases, capping at a hard limit of 8 during validation
  let rawPhases = capArray(raw.phases, 8);
  if (rawPhases.length === 0) {
    // Inject at least one default phase if completely empty to avoid crash
    rawPhases = [{
      title: "Phase 1: Foundation",
      description: "Establish baseline roadmap items and resources.",
      order: 1,
      estimated_duration: "1 week",
      suggested_start_date: new Date().toISOString().split("T")[0],
      suggested_end_date: new Date().toISOString().split("T")[0],
      tasks: []
    }];
  }

  result.phases = rawPhases.map((phase: any, pIdx: number) => {
    const validatedPhase: any = {
      title: sanitizeHTML(phase.title || `Phase ${pIdx + 1}: Progress Milestone`),
      description: sanitizeHTML(phase.description || "No description available."),
      order: Number(phase.order) || (pIdx + 1),
      estimated_duration: sanitizeHTML(phase.estimated_duration || "Flexible"),
      suggested_start_date: sanitizeHTML(phase.suggested_start_date || new Date().toISOString().split("T")[0]),
      suggested_end_date: sanitizeHTML(phase.suggested_end_date || new Date().toISOString().split("T")[0])
    };

    // Requires exactly 2-5 tasks per phase.
    let phaseTasks = capArray(phase.tasks, 5);
    
    // Empty phases automatically get a placeholder task injected by the system to prevent UI crashes
    if (phaseTasks.length === 0) {
      phaseTasks = [{
        title: "Complete initial milestone assessment",
        priority: "medium",
        suggested_due_date: validatedPhase.suggested_end_date,
        order: 1,
        notes: "Placeholder task injected to ensure execution setup."
      }];
    }
    
    // Ensure we have at least 2 tasks per phase
    while (phaseTasks.length < 2) {
      phaseTasks.push({
        title: `Secondary action item for ${validatedPhase.title}`,
        priority: "medium",
        suggested_due_date: validatedPhase.suggested_end_date,
        order: phaseTasks.length + 1,
        notes: "Injected task to satisfy structural validation requirements."
      });
    }

    validatedPhase.tasks = phaseTasks.map((task: any, tIdx: number) => ({
      title: sanitizeHTML(task.title || `Action Item ${tIdx + 1}`),
      priority: coerceTaskPriority(task.priority),
      suggested_due_date: sanitizeHTML(task.suggested_due_date || validatedPhase.suggested_end_date),
      order: Number(task.order) || (tIdx + 1),
      notes: task.notes ? sanitizeHTML(task.notes) : null
    }));

    return validatedPhase;
  });

  // 2. Resources (cap at 15)
  const rawResources = capArray(raw.resources, 15);
  result.resources = rawResources.map((res: any) => ({
    title: sanitizeHTML(res.title || "Reference Material"),
    type: sanitizeHTML(res.type || "article"),
    url: res.url ? sanitizeHTML(res.url) : null,
    description: sanitizeHTML(res.description || "No resource summary available.")
  }));

  // 3. Balance & warnings
  result.balance_note = raw.balance_note ? sanitizeHTML(raw.balance_note) : "Roadmap formulated.";
  result.conflict_warning = raw.conflict_warning ? sanitizeHTML(raw.conflict_warning) : null;
  result.timeline_warning = raw.timeline_warning ? sanitizeHTML(raw.timeline_warning) : null;

  return result;
}
