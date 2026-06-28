interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

/**
 * Estimates token count based on standard approximation (1 token ≈ 4 characters).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Context Budgeter:
 * Caps total context (System Instructions + Message History + New Message) at 16,000 tokens.
 * Truncates oldest messages first if the budget is exceeded.
 */
export function buildSecuredContext(
  systemInstruction: string,
  history: ChatMessage[],
  newMessage: string,
  maxTokens: number = 16000
): { systemInstruction: string; history: ChatMessage[]; newMessage: string } {
  const sysTokens = estimateTokens(systemInstruction);
  const newMsgTokens = estimateTokens(newMessage);
  
  let remainingBudget = maxTokens - sysTokens - newMsgTokens;
  
  if (remainingBudget <= 0) {
    // If system prompt + new message exceeds the limit, truncate the new message and clear history
    const truncatedNewMessage = newMessage.substring(0, Math.max(0, (maxTokens - sysTokens) * 4));
    return {
      systemInstruction,
      history: [],
      newMessage: truncatedNewMessage
    };
  }

  // Iterate backwards through history to keep the most recent messages that fit the remaining budget
  const securedHistory: ChatMessage[] = [];
  let currentHistoryTokens = 0;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const msgTokens = estimateTokens(msg.content);
    
    if (currentHistoryTokens + msgTokens <= remainingBudget) {
      securedHistory.unshift(msg);
      currentHistoryTokens += msgTokens;
    } else {
      break; // Truncate older messages
    }
  }

  return {
    systemInstruction,
    history: securedHistory,
    newMessage
  };
}
