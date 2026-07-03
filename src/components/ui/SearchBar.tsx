"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/recherche?q=${encodeURIComponent(q)}` : "/recherche");
  }

  return (
    <form onSubmit={submit} className="relative">
      <div className="input-search flex items-center gap-3 pr-28">
        <Search className="h-5 w-5 shrink-0 text-text-tertiary" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full bg-transparent text-text placeholder:text-text-tertiary focus:outline-none"
          aria-label="Rechercher un produit"
        />
      </div>
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-light"
      >
        Rechercher
      </button>
    </form>
  );
}
