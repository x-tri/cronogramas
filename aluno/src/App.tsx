import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import StudentLayout from "@/layouts/StudentLayout";
import Login from "@/pages/Login";
import Cronograma from "@/pages/Cronograma";
import Desempenho from "@/pages/Desempenho";
import Analise from "@/pages/Analise";
import Avisos from "@/pages/Avisos";
import Simulados from "@/pages/Simulados";
import SimuladoResponder from "@/pages/SimuladoResponder";
import SimuladoResultado from "@/pages/SimuladoResultado";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary fallbackMessage="O aplicativo encontrou um erro. Tente recarregar a página.">
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<StudentLayout />}>
                <Route path="/" element={<Cronograma />} />
                <Route path="/desempenho" element={<Desempenho />} />
                <Route path="/analise" element={<Analise />} />
                <Route path="/avisos" element={<Avisos />} />
                <Route path="/simulados" element={<Simulados />} />
                <Route path="/simulados/:id/responder" element={<SimuladoResponder />} />
                <Route path="/simulados/:id/resultado" element={<SimuladoResultado />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
