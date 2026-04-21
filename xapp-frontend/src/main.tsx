import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { XamanProvider } from "./xaman/XamanProvider";
import App from "./App";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element not found — index.html is missing <div id=\"root\">");
}

createRoot(rootEl).render(
  <StrictMode>
    <XamanProvider>
      <App />
    </XamanProvider>
  </StrictMode>,
);
