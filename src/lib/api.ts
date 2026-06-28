/**
 * Safe, resilient fetch utility that validates response status and content-type before parsing.
 * Prevents JSON parsing crashes (e.g. "Unexpected token '<'") when the server returns HTML (like 404, 502, or 503).
 */
export async function safeFetchJson(url: string, options?: RequestInit): Promise<any> {
  const response = await fetch(url, options);
  
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  
  if (!response.ok) {
    let errorMsg = `Server error (Status: ${response.status})`;
    if (isJson) {
      try {
        const errResult = await response.json();
        errorMsg = errResult.error || errorMsg;
      } catch (e) {
        // ignore JSON parse error on error payload
      }
    } else {
      try {
        const text = await response.text();
        if (text && text.trim().length > 0 && text.length < 200) {
          errorMsg = `${errorMsg}: ${text.trim()}`;
        }
      } catch (e) {
        // ignore read error
      }
    }
    throw new Error(errorMsg);
  }
  
  if (!isJson) {
    throw new Error(`Invalid response format from server: Expected JSON but received ${contentType || "HTML/Text"}.`);
  }
  
  return response.json();
}
