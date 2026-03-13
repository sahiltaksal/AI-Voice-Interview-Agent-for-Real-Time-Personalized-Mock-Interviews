import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, CheckCircle2, AlertCircle, TrendingUp, BookOpen } from "lucide-react";
import { getFeedbackByInterviewId, getInterviewById } from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { cn } from "@/lib/utils";

const FeedbackPage = async ({ params }: RouteParams) => {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const interview = await getInterviewById(id);
  const feedback = await getFeedbackByInterviewId({ interviewId: id, userId: user.id });

  if (!feedback) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-2xl font-bold">Feedback Not Ready</h2>
        <p className="text-gray-400">Please complete the interview session first.</p>
        <Link href={`/interview/${id}`} className="btn-primary px-6 py-2 rounded-lg">
          Start Interview
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white">
      
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-700/50 bg-[#0D1117]/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors mb-4"
            >
              <ChevronLeft size={20} /> Back to Dashboard
            </Link>
            <div>
              <h1 className="text-3xl font-bold capitalize">{interview?.role} Interview</h1>
              <p className="text-gray-400 mt-1">
                Completed on {new Date(feedback.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        
        {/* Score Section */}
        <section className="grid md:grid-cols-3 gap-6">
          {/* Main Score Card */}
          <div className={cn(
            "md:col-span-1 p-8 rounded-xl border relative overflow-hidden",
            {
              "bg-gradient-to-br from-green-500/10 via-[#161B22] to-[#0D1117] border-green-500/30": feedback.totalScore >= 80,
              "bg-gradient-to-br from-yellow-500/10 via-[#161B22] to-[#0D1117] border-yellow-500/30": feedback.totalScore >= 50 && feedback.totalScore < 80,
              "bg-gradient-to-br from-red-500/10 via-[#161B22] to-[#0D1117] border-red-500/30": feedback.totalScore < 50,
            }
          )}>
            <p className="text-xs uppercase tracking-widest font-semibold text-gray-400">Overall Score</p>
            <div className={cn(
              "text-6xl font-bold my-4 tabular-nums",
              {
                "text-green-400": feedback.totalScore >= 80,
                "text-yellow-400": feedback.totalScore >= 50 && feedback.totalScore < 80,
                "text-red-400": feedback.totalScore < 50,
              }
            )}>
              {feedback.totalScore}
              <span className="text-2xl text-gray-500">/100</span>
            </div>
            <p className="text-sm text-gray-400">
              {feedback.totalScore >= 80 
                ? "Excellent Performance" 
                : feedback.totalScore >= 50 
                  ? "Good Progress"
                  : "Keep Practicing"}
            </p>
          </div>

          {/* Assessment Summary */}
          <div className="md:col-span-2 bg-gradient-to-br from-blue-500/10 to-[#0D1117] border border-blue-500/30 p-8 rounded-xl">
            <p className="text-xs uppercase tracking-widest font-semibold text-gray-400 mb-3">Assessment Summary</p>
            <p className="text-lg leading-relaxed text-gray-200">
              {feedback.finalAssessment}
            </p>
          </div>
        </section>

        {/* Category Scores with Progress Bars */}
        <section className="bg-[#0D1117] border border-gray-700/50 rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-8">Detailed Assessment</h2>
          <div className="space-y-6">
            {feedback.categoryScores.map((cat, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-white">{cat.name}</span>
                  <div className="flex items-baseline gap-2">
                    <span className={cn(
                      "text-xl font-bold tabular-nums",
                      {
                        "text-green-400": cat.score >= 75,
                        "text-yellow-400": cat.score >= 50 && cat.score < 75,
                        "text-red-400": cat.score < 50,
                      }
                    )}>
                      {cat.score}%
                    </span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000 ease-out",
                      {
                        "bg-gradient-to-r from-green-500 to-green-400": cat.score >= 75,
                        "bg-gradient-to-r from-yellow-500 to-yellow-400": cat.score >= 50 && cat.score < 75,
                        "bg-gradient-to-r from-red-500 to-red-400": cat.score < 50,
                      }
                    )}
                    style={{ width: `${cat.score}%` }}
                  />
                </div>
                
                {/* Comment */}
                <p className="text-xs text-gray-500 mt-1">{cat.comment}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Strengths and Areas for Improvement */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Strengths */}
          <div className="bg-gradient-to-br from-green-500/5 to-[#0D1117] border border-green-500/20 rounded-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle2 size={24} className="text-green-400" />
              </div>
              <h3 className="text-xl font-bold">Major Strengths</h3>
            </div>
            <ul className="space-y-3">
              {feedback.strengths.map((s, i) => (
                <li key={i} className="flex gap-3 text-gray-300 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 mt-2" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Areas to Improve */}
          <div className="bg-gradient-to-br from-yellow-500/5 to-[#0D1117] border border-yellow-500/20 rounded-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <AlertCircle size={24} className="text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold">Areas to Improve</h3>
            </div>
            <ul className="space-y-3">
              {feedback.areasForImprovement.map((a, i) => (
                <li key={i} className="flex gap-3 text-gray-300 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0 mt-2" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recommendations */}
        <section className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-blue-500/20 rounded-xl p-8">
          <h3 className="text-2xl font-bold mb-6">Recommendations for Improvement</h3>
          <ul className="space-y-4">
            <li className="flex gap-4 text-gray-300">
              <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-2.5" />
              <div>
                <p className="font-semibold text-white">Repeat complex technical definitions</p>
                <p className="text-sm text-gray-400 mt-1">With 2-3 concrete examples to solidify understanding</p>
              </div>
            </li>
            <li className="flex gap-4 text-gray-300">
              <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-2.5" />
              <div>
                <p className="font-semibold text-white">Keep answers concise</p>
                <p className="text-sm text-gray-400 mt-1">Aim for 60-90 seconds for sharper communication</p>
              </div>
            </li>
            <li className="flex gap-4 text-gray-300">
              <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-2.5" />
              <div>
                <p className="font-semibold text-white">Mention system design tradeoffs</p>
                <p className="text-sm text-gray-400 mt-1">Explicitly discuss pros and cons of your approach</p>
              </div>
            </li>
            <li className="flex gap-4 text-gray-300">
              <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-2.5" />
              <div>
                <p className="font-semibold text-white">Practice behavioral stories</p>
                <p className="text-sm text-gray-400 mt-1">Use STAR structure (Situation, Task, Action, Result) consistently</p>
              </div>
            </li>
          </ul>
        </section>

        {/* Interview Transcript */}
        <section className="bg-[#0D1117] border border-gray-700/50 rounded-xl p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <BookOpen size={20} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-bold">Interview Transcript</h3>
            </div>
            <div className="text-sm text-gray-500 italic">Full session available for review</div>
          </div>
          <p className="text-sm text-gray-400 mt-4">
            The complete transcript of your interview session is available for reference and review.
          </p>
        </section>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4 pb-12">
          <Link 
            href="/" 
            className="flex-1 px-6 py-3 bg-[#161B22] border border-gray-700/50 hover:border-gray-600 rounded-lg font-semibold transition-colors text-center"
          >
            Back to Dashboard
          </Link>
          <Link 
            href="/" 
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors text-center"
          >
            Practice Again
          </Link>
        </div>
      </div>
    </main>
  );
};

export default FeedbackPage;
