// Entry for the published static preview: fonts come from a Google Fonts
// <link> in the page (the artifact CSP allows only that host), data from the
// in-browser engine (VITE_STATIC=1).
import "../ds/tokens.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
