import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-secondary px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted">
        <Compass className="h-8 w-8 text-brand" />
      </div>
      <h1 className="text-2xl font-bold text-text">Page introuvable</h1>
      <p className="max-w-sm text-text-secondary">
        Cette page n&apos;existe pas ou le produit recherché n&apos;est plus disponible
        dans votre zone.
      </p>
      <Link href="/" className="btn-primary mt-2">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
