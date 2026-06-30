import { db } from "./index.ts";
import { users } from "./schema.ts";

async function withRetry<T>(fn: () => Promise<T>, retries = 8, delay = 1500): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 1) throw error;
    console.warn(`Database query failed, retrying in ${delay}ms... Error:`, error.message || error, "Cause:", error.cause || error);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, Math.min(delay * 1.5, 4000));
  }
}

export async function getOrCreateUser(uid: string, email: string) {
  return withRetry(async () => {
    const result = await db.insert(users)
      .values({
        uid,
        email,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
        },
      })
      .returning();

    return result[0];
  });
}
