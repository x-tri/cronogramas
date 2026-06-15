import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SisuGoalPicker } from "./SisuGoalPicker";

const mutateAsync = vi.fn(() => Promise.resolve(null));
vi.mock("@/hooks/useSisuCatalogo", () => ({
  useSisuUniversidades: () => ({ data: [{ sigla: "UFRN", uf: "RN", nome: "UFRN" }], isLoading: false }),
  useSisuCursos: (sigla?: string) => ({
    data: sigla ? [{ curso: "Medicina", nota_corte: 784 }] : [],
    isLoading: false,
  }),
}));
vi.mock("@/hooks/useSetSisuGoal", () => ({
  useSetSisuGoal: () => ({ mutateAsync, isPending: false }),
}));

describe("SisuGoalPicker", () => {
  it("seleciona uni → curso → salva chamando a mutation e o onSaved", async () => {
    const onSaved = vi.fn();
    render(<SisuGoalPicker open onOpenChange={() => {}} studentId="stu-1" onSaved={onSaved} />);
    fireEvent.click(screen.getByTestId("pick-uni-UFRN"));
    fireEvent.click(screen.getByTestId("pick-curso-Medicina"));
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ sigla: "UFRN", uf: "RN", curso: "Medicina" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
