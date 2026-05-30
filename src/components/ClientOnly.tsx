import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders children only on the client.
 * The platformer uses canvas, window, AudioContext, and WebSocket at
 * mount time — none of those exist during TanStack Start's SSR pass.
 */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}