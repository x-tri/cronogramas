import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useStudentPdfs } from "./useStudentPdfs";

interface PdfRow {
  readonly id: string;
  readonly tipo: string;
  readonly filename: string;
  readonly storage_path: string;
  readonly file_size: number | null;
  readonly created_at: string | null;
}

let pdfRows: PdfRow[] = [];
let signedError: { message: string } | null = null;

const supabaseMocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: pdfRows, error: null })),
          })),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: supabaseMocks.createSignedUrl,
      })),
    },
  },
}));

function wrapper({ children }: { readonly children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function Probe() {
  const { data, isLoading } = useStudentPdfs("214140125");
  if (isLoading) return <div>loading</div>;
  return <pre data-testid="payload">{JSON.stringify(data)}</pre>;
}

describe("useStudentPdfs", () => {
  beforeEach(() => {
    pdfRows = [
      {
        id: "pdf-1",
        tipo: "caderno_questoes",
        filename: "caderno.pdf",
        storage_path: "school/C/caderno.pdf",
        file_size: 123,
        created_at: "2026-05-20T00:00:00Z",
      },
    ];
    signedError = null;
    supabaseMocks.createSignedUrl.mockReset();
    supabaseMocks.createSignedUrl.mockImplementation(() =>
      Promise.resolve(
        signedError
          ? { data: null, error: signedError }
          : { data: { signedUrl: "https://signed.local/pdf" }, error: null },
      ),
    );
  });

  it("retorna PDF com URL assinada quando storage permite acesso", async () => {
    render(<Probe />, { wrapper });

    const payload = await screen.findByTestId("payload");

    expect(payload.textContent).toContain("https://signed.local/pdf");
    expect(supabaseMocks.createSignedUrl).toHaveBeenCalledWith("school/C/caderno.pdf", 3600, {
      download: "caderno.pdf",
    });
  });

  it("mantem o PDF visivel mesmo quando a signed URL falha", async () => {
    signedError = { message: "new row violates row-level security policy" };

    render(<Probe />, { wrapper });

    const payload = await screen.findByTestId("payload");

    expect(payload.textContent).toContain("caderno.pdf");
    expect(payload.textContent).toContain('"url":null');
  });
});
