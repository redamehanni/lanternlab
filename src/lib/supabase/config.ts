export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Indique si Supabase est configuré. Quand ce n'est pas le cas, l'application
 * fonctionne avec les données de démonstration (zone pilote Paris) afin de
 * rester déployable et navigable sans backend.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
