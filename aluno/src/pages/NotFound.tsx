import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
    <div className="text-5xl mb-4">🧭</div>
    <h1 className="text-3xl font-black text-foreground mb-2">Página não encontrada</h1>
    <p className="text-sm font-semibold text-muted-foreground mb-6">
      Essa página não existe ou foi removida.
    </p>
    <Link
      to="/"
      className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow hover:bg-primary/90 transition-colors"
    >
      Voltar ao início
    </Link>
  </div>
);

export default NotFound;
