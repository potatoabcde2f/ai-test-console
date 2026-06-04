import { useState, useMemo, useCallback, useEffect } from "react";
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
  const [editingPromptName, setEditingPromptName] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  // 当前分类的提示词
  const filteredPrompts = useMemo(() =>
    prompts.filter((p) => p.category === activeTab),
    [prompts, activeTab]
  );

  // 当前选中的提示词 - 必须严格匹配id和category
  const activePrompt = useMemo(() => {
    return prompts.find((p) => p.id === activeId && p.category === activeTab);
  }, [prompts, activeId, activeTab]);

  // 生成下一个版本号 V1, V2...
  const getNextVersionName = useCallback(() => {
    const versionRegex = /^V(\d+)$/;
    const existingVersions = filteredPrompts
      .map((p) => {
        const match = p.name.match(versionRegex);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((v) => v > 0);
    const maxVersion = existingVersions.length > 0 ? Math.max(...existingVersions) : 0;
    return `V${maxVersion + 1}`;
  }, [filteredPrompts]);

  // 自动检测并命名新创建的提示词
  useEffect(() => {
    const unnamedPrompt = prompts.find((p) =>
      p.category === activeTab &&
      (p.name === "" || p.name === "未命名模板")
    );
    if (unnamedPrompt) {
      const autoName = getNextVersionName();
      onChange({ id: unnamedPrompt.id, name: autoName });
      onSelect(unnamedPrompt.id);
      // 自动进入编辑状态
      setEditingId(unnamedPrompt.id);
      setDraftContent("");
    }
  }, [prompts, activeTab, getNextVersionName, onChange, onSelect]);

  // 切换分类 - 删除未提交的版本（systemPrompt为空）
  const handleTabChange = (tabId: string) => {
    // 切换前删除当前选中的未提交版本（systemPrompt为空）
    if (activeId && activeTab) {
      const currentPrompt = prompts.find((p) => p.id === activeId && p.category === activeTab);
      if (currentPrompt && (!currentPrompt.systemPrompt || currentPrompt.systemPrompt === "")) {
        onDelete(currentPrompt.id);
      }
    }

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

  // 提交保存 - 必须输入内容才算成功
  const handleSubmit = () => {
    if (editingId && draftContent.trim()) {
      onChange({ id: editingId, systemPrompt: draftContent.trim(), updatedAt: Date.now() });
      setEditingId(null);
      setDraftContent("");
    } else {
      alert("请输入提示词内容");
    }
  };

  // 新建提示词 - 自动生成 V1, V2...（由 useEffect 处理命名）
  const handleNewPrompt = () => {
    onNew(activeTab);
  };

  // 删除提示词
  const handleDeletePrompt = (id: string) => {
    if (window.confirm("确定删除这条提示词吗？")) {
      onDelete(id);
    }
  };

  // 双击编辑名字
  const handleDoubleClick = (prompt: PromptTemplate) => {
    setEditingPromptName(prompt.id);
    setDraftName(prompt.name);
  };

  // 保存名字修改
  const handleSaveName = () => {
    if (editingPromptName && draftName.trim()) {
      onChange({ id: editingPromptName, name: draftName.trim() });
      setEditingPromptName(null);
      setDraftName("");
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
        <div style={{
          borderRight: "1px solid var(--border)",
          background: "var(--bg-panel)",
          display: "flex",
          flexDirection: "column",
          width: "100%"
        }}>
          {/* 横向版本列表 - 顶部直接是版本 */}
          <div style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-subtle)",
            alignItems: "center"
          }}>
            {filteredPrompts.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  // 如果要切换到不同版本
                  if (activeId && activeId !== p.id) {
                    // 先记录要删除的未提交版本ID（在onSelect之前）
                    const currentPrompt = prompts.find((cp) => cp.id === activeId && cp.category === activeTab);
                    const promptToDelete = currentPrompt && (!currentPrompt.systemPrompt || currentPrompt.systemPrompt === "")
                      ? currentPrompt.id
                      : null;

                    // 先选中目标版本
                    onSelect(p.id);
                    setEditingId(null);
                    setEditingPromptName(null);

                    // 然后再删除之前记录的未提交版本
                    if (promptToDelete) {
                      onDelete(promptToDelete);
                    }
                  } else {
                    // 同一版本，只选中
                    onSelect(p.id);
                    setEditingId(null);
                    setEditingPromptName(null);
                  }
                }}
                onDoubleClick={() => handleDoubleClick(p)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: activeId === p.id ? "var(--accent)" : "var(--bg-panel)",
                  color: activeId === p.id ? "#fff" : "var(--text)",
                  fontSize: "0.85rem",
                  fontWeight: activeId === p.id ? 500 : 400,
                  border: activeId === p.id ? "none" : "1px solid var(--border)",
                  transition: "all 0.15s",
                  position: "relative",
                }}
              >
                {editingPromptName === p.id ? (
                  <input
                    className="input"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") {
                        setEditingPromptName(null);
                        setDraftName("");
                      }
                    }}
                    autoFocus
                    style={{
                      width: 60,
                      fontSize: "0.8rem",
                      padding: "2px 4px",
                      margin: -2,
                      background: activeId === p.id ? "var(--accent)" : "var(--bg-panel)",
                      color: activeId === p.id ? "#fff" : "var(--text)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      outline: "none"
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span>{p.name}</span>
                )}
              </div>
            ))}
            {/* 新建按钮 */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNewPrompt}
              style={{ fontSize: "0.75rem", padding: "6px 12px", marginLeft: 8 }}
            >
              + 新建
            </button>
          </div>

          {/* 提示词内容区域 */}
          <div style={{ flex: 1, padding: 20, overflow: "auto", background: "var(--bg)" }}>
            {activePrompt ? (
              <div style={{ maxWidth: 900, margin: "0 auto" }}>
                {/* 提示词内容卡片 - 只展示内容 */}
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
                      <button type="button" className="btn" onClick={handleReset}>重置</button>
                      <button type="button" className="btn btn-secondary" onClick={handleUseCurrent}>使用当前版本</button>
                      <button type="button" className="btn btn-primary" onClick={handleSubmit}>提交</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn" onClick={() => onDuplicate(activePrompt.id)}>复制</button>
                      <button type="button" className="btn btn-danger" onClick={() => handleDeletePrompt(activePrompt.id)}>删除</button>
                      <button type="button" className="btn btn-primary" onClick={handleEdit}>编辑</button>
                    </>
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
                请选择一个版本
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
