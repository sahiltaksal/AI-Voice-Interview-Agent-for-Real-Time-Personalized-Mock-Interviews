import Image from "next/image";
import { redirect } from "next/navigation";

import Agent from "@/components/Agent";
import { getInterviewCover } from "@/lib/utils";

import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";
import DisplayTechIcons from "@/components/DisplayTechIcons";

const InterviewDetails = async ({ params }: RouteParams) => {
  const { id } = await params;

  const user = await getCurrentUser();

  const interview = await getInterviewById(id);
  if (!interview) redirect("/");

  const feedback =
    user?.id && id
      ? await getFeedbackByInterviewId({
        interviewId: id,
        userId: user.id,
      })
      : null;

  return (
    <main className="root-layout">
      <section className="bg-dark-200 border border-dark-300 rounded-3xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src={getInterviewCover(id)}
                alt="cover-image"
                width={48}
                height={48}
                className="rounded-full object-cover"
              />
              <div>
                <h2 className="text-2xl font-bold capitalize">{interview.role} Interview</h2>
                <p className="text-sm text-gray-400">{interview.type} • {interview.duration} min</p>
              </div>
            </div>
            <div className="mt-3 text-gray-300">Prepare through a structured voice interaction, instant scoring, and automated feedback generation.</div>
          </div>

          <div className="flex gap-2">
            {interview.techstack?.map((tech, idx) => (
              <span key={idx} className="text-xs px-3 py-1 rounded-full bg-primary/15 text-primary">{tech}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="bg-dark-200 border border-dark-300 rounded-3xl p-5">
          <h3 className="text-lg font-semibold mb-2">Voice Interview Controls</h3>
          <p className="text-gray-300 text-sm">Use the voice call controls to begin and end the session. Speak clearly and stay concise. AI will analyze your answers automatically at completion.</p>
        </div>

        <Agent
          userName={user?.name || "Candidate"}
          userId={user?.id}
          interviewId={id}
          type="interview"
          questions={interview.questions}
          feedbackId={feedback?.id}
          duration={interview.duration}
        />
      </section>
    </main>
  );
};

export default InterviewDetails;
