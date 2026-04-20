import { useState, useEffect, useMemo } from "react";
import { MascotAvatar, type MascotAnimation } from "./MascotAvatar";
import { SpeechBubble } from "./SpeechBubble";
import type { GamificationData } from "@/hooks/useGamification";

type BubbleContext = "idle" | "correct" | "wrong";

interface MascotWithBubbleProps {
  readonly level: number;
  readonly gamification: GamificationData | undefined;
  readonly context?: BubbleContext;
  readonly size?: number;
  readonly className?: string;
}

// ============ MENSAGENS CONTEXTUAIS ============

const IDLE_MOTIVATIONAL = [
  "Bora estudar! 📚",
  "Cada bloco conta! 💪",
  "O ENEM te espera! 🎯",
  "Foco e dedicação! 🔥",
  "Você consegue! ⭐",
  "Hoje é dia de evoluir! 🚀",
  "Não desista! 💎",
  "Um passo de cada vez! 🏃",
];

function getContextualMessage(
  gamification: GamificationData | undefined,
  context: BubbleContext,
): { message: string; variant: "default" | "success" | "error" } {
  // Questão — mensagens fixas
  if (context === "correct") {
    const msgs = [
      "Mandou bem! 🎯",
      "Arrasou! 🔥",
      "Gênio! 🧠",
      "Isso aí! ⭐",
      "Certíssimo! 💎",
    ];
    return { message: msgs[Math.floor(Math.random() * msgs.length)], variant: "success" };
  }

  if (context === "wrong") {
    const msgs = [
      "Quase! Tenta de novo! 💪",
      "Errando se aprende! 📚",
      "Não desista! 🎯",
      "A próxima você acerta! ⭐",
    ];
    return { message: msgs[Math.floor(Math.random() * msgs.length)], variant: "error" };
  }

  // Idle — mensagens baseadas no estado do aluno
  if (!gamification) {
    return { message: IDLE_MOTIVATIONAL[0], variant: "default" };
  }

  const { xp_total, streak_weeks, xp_next_level, level, blocos_done, blocos_total } = gamification;
  const xpFalta = xp_next_level - xp_total;
  const weekPercent = blocos_total > 0 ? Math.round((blocos_done / blocos_total) * 100) : 0;

  // Prioridade de mensagens contextuais
  const contextual: Array<{ message: string; weight: number }> = [];

  // XP baixo — incentivar
  if (xp_total === 0) {
    contextual.push({ message: "Bora começar! Cada bloco vale 10 XP! 🚀", weight: 10 });
  }

  // Streak ativa
  if (streak_weeks > 0) {
    contextual.push({ message: `🔥 ${streak_weeks} semana(s) seguida(s)! Não quebre!`, weight: 8 });
  } else {
    contextual.push({ message: "Complete blocos pra iniciar sua streak! 🔥", weight: 6 });
  }

  // Próximo nível perto
  if (xpFalta > 0 && xpFalta <= 100) {
    const nextTitle = level === 1 ? "Dedicado" : level === 2 ? "Focado" : level === 3 ? "Guerreiro" : "Elite ENEM";
    contextual.push({ message: `Faltam ${xpFalta} XP pro ${nextTitle}! ⚡`, weight: 9 });
  }

  // Semana completa
  if (weekPercent === 100 && blocos_total > 0) {
    contextual.push({ message: "Semana completa! Você é demais! 🏆", weight: 10 });
  } else if (weekPercent > 0 && weekPercent < 50) {
    const faltam = blocos_total - blocos_done;
    contextual.push({ message: `Faltam ${faltam} blocos essa semana! 📅`, weight: 7 });
  }

  // Adicionar motivacionais genéricos com peso baixo
  for (const msg of IDLE_MOTIVATIONAL) {
    contextual.push({ message: msg, weight: 2 });
  }

  return {
    message: contextual[Math.floor(Math.random() * contextual.length)].message,
    variant: "default",
  };
}

// ============ COMPONENTE ============

export function MascotWithBubble({
  level,
  gamification,
  context = "idle",
  size = 160,
  className,
}: MascotWithBubbleProps) {
  const [bubbleKey, setBubbleKey] = useState(0);
  const [animation, setAnimation] = useState<MascotAnimation>("idle");

  // Rotacionar mensagem a cada 6s no idle
  useEffect(() => {
    if (context !== "idle") return;
    const interval = setInterval(() => {
      setBubbleKey((prev) => prev + 1);
    }, 6000);
    return () => clearInterval(interval);
  }, [context]);

  // Animação baseada no contexto
  useEffect(() => {
    if (context === "correct") {
      setAnimation("jump");
    } else if (context === "wrong") {
      setAnimation("hit");
    } else {
      setAnimation("idle");
    }
  }, [context]);

  const { message, variant } = useMemo(
    () => getContextualMessage(gamification, context),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gamification, context, bubbleKey],
  );

  return (
    <div className={className}>
      <div className="flex flex-col items-center">
        <SpeechBubble message={message} variant={variant} key={`bubble-${bubbleKey}-${context}`} />
        <MascotAvatar
          level={level}
          animation={animation}
          size={size}
          className="drop-shadow-lg -mt-1"
        />
      </div>
    </div>
  );
}
