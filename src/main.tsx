import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupSupabaseFunctionAuthGuard } from "@/lib/supabaseFunctionGuard";
import { ThemeProvider } from "@/components/ThemeProvider";

// Configura o guard global para todas as chamadas supabase.functions.invoke
setupSupabaseFunctionAuthGuard();

// Register service worker for PWA and push notifications
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered:", registration.scope);

        // Check for updates periodically (not on every load to avoid loops)
        setTimeout(() => {
          registration.update().catch(() => undefined);
        }, 60000); // Check after 1 minute

        // Only reload if user explicitly confirms OR if there's an update waiting
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New version ready - activate on next natural page load
              console.log("New service worker version available");
            }
          });
        });
      })
      .catch((error) => {
        console.log("Service Worker registration failed:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);

