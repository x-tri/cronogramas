import { cn } from "@/lib/utils";

interface SpeechBubbleProps {
  readonly message: string;
  readonly className?: string;
  readonly variant?: "default" | "success" | "error";
}

const VARIANT_STYLES = {
  default: "bg-card border-2 border-border text-foreground",
  success: "bg-emerald-500 border-0 text-white",
  error: "bg-red-500 border-0 text-white",
} as const;

const ARROW_STYLES = {
  default: "border-t-card",
  success: "border-t-emerald-500",
  error: "border-t-red-500",
} as const;

export function SpeechBubble({ message, className, variant = "default" }: SpeechBubbleProps) {
  return (
    <div className={cn("flex flex-col items-center animate-bounce-in", className)}>
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 shadow-lg max-w-[220px] text-center",
          VARIANT_STYLES[variant],
        )}
      >
        <p className="text-xs font-black leading-snug">{message}</p>
      </div>
      {/* Arrow pointing down */}
      <div
        className={cn(
          "w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent -mt-px",
          ARROW_STYLES[variant],
        )}
      />
    </div>
  );
}
