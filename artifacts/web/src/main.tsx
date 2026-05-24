import "./instrument"; // must be first — Sentry captures load-time errors
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
