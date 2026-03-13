import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full h-11 px-4 py-2.5 rounded-lg",
        "bg-[#0D1117] border border-gray-700/50 hover:border-gray-600/50",
        "text-white placeholder-gray-500",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500",
        "transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}

export { Input };
