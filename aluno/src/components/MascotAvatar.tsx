import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export type MascotAnimation = "idle" | "jump" | "hit";

interface MascotAvatarProps {
  readonly level: number;
  readonly animation?: MascotAnimation;
  readonly size?: number;
  readonly className?: string;
  readonly onAnimationEnd?: () => void;
}

const IDLE_FRAMES = [0, 2, 5, 7, 9, 11, 14, 17];
const JUMP_FRAMES = [0, 3, 6, 9, 12, 16];
const HIT_FRAMES = [0, 3, 6, 9, 12];

const FRAME_MAP: Record<MascotAnimation, readonly number[]> = {
  idle: IDLE_FRAMES,
  jump: JUMP_FRAMES,
  hit: HIT_FRAMES,
};

const FRAME_DURATION: Record<MascotAnimation, number> = {
  idle: 150,
  jump: 120,
  hit: 130,
};

function getLevelFolder(level: number): string {
  const clamped = Math.max(1, Math.min(5, level));
  return `lv${clamped}`;
}

function getFrameSrc(level: number, animation: MascotAnimation, frameIndex: number): string {
  const folder = getLevelFolder(level);
  const frames = FRAME_MAP[animation];
  const frame = frames[frameIndex % frames.length];
  return `/mascots/${folder}/${animation}-${frame}.png`;
}

export function MascotAvatar({
  level,
  animation = "idle",
  size = 48,
  className,
  onAnimationEnd,
}: MascotAvatarProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = FRAME_MAP[animation];
  const isLoop = animation === "idle";

  useEffect(() => {
    setFrameIndex(0);
  }, [animation, level]);

  useEffect(() => {
    const duration = FRAME_DURATION[animation];
    const interval = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= frames.length) {
          if (isLoop) return 0;
          clearInterval(interval);
          onAnimationEnd?.();
          return prev;
        }
        return next;
      });
    }, duration);

    return () => clearInterval(interval);
  }, [animation, frames.length, isLoop, onAnimationEnd]);

  const src = getFrameSrc(level, animation, frameIndex);

  return (
    <img
      src={src}
      alt={`Mascote nível ${level}`}
      width={size}
      height={size}
      className={cn("object-contain", className)}
      style={{ imageRendering: "auto" }}
    />
  );
}

// Versão com animação temporária (jump/hit) que volta pro idle
export function MascotAvatarWithReaction({
  level,
  reaction,
  size = 48,
  className,
}: {
  readonly level: number;
  readonly reaction: MascotAnimation | null;
  readonly size?: number;
  readonly className?: string;
}) {
  const [currentAnim, setCurrentAnim] = useState<MascotAnimation>("idle");

  useEffect(() => {
    if (reaction && reaction !== "idle") {
      setCurrentAnim(reaction);
    }
  }, [reaction]);

  const handleAnimEnd = useCallback(() => {
    setCurrentAnim("idle");
  }, []);

  return (
    <MascotAvatar
      level={level}
      animation={currentAnim}
      size={size}
      className={className}
      onAnimationEnd={currentAnim !== "idle" ? handleAnimEnd : undefined}
    />
  );
}
