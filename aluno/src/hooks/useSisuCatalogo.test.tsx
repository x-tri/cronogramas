import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSisuUniversidades, useSisuCursos } from "./useSisuCatalogo";

const cursosRows = [
  { curso: "Medicina", nota_corte: 780, ano: 2025 },
  { curso: "Medicina", nota_corte: 784, ano: 2026 },
  { curso: "Direito", nota_corte: 699, ano: 2026 },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({
      data: [{ sigla: "UFRN", uf: "RN", nome: "Universidade Federal do Rio Grande do Norte" }],
      error: null,
    })),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: cursosRows, error: null })),
          })),
        })),
      })),
    })),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useSisuUniversidades", () => {
  it("retorna a lista de universidades da RPC", async () => {
    const { result } = renderHook(() => useSisuUniversidades(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data![0]).toMatchObject({ sigla: "UFRN", uf: "RN" });
  });
});

describe("useSisuCursos", () => {
  it("dedup por curso mantendo o ano mais recente", async () => {
    const { result } = renderHook(() => useSisuCursos("UFRN", "RN"), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const med = result.current.data!.find((c) => c.curso === "Medicina");
    expect(med?.nota_corte).toBe(784);
    expect(result.current.data).toHaveLength(2);
  });

  it("desabilitado sem sigla/uf", () => {
    const { result } = renderHook(() => useSisuCursos(undefined, undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
