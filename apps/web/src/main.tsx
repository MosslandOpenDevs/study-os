import { productVision } from "@study-os/core";
import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 32, maxWidth: 860, margin: "0 auto" }}>
      <h1>study-os</h1>
      <p
        style={{
          display: "inline-block",
          padding: "2px 10px",
          borderRadius: 6,
          background: "#fdecc8",
          color: "#7a4f01",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Experimental · pre-alpha scaffold
      </p>
      <p>{productVision}</p>
      <section>
        <h2>Target remediation loop</h2>
        <ol>
          <li>Turn source material into evidence-linked study units</li>
          <li>Generate grounded questions from those units</li>
          <li>
            On a wrong answer, attribute the error to a cause (model proposes, learner confirms)
          </li>
          <li>Prescribe a cause-specific intervention and a transfer question</li>
          <li>Schedule review and measure whether the error recurs</li>
        </ol>
        <p style={{ color: "#666", fontSize: 13 }}>
          This is the intended direction, not current behavior. See the README for what actually
          runs today.
        </p>
      </section>
    </main>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
