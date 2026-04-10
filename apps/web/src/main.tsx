import React from "react";
import ReactDOM from "react-dom/client";
import { productVision } from "@study-os/core";

function App() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 32, maxWidth: 860, margin: "0 auto" }}>
      <h1>study-os</h1>
      <p>{productVision}</p>
      <section>
        <h2>MVP loop</h2>
        <ol>
          <li>Upload study material</li>
          <li>Get Korean summary</li>
          <li>Generate quiz</li>
          <li>Save mistakes</li>
          <li>Review on schedule</li>
        </ol>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
