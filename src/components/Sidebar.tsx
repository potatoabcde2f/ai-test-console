import type { NavKey } from "../types";
import { PERSISTENCE_KEY } from "../lib/storage";

const ITEMS: { key: NavKey; label: string; icon: string }[] = [
  { key: "platformIntro", label: "平台介绍", icon: "📖" },
  { key: "dialogue", label: "原始对话测试", icon: "💬" },
  { key: "prompts", label: "提示词存储", icon: "📝" },
  { key: "conversations", label: "对话结果存储", icon: "📂" },
  { key: "images", label: "生图结果存储", icon: "🖼️" },
  { key: "batchTest", label: "批量测试", icon: "⚡" },
  { key: "intentTest", label: "意图识别测试", icon: "🎯" },
  { key: "questionBank", label: "问题库管理", icon: "📚" },
];

interface Props {
  active: NavKey;
  onNavigate: (k: NavKey) => void;
}

export function Sidebar({ active, onNavigate }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>AI 测试后台</h1>
      </div>
      <nav style={{ flex: 1 }}>
        {ITEMS.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`nav-btn${active === it.key ? " active" : ""}`}
            onClick={() => onNavigate(it.key)}
          >
            <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
      <div style={{ padding: "0.5rem 0.65rem 0", fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
        Demo 数据保存在本机 localStorage。生产环境请接后端与权限。
      </div>

      {/* 数据导入导出 */}
      <div style={{ padding: "0.75rem 0.65rem", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 8 }}>数据管理</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="btn"
            style={{ fontSize: "0.7rem", padding: "4px 8px", flex: 1 }}
            onClick={() => {
              const data = localStorage.getItem(PERSISTENCE_KEY);
              if (!data) {
                alert("暂无数据可导出");
                return;
              }
              const blob = new Blob([data], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `ai-console-data-${new Date().toISOString().slice(0, 10)}.json`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
          >
            ⬇️ 导出数据
          </button>
          <button
            type="button"
            className="btn"
            style={{ fontSize: "0.7rem", padding: "4px 8px", flex: 1 }}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const data = event.target?.result as string;
                    JSON.parse(data); // 验证 JSON
                    if (confirm("导入数据将覆盖当前所有数据，确定继续吗？")) {
                      localStorage.setItem(PERSISTENCE_KEY, data);
                      alert("数据导入成功，页面将刷新");
                      window.location.reload();
                    }
                  } catch (err) {
                    alert("文件格式错误，请导入有效的 JSON 文件");
                  }
                };
                reader.readAsText(file);
              };
              input.click();
            }}
          >
            ⬆️ 导入数据
          </button>
        </div>
      </div>
    </aside>
  );
}
