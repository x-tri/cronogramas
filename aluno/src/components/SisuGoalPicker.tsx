import { useEffect, useMemo, useRef, useState } from "react";
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
  const [uni, setUni] = useState<{ sigla: string; uf: string; nome: string } | null>(null);
  const [curso, setCurso] = useState<{ curso: string; nota_corte: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [needsGoalHydration, setNeedsGoalHydration] = useState(false);
  const [pendingCursoNome, setPendingCursoNome] = useState<string | null>(null);
  const openedRef = useRef(false);

  const { data: unis = [] } = useSisuUniversidades();
  const { data: cursos = [] } = useSisuCursos(uni?.sigla, uni?.uf);
  const { mutateAsync, isPending } = useSetSisuGoal(studentId);

  const unisFiltradas = useMemo(
    () => unis.filter((u) => `${u.nome} ${u.sigla}`.toLowerCase().includes(busca.toLowerCase())),
    [unis, busca],
  );

  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }

    if (openedRef.current) return;
    openedRef.current = true;

    const hasInitialGoal = Boolean(
      initialGoal?.sisu_curso_nome &&
      initialGoal.sisu_universidade &&
      initialGoal.sisu_uf,
    );

    setErro(null);
    setBusca("");
    setCurso(null);
    setPendingCursoNome(hasInitialGoal ? initialGoal?.sisu_curso_nome ?? null : null);
    setNeedsGoalHydration(hasInitialGoal);
    if (!hasInitialGoal) setUni(null);
  }, [
    initialGoal?.sisu_curso_nome,
    initialGoal?.sisu_uf,
    initialGoal?.sisu_universidade,
    open,
  ]);

  useEffect(() => {
    if (!open || !needsGoalHydration) return;

    const goalUni = normalizeKey(initialGoal?.sisu_universidade);
    const goalUf = normalizeKey(initialGoal?.sisu_uf);
    const hydratedUni = unis.find(
      (u) =>
        normalizeKey(u.uf) === goalUf &&
        (normalizeKey(u.sigla) === goalUni || normalizeKey(u.nome) === goalUni),
    );

    if (!hydratedUni) return;
    setUni(hydratedUni);
    setNeedsGoalHydration(false);
  }, [
    initialGoal?.sisu_uf,
    initialGoal?.sisu_universidade,
    needsGoalHydration,
    open,
    unis,
  ]);

  useEffect(() => {
    if (!open || !pendingCursoNome || curso || cursos.length === 0) return;

    const selectedCurso = cursos.find(
      (c) => normalizeKey(c.curso) === normalizeKey(pendingCursoNome),
    );

    if (selectedCurso) setCurso(selectedCurso);
    setPendingCursoNome(null);
  }, [curso, cursos, open, pendingCursoNome]);

  function trocarUniversidade() {
    setUni(null);
    setCurso(null);
    setPendingCursoNome(null);
    setNeedsGoalHydration(false);
  }

  function selecionarUniversidade(nextUni: { sigla: string; uf: string; nome: string }) {
    setUni(nextUni);
    setCurso(null);
    setPendingCursoNome(null);
    setNeedsGoalHydration(false);
  }

  async function salvar() {
    if (!uni || !curso) return;
    setErro(null);
    try {
      await mutateAsync({ sigla: uni.sigla, uf: uni.uf, curso: curso.curso });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                      onClick={() => setCurso(c)}
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
