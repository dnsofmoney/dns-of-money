import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { XamanProvider } from "./xaman/XamanProvider";
import { I18nProvider } from "./i18n";
import App from "./App";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element not found — index.html is missing <div id=\"root\">");
}

createRoot(rootEl).render(
  <StrictMode>
    <XamanProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </XamanProvider>
  </StrictMode>,
);
