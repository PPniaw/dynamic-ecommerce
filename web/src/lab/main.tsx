import "../ds/tokens.css";
import { createRoot } from "react-dom/client";
import { Lab } from "./Lab";

document.body.style.margin = "0";
createRoot(document.getElementById("root")!).render(<Lab />);
