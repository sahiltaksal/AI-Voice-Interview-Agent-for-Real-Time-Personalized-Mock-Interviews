"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
  timestamp: number;
}

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
  duration = 25,
}: AgentProps) => {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [callStartTs, setCallStartTs] = useState<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastStartConfigRef = useRef<any>(null);

  // Suppress noisy unhandled rejection logs for expected meeting end/ejection messages
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      try {
        const reason: any = (e && (e.reason ?? e)) || "";
        const msg = typeof reason === "string" ? reason : reason?.message;
        if (msg && typeof msg === "string" && msg.toLowerCase().includes("meeting")) {
          // Prevent default browser logging for expected meeting-end rejections
          e.preventDefault?.();
          console.log("Suppressed unhandled rejection (meeting):", msg);
        }
      } catch (err) {
        // noop
      }
    };

    window.addEventListener("unhandledrejection", handler as EventListener);
    return () => window.removeEventListener("unhandledrejection", handler as EventListener);
  }, []);

  // Diagnostic logging for VAPI token and connection status
  useEffect(() => {
    console.log("[VAPI] Diagnostic Info on mount:");
    console.log("[VAPI] Token exists:", !!process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN);
    console.log("[VAPI] Token length:", process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN?.length || 0);
    console.log("[VAPI] Token starts with:", process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN?.substring(0, 8) + "...");
    console.log("[VAPI] Client ready:", !!vapi);
  }, []);

  // Timer Effect - ✅ OPTIMIZED: Proper timer management with graceful shutdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let shutdownTimer: NodeJS.Timeout;
    
    if (callStatus === CallStatus.ACTIVE && timeLeft !== null) {
      if (timeLeft > 0) {
        timer = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev === null) return null;
            const newTime = prev - 1;
            // At 0, start graceful shutdown (give AI time to say goodbye)
            if (newTime <= 0) {
              console.log("[Interview] Time ended, gracefully shutting down in 3 seconds...");
              // Give the AI 3 seconds to say goodbye before forcefully stopping
              shutdownTimer = setTimeout(() => {
                setCallStatus(CallStatus.FINISHED);
                vapi.stop().catch((e) => console.debug("vapi.stop() rejected (ignored):", e));
              }, 3000);
              return 0;
            }
            return newTime;
          });
        }, 1000);
      } else if (timeLeft === 0 && callStatus === CallStatus.ACTIVE) {
        // Safety: Graceful shutdown if somehow we're still active at 0
        console.log("[Interview] Safety check: gracefully shutting down...");
        shutdownTimer = setTimeout(() => {
          setCallStatus(CallStatus.FINISHED);
          vapi.stop().catch((e) => console.debug("vapi.stop() rejected (ignored):", e));
        }, 3000);
      }
    }

    return () => {
      if (timer) clearInterval(timer);
      if (shutdownTimer) clearTimeout(shutdownTimer);
    };
  }, [callStatus, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const onCallStart = () => {
      console.log("[VAPI] call-start event fired");
      setCallStatus(CallStatus.ACTIVE);
      setError(null); // Clear any previous errors
      setCallStartTs(Date.now());
      reconnectAttemptsRef.current = 0;
    };

    const onCallEnd = () => {
      console.log("[VAPI] call-end event fired");
      // If the call ended very shortly after it started, it may be an accidental ejection.
      const now = Date.now();
      const elapsed = callStartTs ? now - callStartTs : Infinity;

      // If call lasted less than 15s and we have reconnect attempts left, try to restart
      if (elapsed < 15000 && reconnectAttemptsRef.current < 2 && lastStartConfigRef.current) {
        console.warn("Call ended quickly (", elapsed, "ms). Attempting reconnect #", reconnectAttemptsRef.current + 1);
        reconnectAttemptsRef.current += 1;
        setCallStatus(CallStatus.CONNECTING);
        setTimeout(async () => {
          try {
            const cfg = lastStartConfigRef.current;
            if (!cfg) return;
            if (cfg.type === "generate") {
              await vapi.start(cfg.workflowId, { variableValues: cfg.variableValues });
            } else {
              await vapi.start(cfg.interviewer, { variableValues: cfg.variableValues });
            }
            // onCallStart will be triggered by vapi events
          } catch (e) {
            console.warn("Reconnect attempt failed:", e);
            // fallthrough to mark finished
            setCallStatus(CallStatus.FINISHED);
          }
        }, 1500);
        return;
      }

      setCallStatus(CallStatus.FINISHED);
    };

    const onMessage = (message: Message) => {
      console.log("[VAPI] message event:", {
        type: message.type,
        transcriptType: (message as any).transcriptType,
        role: (message as any).role,
        contentLength: (message as any).transcript?.length || 0
      });
      if (message.type === "transcript" && (message as any).transcriptType === "final") {
        const newMessage: SavedMessage = {
          role: (message as any).role,
          content: (message as any).transcript,
          timestamp: Date.now()
        };
        setMessages((prev) => [...prev, newMessage]);
      }
    };

    const onSpeechStart = () => {
      console.log("[VAPI] speech-start");
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      console.log("[VAPI] speech-end");
      setIsSpeaking(false);
    };

    const onError = (error: any) => {
      // Safer, more informative logging for VAPI errors (handles empty objects)
      const safeStringify = (obj: any) => {
        try {
          if (typeof obj === "string") return obj;
          if (obj instanceof Error) return `${obj.message}${obj.stack ? "\n" + obj.stack : ""}`;
          // Try common props
          if (obj && typeof obj === "object") {
            const useful: Record<string, any> = {};
            ["message", "error", "detail", "reason", "code", "status", "statusMessage", "stack"].forEach((k) => {
              if (obj[k] !== undefined) useful[k] = obj[k];
            });
            if (obj?.error && typeof obj.error === "object") {
              try {
                ["message", "name", "stack"].forEach((k) => {
                  // guard against non-standard error payloads that may throw on property access
                  if (typeof obj.error === "object" && obj.error !== null && obj.error[k] !== undefined) {
                    useful[`error.${k}`] = obj.error[k];
                  }
                });
              } catch (innerErr) {
                // ignore non-serializable error payloads
                console.warn("VAPI safeStringify inner error object traversal failed", innerErr);
              }
            }
            const keys = Object.keys(useful);
            if (keys.length > 0) return JSON.stringify(useful, null, 2);
            // Fallback to full stringify
            return JSON.stringify(obj, null, 2);
          }
          return String(obj);
        } catch (e) {
          return String(obj);
        }
      };

      console.error("VAPI Error:", safeStringify(error));
      console.error("[VAPI] Error type:", typeof error);
      console.error("[VAPI] Error constructor:", error?.constructor?.name);


      // Extract error message from various possible error formats
      let errorMessage = "";
      if (typeof error === "string") {
        errorMessage = error;
      } else if (error instanceof Error && error.message) {
        errorMessage = error.message;
      } else if (error && typeof error === "object") {
        errorMessage =
          error.message ||
          error.error ||
          error.detail ||
          error.reason ||
          error.statusMessage ||
          safeStringify(error);
      } else {
        errorMessage = String(error || "");
      }

      const normalized = (errorMessage || "").toString().toLowerCase();
      console.log("[VAPI] Normalized error message:", normalized);

      // Check if this is a meeting ejection or end error
      const isMeetingEndError =
        normalized.includes("meeting ended") ||
        normalized.includes("ejection") ||
        normalized.includes("meeting has ended");

      if (isMeetingEndError) {
        // Don't show error for normal meeting end, try reconnect if it looks accidental
        console.log("Meeting ended/error received, processing as normal call end or reconnect");
        const now = Date.now();
        const elapsed = callStartTs ? now - callStartTs : Infinity;

        if (elapsed < 15000 && reconnectAttemptsRef.current < 2 && lastStartConfigRef.current) {
          console.warn("Meeting error shortly after start (", elapsed, "ms). Attempting reconnect #", reconnectAttemptsRef.current + 1);
          reconnectAttemptsRef.current += 1;
          setCallStatus(CallStatus.CONNECTING);
          setTimeout(async () => {
            try {
              const cfg = lastStartConfigRef.current;
              if (!cfg) return;
              if (cfg.type === "generate") {
                await vapi.start(cfg.workflowId, { variableValues: cfg.variableValues });
              } else {
                await vapi.start(cfg.interviewer, { variableValues: cfg.variableValues });
              }
            } catch (e) {
              console.warn("Reconnect attempt failed:", e);
              setCallStatus(CallStatus.INACTIVE);
            }
          }, 1500);
        } else {
          if (callStatus === CallStatus.ACTIVE) {
            setCallStatus(CallStatus.FINISHED);
          } else {
            setCallStatus(CallStatus.INACTIVE);
          }
        }
        // Don't set error message for normal meeting ends
      } else if (normalized) {
        // Try to detect typical network / CORS failure from browser
        if (normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
          console.error("[VAPI] ❌ Network error detected. Diagnostics:");
          console.error("  - Token has quotes?", process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN?.startsWith("\""));
          console.error("  - Token length:", process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN?.length);
          console.error("  - Possible causes:");
          console.error("    1. VAPI token is quoted in .env.local (should be unquoted)");
          console.error("    2. Token is invalid or expired");
          console.error("    3. CORS issue with VAPI API");
          console.error("    4. Network connectivity problem");
          console.error("    5. VAPI service temporarily unavailable");
          setError("Network error: Failed to connect to VAPI. Check: 1) Token isn't quoted in .env.local 2) Token is valid 3) Internet is connected");
        } else if (normalized.includes("401") || normalized.includes("unauthorized")) {
          console.error("[VAPI] ❌ Authorization error - Token may be invalid or expired");
          setError("Authentication error: Invalid or expired VAPI token. Get a new token from the VAPI dashboard.");
        } else {
          setError("An error occurred during the call. Please try again.");
        }
        setCallStatus(CallStatus.INACTIVE);
      }
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }

    if (isFinished) return; // Prevent double-execution

    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
      try {
        console.log("[Feedback] Starting feedback generation with", messages.length, "messages");
        setIsProcessing(true);

        // ✅ Validation: Ensure minimum messages
        if (messages.length < 3) {
          console.error("[Feedback] Not enough messages:", messages.length);
          setError(`Interview too short (${messages.length} messages). Need at least 3 exchanges.`);
          setIsProcessing(false);
          setTimeout(() => {
            router.push("/");
          }, 3000);
          return;
        }

        const { success, feedbackId: id, error: apiError } = await createFeedback({
          interviewId: interviewId!,
          userId: userId!,
          transcript: messages,
          feedbackId,
        });

        if (success && id) {
          console.log("[Feedback] Feedback generated successfully:", id);
          setIsFinished(true);
          router.push(`/interview/${interviewId}/feedback`);
        } else {
          console.error("[Feedback] createFeedback returned error:", apiError);
          // ✅ Show actual error from API instead of generic message
          setError(apiError || "Failed to generate feedback. Please try again.");
          setIsProcessing(false);
          setTimeout(() => {
            router.push("/");
          }, 3000);
        }
      } catch (error) {
        console.error("[Feedback] Unexpected error:", error);
        const errorMsg = error instanceof Error ? error.message : "An unknown error occurred";
        setError(`Error: ${errorMsg}`);
        setIsProcessing(false);
        setTimeout(() => {
          router.push("/");
        }, 3000);
      }
    };

    // ✅ Only trigger feedback generation when call is finished and we have messages
    if (callStatus === CallStatus.FINISHED && !isFinished) {
      if (type === "generate") {
        router.push("/");
      } else {
        // Ensure call is completely ended before generating feedback
        console.log("[Interview] Call finished, generating feedback with", messages.length, "messages...");
        handleGenerateFeedback(messages);
      }
    }
  }, [messages, callStatus, feedbackId, interviewId, router, type, userId, isFinished]);

  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);
    const durationInSeconds = duration * 60;
    setTimeLeft(durationInSeconds);

    // Verify VAPI token is present
    const vapiToken = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;
    if (!vapiToken || vapiToken.trim().length === 0) {
      console.error("[Interview] VAPI token not found in environment variables");
      setError("VAPI configuration error: Missing API token (NEXT_PUBLIC_VAPI_WEB_TOKEN). Please set it in .env.local.");
      setCallStatus(CallStatus.INACTIVE);
      return;
    }

    if (vapiToken.includes(" ") || vapiToken.length < 20) {
      console.warn("[Interview] VAPI token format looks suspicious:", vapiToken);
      setError("VAPI token format invalid. Please verify NEXT_PUBLIC_VAPI_WEB_TOKEN in .env.local.");
      setCallStatus(CallStatus.INACTIVE);
      return;
    }

    // Remember last start config so we can attempt reconnects on transient ejections
    lastStartConfigRef.current = {
      type: type === "generate" ? "generate" : "interviewer",
      assistant: interviewer,
      variableValues: { questions: questions && questions.length > 0 ? questions.map((q: string) => `- ${q}`).join("\n") : "Ask general software engineering questions.", username: userName, userid: userId }
    };

    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

    console.log("[Interview] Starting call with config:", {
      type,
      duration: durationInSeconds,
      questionCount: questions?.length || 0,
      userName,
      userId,
      hasVapiToken: !!process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN
    });

    try {
      let formattedQuestions = "";
      if (questions && questions.length > 0) {
        formattedQuestions = questions
          .map((question) => `- ${question}`)
          .join("\n");
      }

      // Add the prepared question set to the assistant system message
      const interviewerWithQuestions = {
        ...interviewer,
        model: {
          ...interviewer.model,
          messages: [
            {
              role: "system",
              content: `You are an expert technical interviewer conducting a professional interview.

Interview Questions:
${formattedQuestions || "Ask general software engineering questions."}

Instructions:
- Ask one question at a time from the provided questions.
- Listen carefully to the candidate's answers.
- Ask clarifying follow-up questions if the answer is vague.
- Be encouraging and professional.
- When ending the interview, ALWAYS say something like: "Thank you for an excellent interview! We'll be in touch soon."
- Keep responses conversational and natural - avoid long lists or complex formatting.
- Do NOT ask unrelated questions outside the provided topics.`,
            },
          ],
        },
      };

      if (type === "generate" && assistantId) {
        console.log("[Interview] Starting VAPI with existing assistant ID:", assistantId);
        console.log("[Interview] VAPI Client ready:", !!vapi);
        await vapi.start(assistantId, {
          variableValues: { username: userName, userid: userId, questions: formattedQuestions },
        } as any);
      } else {
        console.log("[Interview] Starting VAPI assistant object mode");
        console.log("[Interview] VAPI Client ready:", !!vapi);
        console.log("[Interview] Assistant configuration:", {
          name: interviewerWithQuestions.name,
          hasTranscriber: !!interviewerWithQuestions.transcriber,
          hasVoice: !!interviewerWithQuestions.voice,
          hasModel: !!interviewerWithQuestions.model,
        });
        await vapi.start(interviewerWithQuestions as any, {
          variableValues: { username: userName, userid: userId, questions: formattedQuestions },
        });
      }

    } catch (err: any) {
      // If start throws due to normal meeting end/ejection, handle gracefully
      const msg = typeof err === "string" ? err : err?.message || JSON.stringify(err);
      console.error("[Interview] vapi.start failed with:", msg);
      console.error("[Interview] Full error object:", err);
      if (msg && msg.toLowerCase().includes("meeting ended")) {
        console.log("vapi.start ended immediately:", msg);
        setCallStatus(CallStatus.FINISHED);
      } else {
        console.error("vapi.start error:", err);
        setError("Failed to start the call. Please try again.");
        setCallStatus(CallStatus.INACTIVE);
      }
    }
  };

  const handleDisconnect = () => {
    // ✅ Prevent multiple disconnections
    if (callStatus === CallStatus.FINISHED || callStatus === CallStatus.INACTIVE) {
      return;
    }
    console.log("[Call] User disconnecting - Current status:", callStatus);
    setCallStatus(CallStatus.FINISHED);
    vapi.stop().catch((e) => console.debug("vapi.stop() rejected (ignored):", e));
  };

  return (
    <div className="fixed inset-0 bg-[#0A0A0F] overflow-hidden flex flex-col">
      
      {/* Main Call Layout */}
      <div className="flex-1 flex items-center justify-center gap-4 p-8 relative">
        
        {/* Left: AI Interviewer */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-600/20 to-blue-900/20 border border-blue-500/30 flex items-center justify-center overflow-hidden">
              <Image
                src="/ai-avatar.png"
                alt="AI Interviewer"
                width={128}
                height={128}
                className="object-cover w-full h-full"
              />
            </div>
            
            {/* Animated Speaking Ring */}
            {isSpeaking && (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-blue-500/50 animate-pulse" />
                <div className="absolute -inset-2 rounded-full border-2 border-blue-500/25 animate-ping" />
              </>
            )}
          </div>
          
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white">AI Interviewer</h3>
            <p className="text-sm text-gray-500 mt-1">
              {isSpeaking ? "Speaking..." : "Listening..."}
            </p>
          </div>
        </div>

        {/* Center: Timer Display */}
        <div className="flex flex-col items-center gap-6">
          {timeLeft !== null && callStatus === CallStatus.ACTIVE && (
            <div className="text-center">
              <div className="text-6xl font-mono font-bold text-blue-400 tabular-nums mb-3">
                {formatTime(timeLeft)}
              </div>
              <p className="text-sm text-gray-500">Time Remaining</p>
            </div>
          )}

          {callStatus !== CallStatus.ACTIVE && (
            <div className="text-center">
              <p className="text-xl text-gray-400">
                {callStatus === CallStatus.CONNECTING 
                  ? "Connecting..." 
                  : callStatus === CallStatus.FINISHED 
                    ? "Interview Complete"
                    : "Ready to Start"}
              </p>
            </div>
          )}
        </div>

        {/* Right: User Profile */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 border border-emerald-500/30 flex items-center justify-center overflow-hidden">
            <Image
              src="/user-avatar.png"
              alt="User Profile"
              width={128}
              height={128}
              className="object-cover w-full h-full rounded-full"
            />
          </div>
          
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white">{userName}</h3>
            <p className="text-sm text-gray-500 mt-1">Candidate</p>
          </div>
        </div>
      </div>

      {/* Live Transcript */}
      {messages.length > 0 && (
        <div className="max-h-40 bg-[#0D1117]/80 border-t border-gray-700/50 overflow-y-auto">
          <div className="p-6 space-y-4">
            {messages.slice(-3).map((msg, idx) => (
              <div 
                key={idx}
                className={cn(
                  "text-sm px-4 py-3 rounded-lg",
                  msg.role === "user" || msg.role === "assistant"
                    ? "bg-blue-500/10 text-blue-200 border border-blue-500/20"
                    : "bg-gray-700/20 text-gray-300 border border-gray-600/20"
                )}
              >
                <span className="font-semibold text-xs uppercase tracking-wide">
                  {msg.role === "user" ? "You" : "AI"}:
                </span>
                <p className="mt-1 line-clamp-2">{msg.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing Feedback */}
      {isProcessing && (
        <div className="px-6 py-4 bg-blue-500/10 border-t border-blue-500/50 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin text-xl">⏳</div>
            <p className="text-sm text-blue-300">Analyzing your interview and generating feedback...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="px-6 py-4 bg-red-500/10 border-t border-red-500/50 text-center">
          <p className="text-sm text-red-300">{error}</p>
          {!isProcessing && <p className="text-xs text-red-400 mt-2">Redirecting in 3 seconds...</p>}
        </div>
      )}

      {/* Bottom Control Bar */}
      <div className="border-t border-gray-700/50 bg-[#0D1117]/95 backdrop-blur px-8 py-6 flex items-center justify-center gap-4">
        {isProcessing ? (
          <button 
            disabled 
            className="px-8 py-3 bg-gray-700 text-gray-400 rounded-lg font-semibold cursor-not-allowed opacity-50"
          >
            Processing...
          </button>
        ) : callStatus === CallStatus.ACTIVE ? (
          <button 
            onClick={handleDisconnect}
            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            End Interview
          </button>
        ) : callStatus === CallStatus.CONNECTING ? (
          <button 
            disabled
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center gap-2 opacity-75 cursor-not-allowed"
          >
            <div className="animate-spin w-5 h-5">●</div>
            Connecting...
          </button>
        ) : (
          <button 
            onClick={handleCall}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.5 1h-8C6.12 1 5 2.12 5 3.5v17C5 21.88 6.12 23 7.5 23h8c1.38 0 2.5-1.12 2.5-2.5v-17C18 2.12 16.88 1 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h8v14z"/>
            </svg>
            Start Interview
          </button>
        )}
      </div>
    </div>
  );
};

export default Agent;
