/**
 * vitest-only stub for the `server-only` marker package.
 * The real package throws when imported outside React Server Components;
 * unit tests alias `server-only` to this no-op (see vitest.config.ts).
 * Never imported at runtime by the app.
 */
export {};
