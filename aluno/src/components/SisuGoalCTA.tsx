import { useState } from "react";
import { SisuGoalPicker } from "./SisuGoalPicker";

export function SisuGoalCTA({ studentId, onSaved }: { studentId: string | undefined; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border-2 border-dashed bg-card p-4 text-center">
      <p className="text-sm font-black">🎯 Defina sua meta SISU</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Escolha seu curso e universidade pra ver quanto falta pra passar.
      </p>
      <button type="button" onClick={() => setOpen(true)}
        className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-black text-primary-foreground">
        Escolher meta
      </button>
      <SisuGoalPicker open={open} onOpenChange={setOpen} studentId={studentId} onSaved={onSaved} />
    </div>
  );
}
