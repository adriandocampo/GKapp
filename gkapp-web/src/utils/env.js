// Environment flags – Vite replaces import.meta.env.* at build time.
// In production, dead-code elimination strips all `if (isDev)` blocks.
export const isDev = import.meta.env.DEV === true;
export const isProd = import.meta.env.PROD === true;
