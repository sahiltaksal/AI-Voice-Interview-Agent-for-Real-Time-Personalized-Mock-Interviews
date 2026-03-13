import Link from "next/link";
import Image from "next/image";
import { Code2, Database, Globe, TestTube, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import InterviewCard from "@/components/InterviewCard";
import ResumeUpload from "@/components/ResumeUpload";
import RoleCard from "@/components/RoleCard";

import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewsByUserId,
  getLatestInterviews,
  getFeedbackByInterviewIds,
  
} from "@/lib/actions/general.action";
import { getResumeByUserId } from "@/lib/actions/resume.action";

import { dummyInterviews } from "@/constants";

async function Home() {
  const user = await getCurrentUser();

  // ✅ OPTIMIZED: Parallel data fetching
  const [userInterviews, allInterview, resumeResponse] =
    user
      ? await Promise.all([
        getInterviewsByUserId(user.id) || [],
        getLatestInterviews({ userId: user.id }) || [],
        getResumeByUserId(user.id),
      ])
      : [[], [], null];

  const initialResumeData = resumeResponse?.success ? resumeResponse.data : null;

  const safeUserInterviews = userInterviews || [];
  const safeAllInterview = allInterview || [];

  // ✅ OPTIMIZED: Batch fetch feedback instead of N+1 queries
  const feedbackMap = user
    ? await getFeedbackByInterviewIds({
      interviewIds: safeUserInterviews.slice(0, 4).map((i) => i.id),
      userId: user.id,
    })
    : {};

  const hasPastInterviews = safeUserInterviews.length > 0;

  const predefinedRoles = [
    { role: "Java Developer", icon: <Code2 size={24} /> },
    { role: "Python Developer", icon: <Database size={24} /> },
    { role: "Golang Developer", icon: <Globe size={24} /> },
    { role: "Software Tester", icon: <TestTube size={24} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0F] via-[#0D1117] to-[#0A0A0F]">
      {/* ===== NAVBAR ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-700/50 bg-[#0D1117]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
              </svg>
            </div>
            <span className="text-lg font-bold text-white">PrepAI</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-white hover:text-blue-400 font-medium transition">Dashboard</Link>
            <Link href="/history" className="text-gray-400 hover:text-white transition">History</Link>
            <a href="#" className="text-gray-400 hover:text-white transition">Resources</a>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <button className="relative p-2 hover:bg-gray-800/50 rounded-lg transition">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-sm font-semibold cursor-pointer hover:opacity-80 transition">
              {user?.name?.charAt(0) || "U"}
            </div>
          </div>
        </div>
      </nav>

      {/* ===== MAIN CONTENT ===== */}
      <main className="pt-20">
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">

          {/* ===== HERO SECTION ===== */}
          <section className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              {/* Greeting */}
              <div>
                <h1 className="text-5xl font-bold text-white mb-2">
                  Welcome back, <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">{user?.name?.split(" ")[0] || "Candidate"}</span>
                </h1>
                <p className="text-lg text-gray-400 leading-relaxed">
                  Master your interview skills with AI-powered voice practice, intelligent feedback, and comprehensive performance analytics.
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-[#161B22] to-[#0D1117] border border-blue-500/20 rounded-xl p-5 hover:border-blue-500/50 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Total Interviews</p>
                      <p className="text-3xl font-bold text-white mt-1">{safeUserInterviews.length}</p>
                    </div>
                    <svg className="w-8 h-8 text-blue-500/50" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                    </svg>
                  </div>
                  <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 w-3/4"></div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-[#161B22] to-[#0D1117] border border-emerald-500/20 rounded-xl p-5 hover:border-emerald-500/50 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Average Score</p>
                      <p className="text-3xl font-bold text-white mt-1">
                        {safeUserInterviews.length ? Math.round((Object.values(feedbackMap).reduce((acc, f) => acc + (f?.totalScore || 0), 0) / (safeUserInterviews.length || 1))) : 0}%
                      </p>
                    </div>
                    <svg className="w-8 h-8 text-emerald-500/50" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 w-2/3"></div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-[#161B22] to-[#0D1117] border border-purple-500/20 rounded-xl p-5 hover:border-purple-500/50 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Interview Types</p>
                      <p className="text-3xl font-bold text-white mt-1">{predefinedRoles.length}</p>
                    </div>
                    <svg className="w-8 h-8 text-purple-500/50" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="text-xs text-gray-500">Java, Python, Go, Testing</div>
                </div>

                <div className="bg-gradient-to-br from-[#161B22] to-[#0D1117] border border-pink-500/20 rounded-xl p-5 hover:border-pink-500/50 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Your Goal</p>
                      <p className="text-3xl font-bold text-white mt-1">80%+</p>
                    </div>
                    <svg className="w-8 h-8 text-pink-500/50" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <p className="text-xs text-emerald-400">Keep improving!</p>
                </div>
              </div>

              {/* CTA Button */}
              <div className="flex gap-3 pt-4">
                <Button asChild className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-8 py-3 rounded-lg transition-all duration-200 flex-1">
                  <Link href="/interview" className="flex items-center gap-2">
                    <span>✨</span>
                    Start New Interview
                  </Link>
                </Button>
                <Button asChild className="border border-gray-700 hover:border-gray-600 bg-[#161B22] hover:bg-[#161B22]/80 text-white px-6 py-3 rounded-lg transition-all duration-200">
                  <Link href="/history">View History</Link>
                </Button>
              </div>
            </div>

            {/* Hero Image */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-emerald-500/20 rounded-3xl blur-2xl"></div>
                <div className="relative rounded-3xl overflow-hidden border border-gray-700/50 bg-[#161B22] p-8">
                  <Image 
                    src="/robot.png" 
                    width={420} 
                    height={420} 
                    alt="AI interview assistant"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ===== INTERVIEW TYPES SECTION ===== */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Code2 className="text-blue-400" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Start by Role</h2>
                <p className="text-sm text-gray-400">Choose from predefined role-based interview scenarios</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {predefinedRoles.map((role) => (
                <RoleCard
                  key={role.role}
                  role={role.role}
                  userId={user?.id || ""}
                  icon={role.icon}
                />
              ))}
            </div>
          </section>

          {/* ===== RECENT INTERVIEWS ===== */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <FileText className="text-emerald-400" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Recent Interviews</h2>
                  <p className="text-sm text-gray-400">Your latest practice sessions and feedback</p>
                </div>
              </div>
              <Link 
                href="/history" 
                className="text-blue-400 hover:text-blue-300 font-medium transition flex items-center gap-2"
              >
                View All
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {hasPastInterviews ? (
              <div className="grid grid-cols-1 gap-4">
                {safeUserInterviews.slice(0, 4).map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    userId={user?.id}
                    interviewId={interview.id}
                    role={interview.role}
                    type={interview.type}
                    techstack={interview.techstack}
                    createdAt={interview.createdAt}
                    difficulty={interview.difficulty || interview.level}
                    duration={interview.duration}
                    feedback={feedbackMap[interview.id] || null}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-[#161B22] border border-dashed border-gray-700/50 rounded-xl p-12 text-center">
                <div className="mb-4">
                  <svg className="w-16 h-16 text-gray-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-lg mb-4">No interviews yet</p>
                <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition">
                  <Link href="/interview">Take Your First Interview</Link>
                </Button>
              </div>
            )}
          </section>

          {/* ===== RESUME SECTION ===== */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <FileText className="text-purple-400" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Resume-Based Interviews</h2>
                <p className="text-sm text-gray-400">Generate questions tailored to your resume</p>
              </div>
            </div>
            <div className="bg-[#161B22] border border-gray-700/50 rounded-xl p-8">
              <ResumeUpload userId={user?.id || ""} initialData={initialResumeData} />
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}


export default Home;
