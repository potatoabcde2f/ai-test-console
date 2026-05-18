import { useState, useCallback } from "react";
import type { PromptTemplate, PromptCategoryConfig } from "../types";

interface Props {
  prompts: PromptTemplate[];
  categories: PromptCategoryConfig[];
  activeId: string;
  onSelect: (id: string) => void;
  onChange: (patch: Partial<PromptTemplate> & { id: string }) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  return d.toLocaleDateString("zh-CN") + " " + d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function PromptPanel({
  prompts,
  categories,
  activeId,
  onSelect,
  onChange,
  onDuplicate,
  onDelete,
  onNew,
}: Props) {
  const p = prompts.find((x) => x.id === activeId);
  const categoryName = categories.find((c) => c.id === p?.category)?.name ?? "";

  // 编辑弹窗状态
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    promptId: string;
  } | null>(null);

  // 打开编辑弹窗
  const openEditModal = () => {
    if (!p) return;
    setEditName(p.name);
    setEditSystemPrompt(p.systemPrompt);
    setHasChanges(false);
    setIsEditModalOpen(true);
  };

  // 关闭编辑弹窗
  const closeEditModal = () => {
    setIsEditModalOpen(false);
  };

  // 保存编辑
  const handleSave = () => {
    if (!p) return;
    onChange({
      id: p.id,
      name: editName,
      systemPrompt: editSystemPrompt,
    });
    setHasChanges(false);
    closeEditModal();
  };

  // 重置编辑
  const handleReset = () => {
    if (!p) return;
    setEditName(p.name);
    setEditSystemPrompt(p.systemPrompt);
    setHasChanges(false);
  };

  // 名称变更
  const handleNameChange = (v: string) => {
    setEditName(v);
    setHasChanges(true);
  };

  // 内容变更
  const handlePromptChange = (v: string) => {
    setEditSystemPrompt(v);
    setHasChanges(true);
  };

  // 复制提示词内容到剪贴板
  const handleCopyPrompt = async () => {
    if (!p) return;
    const content = `名称：${p.name}\n\nSystem Prompt：\n${p.systemPrompt}`;
    try {
      await navigator.clipboard.writeText(content);
      window.alert("提示词内容已复制到剪贴板");
    } catch {
      window.alert("复制失败，请手动复制");
    }
  };

  // 删除
  const handleDelete = () => {
    if (!p) return;
    if (prompts.length <= 1) {
      window.alert("至少保留一个提示词模板");
      return;
    }
    if (window.confirm(`确定删除提示词「${p.name}」吗？`)) {
      onDelete(p.id);
    }
  };

  // 右键菜单处理
  const handleContextMenu = useCallback((e: React.MouseEvent, promptId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      promptId,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextAction = (action: "duplicate" | "delete") => {
    if (!contextMenu) return;
    if (action === "duplicate") {
      onDuplicate(contextMenu.promptId);
    } else if (action === "delete") {
      const targetPrompt = prompts.find((x) => x.id === contextMenu.promptId);
      if (targetPrompt && prompts.length > 1) {
        if (window.confirm(`确定删除提示词「${targetPrompt.name}」吗？`)) {
          onDelete(contextMenu.promptId);
        }
      } else {
        window.alert("至少保留一个提示词模板");
      }
    }
    closeContextMenu();
  };

  // 点击其他地方关闭菜单
  const handleDocumentClick = useCallback(() => {
    closeContextMenu();
  }, [closeContextMenu]);

  return (
    <div className="panel scroll-y" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>白盒 · 提示词</span>
          <button type="button" className="btn btn-primary" onClick={onNew}>
            ＋ 新建
          </button>
        </div>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
          切换模板即切换系统指令；编辑后需点击确认才生效。
        </p>
      </div>

      {/* 提示词列表 */}
      <div style={{ padding: "0.5rem", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
        {prompts.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => onSelect(x.id)}
            onContextMenu={(e) => handleContextMenu(e, x.id)}
            style={{
              textAlign: "left",
              padding: "0.5rem 0.65rem",
              borderRadius: 8,
              border: "1px solid",
              borderColor: x.id === activeId ? "rgba(37,99,235,0.35)" : "transparent",
              background: x.id === activeId ? "var(--accent-soft)" : "transparent",
              color: "var(--text)",
              fontSize: "0.85rem",
              fontWeight: x.id === activeId ? 600 : 500,
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{x.name}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 400 }}>
                {formatTime(x.updatedAt)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* 全局点击关闭右键菜单（先渲染，在底层） */}
      {contextMenu && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 2000 }}
          onClick={handleDocumentClick}
        />
      )}

      {/* 右键菜单（后渲染，在上层） */}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 2001,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            padding: "0.25rem 0",
            minWidth: 120,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start", padding: "0.5rem 0.75rem", border: "none" }}
            onClick={() => handleContextAction("duplicate")}
          >
            📋 创建副本
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              width: "100%",
              justifyContent: "flex-start",
              padding: "0.5rem 0.75rem",
              border: "none",
              color: "#dc2626",
            }}
            onClick={() => handleContextAction("delete")}
            disabled={prompts.length <= 1}
          >
            🗑️ 删除
          </button>
        </div>
      )}
      {p && (
        <div className="scroll-y" style={{ flex: 1, padding: "0.85rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* 提示词名称 */}
          <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)" }}>
            {p.name}
          </div>

          {/* 操作按钮 */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={openEditModal}>
              ✏️ 编辑
            </button>
            <button type="button" className="btn" onClick={handleCopyPrompt}>
              📋 复制提示词
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={prompts.length <= 1}
            >
              🗑️ 删除
            </button>
          </div>

          {/* 内容预览 */}
          <div style={{ flex: 1, minHeight: 200, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="label">System Prompt 预览</label>
              {categoryName && (
                <span className="chip" style={{ fontSize: "0.75rem" }}>
                  {categoryName}
                </span>
              )}
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 200,
                padding: "0.75rem",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontFamily: "var(--font-mono)",
                fontSize: "0.8rem",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflow: "auto",
              }}
            >
              {p.systemPrompt}
            </div>
          </div>

          {/* 说明文字 */}
          <div style={{ fontSize: "0.72rem", color: "var(--text)", padding: "0.6rem 0.75rem", background: "rgba(37,99,235,0.08)", borderRadius: 6, border: "1px solid rgba(37,99,235,0.2)" }}>
            <strong style={{ color: "var(--accent)" }}>操作说明：</strong>
            <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.2rem", color: "var(--text-muted)" }}>
              <li><strong>编辑</strong>：打开弹窗编辑提示词内容</li>
              <li><strong>复制提示词</strong>：复制当前提示词内容到剪贴板</li>
              <li><strong>删除</strong>：删除当前提示词（至少保留一个）</li>
              <li><strong>右键菜单</strong>：在提示词列表右键点击可快速创建副本/删除</li>
            </ul>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {isEditModalOpen && p && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
          }}
          onClick={closeEditModal}
        >
          <div
            style={{
              width: "min(800px, 90vw)",
              maxHeight: "min(600px, 90vh)",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: "1rem" }}>编辑提示词</span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "0.25rem 0.5rem", fontSize: "1.25rem", lineHeight: 1 }}
                onClick={closeEditModal}
              >
                ×
              </button>
            </div>

            {/* 弹窗内容 */}
            <div style={{ flex: 1, overflow: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="label">模板名称</label>
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="输入提示词名称"
                />
              </div>
              <div style={{ flex: 1, minHeight: 200, display: "flex", flexDirection: "column" }}>
                <label className="label">System Prompt</label>
                <textarea
                  className="textarea-field"
                  style={{ flex: 1, minHeight: 250, fontFamily: "var(--font-mono)", fontSize: "0.8rem", lineHeight: 1.5 }}
                  value={editSystemPrompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="输入系统提示词..."
                />
              </div>
            </div>

            {/* 弹窗底部按钮 */}
            <div
              style={{
                padding: "0.75rem 1.25rem",
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: 8,
                alignItems: "center",
                background: hasChanges ? "rgba(37,99,235,0.08)" : "var(--bg-subtle)",
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                disabled={!hasChanges}
                onClick={handleSave}
              >
                确认保存
              </button>
              <button
                type="button"
                className="btn"
                disabled={!hasChanges}
                onClick={handleReset}
              >
                重置
              </button>
              <button
                type="button"
                className="btn"
                onClick={closeEditModal}
              >
                取消
              </button>
              {hasChanges && (
                <span style={{ fontSize: "0.75rem", color: "var(--accent)", marginLeft: "auto" }}>
                  有未保存的更改
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 全局点击关闭右键菜单 */}
      {contextMenu && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 2000 }}
          onClick={handleDocumentClick}
        />
      )}
    </div>
  );
}
