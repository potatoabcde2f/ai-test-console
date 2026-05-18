import { useState } from "react";
import type { PromptTemplate, PromptCategory } from "../types";
import { PROMPT_CATEGORY_LABELS } from "../types";
import { PromptPanel } from "../components/PromptPanel";

interface Props {
  prompts: PromptTemplate[];
  activeId: string;
  onSelect: (id: string) => void;
  onChange: (patch: Partial<PromptTemplate> & { id: string }) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: (category?: PromptCategory) => void;
}

const CATEGORIES: { key: PromptCategory; label: string; desc: string }[] = [
  { key: "product", label: "产品介绍提示词", desc: "用于产品介绍、商品推荐等场景" },
  { key: "general", label: "通用提示词", desc: "通用对话、问答等基础场景" },
  { key: "intent", label: "意图识别提示词", desc: "用于识别用户意图、分类等" },
  { key: "image", label: "引导生图提示词", desc: "引导用户进行图像生成" },
];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PromptStorageView({
  prompts,
  activeId,
  onSelect,
  onChange,
  onDuplicate,
  onDelete,
  onNew,
}: Props) {
  const [activeTab, setActiveTab] = useState<PromptCategory>("product");
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");

  // 过滤当前分类的提示词
  const filteredPrompts = prompts.filter((p) => p.category === activeTab);

  // 当前选中的提示词
  const activePrompt = prompts.find((p) => p.id === activeId);

  // 切换 Tab 时自动选中该分类的第一个
  const handleTabChange = (tab: PromptCategory) => {
    setActiveTab(tab);
    setViewMode("list");
    const firstInTab = prompts.find((p) => p.category === tab);
    if (firstInTab) {
      onSelect(firstInTab.id);
    }
  };

  // 查看版本详情
  const handleViewDetail = (id: string) => {
    onSelect(id);
    setViewMode("detail");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      {/* 顶部 Tab 导航 */}
      <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        <h2 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>提示词存储</h2>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => {
            const isActive = activeTab === cat.key;
            const count = prompts.filter((p) => p.category === cat.key).length;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => handleTabChange(cat.key)}
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid",
                  borderColor: isActive ? "var(--accent)" : "var(--border)",
                  borderRadius: "6px 6px 0 0",
                  borderBottom: isActive ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: isActive ? "var(--accent-soft)" : "var(--bg-subtle)",
                  color: isActive ? "var(--accent)" : "var(--text)",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  position: "relative",
                  top: isActive ? 1 : 0,
                }}
              >
                {cat.label}
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: "0.75rem",
                    padding: "1px 6px",
                    borderRadius: 10,
                    background: isActive ? "var(--accent)" : "var(--border)",
                    color: isActive ? "#fff" : "var(--text-muted)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {CATEGORIES.find((c) => c.key === activeTab)?.desc}
        </p>
      </div>

      {/* 内容区 */}
      {viewMode === "list" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 新建按钮 */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNew(activeTab)}
            >
              ＋ 新建{PROMPT_CATEGORY_LABELS[activeTab].replace("提示词", "")}提示词
            </button>
          </div>

          {/* 版本列表 */}
          <div className="panel" style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
            {filteredPrompts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                <p>暂无{PROMPT_CATEGORY_LABELS[activeTab]}</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={() => onNew(activeTab)}
                >
                  创建第一个
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredPrompts
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleViewDetail(p.id)}
                      style={{
                        padding: "1rem",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        background: activeId === p.id ? "var(--accent-soft)" : "var(--bg)",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: 4 }}>
                          {p.name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          <span>✏️ 编辑于 {formatTime(p.updatedAt)}</span>
                          <span style={{ color: "var(--accent)" }}>点击查看详情</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn"
                        style={{ flexShrink: 0 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetail(p.id);
                        }}
                      >
                        查看详情
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 详情视图 - 使用 PromptPanel */
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          {/* 返回按钮 */}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn" onClick={() => setViewMode("list")}>
              ← 返回列表
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNew(activeTab)}
            >
              ＋ 新建版本
            </button>
          </div>

          {/* 详情面板 */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {activePrompt && activePrompt.category === activeTab ? (
              <PromptPanel
                prompts={filteredPrompts}
                activeId={activeId}
                onSelect={onSelect}
                onChange={onChange}
                onDuplicate={onDuplicate}
                onDelete={(id: string) => {
                  onDelete(id);
                  if (filteredPrompts.length <= 1) {
                    setViewMode("list");
                  }
                }}
                onNew={() => onNew(activeTab)}
              />
            ) : (
              <div className="panel" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                请选择一个提示词查看详情
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
