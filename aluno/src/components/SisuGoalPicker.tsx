import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSisuUniversidades, useSisuCursos } from "@/hooks/useSisuCatalogo";
import { useSetSisuGoal } from "@/hooks/useSetSisuGoal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string | undefined;
  onSaved: () => void;
}

export function SisuGoalPicker({ open, onOpenChange, studentId, onSaved }: Props) {
  const [busca, setBusca] = useState("");
  const [uni, setUni] = useState<{ sigla: string; uf: string; nome: string } | null>(null);
  const [curso, setCurso] = useState<{ curso: string; nota_corte: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data: unis = [] } = useSisuUniversidades();
  const { data: cursos = [] } = useSisuCursos(uni?.sigla, uni?.uf);
  const { mutateAsync, isPending } = useSetSisuGoal(studentId);

  const unisFiltradas = useMemo(
    () => unis.filter((u) => `${u.nome} ${u.sigla}`.toLowerCase().includes(busca.toLowerCase())),
    [unis, busca],
  );

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
                    onClick={() => { setUni(u); setCurso(null); }}
                    className="w-full rounded-lg border p-2 text-left text-sm hover:bg-muted">
                    <span className="font-bold">{u.sigla}</span> · {u.uf} <span className="text-muted-foreground">— {u.nome}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : !curso ? (
          <div className="space-y-2">
            <button type="button" onClick={() => setUni(null)} className="text-xs text-muted-foreground">← trocar universidade ({uni.sigla})</button>
            <ul className="max-h-64 overflow-auto space-y-1">
              {cursos.map((c) => (
                <li key={c.curso}>
                  <button type="button" data-testid={`pick-curso-${c.curso}`}
                    onClick={() => setCurso(c)}
                    className="flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm hover:bg-muted">
                    <span className="font-bold">{c.curso}</span>
                    <span className="font-mono text-xs text-muted-foreground">{Math.round(c.nota_corte)} pts</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">Meta: <b>{curso.curso}</b> · {uni.sigla}/{uni.uf}</p>
            <p className="text-xs text-muted-foreground">Nota de corte: {Math.round(curso.nota_corte)} pts</p>
            {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurso(null)} className="flex-1">Voltar</Button>
              <Button onClick={salvar} disabled={isPending} className="flex-1">{isPending ? "Salvando…" : "Salvar"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
