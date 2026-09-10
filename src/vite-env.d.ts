//Vite exposes env vars via import.meta.env, but by default TypeScript has no idea what keys exist on that object
//Tell it explicitly:

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// import.meta.env.VITE_SUPABASE_URL autocompletes and is typed as string, 
// and misspelling the variable name is a compile error instead of a silent undefined at runtime