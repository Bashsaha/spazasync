// No-op stub for the `server-only` package under vitest. The real package
// throws unless imported in a React Server bundler condition; aliased here
// (vitest.config.ts) so server modules guarded with `import 'server-only'`
// can still be unit-tested in the node/jsdom environment.
export {}
