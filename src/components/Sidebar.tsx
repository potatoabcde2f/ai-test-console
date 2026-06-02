import type { NavKey } from "../types";

const ITEMS: { key: NavKey; label: string; icon: string }[] = [
  { key: "dialogue", label: "原始对话测试", icon: "◆" },
  { key: "prompts", label: "提示词存储", icon: "≡" },
  { key: "conversations", label: "对话结果存储", icon: "☰" },
  { key: "images", label: "生图结果存储", icon: "▣" },
  { key: "batchTest", label: "批量测试", icon: "▸" },
  { key: "intentTest", label: "意图识别测试", icon: "◎" },
  { key: "questionBank", label: "问题库管理", icon: "?" },
  { key: "apiVisualizer", label: "API 可视化", icon: "◈" },
  { key: "imageUpload", label: "图床测试", icon: "📤" },
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
        <p>对话 · 生图白盒 · 提示词版本 · OMS 存档 · 多模型对比</p>
      </div>
      <nav style={{ flex: 1 }}>
        {ITEMS.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`nav-btn${active === it.key ? " active" : ""}`}
            onClick={() => onNavigate(it.key)}
          >
            <span style={{ opacity: 0.75, fontSize: "0.75rem" }}>{it.icon}</span>
            {it.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: "0.5rem 0.65rem 0", fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
        Demo 数据保存在本机 localStorage。生产环境请接后端与权限。
      </div>
    </aside>
  );
}
