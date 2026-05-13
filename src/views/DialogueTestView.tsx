import type { ChatMessage, Evaluation, PromptTemplate } from "../types";
import { ChatArea } from "../components/ChatArea";

interface Props {
  prompts: PromptTemplate[];
  activePromptId: string;
  onPromptChange: (id: string) => void;
  onOpenPromptLibrary: () => void;
  userProfile: string;
  onUserProfile: (v: string) => void;
  // 生文模型
  textModelId: string;
  onTextModelChange: (id: string) => void;
  // 生图模型
  imageModelId: string;
  onImageModelChange: (id: string) => void;
  modelLocked: boolean;
  modelLockHint: string;
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
}

const TAG_PRESETS = ["幻觉", "语气", "合规", "长度", "格式", "拒答", "多轮记忆"];

export function DialogueTestView({
  prompts,
  activePromptId,
  onPromptChange,
  onOpenPromptLibrary,
  userProfile,
  onUserProfile,
  textModelId,
  onTextModelChange,
  imageModelId,
  onImageModelChange,
  modelLocked,
  modelLockHint,
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
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>原始对话测试</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            网页端对话 · 历史同屏 · 模型与提示词 · 用户画像可编辑注入。有对话时不可切换模型；「保存到对话库」并评测（通过/不通过）后自动清空，方可进入新一轮并重新选模型。
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={onOpenPromptLibrary}>
            管理提示词版本
          </button>
          <button type="button" className="btn btn-primary" onClick={onSaveToLibrary} disabled={!canSaveToLibrary}>
            保存到对话库
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ flex: 1, minHeight: 0, alignItems: "stretch" }}>
        <div style={{ minHeight: 360, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <ChatArea
            textModelId={textModelId}
            imageModelId={imageModelId}
            onTextModelChange={onTextModelChange}
            onImageModelChange={onImageModelChange}
            modelLocked={modelLocked}
            modelLockHint={modelLockHint}
            messages={messages}
            loading={loading}
            input={input}
            onInput={onInput}
            onSend={onSend}
            onUploadImage={onUploadImage}
          />
        </div>

        <div className="panel scroll-y" style={{ padding: "0.85rem 1rem", display: "flex", flexDirection: "column", gap: "0.85rem", minHeight: 0 }}>
          {/* 上部：配置部分（对话开始时锁定） */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1, minHeight: 100, display: "flex", flexDirection: "column" }}>
              <label className="label">
                User Profile（注入上下文 · 白盒可见）
                {configLocked && <span className="chip" style={{ marginLeft: 8, fontSize: "0.7rem" }}>{configLockHint}</span>}
              </label>
              <textarea
                className="textarea-field"
                style={{ flex: 1, minHeight: 120, fontFamily: "var(--font-mono)", fontSize: "0.78rem", lineHeight: 1.45, opacity: configLocked ? 0.55 : 1 }}
                value={userProfile}
                onChange={(e) => onUserProfile(e.target.value)}
                disabled={configLocked}
              />
            </div>
          </div>

          {/* 中间：分割线 */}
          <hr style={{ margin: "0.5rem 0", border: "none", borderTop: "1px solid var(--border)" }} />

          {/* 下部：评测部分（始终可编辑） */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="label">评测（保存前须选择通过或不通过）</label>
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
            <input
              className="input"
              type="number"
              min={0}
              max={10}
              step={0.5}
              placeholder="分数 0–10（可选）"
              value={evaluation.score ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                onEvaluation({ score: raw === "" ? null : Number(raw) });
              }}
            />
            <textarea className="textarea-field" rows={2} placeholder="备注" value={evaluation.notes} onChange={(e) => onEvaluation({ notes: e.target.value })} />
            <textarea className="textarea-field" rows={2} placeholder="优化点" value={evaluation.optimizations} onChange={(e) => onEvaluation({ optimizations: e.target.value })} />
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
        </div>
      </div>
    </div>
  );
}
