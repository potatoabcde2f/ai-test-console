import { useState, useMemo } from "react";
import type { PromptTemplate, PromptCategoryConfig } from "../types";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [showCategoryManage, setShowCategoryManage] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  // 当前分类的提示词
  const filteredPrompts = useMemo(() =>
    prompts.filter((p) => p.category === activeTab),
    [prompts, activeTab]
  );

  // 当前选中的提示词
  const activePrompt = prompts.find((p) => p.id === activeId);

  // 当前分类
  const activeCategory = categories.find((c) => c.id === activeTab);

  // 切换分类
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const firstInTab = prompts.find((p) => p.category === tabId);
    if (firstInTab) {
      onSelect(firstInTab.id);
    }
    setEditingId(null);
  };

  // 开始编辑
  const handleEdit = () => {
    if (activePrompt) {
      setEditingId(activePrompt.id);
      setDraftContent(activePrompt.systemPrompt);
    }
  };

  // 重置
  const handleReset = () => {
    if (activePrompt) {
      setDraftContent(activePrompt.systemPrompt);
    }
  };

  // 使用当前版本（取消编辑）
  const handleUseCurrent = () => {
    setEditingId(null);
    setDraftContent("");
  };

  // 提交保存
  const handleSubmit = () => {
    if (editingId && draftContent.trim()) {
      onChange({ id: editingId, systemPrompt: draftContent.trim() });
      setEditingId(null);
      setDraftContent("");
    }
  };

  // 新建提示词
  const handleNewPrompt = () => {
    const prevIds = new Set(prompts.map((p) => p.id));
    onNew(activeTab);
    setTimeout(() => {
      const newPrompt = prompts.find((p) => !prevIds.has(p.id));
      if (newPrompt) {
        onSelect(newPrompt.id);
        setEditingId(newPrompt.id);
        setDraftContent(newPrompt.systemPrompt);
      }
    }, 0);
  };

  // 删除提示词
  const handleDeletePrompt = (id: string) => {
    if (window.confirm("确定删除这条提示词吗？")) {
      onDelete(id);
    }
  };

  // 添加分类
  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const newCategory: PromptCategoryConfig = {
      id: uid("cat"),
      name,
      desc: "",
      createdAt: Date.now(),
    };
    onChangeCategories([...categories, newCategory]);
    setNewCategoryName("");
    setActiveTab(newCategory.id);
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

  // 重命名分类
  const handleRenameCategory = (categoryId: string, newName: string) => {
    onChangeCategories(
      categories.map((c) => (c.id === categoryId ? { ...c, name: newName } : c))
    );
    setEditingCategory(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* 顶部 Tab 导航 */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-panel)"
      }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {categories.map((cat) => {
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleTabChange(cat.id)}
                style={{
                  padding: "6px 14px",
                  border: "none",
                  borderRadius: 6,
                  background: isActive ? "var(--accent)" : "transparent",
                  color: isActive ? "#fff" : "var(--text)",
                  fontSize: "0.85rem",
                  fontWeight: isActive ? 500 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowCategoryManage(!showCategoryManage)}
          style={{ fontSize: "0.8rem" }}
        >
          {showCategoryManage ? "完成" : "管理板块"}
        </button>
      </div>

      {/* 板块管理面板 */}
      {showCategoryManage && (
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-subtle)"
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              className="input"
              placeholder="新板块名称"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              style={{ flex: 1, maxWidth: 200 }}
            />
            <button type="button" className="btn btn-primary" onClick={handleAddCategory}>
              添加
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <div
                key={cat.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  background: "var(--bg-panel)",
                  borderRadius: 4,
                  border: "1px solid var(--border)"
                }}
              >
                {editingCategory === cat.id ? (
                  <input
                    className="input"
                    defaultValue={cat.name}
                    onBlur={(e) => handleRenameCategory(cat.id, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRenameCategory(cat.id, e.currentTarget.value)}
                    autoFocus
                    style={{ width: 80, fontSize: "0.8rem" }}
                  />
                ) : (
                  <span style={{ fontSize: "0.8rem" }}>{cat.name}</span>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEditingCategory(cat.id)}
                  style={{ fontSize: "0.7rem", padding: "2px 6px" }}
                >
                  重命名
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleDeleteCategory(cat.id)}
                  style={{ fontSize: "0.7rem", padding: "2px 6px" }}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* 左侧列表 */}
        <div style={{
          width: 240,
          borderRight: "1px solid var(--border)",
          background: "var(--bg-panel)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
              {activeCategory?.name}
            </span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNewPrompt}
              style={{ fontSize: "0.75rem", padding: "4px 10px" }}
            >
              + 新建
            </button>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {filteredPrompts.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onSelect(p.id);
                  setEditingId(null);
                }}
                style={{
                  padding: "10px 12px",
                  marginBottom: 4,
                  borderRadius: 6,
                  cursor: "pointer",
                  background: activeId === p.id ? "var(--accent-soft)" : "transparent",
                  borderLeft: activeId === p.id ? "3px solid var(--accent)" : "3px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                <div style={{
                  fontWeight: activeId === p.id ? 500 : 400,
                  fontSize: "0.85rem",
                  marginBottom: 4,
                  color: activeId === p.id ? "var(--accent)" : "var(--text)"
                }}>
                  {p.name}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  {formatTime(p.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧详情区 */}
        <div style={{ flex: 1, padding: 20, background: "var(--bg)", overflow: "auto" }}>
          {activePrompt ? (
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
              {/* 提示词标题 */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16
              }}>
                <input
                  className="input"
                  value={activePrompt.name}
                  onChange={(e) => onChange({ id: activePrompt.id, name: e.target.value })}
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    flex: 1,
                    marginRight: 12
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => onDuplicate(activePrompt.id)}
                  >
                    复制
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDeletePrompt(activePrompt.id)}
                  >
                    删除
                  </button>
                </div>
              </div>

              {/* 提示词内容卡片 */}
              <div style={{
                background: "#fff",
                borderRadius: 8,
                border: "1px solid var(--border)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                marginBottom: 16
              }}>
                {editingId === activePrompt.id ? (
                  <textarea
                    className="textarea-field"
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: 400,
                      padding: 16,
                      border: "none",
                      borderRadius: 8,
                      fontSize: "0.9rem",
                      lineHeight: 1.6,
                      fontFamily: 'var(--font-mono), ui-monospace, monospace',
                      resize: "vertical",
                      outline: "none"
                    }}
                  />
                ) : (
                  <div style={{
                    padding: 16,
                    minHeight: 400,
                    fontSize: "0.9rem",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    fontFamily: 'var(--font-mono), ui-monospace, monospace',
                    color: "var(--text)"
                  }}>
                    {activePrompt.systemPrompt}
                  </div>
                )}
              </div>

              {/* 底部按钮 */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                {editingId === activePrompt.id ? (
                  <>
                    <button
                      type="button"
                      className="btn"
                      onClick={handleReset}
                    >
                      重置
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleUseCurrent}
                    >
                      使用当前版本
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSubmit}
                    >
                      提交
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleEdit}
                  >
                    编辑
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-muted)"
            }}>
              请选择一条提示词
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
