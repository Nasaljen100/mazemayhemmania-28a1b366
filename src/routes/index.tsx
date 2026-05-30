import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@/components/ClientOnly";
import App from "@/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maze Mayhem Mania" },
      { name: "description", content: "A pixel-perfect chaos platformer with daily AI-validated levels." },
      { property: "og:title", content: "Maze Mayhem Mania" },
      { property: "og:description", content: "A pixel-perfect chaos platformer with daily AI-validated levels." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly
      fallback={
        <div style={{ width: "100vw", height: "100vh", background: "#000", color: "#55ff22", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Courier New, monospace" }}>
          Loading…
        </div>
      }
    >
      <App />
    </ClientOnly>
  );
}
