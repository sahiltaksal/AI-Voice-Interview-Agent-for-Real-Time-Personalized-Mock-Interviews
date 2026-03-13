import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";

import { Button } from "./ui/button";
import DisplayTechIcons from "./DisplayTechIcons";

import { cn, getInterviewCover } from "@/lib/utils";
import { getFeedbackByInterviewId } from "@/lib/actions/general.action";

const InterviewCard = async ({
  interviewId,
  userId,
  role,
  type,
  techstack,
  createdAt,
  difficulty,
  duration,
  feedback: initialFeedback,
}: InterviewCardProps & { feedback?: any }) => {
  // ✅ Use passed feedback or fetch if not provided (backward compatibility)
  let feedback = initialFeedback;
  if (!feedback && userId && interviewId) {
    feedback = await getFeedbackByInterviewId({
      interviewId,
      userId,
    });
  }

  const normalizedType = /mix/gi.test(type) ? "Mixed" : type;

  const badgeColor =
    {
      Behavioral: "bg-light-400",
      Mixed: "bg-light-600",
      Technical: "bg-light-800",
    }[normalizedType] || "bg-light-600";

  const formattedDate = dayjs(feedback?.createdAt || createdAt).format(
    "MMM D, YYYY"
  );

  return (
    <Link 
      href={
        feedback
          ? `/interview/${interviewId}/feedback`
          : `/interview/${interviewId}`
      }
      className="group"
    >
      <div className="bg-gradient-to-br from-[#161B22] to-[#0D1117] border border-gray-700/50 hover:border-blue-500/50 rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
        
        {/* Header with Role and Difficulty Badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            {/* Profile Image */}
            <Image
              src={getInterviewCover(interviewId)}
              alt="cover-image"
              width={60}
              height={60}
              className="rounded-lg object-cover w-16 h-16"
            />
            
            {/* Title Section */}
            <div>
              <h3 className="text-lg font-semibold text-white capitalize group-hover:text-blue-400 transition">
                {role} Interview
              </h3>
              <p className="text-sm text-gray-500 mt-1">{normalizedType}</p>
            </div>
          </div>

          {/* Difficulty Badge */}
          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-medium",
            {
              "Easy": "bg-green-500/20 text-green-400",
              "Medium": "bg-yellow-500/20 text-yellow-400",
              "Hard": "bg-red-500/20 text-red-400",
            }[difficulty] || "bg-gray-700/20 text-gray-400"
          )}>
            {difficulty || ""}
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-6 mb-4 pb-4 border-b border-gray-700/30">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-gray-400">{formattedDate}</span>
          </div>
          
          {duration && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-gray-400">{duration}m</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span className="text-sm font-semibold text-white">{feedback?.totalScore || "--"}/100</span>
          </div>
        </div>

        {/* Assessment or Placeholder */}
        <p className="text-sm text-gray-400 line-clamp-2 mb-4">
          {feedback?.finalAssessment ||
            "Take this interview to receive AI-powered feedback and performance insights."}
        </p>

        {/* Tech Stack */}
        {techstack && techstack.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500">Stack:</span>
            <DisplayTechIcons techStack={techstack} />
          </div>
        )}

        {/* Button Row */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-700/30">
          <span className="text-xs text-gray-500">
            {feedback ? "View Feedback" : "Start Interview"}
          </span>
          <svg className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
};

export default InterviewCard;
