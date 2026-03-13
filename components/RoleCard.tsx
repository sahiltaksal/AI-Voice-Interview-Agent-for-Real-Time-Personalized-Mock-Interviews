"use client";

import { useState, Suspense } from "react";
import { ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";

interface RoleCardProps {
    role: string;
    userId: string;
    icon?: React.ReactNode;
}

// ✅ OPTIMIZED: Lazy load modal component
const InterviewSetupModal = dynamic(() => import("./InterviewSetupModal"), {
    loading: () => <></>,
});

const RoleCard = ({ role, userId, icon }: RoleCardProps) => {
    const [isSetupOpen, setIsSetupOpen] = useState(false);

    return (
        <>
            <Suspense fallback={<></>}>
                <div
                    onClick={() => setIsSetupOpen(true)}
                    className="group bg-gradient-to-br from-[#161B22] to-[#0D1117] border border-gray-700/50 hover:border-blue-500/50 rounded-xl p-6 flex flex-col gap-4 hover:shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer relative overflow-hidden"
                >
                    {/* Gradient background effect on hover */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/0 group-hover:bg-blue-500/10 rounded-full blur-3xl transition-all duration-500" />
                    
                    {/* Icon Container */}
                    <div className="relative z-10">
                        <div className="bg-blue-500/20 w-fit p-3 rounded-lg text-blue-400 group-hover:bg-blue-500/30 transition">
                            {icon}
                        </div>
                    </div>

                    {/* Text Section */}
                    <div className="relative z-10 flex flex-col gap-2">
                        <h3 className="text-lg font-semibold capitalize text-white group-hover:text-blue-400 transition">
                            {role}
                        </h3>
                        <p className="text-sm text-gray-500">
                            Start a role-based practice interview
                        </p>
                    </div>

                    {/* CTA Section */}
                    <div className="relative z-10 flex items-center justify-between mt-2 pt-4 border-t border-gray-700/30">
                        <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                            Start Interview
                        </span>
                        <ChevronRight size={18} className="text-blue-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </Suspense>

            <Suspense fallback={<></>}>
                {isSetupOpen && (
                    <InterviewSetupModal
                        isOpen={isSetupOpen}
                        onClose={() => setIsSetupOpen(false)}
                        type="role"
                        userId={userId}
                        role={role}
                    />
                )}
            </Suspense>
        </>
    );
};

export default RoleCard;
