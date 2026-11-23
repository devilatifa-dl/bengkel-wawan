import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@/index.css";
import App from "@/App";
import { initPWA } from "@/lib/pwa";

initPWA();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
