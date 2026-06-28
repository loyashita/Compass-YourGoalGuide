export function isGibberish(text: string): boolean {
  const clean = (text || "").trim();
  if (clean.length < 2) return true;

  // Repetitive spam (e.g. "aaaaa...")
  if (/(.)\1{9,}/.test(clean)) return true;

  // Long block with virtually no spaces (e.g. no spaces in > 30 characters of letters/numbers)
  // or very few spaces compared to length (e.g. if length > 20 and space count is 0)
  const spaces = (clean.match(/\s/g) || []).length;
  if (clean.length > 20 && spaces === 0) return true;

  // Check if there are recognizable letters (at least some alphabet characters)
  const letters = (clean.match(/[a-zA-Z]/g) || []).length;
  if (letters / clean.length < 0.2) return true;

  return false;
}

export function isOffTopicOrInjection(text: string): boolean {
  const cleanLower = (text || "").toLowerCase();

  const injectionPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /disregard\s+(all\s+)?previous/i,
    /act\s+as\s+a/i,
    /system\s+prompt/i,
    /new\s+instruction/i,
    /forget\s+(your\s+)?goals/i,
    /bypass\s+the\s+limit/i
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(cleanLower)) {
      return true;
    }
  }

  // Common off-topic triggers
  const offTopicKeywords = [
    "write me a poem",
    "what's the weather",
    "whats the weather",
    "weather today",
    "make a pizza",
    "pizza recipe",
    "capital of",
    "tell me a joke",
    "how to cook",
    "movie recommendations",
    "who wrote"
  ];

  for (const kw of offTopicKeywords) {
    if (cleanLower.includes(kw)) {
      return true;
    }
  }

  return false;
}
