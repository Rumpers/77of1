import "./instrument"; // must be first — Sentry captures load-time errors
import '@fontsource-variable/inter';         // self-hosted — replaces Google Fonts CDN
import '@fontsource-variable/noto-sans-jp';  // CJK coverage — unicode-range subsetting loads lazily
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
