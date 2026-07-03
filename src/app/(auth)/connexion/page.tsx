"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, Truck, User } from "lucide-react";
import { clsx } from "clsx";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Role } from "@/lib/types";

const ROLES: { id: Role; label: string; desc: string; icon: React.ComponentType<{ className?: string }>; home: string }[] = [
  { id: "consumer", label: "Client", desc: "Commander un produit", icon: User, home: "/" },
  { id: "merchant", label: "Commerçant", desc: "Gérer mon commerce", icon: Store, home: "/commercant" },
  { id: "driver", label: "Livreur", desc: "Effectuer des livraisons", icon: Truck, home: "/livreur" },
];

function ConnexionForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<Role>("consumer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const homeFor = (r: Role) => ROLES.find((x) => x.id === r)?.home ?? "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Mode démonstration : pas de backend, on entre directement dans l'espace choisi.
    if (!isSupabaseConfigured) {
      router.push(params.get("redirect") || homeFor(role));
      return;
    }

    setLoading(true);
    const supabase = createClient()!;
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { role, full_name: fullName } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push(params.get("redirect") || homeFor(role));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>

      <div className="card-premium p-6">
        <h1 className="text-xl font-bold text-text">
          {mode === "signin" ? "Connexion" : "Créer un compte"}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {mode === "signin"
            ? "Accédez à votre espace Ma Zone."
            : "Rejoignez Ma Zone en quelques secondes."}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {ROLES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setRole(id)}
              className={clsx(
                "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors",
                role === id
                  ? "border-brand bg-brand-muted text-brand"
                  : "border-border text-text-secondary hover:bg-surface-tertiary"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Nom complet"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-brand focus:outline-none"
            />
          )}
          <input
            type="email"
            required={isSupabaseConfigured}
            placeholder="Adresse e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-brand focus:outline-none"
          />
          <input
            type="password"
            required={isSupabaseConfigured}
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-brand focus:outline-none"
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading
              ? "Patientez..."
              : mode === "signin"
                ? "Se connecter"
                : "Créer mon compte"}
          </button>
        </form>

        {!isSupabaseConfigured && (
          <p className="mt-4 rounded-lg bg-surface-tertiary px-3 py-2 text-xs text-text-secondary">
            Mode démonstration : la connexion vous mène directement à l&apos;espace
            sélectionné, sans mot de passe.
          </p>
        )}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-sm text-text-secondary hover:text-brand"
        >
          {mode === "signin"
            ? "Pas encore de compte ? S'inscrire"
            : "Déjà inscrit ? Se connecter"}
        </button>
      </div>

      <Link
        href="/"
        className="mt-6 block text-center text-sm text-text-tertiary hover:text-text"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense>
      <ConnexionForm />
    </Suspense>
  );
}
