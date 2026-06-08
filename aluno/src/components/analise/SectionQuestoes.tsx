import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { QuestaoRecomendada } from "./types";
import { byDifficultyAsc, difficultyTier, type DifficultyTier } from "@/lib/question-difficulty";
import { CheckCircle, XCircle, RotateCcw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useStudentProfile } from "@/hooks/useStudentData";
import { useGamification } from "@/hooks/useGamification";
import { MascotWithBubble } from "@/components/MascotWithBubble";
import type { MascotAnimation } from "@/components/MascotAvatar";
import type { QuestionResponse, QuestionResponseMap } from "@/hooks/useQuestionResponses";

interface Props {
  questoes: QuestaoRecomendada[];
  titulo: string;
  responses?: QuestionResponseMap;
}

const XP_CORRECT = 20;
const XP_WRONG = 5;

const TIER_LABEL: Record<DifficultyTier, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};
const TIER_CLASS: Record<DifficultyTier, string> = {
  facil: "bg-emerald-500/15 text-emerald-600",
  medio: "bg-amber-500/15 text-amber-600",
  dificil: "bg-red-500/15 text-red-600",
};
const CONFETTI_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: `${10 + ((i * 37) % 80)}%`,
  delay: `${((i * 13) % 50) / 100}s`,
  duration: `${1 + ((i * 17) % 100) / 100}s`,
  icon: ["⭐", "🔥", "💎", "✨", "🎯", "💪"][i % 6],
}));

export function SectionQuestoes({ questoes, titulo, responses }: Props) {
  const ordenadas = [...questoes].sort(byDifficultyAsc);
  return (
    <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-3">
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
        Questões para treinar — {titulo}
      </p>
      {ordenadas.map((q, i) => (
        <QuestaoCard
          key={q.coItem ?? i}
          questao={q}
          index={i}
          prior={q.coItem != null ? responses?.get(q.coItem) : undefined}
        />
      ))}
    </div>
  );
}

function saveQuestionResponse(
  studentKey: string,
  coItem: number,
  answered: string,
  correct: boolean,
) {
  const xp = correct ? XP_CORRECT : XP_WRONG;
  void supabase
    .from("student_question_responses")
    .upsert(
      { student_key: studentKey, co_item: coItem, answered, correct, xp_earned: xp },
      // Preserva a 1ª tentativa: no conflito não sobrescreve (sinal e XP honestos,
      // sem farmar via "Tentar" depois de ver o gabarito).
      { onConflict: "student_key,co_item", ignoreDuplicates: true },
    )
    .then(({ error }) => {
      if (error) console.warn("[questoes] Falha ao salvar resposta:", error.message);
    });
}

function QuestaoCard({
  questao,
  index,
  prior,
}: {
  questao: QuestaoRecomendada;
  index: number;
  prior?: QuestionResponse;
}) {
  const [selected, setSelected] = useState<string | null>(prior?.answered ?? null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [mascotReaction, setMascotReaction] = useState<MascotAnimation | null>(null);
  const [scored, setScored] = useState(!!prior); // já respondida antes (1ª tentativa registrada)
  const [awarded, setAwarded] = useState(false); // XP concedido NESTA sessão
  const [replay, setReplay] = useState(false); // resposta atual é treino (sem XP/registro)
  const { data: student } = useStudentProfile();
  const studentKey = student?.matricula || student?.id;
  const { data: gamification } = useGamification(studentKey);
  const queryClient = useQueryClient();
  const level = gamification?.level ?? 1;

  const answered = selected !== null;
  const correct = selected === questao.gabarito;
  const tier = difficultyTier(questao.dificuldade);

  const handleAnswer = useCallback(
    (letra: string) => {
      setSelected(letra);
      const isCorrect = letra === questao.gabarito;

      // Mascote sempre (feedback de aprendizado)
      setMascotReaction(isCorrect ? "jump" : "hit");
      setTimeout(() => setMascotReaction(null), 1500);

      // Só a 1ª tentativa conta: celebração, XP e registro. Retry = treino.
      if (scored) {
        setReplay(true);
        return;
      }
      setScored(true);
      setReplay(false);
      setAwarded(true);
      if (isCorrect) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 2000);
      }
      const studentKey = student?.matricula || student?.id;
      if (studentKey && questao.coItem) {
        saveQuestionResponse(studentKey, questao.coItem, letra, isCorrect);
        // Atualizar XP no header + progresso por habilidade após 1s
        setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: ["gamification"] });
          void queryClient.invalidateQueries({ queryKey: ["question-responses"] });
        }, 1000);
      }
    },
    [questao.gabarito, questao.coItem, student, queryClient, scored],
  );

  const handleRetry = () => {
    setSelected(null);
    setShowCelebration(false);
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 space-y-2 animate-fade-in relative overflow-hidden",
        answered && correct && "border-emerald-500/40",
      )}
      style={{ animationDelay: `${index * 0.05}s`, animationFillMode: "both" }}
    >
      {/* Celebração — mascote com speech bubble */}
      {showCelebration && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="animate-bounce-in flex flex-col items-center">
            <MascotWithBubble level={level} gamification={gamification} context="correct" size={100} />
            <div className="mt-1 flex items-center gap-1 bg-primary rounded-full px-3 py-1 shadow-lg animate-wiggle">
              <Zap className="h-4 w-4 text-white" />
              <span className="text-sm font-black text-white">+{XP_CORRECT} XP</span>
            </div>
          </div>
          {/* Confetti particles */}
          {CONFETTI_PARTICLES.map((particle) => (
            <div
              key={particle.id}
              className="absolute animate-confetti-fall"
              style={{
                left: particle.left,
                top: "-10px",
                animationDelay: particle.delay,
                animationDuration: particle.duration,
                fontSize: "16px",
              }}
            >
              {particle.icon}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-black text-primary uppercase">{questao.sourceExam}</span>
          {tier && (
            <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold", TIER_CLASS[tier])}>
              {TIER_LABEL[tier]}
            </span>
          )}
        </div>
        {questao.matchedTopicLabel && (
          <span className="text-[10px] font-semibold text-muted-foreground truncate ml-2">
            {questao.matchedTopicLabel}
          </span>
        )}
      </div>

      {(questao.linkImagem || questao.imagemUrl) && (
        <img
          src={questao.linkImagem || questao.imagemUrl || ""}
          alt="Imagem da questão"
          className="w-full rounded-md max-h-64 object-contain bg-muted"
          loading="lazy"
        />
      )}

      {questao.textoApoio && (
        <p className="text-[11px] text-muted-foreground italic border-l-2 border-primary/30 pl-2 leading-relaxed whitespace-pre-line">
          {questao.textoApoio}
        </p>
      )}

      <p className="text-xs font-semibold text-foreground leading-relaxed">{questao.enunciado}</p>

      <div className="space-y-1.5">
        {questao.alternativas?.map((alt) => {
          const isThis = selected === alt.letra;
          const isCorrect = alt.letra === questao.gabarito;
          let bg = "bg-muted/50 hover:bg-muted";
          if (answered) {
            if (isCorrect) bg = "bg-emerald-500/15 border-emerald-500/40";
            else if (isThis && !correct) bg = "bg-red-500/15 border-red-500/40";
            else bg = "bg-muted/30 opacity-60";
          }

          return (
            <button
              key={alt.letra}
              disabled={answered}
              onClick={() => handleAnswer(alt.letra)}
              className={cn(
                "w-full flex items-start gap-2 rounded-lg border p-2.5 text-left transition-all text-xs",
                bg,
              )}
            >
              <span
                className={cn(
                  "flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black border",
                  answered && isCorrect
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : answered && isThis && !correct
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-background border-border",
                )}
              >
                {answered && isCorrect ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : answered && isThis && !correct ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  alt.letra
                )}
              </span>
              <span className="font-medium text-foreground leading-relaxed pt-0.5">
                {alt.texto}
              </span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="flex items-center justify-between gap-2">
          {!showCelebration && !correct && mascotReaction === "hit" && (
            <MascotWithBubble level={level} gamification={gamification} context="wrong" size={48} className="flex-shrink-0" />
          )}
          <div
            className={cn(
              "text-[11px] font-bold p-2 rounded-lg text-center flex-1 flex items-center justify-center gap-1.5",
              correct ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600",
            )}
          >
            {correct ? (
              <>
                Correto!
                {awarded && (
                  <span className="inline-flex items-center gap-0.5 bg-primary/15 text-primary rounded-full px-1.5 py-0.5 text-[9px] font-black">
                    <Zap className="h-2.5 w-2.5" />+{XP_CORRECT}
                  </span>
                )}
              </>
            ) : (
              <>
                Resposta: {questao.gabarito}
                {awarded && (
                  <span className="inline-flex items-center gap-0.5 bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[9px] font-black">
                    <Zap className="h-2.5 w-2.5" />+{XP_WRONG}
                  </span>
                )}
              </>
            )}
            {replay && <span className="text-[9px] font-bold text-muted-foreground">treino</span>}
            {!replay && !awarded && prior && (
              <span className="text-[9px] font-bold text-muted-foreground">já respondida</span>
            )}
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 px-2 py-2 rounded-lg border border-primary/20 hover:bg-primary/5 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Tentar
          </button>
        </div>
      )}
    </div>
  );
}
