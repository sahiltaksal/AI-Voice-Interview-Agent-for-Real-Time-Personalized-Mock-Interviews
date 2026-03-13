"use client";

import { useState } from "react";
import { Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { db } from "@/firebase/client";
import { doc, onSnapshot } from "firebase/firestore";
import { processResumeAction } from "@/lib/actions/resume.action";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useEffect, Suspense } from "react";

// ✅ OPTIMIZED: Lazy load modal component
const InterviewSetupModal = dynamic(() => import("./InterviewSetupModal"), {
    loading: () => <></>,
});

const ResumeUpload = ({ userId, initialData }: { userId: string, initialData?: any }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [resumeData, setResumeData] = useState<{
        extractedText: string;
        summary: string;
        status: string;
    } | null>(initialData ? {
        extractedText: initialData.rawText || initialData.extractedText, // Handle both schemas
        summary: initialData.summary,
        status: initialData.status
    } : null);
    const [isSetupOpen, setIsSetupOpen] = useState(false);

    useEffect(() => {
        if (!userId) return;

        const unsubscribe = onSnapshot(doc(db, "resumes", userId), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setResumeData({
                    extractedText: data.rawText || data.extractedText,
                    summary: data.summary,
                    status: data.status
                });
                if (data.status === "processed") {
                    setIsUploading(false);
                    setIsProcessing(false);
                }
            } else {
                setResumeData(null);
            }
        }, (error) => {
            if (error.code === "permission-denied") {
                console.log("Firestore sync: Permission denied (doc may not exist yet or auth pending)");
                return;
            }
            console.error("Firestore onSnapshot error:", error);
        });

        return () => unsubscribe();
    }, [userId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type !== "application/pdf") {
                toast.error("Please upload a PDF file");
                return;
            }
            setFile(selectedFile);
        }
    };

    const extractTextFromPDF = async (file: File): Promise<string> => {
        const pdfjs = await import("pdfjs-dist");
        // @ts-ignore
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let text = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map((item: any) => item.str);
            text += strings.join(" ") + "\n";
        }

        return text;
    };

    const handleUpload = async () => {
        if (!file || !userId) return;

        setIsUploading(true);
        setIsProcessing(true);
        try {
            // 1. Extract Text on Client (No Storage needed)
            const extractedText = await extractTextFromPDF(file);

            // 2. Process via Server Action
            const result = await processResumeAction(extractedText, userId);
            console.log("Resume processing result:", result.success);

            if (!result.success) {
                toast.error(result.error || "Failed to process resume");
                setIsProcessing(false);
            } else {
                if ((result as any).isFallback) {
                    toast.info("Resume processed with default settings (AI limit reached).");
                } else {
                    toast.success("Resume uploaded and processed successfully!");
                }

                // Direct state update as fallback/complement to onSnapshot
                setResumeData({
                    extractedText: result.extractedText!,
                    summary: result.summary!,
                    status: "processed"
                });

                setIsProcessing(false);
                setIsSetupOpen(true); // Automatically open modal on success
            }
        } catch (error) {
            console.error("Upload/Processing error:", error);
            toast.error("Error processing resume");
        } finally {
            setIsUploading(false);
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="border-2 border-dashed border-dark-300 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 bg-dark-100/50 hover:bg-dark-100 transition-colors cursor-pointer relative">
                <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {file ? (
                    <div className="flex flex-col items-center gap-2">
                        <FileText className="text-primary size-12" />
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-gray-400">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </div>
                ) : (resumeData?.status === "processed") ? (
                    <div className="flex flex-col items-center gap-2 text-center">
                        <CheckCircle2 className="text-primary size-12" />
                        <p className="font-medium text-primary">Resume Ready</p>
                        <p className="text-sm text-gray-400">
                            Click below to start your personalized interview
                        </p>
                    </div>
                ) : (resumeData?.status === "processing" || isProcessing) ? (
                    <div className="flex flex-col items-center gap-2 text-center">
                        <Loader2 className="animate-spin text-primary size-12" />
                        <p className="font-medium text-primary">Processing...</p>
                        <p className="text-sm text-gray-400">
                            We're analyzing your resume. This usually takes a minute.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-center">
                        <Upload className="text-gray-400 size-12" />
                        <p className="font-medium">Upload your Resume (PDF)</p>
                        <p className="text-sm text-gray-400">
                            Maximum file size: 5MB
                        </p>
                    </div>
                )}
            </div>

            <button
                onClick={resumeData?.status === "processed" ? () => setIsSetupOpen(true) : handleUpload}
                disabled={(!file && resumeData?.status !== "processed") || (resumeData?.status === "processing" || isProcessing)}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {(resumeData?.status === "processing" || isProcessing) ? (
                    <>
                        <Loader2 className="animate-spin size-4" />
                        Processing...
                    </>
                ) : resumeData?.status === "processed" ? (
                    "Start Interview"
                ) : (
                    "Process Resume"
                )}
            </button>

            <Suspense fallback={<></>}>
                {isSetupOpen && resumeData && (
                    <InterviewSetupModal
                        isOpen={isSetupOpen}
                        onClose={() => setIsSetupOpen(false)}
                        type="resume"
                        userId={userId}
                        resumeData={{
                            text: resumeData.extractedText,
                            summary: resumeData.summary
                        }}
                    />
                )}
            </Suspense>
        </div>
    );
};

export default ResumeUpload;
