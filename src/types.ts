export interface UserProfile {
  id?: string;
  userId: string;
  role: 'Student' | 'Early Career Professional' | 'Founder' | 'Researcher';
  aiStyle: 'Detailed' | 'Balanced' | 'Concise';
  categoryTabs: string[];
  extraContext: string;
  createdAt: string;
  updatedAt: string;
  blocker?: string;
  multitaskLevel?: string;
  coachingTone?: 'Tough Love' | 'Supportive' | 'Analytical';
  peakFocusWindow?: string;
  habitFocus?: string;
  workspaceVibe?: string;
  googleCalendarSyncEnabled?: boolean;
  googleTasksSyncEnabled?: boolean;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'active' | 'completed';
  targetDate: string; // YYYY-MM-DD
  progressPercentage: number; // 0 to 100
  confidenceScore: number; // 1 to 5
  balanceNote?: string;
  conflictWarning?: string | null;
  timelineWarning?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalPhase {
  id: string;
  goalId: string;
  userId: string;
  title: string;
  description: string;
  order: number;
  estimatedDuration: string;
  suggestedStartDate: string;
  suggestedEndDate: string;
  status: 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface GoalTask {
  id: string;
  phaseId: string;
  goalId: string;
  userId: string;
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'pending' | 'completed';
  suggestedDueDate: string;
  order: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  googleTaskId?: string | null;
  googleEventId?: string | null;
}

export interface GoalResource {
  id: string;
  goalId: string;
  userId: string;
  title: string;
  type: 'book' | 'course' | 'tool' | 'video' | 'article';
  url: string | null;
  description: string;
  createdAt: string;
}

export interface GoalChat {
  id?: string;
  goalId: string;
  userId: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
}

export interface WeeklyReview {
  id: string;
  userId: string;
  content: string;
  goalsSnapshot: string; // JSON snapshot of active goals
  generatedAt: string;
  createdAt: string;
}

export interface RebalanceHistory {
  id: string;
  userId: string;
  content: string;
  goalsSnapshot: string; // JSON snapshot
  generatedAt: string;
  createdAt: string;
}

export interface GoalCheckIn {
  id: string;
  goalId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  coachingStyle: 'Detailed' | 'Balanced' | 'Concise';
  diagnosticSentiment: 'Excellent' | 'On Track' | 'Under Pressure' | 'Overloaded' | 'Stalled';
  coachingReflection: string;
  suggestedActionToday: string;
  status: 'pending' | 'completed' | 'postponed';
  createdAt: string;
}

export interface CheckInSchedule {
  goalId: string;
  userId: string;
  enabled: boolean;
  time: string; // e.g. "08:00"
  frequency: 'daily' | 'weekly';
  lastRunAt: string | null;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: 'Exam' | 'Submission' | 'Deadline' | 'Fixed Task' | 'Other';
  date: string; // YYYY-MM-DD
  associatedGoalId?: string;
  createdAt: string;
  googleEventId?: string | null;
  googleTaskId?: string | null;
}

