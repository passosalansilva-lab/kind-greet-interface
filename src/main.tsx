import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupSupabaseFunctionAuthGuard } from "@/lib/supabaseFunctionGuard";
import { ThemeProvider } from "@/components/ThemeProvider";

// Configura o guard global para todas as chamadas supabase.functions.invoke
setupSupabaseFunctionAuthGuard();

// Register service worker for PWA and push notifications
if ("serviceWorker" in navigator) {
  // Flag to prevent infinite reload loops
  let isReloading = false;
  
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered:", registration.scope);

        // Força checagem de atualização ao carregar
        registration.update().catch(() => undefined);

        // Quando uma nova versão assumir o controle, recarrega a página (apenas uma vez)
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (isReloading) return;
          isReloading = true;
          window.location.reload();
        });

        // Quando achar update, manda o SW novo ativar imediatamente
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // nova versão pronta -> ativa sem esperar
              registration.waiting?.postMessage({ type: "SKIP_WAITING" });
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

