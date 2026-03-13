"use client";

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { auth } from "@/firebase/client";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser,
} from "firebase/auth";
import { useState, useEffect } from "react";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { signIn, signUp } from "@/lib/actions/auth.action";
import FormField from "./FormField";

const authFormSchema = (type: FormType) => {
  return z.object({
    name: type === "sign-up" ? z.string().min(3) : z.string().optional(),
    email: z.string().email(),
    password: z.string().min(3),
  });
};

const AuthForm = ({ type }: { type: FormType }) => {
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const formSchema = authFormSchema(type);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  if (!isMounted) return null;

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      if (type === "sign-up") {
        const { name, email, password } = data;

        let userCredential;
        try {
          userCredential = await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );
        } catch (firebaseError: any) {
          if (firebaseError.code === "auth/email-already-in-use") {
            toast.error("This email is already in use. Please sign in.");
          } else {
            toast.error(firebaseError.message || "Failed to create account.");
          }
          return;
        }

        try {
          const result = await signUp({
            uid: userCredential.user.uid,
            name: name!,
            email,
            password,
          });

          if (!result.success) {
            await deleteUser(userCredential.user);
            toast.error(result.message);
            return;
          }

          toast.success("Account created successfully. Please sign in.");
          router.push("/sign-in");
        } catch (dbError: any) {
          await deleteUser(userCredential.user);
          toast.error("Failed to save user data. Please try again.");
        }
      } else {
        const { email, password } = data;

        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        const idToken = await userCredential.user.getIdToken();
        if (!idToken) {
          toast.error("Sign in Failed. Please try again.");
          return;
        }

        const result = await signIn({
          email,
          idToken,
        });

        if (!result.success) {
          toast.error(result.message);
          return;
        }

        toast.success("Signed in successfully.");
        router.push("/");
      }
    } catch (error: any) {
      console.log(error);
      toast.error(error.message || "An unexpected error occurred.");
    }
  };

  const isSignIn = type === "sign-in";

  return (
    <main className="auth-layout min-h-screen bg-gradient-to-br from-[#0A0A0F] via-[#0D1117] to-[#0A0A0F] flex items-center justify-center p-4">
      {/* Background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Split Layout Container */}
      <div className="relative w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        
        {/* LEFT SIDE - Branding */}
        <div className="hidden md:flex flex-col justify-center space-y-12 px-8">
          {/* Logo and Brand */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">PrepAI</h1>
                <p className="text-sm text-gray-400">Interview Mastery</p>
              </div>
            </div>
          </div>

          {/* Tagline and Features */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
                Ace Your Next Interview
              </h2>
              <p className="text-lg text-gray-400 leading-relaxed">
                Practice with AI, get instant feedback, and master interview skills with our cutting-edge platform.
              </p>
            </div>

            {/* Feature list */}
            <div className="space-y-4">
              {[
                { icon: "🎤", text: "Real-time voice analysis" },
                { icon: "⚡", text: "Instant AI-powered feedback" },
                { icon: "📊", text: "Detailed performance metrics" },
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-2xl">{feature.icon}</span>
                  <span className="text-gray-300">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom accent */}
          <div className="pt-8 border-t border-gray-700/50">
            <p className="text-xs text-gray-500">
              Trusted by 10,000+ candidates • Used by leading tech companies
            </p>
          </div>
        </div>

        {/* RIGHT SIDE - Form */}
        <div className="flex flex-col justify-center">
          <div className="bg-[#161B22] border border-gray-700/50 rounded-2xl p-8 shadow-2xl">
            {/* Form Header */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">
                {isSignIn ? "Welcome Back" : "Get Started"}
              </h3>
              <p className="text-gray-400">
                {isSignIn 
                  ? "Sign in to continue your interview practice" 
                  : "Create an account to begin mastering interviews"}
              </p>
            </div>

            {/* Form */}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="w-full space-y-5 form"
              >
                {!isSignIn && (
                  <FormField
                    control={form.control}
                    name="name"
                    label="Full Name"
                    placeholder="John Doe"
                    type="text"
                  />
                )}

                <FormField
                  control={form.control}
                  name="email"
                  label="Email Address"
                  placeholder="you@example.com"
                  type="email"
                />

                <FormField
                  control={form.control}
                  name="password"
                  label="Password"
                  placeholder="••••••••"
                  type="password"
                />

                <Button 
                  className="btn w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg transition-all duration-200 mt-2" 
                  type="submit"
                >
                  {isSignIn ? "Sign In" : "Create Account"}
                </Button>
              </form>
            </Form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-700/50"></div>
              <span className="text-xs text-gray-500">OR</span>
              <div className="flex-1 h-px bg-gray-700/50"></div>
            </div>

            {/* Google Sign In */}
            <button className="w-full border border-gray-700/50 hover:border-gray-600 bg-[#0D1117] hover:bg-[#161B22] text-white font-medium py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/>
              </svg>
              Continue with Google
            </button>

            {/* Footer Link */}
            <p className="text-center text-sm text-gray-400 mt-6">
              {isSignIn ? "Don't have an account?" : "Already have an account?"}
              <Link
                href={!isSignIn ? "/sign-in" : "/sign-up"}
                className="ml-2 text-blue-500 hover:text-blue-400 font-semibold transition-colors"
              >
                {!isSignIn ? "Sign In" : "Sign Up"}
              </Link>
            </p>
          </div>

          {/* Mobile Logo */}
          <div className="md:hidden mt-8 text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">PrepAI</h1>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AuthForm;
