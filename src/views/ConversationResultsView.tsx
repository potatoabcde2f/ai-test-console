import { useState } from "react";
import type { Evaluation, StoredConversation } from "../types";
import { MODEL_PRESETS } from "../lib/models";

interface Props {
  conversations: StoredConversation[];
  onUpdate: (id: string, evaluation: Evaluation) => void;
  onDelete: (id: string) => void;
}

function modelLabel(id: string) {
  return MODEL_PRESETS.find((m) => m.id === id)?.label ?? id;
}

function verdictLabel(v: string) {
  if (v === "pass") return "通过";
  if (v === "fail") return "不通过";
  return "待定";
}

const TAG_PRESETS = ["幻觉", "语气", "合规", "长度", "格式", "拒答", "多轮记忆"];

export function ConversationResultsView({ conversations, onUpdate, onDelete }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const cur = conversations.find((c) => c.id === openId);
  const [draft, setDraft] = useState<Evaluation | null>(null);

  const open = (id: string) => {
    const c = conversations.find((x) => x.id === id);
    setOpenId(id);
    setDraft(c ? { ...c.evaluation } : null);
  };

  const close = () => {
    setOpenId(null);
    setDraft(null);
  };

  const saveDraft = () => {
    if (openId && draft) {
      onUpdate(openId, draft);
      close();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>对话结果存储</h2>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          OMS 风格列表；点选一行查看单条对话、修改评分与优化点。
        </p>
      </div>
      <div className="table-wrap scroll-y" style={{ flex: 1 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>时间</th>
              <th>生文模型</th>
              <th>对话轮数</th>
              <th>提示词版本</th>
              <th>结论</th>
              <th>分数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {conversations.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  暂无存档。请在「原始对话测试」中点击「保存到对话库」。
                </td>
              </tr>
            ) : (
              conversations.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.title}</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {new Date(c.createdAt).toLocaleString("zh-CN")}
                  </td>
                  <td>{modelLabel(c.modelId)}</td>
                  <td>{Math.ceil(c.messages.length / 2)} 轮</td>
                  <td>{c.promptVersionName}</td>
                  <td>{verdictLabel(c.evaluation.verdict)}</td>
                  <td>{c.evaluation.score ?? "—"}</td>
                  <td>
                    <button type="button" className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem" }} onClick={() => open(c.id)}>
                      详情
                    </button>
                    <button type="button" className="btn btn-danger" style={{ padding: "0.25rem 0.5rem", marginLeft: 4 }} onClick={() => onDelete(c.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {cur && draft && (
        <div className="modal-backdrop" role="presentation" onClick={close}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <strong>{cur.title}</strong>
              <button type="button" className="btn btn-ghost" onClick={close}>
                关闭
              </button>
            </div>
            <div className="modal-body scroll-y">
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 12 }}>
                生文模型：{modelLabel(cur.modelId)} · 对话轮数：{Math.ceil(cur.messages.length / 2)} 轮 · 提示词：{cur.promptVersionName} · 消息数：{cur.messages.length}
              </div>
              <div className="panel" style={{ padding: "0.75rem", marginBottom: 12, maxHeight: 220, overflow: "auto" }}>
                <div className="label">System Prompt 快照</div>
                <pre style={{ margin: 0, fontSize: "0.72rem", whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)" }}>{cur.systemPromptContent || "（未记录）"}</pre>
              </div>
              <div className="panel" style={{ padding: "0.75rem", marginBottom: 12, maxHeight: 220, overflow: "auto" }}>
                <div className="label">User Profile 快照</div>
                <pre style={{ margin: 0, fontSize: "0.72rem", whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)" }}>{cur.userProfileSnapshot}</pre>
              </div>
              <div className="label">对话内容</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {cur.messages.map((m) => (
                  <div key={m.id} className="panel" style={{ padding: "0.5rem 0.65rem", background: m.role === "user" ? "var(--accent-soft)" : "var(--bg-subtle)" }}>
                    <span className="chip" style={{ marginBottom: 4 }}>
                      {m.role} {m.modelId ? `· ${m.modelId}` : ""}
                    </span>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.8rem", fontFamily: "var(--font-sans)" }}>{m.content}</pre>
                    {/* 图片渲染 */}
                    {m.images && m.images.length > 0 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {m.images.map((img, idx) => (
                          <div key={idx} style={{ position: "relative" }}>
                            <img
                              src={img.url}
                              alt={`图片 ${idx + 1}`}
                              style={{ maxWidth: 200, maxHeight: 150, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)" }}
                            />
                            <span style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              background: "rgba(0,0,0,0.7)",
                              color: "#fff",
                              fontSize: "0.7rem",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}>
                              {img.type === "upload" ? "📤 上传" : "🤖 生成"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="label">评测</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {(
                  [
                    ["pass", "通过"],
                    ["fail", "不通过"],
                    ["pending", "待定"],
                  ] as const
                ).map(([v, label]) => {
                  const on = draft.verdict === v;
                  const c = v === "pass" ? "#16a34a" : v === "fail" ? "#dc2626" : "#64748b";
                  return (
                    <button
                      key={v}
                      type="button"
                      className="btn"
                      onClick={() => setDraft({ ...draft, verdict: v })}
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
                placeholder="分数"
                value={draft.score ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDraft({ ...draft, score: raw === "" ? null : Number(raw) });
                }}
                style={{ marginBottom: 8 }}
              />
              <textarea className="textarea-field" rows={2} placeholder="备注" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} style={{ marginBottom: 8 }} />
              <textarea className="textarea-field" rows={2} placeholder="优化点" value={draft.optimizations} onChange={(e) => setDraft({ ...draft, optimizations: e.target.value })} style={{ marginBottom: 8 }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {TAG_PRESETS.map((t) => {
                  const on = draft.tags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className="chip"
                      onClick={() =>
                        on ? setDraft({ ...draft, tags: draft.tags.filter((x) => x !== t) }) : setDraft({ ...draft, tags: [...draft.tags, t] })
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
              <button type="button" className="btn btn-primary" onClick={saveDraft}>
                保存评测
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
