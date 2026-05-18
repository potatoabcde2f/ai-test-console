import { useState } from "react";
import type { PromptTemplate, PromptCategoryConfig } from "../types";
import { PromptPanel } from "../components/PromptPanel";
import { uid } from "../lib/ids";

interface Props {
  prompts: PromptTemplate[];
  categories: PromptCategoryConfig[];
  activeId: string;
  onSelect: (id: string) => void;
  onChange: (patch: Partial<PromptTemplate> & { id: string }) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: (category?: string) => void;
  onChangeCategories: (categories: PromptCategoryConfig[]) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PromptStorageView({
  prompts,
  categories,
  activeId,
  onSelect,
  onChange,
  onDuplicate,
  onDelete,
  onNew,
  onChangeCategories,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>(categories[0]?.id ?? "");
  const [viewMode, setViewMode] = useState<"list" | "detail" | "categories">("list");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");

  // 过滤当前分类的提示词
  const filteredPrompts = prompts.filter((p) => p.category === activeTab);

  // 当前选中的提示词
  const activePrompt = prompts.find((p) => p.id === activeId);

  // 当前分类
  const activeCategory = categories.find((c) => c.id === activeTab);

  // 切换 Tab
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setViewMode("list");
    const firstInTab = prompts.find((p) => p.category === tabId);
    if (firstInTab) {
      onSelect(firstInTab.id);
    }
  };

  // 查看详情
  const handleViewDetail = (id: string) => {
    onSelect(id);
    setViewMode("detail");
  };

  // 添加新分类
  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const newCategory: PromptCategoryConfig = {
      id: uid("cat"),
      name,
      desc: newCategoryDesc.trim(),
      createdAt: Date.now(),
    };
    onChangeCategories([...categories, newCategory]);
    setNewCategoryName("");
    setNewCategoryDesc("");
    setActiveTab(newCategory.id);
    setViewMode("list");
  };

  // 删除分类
  const handleDeleteCategory = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;
    const promptsInCategory = prompts.filter((p) => p.category === categoryId).length;
    if (promptsInCategory > 0) {
      window.alert(`该板块下有 ${promptsInCategory} 条提示词，请先删除或移动这些提示词后再删除板块`);
      return;
    }
    if (!window.confirm(`确定删除板块「${category.name}」吗？`)) return;
    const newCategories = categories.filter((c) => c.id !== categoryId);
    onChangeCategories(newCategories);
    if (activeTab === categoryId) {
      setActiveTab(newCategories[0]?.id ?? "");
    }
  };

  // 更新分类
  const handleUpdateCategory = (categoryId: string, name: string, desc: string) => {
    onChangeCategories(
      categories.map((c) => (c.id === categoryId ? { ...c, name, desc } : c))
    );
    setEditingCategory(null);
  };

  if (viewMode === "categories") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>板块管理</h2>
          <button type="button" className="btn" onClick={() => setViewMode("list")}>
            ← 返回提示词列表
          </button>
        </div>

        {/* 添加新板块 */}
        <div className="panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 600 }}>添加新板块</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="板块名称"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              style={{ flex: 1, minWidth: 150 }}
            />
            <input
              className="input"
              placeholder="板块描述"
              value={newCategoryDesc}
              onChange={(e) => setNewCategoryDesc(e.target.value)}
              style={{ flex: 2, minWidth: 200 }}
            />
            <button type="button" className="btn btn-primary" onClick={handleAddCategory}>
              ＋ 添加板块
            </button>
          </div>
        </div>

        {/* 板块列表 */}
        <div className="panel" style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>现有板块</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {categories.map((cat) => {
              const count = prompts.filter((p) => p.category === cat.id).length;
              const isEditing = editingCategory === cat.id;

              if (isEditing) {
                return (
                  <div
                    key={cat.id}
                    className="panel"
                    style={{ padding: "0.75rem", display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <input
                      className="input"
                      defaultValue={cat.name}
                      onBlur={(e) => handleUpdateCategory(cat.id, e.target.value, cat.desc)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUpdateCategory(cat.id, e.currentTarget.value, cat.desc);
                        }
                        if (e.key === "Escape") {
                          setEditingCategory(null);
                        }
                      }}
                      autoFocus
                      style={{ flex: 1 }}
                    />
                    <input
                      className="input"
                      defaultValue={cat.desc}
                      onBlur={(e) => handleUpdateCategory(cat.id, cat.name, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUpdateCategory(cat.id, cat.name, e.currentTarget.value);
                        }
                        if (e.key === "Escape") {
                          setEditingCategory(null);
                        }
                      }}
                      style={{ flex: 2 }}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={cat.id}
                  className="panel"
                  style={{
                    padding: "0.75rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setActiveTab(cat.id);
                    setViewMode("list");
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{cat.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{cat.desc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {count} 条
                    </span>
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCategory(cat.id);
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: "0.7rem", padding: "2px 8px", color: "#dc2626" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(cat.id);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      {/* 顶部 Tab 导航 */}
      <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>提示词存储</h2>
          <button type="button" className="btn" onClick={() => setViewMode("categories")}>
            管理板块
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {categories.map((cat) => {
            const isActive = activeTab === cat.id;
            const count = prompts.filter((p) => p.category === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleTabChange(cat.id)}
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
                {cat.name}
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
          {activeCategory?.desc ?? "请选择板块"}
        </p>
      </div>

      {/* 内容区 */}
      {viewMode === "list" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 新建按钮 */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-primary" onClick={() => onNew(activeTab)}>
              ＋ 新建{activeCategory?.name ?? "提示词"}
            </button>
          </div>

          {/* 版本列表 */}
          <div className="panel" style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
            {filteredPrompts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                <p>暂无{activeCategory?.name ?? "提示词"}</p>
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
            <button type="button" className="btn btn-primary" onClick={() => onNew(activeTab)}>
              ＋ 新建版本
            </button>
          </div>

          {/* 详情面板 */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {activePrompt && activePrompt.category === activeTab ? (
              <PromptPanel
                prompts={filteredPrompts}
                categories={categories}
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
