import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { QuestaoRecomendada } from "./types";
import { CheckCircle, XCircle, RotateCcw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useStudentProfile } from "@/hooks/useStudentData";
import { useGamification } from "@/hooks/useGamification";
import { MascotAvatarWithReaction, type MascotAnimation } from "@/components/MascotAvatar";

interface Props {
  questoes: QuestaoRecomendada[];
  titulo: string;
}

const XP_CORRECT = 20;
const XP_WRONG = 5;

export function SectionQuestoes({ questoes, titulo }: Props) {
  return (
    <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-3">
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
        Questões para treinar — {titulo}
      </p>
      {questoes.map((q, i) => (
        <QuestaoCard key={q.coItem ?? i} questao={q} index={i} />
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
      { onConflict: "student_key,co_item" },
    )
    .then(({ error }) => {
      if (error) console.warn("[questoes] Falha ao salvar resposta:", error.message);
    });
}

function QuestaoCard({ questao, index }: { questao: QuestaoRecomendada; index: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);
  const [mascotReaction, setMascotReaction] = useState<MascotAnimation | null>(null);
  const { data: student } = useStudentProfile();
  const studentKey = student?.matricula || student?.id;
  const { data: gamification } = useGamification(studentKey);
  const queryClient = useQueryClient();
  const level = gamification?.level ?? 1;

  const answered = selected !== null;
  const correct = selected === questao.gabarito;

  const handleAnswer = useCallback(
    (letra: string) => {
      setSelected(letra);
      const isCorrect = letra === questao.gabarito;
      const xp = isCorrect ? XP_CORRECT : XP_WRONG;
      setXpAwarded(xp);

      // Mascote + celebração
      setMascotReaction(isCorrect ? "jump" : "hit");
      if (isCorrect) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 2000);
      }
      setTimeout(() => setMascotReaction(null), 1500);

      // Salvar resposta + invalidar cache de gamificação
      const studentKey = student?.matricula || student?.id;
      if (studentKey && questao.coItem) {
        saveQuestionResponse(studentKey, questao.coItem, letra, isCorrect);
        // Atualizar XP no header após 1s
        setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: ["gamification"] });
        }, 1000);
      }
    },
    [questao.gabarito, questao.coItem, student, queryClient],
  );

  const handleRetry = () => {
    setSelected(null);
    setXpAwarded(null);
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
      {/* Celebração — mascote + XP popup */}
      {showCelebration && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="animate-bounce-in flex flex-col items-center">
            <MascotAvatarWithReaction level={level} reaction="jump" size={80} />
            <div className="mt-1 flex items-center gap-1 bg-primary rounded-full px-3 py-1 shadow-lg animate-wiggle">
              <Zap className="h-4 w-4 text-white" />
              <span className="text-sm font-black text-white">+{XP_CORRECT} XP</span>
            </div>
          </div>
          {/* Confetti particles */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti-fall"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: "-10px",
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random() * 1}s`,
                fontSize: "16px",
              }}
            >
              {["⭐", "🔥", "💎", "✨", "🎯", "💪"][i % 6]}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-primary uppercase">{questao.sourceExam}</span>
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
          {!showCelebration && (
            <MascotAvatarWithReaction level={level} reaction={mascotReaction} size={36} className="flex-shrink-0" />
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
                <span className="inline-flex items-center gap-0.5 bg-primary/15 text-primary rounded-full px-1.5 py-0.5 text-[9px] font-black">
                  <Zap className="h-2.5 w-2.5" />+{XP_CORRECT}
                </span>
              </>
            ) : (
              <>
                Resposta: {questao.gabarito}
                <span className="inline-flex items-center gap-0.5 bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[9px] font-black">
                  <Zap className="h-2.5 w-2.5" />+{XP_WRONG}
                </span>
              </>
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
