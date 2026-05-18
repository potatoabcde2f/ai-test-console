import type { ChatMessage, Evaluation, PromptTemplate } from "../types";
import { ChatArea } from "../components/ChatArea";
import { MODEL_PRESETS, IMAGE_GEN_MODELS } from "../lib/models";

interface Props {
  prompts: PromptTemplate[];
  activePromptId: string;
  onPromptChange: (id: string) => void;
  onOpenPromptLibrary: () => void;
  userProfile: string;
  onUserProfile: (v: string) => void;
  configLocked: boolean;
  configLockHint: string;
  messages: ChatMessage[];
  loading: boolean;
  input: string;
  onInput: (v: string) => void;
  onSend: () => void;
  onUploadImage: (file: File) => void;
  evaluation: Evaluation;
  onEvaluation: (p: Partial<Evaluation>) => void;
  onSaveToLibrary: () => void;
  canSaveToLibrary: boolean;
  // Memory
  memory: string;
  onMemory: (v: string) => void;
  // Models
  textModelId: string;
  onTextModelChange: (id: string) => void;
  imageModelId: string;
  onImageModelChange: (id: string) => void;
}

const TAG_PRESETS = ["幻觉", "语气", "合规", "长度", "格式", "拒答", "多轮记忆"];

export function DialogueTestView({
  prompts,
  activePromptId,
  onPromptChange,
  onOpenPromptLibrary,
  userProfile,
  onUserProfile,
  configLocked,
  configLockHint,
  messages,
  loading,
  input,
  onInput,
  onSend,
  onUploadImage,
  evaluation,
  onEvaluation,
  onSaveToLibrary,
  canSaveToLibrary,
  memory,
  onMemory,
  textModelId,
  onTextModelChange,
  imageModelId,
  onImageModelChange,
}: Props) {

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      {/* 顶部标题栏 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>原始对话测试</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            三栏布局：左侧配置 · 中间对话 · 右侧评测
          </p>
        </div>
        <button type="button" className="btn" onClick={onOpenPromptLibrary}>
          管理提示词版本
        </button>
      </div>

      {/* 三栏主体 */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 12, minHeight: 0, overflow: "hidden" }}>
        {/* 左侧：配置区 */}
        <div className="panel scroll-y" style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
            ⚙️ 配置区
          </div>

          {/* 提示词版本 */}
          <div>
            <label className="label">
              提示词版本
              {configLocked && <span className="chip" style={{ marginLeft: 8, fontSize: "0.7rem" }}>{configLockHint}</span>}
            </label>
            <select
              className="select"
              value={activePromptId}
              onChange={(e) => onPromptChange(e.target.value)}
              disabled={configLocked}
              style={{ opacity: configLocked ? 0.55 : 1 }}
            >
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 生文模型 */}
          <div>
            <label className="label">生文模型</label>
            <select
              className="select"
              value={textModelId}
              onChange={(e) => onTextModelChange(e.target.value)}
              disabled={configLocked}
              style={{ opacity: configLocked ? 0.55 : 1 }}
            >
              {MODEL_PRESETS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* 生图模型 */}
          <div>
            <label className="label">生图模型</label>
            <select
              className="select"
              value={imageModelId}
              onChange={(e) => onImageModelChange(e.target.value)}
              disabled={configLocked}
              style={{ opacity: configLocked ? 0.55 : 1 }}
            >
              {IMAGE_GEN_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* User Profile */}
          <div style={{ flex: 1, minHeight: 100, display: "flex", flexDirection: "column" }}>
            <label className="label">
              User Profile
              {configLocked && <span className="chip" style={{ marginLeft: 8, fontSize: "0.7rem" }}>{configLockHint}</span>}
            </label>
            <textarea
              className="textarea-field"
              style={{ flex: 1, minHeight: 120, fontSize: "0.78rem", lineHeight: 1.45, opacity: configLocked ? 0.55 : 1 }}
              value={userProfile}
              onChange={(e) => onUserProfile(e.target.value)}
              disabled={configLocked}
              placeholder="注入上下文 · 白盒可见"
            />
          </div>

          {/* Memory */}
          <div style={{ flex: 1, minHeight: 100, display: "flex", flexDirection: "column" }}>
            <label className="label">Memory</label>
            <textarea
              className="textarea-field"
              style={{ flex: 1, minHeight: 80, fontSize: "0.78rem", lineHeight: 1.45 }}
              value={memory}
              onChange={(e) => onMemory(e.target.value)}
              placeholder="多轮记忆 · 自动注入"
            />
          </div>
        </div>

        {/* 中间：对话区 */}
        <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
          <ChatArea
            messages={messages}
            loading={loading}
            input={input}
            onInput={onInput}
            onSend={onSend}
            onUploadImage={onUploadImage}
          />
        </div>

        {/* 右侧：评测区 */}
        <div className="panel scroll-y" style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
            📊 评测区
          </div>

          {/* 结论选择 - 带必选标识 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#dc2626", fontWeight: "bold" }}>*</span>
              结论（必选）
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(
                [
                  ["pass", "通过"],
                  ["fail", "不通过"],
                  ["pending", "待定"],
                ] as const
              ).map(([v, label]) => {
                const on = evaluation.verdict === v;
                const c = v === "pass" ? "#16a34a" : v === "fail" ? "#dc2626" : "#64748b";
                return (
                  <button
                    key={v}
                    type="button"
                    className="btn"
                    onClick={() => onEvaluation({ verdict: v })}
                    style={on ? { borderColor: c, color: c, background: `${c}14` } : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* 分数 */}
            <div>
              <label className="label">分数（0–10，可选）</label>
              <input
                className="input"
                type="number"
                min={0}
                max={10}
                step={0.5}
                placeholder="输入分数"
                value={evaluation.score ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  onEvaluation({ score: raw === "" ? null : Number(raw) });
                }}
              />
            </div>

            {/* 备注 */}
            <div>
              <label className="label">备注</label>
              <textarea
                className="textarea-field"
                rows={2}
                placeholder="评测备注..."
                value={evaluation.notes}
                onChange={(e) => onEvaluation({ notes: e.target.value })}
              />
            </div>

            {/* 优化点 */}
            <div>
              <label className="label">优化点</label>
              <textarea
                className="textarea-field"
                rows={2}
                placeholder="记录优化建议..."
                value={evaluation.optimizations}
                onChange={(e) => onEvaluation({ optimizations: e.target.value })}
              />
            </div>

            {/* 标签 */}
            <div>
              <label className="label">问题标签</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {TAG_PRESETS.map((t) => {
                  const on = evaluation.tags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className="chip"
                      onClick={() =>
                        on ? onEvaluation({ tags: evaluation.tags.filter((x) => x !== t) }) : onEvaluation({ tags: [...evaluation.tags, t] })
                      }
                      style={{
                        cursor: "pointer",
                        borderColor: on ? "rgba(37,99,235,0.4)" : undefined,
                        color: on ? "var(--accent)" : undefined,
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 保存到对话库按钮 */}
            <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%" }}
                onClick={onSaveToLibrary}
                disabled={!canSaveToLibrary}
              >
                💾 保存到对话库
              </button>
              {!canSaveToLibrary && (
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
                  需先选择结论（通过/不通过）才能保存
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
