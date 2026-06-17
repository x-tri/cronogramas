import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSisuUniversidades, useSisuCursos } from "@/hooks/useSisuCatalogo";
import { useSetSisuGoal } from "@/hooks/useSetSisuGoal";

interface SisuGoalPickerInitialGoal {
  readonly sisu_curso_nome: string | null;
  readonly sisu_universidade: string | null;
  readonly sisu_uf: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string | undefined;
  onSaved: () => void;
  initialGoal?: SisuGoalPickerInitialGoal | null;
}

function normalizeKey(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

export function SisuGoalPicker({ open, onOpenChange, studentId, onSaved, initialGoal }: Props) {
  const [busca, setBusca] = useState("");
  const [manualUni, setManualUni] = useState<{ sigla: string; uf: string; nome: string } | null>(null);
  const [manualCurso, setManualCurso] = useState<{ curso: string; nota_corte: number } | null>(null);
  const [isChangingUniversity, setIsChangingUniversity] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { data: unis = [] } = useSisuUniversidades();
  const { mutateAsync, isPending } = useSetSisuGoal(studentId);

  const unisFiltradas = useMemo(
    () => unis.filter((u) => `${u.nome} ${u.sigla}`.toLowerCase().includes(busca.toLowerCase())),
    [unis, busca],
  );

  const initialUni = useMemo(() => {
    const goalUni = normalizeKey(initialGoal?.sisu_universidade);
    const goalUf = normalizeKey(initialGoal?.sisu_uf);
    if (!goalUni || !goalUf) return null;

    return unis.find(
      (u) =>
        normalizeKey(u.uf) === goalUf &&
        (normalizeKey(u.sigla) === goalUni || normalizeKey(u.nome) === goalUni),
    ) ?? null;
  }, [
    initialGoal?.sisu_uf,
    initialGoal?.sisu_universidade,
    unis,
  ]);

  const uni = isChangingUniversity ? manualUni : manualUni ?? initialUni;
  const { data: cursos = [] } = useSisuCursos(uni?.sigla, uni?.uf);

  const initialCurso = useMemo(() => {
    const goalCurso = normalizeKey(initialGoal?.sisu_curso_nome);
    if (!goalCurso || isChangingUniversity) return null;

    return cursos.find((c) => normalizeKey(c.curso) === goalCurso) ?? null;
  }, [cursos, initialGoal?.sisu_curso_nome, isChangingUniversity]);

  const curso = manualCurso ?? initialCurso;

  function resetTransientState() {
    setBusca("");
    setManualUni(null);
    setManualCurso(null);
    setIsChangingUniversity(false);
    setErro(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetTransientState();
    onOpenChange(nextOpen);
  }

  function trocarUniversidade() {
    setBusca("");
    setManualUni(null);
    setManualCurso(null);
    setIsChangingUniversity(true);
    setErro(null);
  }

  function selecionarUniversidade(nextUni: { sigla: string; uf: string; nome: string }) {
    setManualUni(nextUni);
    setManualCurso(null);
    setIsChangingUniversity(true);
    setErro(null);
  }

  function selecionarCurso(nextCurso: { curso: string; nota_corte: number }) {
    setManualCurso(nextCurso);
    setErro(null);
  }

  async function salvar() {
    if (!uni || !curso) return;
    setErro(null);
    try {
      await mutateAsync({ sigla: uni.sigla, uf: uni.uf, curso: curso.curso });
      onSaved();
      handleOpenChange(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>🎯 Defina sua meta SISU</DialogTitle></DialogHeader>
        <DialogDescription className="sr-only">Escolha sua universidade e curso para definir sua meta SISU.</DialogDescription>
        {!uni ? (
          <div className="space-y-2">
            <Input placeholder="Buscar universidade…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <ul className="max-h-64 overflow-auto space-y-1">
              {unisFiltradas.map((u) => (
                <li key={`${u.sigla}-${u.uf}`}>
                  <button type="button" data-testid={`pick-uni-${u.sigla}`}
                    onClick={() => selecionarUniversidade(u)}
                    className="w-full rounded-lg border p-2 text-left text-sm hover:bg-muted">
                    <span className="font-bold">{u.sigla}</span> · {u.uf} <span className="text-muted-foreground">— {u.nome}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <button type="button" onClick={trocarUniversidade} className="text-xs text-muted-foreground">← trocar universidade ({uni.sigla})</button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Ranking por nota de corte
              </p>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                {uni.nome} · {uni.uf}
              </p>
            </div>
            <ul className="max-h-64 overflow-auto space-y-1">
              {cursos.map((c) => {
                const selected = curso?.curso === c.curso;
                return (
                  <li key={c.curso}>
                    <button type="button" data-testid={`pick-curso-${c.curso}`}
                      onClick={() => selecionarCurso(c)}
                      className={`flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      }`}>
                      <span className="font-bold">{c.curso}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {Math.round(c.nota_corte)} pts
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {curso && (
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-sm">Meta: <b>{curso.curso}</b> · {uni.sigla}/{uni.uf}</p>
                <p className="text-xs text-muted-foreground">Nota de corte: {Math.round(curso.nota_corte)} pts</p>
                {erro && <p role="alert" className="mt-2 text-xs text-red-600">{erro}</p>}
                <Button onClick={salvar} disabled={isPending} className="mt-3 w-full">
                  {isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
