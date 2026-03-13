"use server";

import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { feedbackSchema } from "@/constants";
import { z } from "zod";

export async function createFeedback(params: CreateFeedbackParams): Promise<FeedbackResult> {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    console.log("[createFeedback] Starting with", transcript.length, "messages");

    // ✅ Validation: Minimum transcript length
    if (!transcript || transcript.length < 3) {
      const msg = `Interview too short for analysis. Messages: ${transcript?.length || 0}`;
      console.error("[createFeedback]", msg);
      return { success: false, error: msg };
    }

    const interview = await getInterviewById(interviewId);
    if (!interview) {
      const msg = "Interview not found";
      console.error("[createFeedback]", msg);
      return { success: false, error: msg };
    }

    // 1. Get analysis from ML Service via API Route
    console.log("[createFeedback] Fetching ML analysis...");
    let analysis: any = {};
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/feedback/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          difficulty: interview?.level || "Medium",
          role: interview?.role || "Software Engineer"
        }),
      });

      if (!response.ok) {
        console.warn("[createFeedback] ML Service failed:", response.status, response.statusText);
      } else {
        try {
          analysis = await response.json();
          console.log("[createFeedback] ML analysis received");
        } catch (e) {
          console.warn("[createFeedback] Could not parse ML response:", e);
        }
      }
    } catch (fetchError) {
      console.warn("[createFeedback] Could not reach ML Service:", fetchError);
      // Continue without ML analysis
    }

    // 2. Supplement with Gemini assessment
    console.log("[createFeedback] Generating Gemini feedback...");
    const formattedTranscript = transcript
      .map((sentence) => `- ${sentence.role}: ${sentence.content}\n`)
      .join("");

    if (!formattedTranscript || formattedTranscript.length === 0) {
      const msg = "Empty transcript after formatting";
      console.error("[createFeedback]", msg);
      return { success: false, error: msg };
    }

    let geminiFeedback;
    let usedFallbackForGemini = false;
    try {
      const { text } = await generateText({
        model: google("gemini-2.0-flash"),
        prompt: `You are an expert interviewer evaluator. Analyze this interview transcript and provide structured feedback as a JSON object.

Transcript:
${formattedTranscript}

Provide your analysis as a valid JSON object with this exact structure:
{
  "totalScore": <number 0-100>,
  "categoryScores": [
    { "name": "Communication Skills", "score": <number 0-100>, "comment": "<string>" },
    { "name": "Technical Knowledge", "score": <number 0-100>, "comment": "<string>" },
    { "name": "Problem Solving", "score": <number 0-100>, "comment": "<string>" },
    { "name": "Cultural Fit", "score": <number 0-100>, "comment": "<string>" },
    { "name": "Confidence and Clarity", "score": <number 0-100>, "comment": "<string>" }
  ],
  "strengths": [<string>, <string>, ...],
  "areasForImprovement": [<string>, <string>, ...],
  "finalAssessment": "<string>"
}

Return ONLY the JSON object, no additional text or markdown formatting.`,
      });

      // Parse JSON from response
      let parsedFeedback;
      try {
        parsedFeedback = JSON.parse(text);
      } catch (parseError) {
        console.error("[createFeedback] Failed to parse JSON response:", parseError);
        console.log("[createFeedback] Raw response:", text);
        throw new Error("Failed to parse feedback format from AI response");
      }

      // Validate with Zod schema
      geminiFeedback = feedbackSchema.parse(parsedFeedback);
      console.log("[createFeedback] Gemini feedback generated successfully");
    } catch (geminiError) {
      // If Gemini fails (quota, rate limits, etc), generate a safe fallback feedback
      const errorMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
      console.warn("[createFeedback] Gemini API error, using fallback feedback:", errorMessage);
      usedFallbackForGemini = true;

      // Simple heuristic fallback: derive scores from transcript length and presence of technical tokens
      const msgCount = Math.max(1, transcript.length);
      const avgMsgLen = Math.floor(transcript.reduce((s, m) => s + (m.content?.length || 0), 0) / msgCount || 0);

      const heuristicScore = Math.max(40, Math.min(85, Math.floor(50 + (Math.min(avgMsgLen, 300) / 300) * 40)));

      const defaultCategory = (name: string, offset = 0) => ({
        name,
        score: Math.max(30, Math.min(95, heuristicScore + offset)),
        comment: `Generated fallback comment for ${name}. Improve by providing clearer, more detailed answers.`,
      });

      geminiFeedback = {
        totalScore: heuristicScore,
        categoryScores: [
          defaultCategory("Communication Skills", 0),
          defaultCategory("Technical Knowledge", -5),
          defaultCategory("Problem Solving", -3),
          defaultCategory("Cultural Fit", 0),
          defaultCategory("Confidence and Clarity", -2),
        ],
        strengths: ["Clear and concise answers", "Good pacing"].slice(0, 3),
        areasForImprovement: ["Provide more technical depth", "Give concrete examples"].slice(0, 3),
        finalAssessment: "Fallback feedback generated due to AI service unavailability or quota limits. Consider retrying or upgrading AI quota for richer feedback.",
      } as any;
    }

    const feedback = {
      interviewId,
      userId,
      totalScore: analysis.preparedness_score || geminiFeedback.totalScore,
      preparednessScore: analysis.preparedness_score ?? geminiFeedback.totalScore,
      categoryScores: geminiFeedback.categoryScores,
      // Mark that this feedback used fallback generation when Gemini failed
      _metadata: {
        usedFallbackForGemini: !!(typeof usedFallbackForGemini !== "undefined" && usedFallbackForGemini),
      },
      strengths: analysis.strengths && analysis.strengths.length > 0 ? analysis.strengths : geminiFeedback.strengths,
      areasForImprovement: [
        ...(analysis.weaknesses || []),
        ...(analysis.improvement_areas || []),
        ...(analysis.weaknesses?.length || analysis.improvement_areas?.length ? [] : geminiFeedback.areasForImprovement)
      ].slice(0, 5),
      finalAssessment: geminiFeedback.finalAssessment,
      technicalKeywordUsage: analysis.technical_keyword_usage ?? null,
      fillerWordRatio: analysis.filler_word_ratio ?? null,
      createdAt: FieldValue.serverTimestamp(),
    };

    const feedbackRef = feedbackId
      ? db.collection("feedback").doc(feedbackId)
      : db.collection("feedback").doc();

    try {
      await feedbackRef.set(feedback);
      console.log("[createFeedback] Feedback saved to Firestore:", feedbackRef.id);
    } catch (firestoreError) {
      console.error("[createFeedback] Firestore save error:", firestoreError);
      return { 
        success: false, 
        error: `Failed to save feedback: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown error'}` 
      };
    }

    // 3. Mark interview as finalized
    try {
      await db.collection("interviews").doc(interviewId).update({
        finalized: true,
        endedAt: FieldValue.serverTimestamp(),
      });
      console.log("[createFeedback] Interview marked as finalized");
    } catch (updateError) {
      console.error("[createFeedback] Failed to update interview:", updateError);
      // Don't fail here - feedback was saved
    }

    console.log("[createFeedback] Feedback generation completed successfully");
    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("[createFeedback] Unexpected error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to generate feedback" 
    };
  }
}

export async function createRoleInterview(params: {
  userId: string;
  role: string;
  duration: number;
  difficulty: string;
}) {
  try {
    const { userId, role, duration, difficulty } = params;

    let questions: string[] = [];

    try {
      const { text } = await generateText({
        model: google("gemini-2.0-flash"),
        prompt: `You are a technical interviewer for the role of ${role}.
        Generate exactly 5 specific interview questions for this role at a ${difficulty} difficulty level.
        
        Constraints:
        - Questions MUST be technical and specific to ${role}.
        - Match the difficulty level: ${difficulty}.
        - DO NOT ask generic questions like "Tell me about yourself" or "What are your strengths".
        - DO NOT ask unrelated questions like DSA if it's not core to the role (unless the role is specifically for DSA/Leetcoding).
        - Focus on core concepts, advanced topics, and practical scenarios for ${role}.
        
        Return ONLY a JSON array of exactly 5 question strings, like: ["question1", "question2", "question3", "question4", "question5"]`,
      });

      try {
        const parsed = JSON.parse(text);
        questions = Array.isArray(parsed) ? parsed : [];
        if (questions.length !== 5) {
          throw new Error(`Expected 5 questions, got ${questions.length}`);
        }
      } catch (parseError) {
        console.error("Failed to parse questions JSON:", parseError);
        throw parseError;
      }
    } catch (aiError: any) {
      console.error("Gemini API Error (likely quota):", aiError);
      // Fallback questions if AI fails
      questions = [
        `What are the core technical concepts every ${role} should master?`,
        `Can you describe a challenging project you worked on as a ${role} and how you overcame technical hurdles?`,
        `How do you stay updated with the latest trends and best practices in ${role} development?`,
        `Explain a complex technical problem you solved recently.`,
        `What are your favorite tools and frameworks for ${role} and why?`
      ];
    }

    const interviewData = {
      userId,
      role,
      level: difficulty,
      questions,
      techstack: [role.split(" ")[0]], // Basic techstack from role
      createdAt: FieldValue.serverTimestamp(),
      type: "Role-based",
      finalized: false,
      duration,
      difficulty,
      sourceType: "role",
    };

    const docRef = await db.collection("interviews").add(interviewData);

    return { success: true, interviewId: docRef.id, isFallback: questions.length > 0 && !questions[0].toLowerCase().includes(role.toLowerCase()) };
  } catch (error) {
    console.error("Error creating role interview:", error);
    return { success: false, error: "Failed to create interview session" };
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const interview = await db.collection("interviews").doc(id).get();

  return interview.data() as Interview | null;
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  const querySnapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (querySnapshot.empty) return null;

  const feedbackDoc = querySnapshot.docs[0];
  return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}

// ✅ NEW: Batch fetch feedback for multiple interviews (solves N+1 problem)
export async function getFeedbackByInterviewIds(
  params: { interviewIds: string[]; userId: string }
): Promise<Record<string, Feedback>> {
  const { interviewIds, userId } = params;
  
  if (!interviewIds.length) return {};

  const feedbackMap: Record<string, Feedback> = {};

  // Firestore has query limit of 30 'in' conditions, so batch if needed
  const batchSize = 30;
  for (let i = 0; i < interviewIds.length; i += batchSize) {
    const batch = interviewIds.slice(i, i + batchSize);
    
    const querySnapshot = await db
      .collection("feedback")
      .where("userId", "==", userId)
      .where("interviewId", "in", batch)
      .get();

    querySnapshot.docs.forEach((doc) => {
      const data = doc.data() as Feedback;
      // ✅ Ensure id is set from document ID, don't override if already present
      feedbackMap[data.interviewId] = { 
        ...data,
        id: doc.id 
      };
    });
  }

  return feedbackMap;
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  try {
    // ✅ OPTIMIZED: Query with proper filters and ordering
    const interviews = await db
      .collection("interviews")
      .where("userId", "==", userId)
      .where("finalized", "==", true)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    return interviews.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      };
    }) as Interview[];
  } catch (error) {
    // Detect Firestore 'requires an index' / FAILED_PRECONDITION error and fallback quietly
    const errMsg = error instanceof Error ? error.message : String(error);
    const isMissingIndex =
      // Admin SDK numeric code (seen as 9) or string codes
      (error && typeof error === "object" && "code" in error && ((error.code === 9) || (error.code === "FAILED_PRECONDITION"))) ||
      (typeof errMsg === "string" && errMsg.toLowerCase().includes("requires an index"));

    if (isMissingIndex) {
      console.info("getLatestInterviews: composite index missing, using fallback query");
      return getInterviewsByUserId(userId);
    }

    console.warn("getLatestInterviews failed:", errMsg || error);
    // Generic fallback
    return getInterviewsByUserId(userId);
  }
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  try {
    // ✅ OPTIMIZED: Query with proper sorting
    const interviews = await db
      .collection("interviews")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    return interviews.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      };
    }) as Interview[];
  } catch (error) {
    console.warn("getInterviewsByUserId failed (index may not exist):", error);
    // Fallback: Fetch without orderBy
    const interviews = await db
      .collection("interviews")
      .where("userId", "==", userId)
      .get();

    // Sort in memory as fallback
    const sortedDocs = interviews.docs.sort((a, b) => {
      const aData = a.data();
      const bData = b.data();
      const aDate = aData.createdAt?.toDate?.() || new Date(aData.createdAt || 0);
      const bDate = bData.createdAt?.toDate?.() || new Date(bData.createdAt || 0);
      return bDate.getTime() - aDate.getTime();
    });

    return sortedDocs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      };
    }) as Interview[];
  }
}
