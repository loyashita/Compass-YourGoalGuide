import { CalendarEvent, GoalTask } from "../types";

// Helper to get tomorrow/next day for exclusive end dates in Google Calendar
export const getNextDayDateString = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return dateStr;
    }
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  } catch (err) {
    return dateStr;
  }
};

/**
 * Custom error class to identify Google API Authentication (401) failures.
 */
export class GoogleAuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = "GoogleAuthError";
    this.status = status;
  }
}

/**
 * Utility helper to assert response success and handle 401 authorization issues.
 */
export async function checkResponse(res: Response, defaultMsg: string): Promise<void> {
  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 401) {
      throw new GoogleAuthError(`GoogleAuthError: 401 Unauthenticated - ${res.statusText} (${errorText})`, 401);
    }
    throw new Error(`${defaultMsg}: ${res.statusText} (${errorText})`);
  }
}

/**
 * Lists the user's Google Task lists and searches for one titled "COMPASS Goals".
 * If not found, creates it.
 */
export async function getOrCreateCompassTaskList(token: string): Promise<string> {
  const cachedId = localStorage.getItem("compass_google_task_list_id");
  if (cachedId) {
    // Quickly verify if it still exists
    try {
      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        throw new GoogleAuthError("GoogleAuthError: 401 Unauthenticated (cached verification)", 401);
      }
      if (res.ok) {
        const data = await res.json();
        const exists = data.items?.some((item: any) => item.id === cachedId);
        if (exists) {
          return cachedId;
        }
      }
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        throw err;
      }
      console.warn("Failed to verify Google task list, falling back to cached value:", err);
      return cachedId;
    }
  }

  // Fetch lists
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  await checkResponse(res, "Failed to fetch Google task lists");

  const data = await res.json();
  const existingList = data.items?.find((item: any) => item.title === "COMPASS Goals");

  if (existingList) {
    localStorage.setItem("compass_google_task_list_id", existingList.id);
    return existingList.id;
  }

  // Create list
  const createRes = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "COMPASS Goals" }),
  });

  await checkResponse(createRes, "Failed to create COMPASS Goals task list");

  const newList = await createRes.json();
  localStorage.setItem("compass_google_task_list_id", newList.id);
  return newList.id;
}

/**
 * Synchronizes a single GoalTask to Google Tasks.
 * Returns the googleTaskId if successfully synced/created.
 */
export async function syncTaskToGoogle(
  task: GoalTask,
  token: string,
  taskListId?: string
): Promise<string> {
  const listId = taskListId || (await getOrCreateCompassTaskList(token));
  const dueFormatted = task.suggestedDueDate ? `${task.suggestedDueDate}T00:00:00Z` : undefined;
  const statusFormatted = task.status === "completed" ? "completed" : "needsAction";

  const body = {
    title: task.title,
    notes: task.notes || `Priority: ${task.priority}`,
    status: statusFormatted,
    due: dueFormatted,
  };

  if (task.googleTaskId) {
    // Update existing task
    const res = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${task.googleTaskId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (res.status === 404) {
      // If it was deleted in Google Tasks but we have it, recreate it!
      const recreateRes = await fetch(
        `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      await checkResponse(recreateRes, "Failed to recreate deleted task");
      const data = await recreateRes.json();
      return data.id;
    }

    await checkResponse(res, "Failed to update Google Task");
    return task.googleTaskId;
  } else {
    // Create new task
    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    await checkResponse(res, "Failed to create Google Task");

    const data = await res.json();
    return data.id;
  }
}

/**
 * Deletes a task from Google Tasks if it exists.
 */
export async function deleteTaskFromGoogle(
  googleTaskId: string,
  token: string,
  taskListId?: string
): Promise<void> {
  try {
    const listId = taskListId || (await getOrCreateCompassTaskList(token));
    const res = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${googleTaskId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    // Ignore or handle auth errors
    if (res.status === 401) {
      throw new GoogleAuthError("GoogleAuthError: 401 Unauthenticated on task deletion", 401);
    }
  } catch (err) {
    console.error("Failed to delete task from Google Tasks:", err);
    throw err; // Propagate auth errors if needed
  }
}

/**
 * Synchronizes a single CalendarEvent to Google Calendar.
 * Returns the googleEventId if successfully synced/created.
 */
export async function syncCalendarEventToGoogle(
  event: CalendarEvent,
  token: string
): Promise<string> {
  const nextDay = getNextDayDateString(event.date);
  const body = {
    summary: event.title,
    description: event.description || `COMPASS Roadmap Calendar Event (${event.type})`,
    start: {
      date: event.date,
    },
    end: {
      date: nextDay,
    },
  };

  if (event.googleEventId) {
    // Update existing Google Calendar event
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.googleEventId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (res.status === 404) {
      // Recreate if not found (e.g., deleted on Calendar UI)
      const recreateRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      await checkResponse(recreateRes, "Failed to recreate calendar event");
      const data = await recreateRes.json();
      return data.id;
    }

    await checkResponse(res, "Failed to update calendar event");
    return event.googleEventId;
  } else {
    // Create new Google Calendar event
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    await checkResponse(res, "Failed to create calendar event");

    const data = await res.json();
    return data.id;
  }
}

/**
 * Deletes an event from Google Calendar if it exists.
 */
export async function deleteCalendarEventFromGoogle(
  googleEventId: string,
  token: string
): Promise<void> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (res.status === 401) {
      throw new GoogleAuthError("GoogleAuthError: 401 Unauthenticated on calendar deletion", 401);
    }
  } catch (err) {
    console.error("Failed to delete event from Google Calendar:", err);
    throw err;
  }
}
