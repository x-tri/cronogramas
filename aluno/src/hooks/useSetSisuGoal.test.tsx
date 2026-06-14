import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSetSisuGoal } from "./useSetSisuGoal";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(() => Promise.resolve({
    data: [{ sisu_curso_nome: "Medicina", sisu_universidade: "UFRN", sisu_uf: "RN", sisu_nota_corte: 784 }],
    error: null,
  })),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useSetSisuGoal", () => {
  it("chama a RPC com os args e resolve", async () => {
    const { result } = renderHook(() => useSetSisuGoal("stu-1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ sigla: "UFRN", uf: "RN", curso: "Medicina" });
    });
    expect(rpc).toHaveBeenCalledWith("set_my_sisu_goal", { p_sigla: "UFRN", p_uf: "RN", p_curso: "Medicina" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
