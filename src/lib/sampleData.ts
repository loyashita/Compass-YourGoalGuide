import { db, collection, doc, writeBatch, getDocs, query, where } from "./firebase";
import { Goal, GoalPhase, GoalTask, GoalResource } from "../types";

export async function prePopulateSampleData(userId: string) {
  try {
    // Check if the user already has goals to avoid double population
    const goalsRef = collection(db, "goals");
    const q = query(goalsRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      console.log("User already has goals. Skipping pre-population.");
      return;
    }

    console.log("Pre-populating sample data for user:", userId);
    const batch = writeBatch(db);
    const today = new Date();

    const getFutureDateString = (daysAhead: number) => {
      const d = new Date();
      d.setDate(today.getDate() + daysAhead);
      return d.toISOString().split("T")[0];
    };

    const getPastDateString = (daysAgo: number) => {
      const d = new Date();
      d.setDate(today.getDate() - daysAgo);
      return d.toISOString().split("T")[0];
    };

    // Goal IDs
    const g1Id = `sample_g1_${userId}`;
    const g2Id = `sample_g2_${userId}`;
    const g3Id = `sample_g3_${userId}`;
    const g4Id = `sample_g4_${userId}`;

    // Goal Documents
    const goal1: Goal = {
      id: g1Id,
      userId,
      title: "Ace my Macroeconomics mid-semester",
      description: "Aiming for an A in intermediate Macroeconomics. Covers IS-LM models, inflation, unemployment, fiscal/monetary policies, and growth theories.",
      category: "Academics",
      priority: "High",
      status: "active",
      targetDate: getFutureDateString(10), // Within 14 days to trigger conflict
      progressPercentage: 30,
      confidenceScore: 4, // 🙂
      balanceNote: "Fits with moderate workload, but overlaps heavily with Side Project shipping deadline.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const goal2: Goal = {
      id: g2Id,
      userId,
      title: "Build COMPASS MVP and ship it",
      description: "An AI-powered personal operating system for ambitious students managing 10-20 competing goals. Build, test and deploy on Cloud Run.",
      category: "Side Projects",
      priority: "High",
      status: "active",
      targetDate: getFutureDateString(12), // Within 14 days to trigger conflict
      progressPercentage: 45,
      confidenceScore: 5, // 🚀
      balanceNote: "Demanding project requiring daily development sprints alongside course workload.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const goal3: Goal = {
      id: g3Id,
      userId,
      title: "Apply for Summer Internships",
      description: "Securing a software engineering or product management summer role. Target 15 quality applications and complete interview prep.",
      category: "Career",
      priority: "High",
      status: "active",
      targetDate: getFutureDateString(5), // Within 14 days to trigger conflict
      progressPercentage: 10,
      confidenceScore: 2, // 😟
      balanceNote: "Highly urgent. Needs immediate attention as application portals are closing.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const goal4: Goal = {
      id: g4Id,
      userId,
      title: "Complete EmpowHer Fellowship deliverables",
      description: "Running a cohort fellowship on gender gaps in tech. Authoring the final tech equity research paper and preparing cohort slides.",
      category: "Personal",
      priority: "Medium",
      status: "active",
      targetDate: getFutureDateString(49), // 7 weeks
      progressPercentage: 20,
      confidenceScore: 3, // 😐
      balanceNote: "Longer horizon deliverable. Can be steadily balanced on weekends.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save Goals
    batch.set(doc(db, "goals", g1Id), goal1);
    batch.set(doc(db, "goals", g2Id), goal2);
    batch.set(doc(db, "goals", g3Id), goal3);
    batch.set(doc(db, "goals", g4Id), goal4);

    // ---------------------- GOAL 1 PHASES & TASKS ----------------------
    const g1p1Id = `g1p1_${userId}`;
    const g1p2Id = `g1p2_${userId}`;
    const g1p3Id = `g1p3_${userId}`;

    const g1Phase1: GoalPhase = {
      id: g1p1Id,
      goalId: g1Id,
      userId,
      title: "Core Fundamentals & Catch-up",
      description: "Establish strong foundations on IS-LM and standard macro aggregates.",
      order: 1,
      estimatedDuration: "1 week",
      suggestedStartDate: getPastDateString(5),
      suggestedEndDate: getFutureDateString(2),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const g1Phase2: GoalPhase = {
      id: g1p2Id,
      goalId: g1Id,
      userId,
      title: "Advanced Applications & Problem Sets",
      description: "Apply model frameworks to policy shifts and analyze growth equations.",
      order: 2,
      estimatedDuration: "1 week",
      suggestedStartDate: getFutureDateString(3),
      suggestedEndDate: getFutureDateString(7),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const g1Phase3: GoalPhase = {
      id: g1p3Id,
      goalId: g1Id,
      userId,
      title: "Exam Simulation & Prep Review",
      description: "Solve past exams under timed conditions and close remaining concept gaps.",
      order: 3,
      estimatedDuration: "3 days",
      suggestedStartDate: getFutureDateString(8),
      suggestedEndDate: getFutureDateString(10),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    batch.set(doc(db, "goals", g1Id, "phases", g1p1Id), g1Phase1);
    batch.set(doc(db, "goals", g1Id, "phases", g1p2Id), g1Phase2);
    batch.set(doc(db, "goals", g1Id, "phases", g1p3Id), g1Phase3);

    // Goal 1 Tasks
    const g1Tasks: GoalTask[] = [
      { id: `g1t1_${userId}`, phaseId: g1p1Id, goalId: g1Id, userId, title: "Review lecture notes 1-5 on IS-LM framework", priority: "High", status: "completed", suggestedDueDate: getPastDateString(3), order: 1, notes: "Focus on shifts in the IS and LM curves", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g1t2_${userId}`, phaseId: g1p1Id, goalId: g1Id, userId, title: "Read Mankiw Chapters 1-3 on classical growth theories", priority: "Medium", status: "completed", suggestedDueDate: getPastDateString(1), order: 2, notes: "Key takeaway: Solow model dynamics", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g1t3_${userId}`, phaseId: g1p1Id, goalId: g1Id, userId, title: "Draft a one-page summary on inflation metrics", priority: "Medium", status: "completed", suggestedDueDate: getFutureDateString(1), order: 3, notes: "Compare CPI vs GDP Deflator formulas", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g1t4_${userId}`, phaseId: g1p1Id, goalId: g1Id, userId, title: "Complete Macro Problem Set 1 from syllabus", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(2), order: 4, notes: "Need to submit on professor portal", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      
      { id: `g1t5_${userId}`, phaseId: g1p2Id, goalId: g1Id, userId, title: "Solve Chapters 4-6 workbook exercises", priority: "Medium", status: "pending", suggestedDueDate: getFutureDateString(4), order: 1, notes: "Check answers against back of book", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g1t6_${userId}`, phaseId: g1p2Id, goalId: g1Id, userId, title: "Outline open-economy IS-LM-BP model", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(6), order: 2, notes: "Mundell-Fleming model under floating rates", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g1t7_${userId}`, phaseId: g1p2Id, goalId: g1Id, userId, title: "Draft macroeconomics midterm cheat sheet", priority: "Low", status: "pending", suggestedDueDate: getFutureDateString(7), order: 3, notes: "Allowed 1 single-sided hand-written paper", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

      { id: `g1t8_${userId}`, phaseId: g1p3Id, goalId: g1Id, userId, title: "Complete 2024 Past Midterm Exam under timed conditions", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(8), order: 1, notes: "Set a timer for 90 minutes", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g1t9_${userId}`, phaseId: g1p3Id, goalId: g1Id, userId, title: "Review incorrect problems with classmate", priority: "Medium", status: "pending", suggestedDueDate: getFutureDateString(9), order: 2, notes: "Focus on open-economy multiple choice questions", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g1t10_${userId}`, phaseId: g1p3Id, goalId: g1Id, userId, title: "Quick index-card formula review", priority: "Low", status: "pending", suggestedDueDate: getFutureDateString(10), order: 3, notes: "Double check Money Multiplier terms", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    g1Tasks.forEach(t => batch.set(doc(db, "goals", g1Id, "tasks", t.id), t));

    // Goal 1 Resources
    const g1Resources: GoalResource[] = [
      { id: `g1r1_${userId}`, goalId: g1Id, userId, title: "Macroeconomics by N. Gregory Mankiw", type: "book", url: "https://www.macmillanlearning.com/college/us/product/Macroeconomics/p/1319263587", description: "The definitive textbook covering intermediate macro theory cleanly.", createdAt: new Date().toISOString() },
      { id: `g1r2_${userId}`, goalId: g1Id, userId, title: "MIT Principles of Macroeconomics OpenCourseWare", type: "course", url: "https://ocw.mit.edu/courses/14-02-principles-of-macroeconomics-spring-2014/", description: "Excellent lectures on inflation, business cycles, and policy models.", createdAt: new Date().toISOString() },
    ];
    g1Resources.forEach(r => batch.set(doc(db, "goals", g1Id, "resources", r.id), r));


    // ---------------------- GOAL 2 PHASES & TASKS ----------------------
    const g2p1Id = `g2p1_${userId}`;
    const g2p2Id = `g2p2_${userId}`;
    const g2p3Id = `g2p3_${userId}`;
    const g2p4Id = `g2p4_${userId}`;

    const g2Phase1: GoalPhase = {
      id: g2p1Id,
      goalId: g2Id,
      userId,
      title: "Architecture & Database Schema Setup",
      description: "Define the fundamental data structures and initialize deployment pipelines.",
      order: 1,
      estimatedDuration: "4 days",
      suggestedStartDate: getPastDateString(8),
      suggestedEndDate: getPastDateString(4),
      status: "completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const g2Phase2: GoalPhase = {
      id: g2p2Id,
      goalId: g2Id,
      userId,
      title: "Core AI Backend API Integrations",
      description: "Build robust backend routers and hook up system prompt instructions to Gemini 2.0.",
      order: 2,
      estimatedDuration: "1 week",
      suggestedStartDate: getPastDateString(3),
      suggestedEndDate: getFutureDateString(4),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const g2Phase3: GoalPhase = {
      id: g2p3Id,
      goalId: g2Id,
      userId,
      title: "Responsive Front-End Development",
      description: "Code the Bento-style dashboard and detailed interactive workspace view.",
      order: 3,
      estimatedDuration: "5 days",
      suggestedStartDate: getFutureDateString(5),
      suggestedEndDate: getFutureDateString(9),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const g2Phase4: GoalPhase = {
      id: g2p4Id,
      goalId: g2Id,
      userId,
      title: "Polish & Cloud Run Deploy",
      description: "Perform end-to-end testing, optimize loaders, and publish the release build.",
      order: 4,
      estimatedDuration: "3 days",
      suggestedStartDate: getFutureDateString(10),
      suggestedEndDate: getFutureDateString(12),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    batch.set(doc(db, "goals", g2Id, "phases", g2p1Id), g2Phase1);
    batch.set(doc(db, "goals", g2Id, "phases", g2p2Id), g2Phase2);
    batch.set(doc(db, "goals", g2Id, "phases", g2p3Id), g2Phase3);
    batch.set(doc(db, "goals", g2Id, "phases", g2p4Id), g2Phase4);

    // Goal 2 Tasks
    const g2Tasks: GoalTask[] = [
      { id: `g2t1_${userId}`, phaseId: g2p1Id, goalId: g2Id, userId, title: "Configure Firestore database schemas", priority: "High", status: "completed", suggestedDueDate: getPastDateString(7), order: 1, notes: "Set up security rules for user_id matching", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g2t2_${userId}`, phaseId: g2p1Id, goalId: g2Id, userId, title: "Scaffold Express server structure in server.ts", priority: "Medium", status: "completed", suggestedDueDate: getPastDateString(6), order: 2, notes: "Ensure port 3000 mapping", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g2t3_${userId}`, phaseId: g2p1Id, goalId: g2Id, userId, title: "Initialize React app with Vite and Tailwind v4", priority: "High", status: "completed", suggestedDueDate: getPastDateString(4), order: 3, notes: "Confirm hot reloading and path aliases work", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      
      { id: `g2t4_${userId}`, phaseId: g2p2Id, goalId: g2Id, userId, title: "Program AI Roadmap Generator endpoint", priority: "High", status: "completed", suggestedDueDate: getPastDateString(2), order: 1, notes: "Integrates with gemini-2.0-flash with JSON schema", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g2t5_${userId}`, phaseId: g2p2Id, goalId: g2Id, userId, title: "Code Per-Goal AI chat endpoint", priority: "Medium", status: "completed", suggestedDueDate: getPastDateString(1), order: 2, notes: "Provide custom system prompt with active tasks context", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g2t6_${userId}`, phaseId: g2p2Id, goalId: g2Id, userId, title: "Implement Weekly Review AI endpoint", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(1), order: 3, notes: "Assemble snapshots of all user's active goals", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g2t7_${userId}`, phaseId: g2p2Id, goalId: g2Id, userId, title: "Develop portfolio-wide rebalancing agent API", priority: "Medium", status: "pending", suggestedDueDate: getFutureDateString(3), order: 4, notes: "Looks across all active goals and lists strategic focus", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

      { id: `g2t8_${userId}`, phaseId: g2p3Id, goalId: g2Id, userId, title: "Build Bento-style central dashboard UI", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(6), order: 1, notes: "Make sure all active goals and conflict warnings are scannable", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g2t9_${userId}`, phaseId: g2p3Id, goalId: g2Id, userId, title: "Build roadmap workspace and task checklist tree", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(8), order: 2, notes: "Check/uncheck should trigger instant state saves", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g2t10_${userId}`, phaseId: g2p3Id, goalId: g2Id, userId, title: "Design the onboarding multi-step preferences setup", priority: "Medium", status: "pending", suggestedDueDate: getFutureDateString(9), order: 3, notes: "Save role, AI style and category selections on submit", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

      { id: `g2t11_${userId}`, phaseId: g2p4Id, goalId: g2Id, userId, title: "Verify full production bundle and run test suites", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(11), order: 1, notes: "Make sure ESBuild generates dist/server.cjs successfully", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    g2Tasks.forEach(t => batch.set(doc(db, "goals", g2Id, "tasks", t.id), t));

    // Goal 2 Resources
    const g2Resources: GoalResource[] = [
      { id: `g2r1_${userId}`, goalId: g2Id, userId, title: "The Mom Test by Rob Fitzpatrick", type: "book", url: "https://www.momtestbook.com/", description: "Excellent handbook on how to talk to users to validate startup ideas.", createdAt: new Date().toISOString() },
      { id: `g2r2_${userId}`, goalId: g2Id, userId, title: "Tailwind CSS v4 Documentation", type: "tool", url: "https://tailwindcss.com/docs/v4-beta", description: "Styling utilities guide for modern web applications.", createdAt: new Date().toISOString() },
    ];
    g2Resources.forEach(r => batch.set(doc(db, "goals", g2Id, "resources", r.id), r));


    // ---------------------- GOAL 3 PHASES & TASKS ----------------------
    const g3p1Id = `g3p1_${userId}`;
    const g3p2Id = `g3p2_${userId}`;

    const g3Phase1: GoalPhase = {
      id: g3p1Id,
      goalId: g3Id,
      userId,
      title: "Resume Refinement & Prep Materials",
      description: "Perfect resume bullet points and draft cover letter frames.",
      order: 1,
      estimatedDuration: "2 days",
      suggestedStartDate: getPastDateString(3),
      suggestedEndDate: getPastDateString(1),
      status: "completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const g3Phase2: GoalPhase = {
      id: g3p2Id,
      goalId: g3Id,
      userId,
      title: "Application Campaign & Tracking",
      description: "Submit to list of priority openings and manage pipeline.",
      order: 2,
      estimatedDuration: "5 days",
      suggestedStartDate: getPastDateString(0),
      suggestedEndDate: getFutureDateString(5),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    batch.set(doc(db, "goals", g3Id, "phases", g3p1Id), g3Phase1);
    batch.set(doc(db, "goals", g3Id, "phases", g3p2Id), g3Phase2);

    // Goal 3 Tasks
    const g3Tasks: GoalTask[] = [
      { id: `g3t1_${userId}`, phaseId: g3p1Id, goalId: g3Id, userId, title: "Refactor engineering resume with fellowship metrics", priority: "High", status: "completed", suggestedDueDate: getPastDateString(2), order: 1, notes: "Highlight active React development metrics", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      
      { id: `g3t2_${userId}`, phaseId: g3p2Id, goalId: g3Id, userId, title: "Identify 10 matching internship openings on LinkedIn", priority: "Medium", status: "pending", suggestedDueDate: getFutureDateString(1), order: 1, notes: "Filter for Summer 2026 roles", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g3t3_${userId}`, phaseId: g3p2Id, goalId: g3Id, userId, title: "Submit applications to 5 primary target roles", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(2), order: 2, notes: "Includes personal tailored cover letters", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g3t4_${userId}`, phaseId: g3p2Id, goalId: g3Id, userId, title: "Begin technical preparation with Leetcode study guide", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(4), order: 3, notes: "Review HashMaps, Array pointers and Trees", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g3t5_${userId}`, phaseId: g3p2Id, goalId: g3Id, userId, title: "Fill applications log tracking sheet", priority: "Low", status: "pending", suggestedDueDate: getFutureDateString(5), order: 4, notes: "Log company name, date applied and referral status", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    g3Tasks.forEach(t => batch.set(doc(db, "goals", g3Id, "tasks", t.id), t));

    // Goal 3 Resources
    const g3Resources: GoalResource[] = [
      { id: `g3r1_${userId}`, goalId: g3Id, userId, title: "Cracking the Coding Interview by Gayle Laakmann McDowell", type: "book", url: "http://www.crackingthecodinginterview.com/", description: "Excellent workbook for technical interviews and data structure practice.", createdAt: new Date().toISOString() },
    ];
    g3Resources.forEach(r => batch.set(doc(db, "goals", g3Id, "resources", r.id), r));


    // ---------------------- GOAL 4 PHASES & TASKS ----------------------
    const g4p1Id = `g4p1_${userId}`;
    const g4p2Id = `g4p2_${userId}`;
    const g4p3Id = `g4p3_${userId}`;

    const g4Phase1: GoalPhase = {
      id: g4p1Id,
      goalId: g4Id,
      userId,
      title: "Interviews & Focus Group Research",
      description: "Gather first-hand testimonies from female tech leaders about entry obstacles.",
      order: 1,
      estimatedDuration: "2 weeks",
      suggestedStartDate: getPastDateString(15),
      suggestedEndDate: getPastDateString(1),
      status: "completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const g4Phase2: GoalPhase = {
      id: g4p2Id,
      goalId: g4Id,
      userId,
      title: "Draft Authoring & Content Synthesis",
      description: "Analyze transcription records and write the executive briefing papers.",
      order: 2,
      estimatedDuration: "3 weeks",
      suggestedStartDate: getPastDateString(0),
      suggestedEndDate: getFutureDateString(21),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const g4Phase3: GoalPhase = {
      id: g4p3Id,
      goalId: g4Id,
      userId,
      title: "Campaign Presentation & Cohort Delivery",
      description: "Present key insights to fellowship sponsors and distribute research briefs.",
      order: 3,
      estimatedDuration: "2 weeks",
      suggestedStartDate: getFutureDateString(22),
      suggestedEndDate: getFutureDateString(49),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    batch.set(doc(db, "goals", g4Id, "phases", g4p1Id), g4Phase1);
    batch.set(doc(db, "goals", g4Id, "phases", g4p2Id), g4Phase2);
    batch.set(doc(db, "goals", g4Id, "phases", g4p3Id), g4Phase3);

    // Goal 4 Tasks
    const g4Tasks: GoalTask[] = [
      { id: `g4t1_${userId}`, phaseId: g4p1Id, goalId: g4Id, userId, title: "Schedule 3 interviews with female engineering directors", priority: "High", status: "completed", suggestedDueDate: getPastDateString(10), order: 1, notes: "Focus on early career retention topics", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g4t2_${userId}`, phaseId: g4p1Id, goalId: g4Id, userId, title: "Formulate standard questionnaire for interview sessions", priority: "Medium", status: "completed", suggestedDueDate: getPastDateString(8), order: 2, notes: "Approved by fellowship advisor", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g4t3_${userId}`, phaseId: g4p1Id, goalId: g4Id, userId, title: "Transcribe audio recordings of completed interviews", priority: "Low", status: "pending", suggestedDueDate: getPastDateString(1), order: 3, notes: "Use AI transcriber and clean up", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      
      { id: `g4t4_${userId}`, phaseId: g4p2Id, goalId: g4Id, userId, title: "Perform thematic coding analysis on transcript files", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(7), order: 1, notes: "Tag notes for recurring system barriers", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g4t5_${userId}`, phaseId: g4p2Id, goalId: g4Id, userId, title: "Draft first 3 sections of fellowship final brief", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(14), order: 2, notes: "Intro, Methodology and Findings", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g4t6_${userId}`, phaseId: g4p2Id, goalId: g4Id, userId, title: "Present preliminary takeaways to cohort", priority: "Medium", status: "pending", suggestedDueDate: getFutureDateString(20), order: 3, notes: "Prepare 5 slides summarizing transcripts", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

      { id: `g4t7_${userId}`, phaseId: g4p3Id, goalId: g4Id, userId, title: "Compile cohort feedback and polish final brief PDF", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(35), order: 1, notes: "Professional page-layout and chart references", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: `g4t8_${userId}`, phaseId: g4p3Id, goalId: g4Id, userId, title: "Upload deliverables on fellowship admin dashboard", priority: "High", status: "pending", suggestedDueDate: getFutureDateString(45), order: 2, notes: "Deadline is hard-coded", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    g4Tasks.forEach(t => batch.set(doc(db, "goals", g4Id, "tasks", t.id), t));

    // Goal 4 Resources
    const g4Resources: GoalResource[] = [
      { id: `g4r1_${userId}`, goalId: g4Id, userId, title: "EmpowHer Fellowship Resource Portal", type: "article", url: "https://www.empowherfellowship.org/resources", description: "Formatting templates and compliance rubrics for final thesis projects.", createdAt: new Date().toISOString() },
    ];
    g4Resources.forEach(r => batch.set(doc(db, "goals", g4Id, "resources", r.id), r));

    // Commit all sample data documents
    await batch.commit();
    console.log("Sample data committed successfully.");
  } catch (error) {
    console.error("Error pre-populating sample data:", error);
  }
}
