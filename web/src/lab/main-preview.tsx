// Entry for the published preview: same lab, fonts from Google Fonts (linked
// in the page) instead of the bundled @fontsource files.
import "../ds/tokens.css";
import { createRoot } from "react-dom/client";
import { Lab } from "./Lab";

createRoot(document.getElementById("root")!).render(<Lab />);
