import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";

// 错误处理，帮助调试白屏问题
window.onerror = function(msg, url, line, col, error) {
  console.error('Global error:', msg, url, line, col, error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding: 20px; color: red;">
      <h3>JavaScript Error:</h3>
      <pre>${msg}</pre>
      <p>Line: ${line}, Col: ${col}</p>
      <p>File: ${url}</p>
    </div>`;
  }
  return false;
};

const root = document.getElementById("root");
if (!root) {
  document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: root element not found</div>';
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
