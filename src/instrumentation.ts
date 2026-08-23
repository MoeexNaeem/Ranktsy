/**
 * Next.js startup hook. `register()` runs in EVERY runtime (Node.js AND Edge), so
 * the Node-only crash handlers (process.on / process.exit) must NOT live here —
 * they'd be pulled into the Edge bundle and error at build. Per the Next docs we
 * conditionally import a Node-only module, which Turbopack tree-shakes out of the
 * Edge bundle. See src/instrumentation-node.ts for the actual handlers.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }
}
