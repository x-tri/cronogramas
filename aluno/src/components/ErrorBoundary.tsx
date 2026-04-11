import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallbackMessage?: string;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly errorMessage: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : "Erro inesperado";
    return { hasError: true, errorMessage: message };
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-bounce-in">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <p className="text-lg font-black text-foreground mb-1">
            Algo deu errado
          </p>
          <p className="text-sm font-semibold text-muted-foreground mb-4 max-w-xs">
            {this.props.fallbackMessage ??
              "Não foi possível carregar esta seção. Tente novamente."}
          </p>
          <Button
            onClick={this.handleRetry}
            variant="outline"
            className="rounded-xl font-bold gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
