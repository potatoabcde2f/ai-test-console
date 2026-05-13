import { useMemo, useState, useCallback } from "react";
import type { CompareTask, CompareRound } from "../types";
import { MODEL_PRESETS } from "../lib/models";
import { mockAssistantReply } from "../lib/mockAI";
import { uid } from "../lib/ids";

interface Props {
  tasks: CompareTask[];
  onChangeTasks: (updater: (prev: CompareTask[]) => CompareTask[]) => void;
}

const DEFAULT_MODEL_IDS = ["gpt-4o", "gpt-4o-mini", "o3-mini"];

export function ModelCompareView({ tasks, onChangeTasks }: Props) {
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSystemPrompt, setFormSystemPrompt] = useState("你是严谨的评测助手，请直接回答用户问题。");
  const [formModelIds, setFormModelIds] = useState<string[]>(DEFAULT_MODEL_IDS);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  // 弹窗详情
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [roundInput, setRoundInput] = useState("");

  const selectableModels = useMemo(() => MODEL_PRESETS, []);

  const toggleModel = (id: string) => {
    setFormModelIds((prev) => {
      const set = new Set(prev);
      if (set.has(id)) {
        if (set.size <= 2) return prev;
        set.delete(id);
      } else {
        if (set.size >= 4) return prev;
        set.add(id);
      }
      return [...set];
    });
  };

  const createTask = () => {
    if (!formName.trim()) {
      window.alert("请填写任务名称");
      return;
    }
    if (formModelIds.length < 2) {
      window.alert("请至少选择2个模型");
      return;
    }
    const t: CompareTask = {
      id: uid("cmp"),
      name: formName.trim(),
      systemPrompt: formSystemPrompt.trim(),
      modelIds: formModelIds,
      status: "running",
      rounds: [],
      createdAt: Date.now(),
    };
    onChangeTasks((prev) => [t, ...prev]);
    setFormName("");
    setFormSystemPrompt("你是严谨的评测助手，请直接回答用户问题。");
    setFormModelIds(DEFAULT_MODEL_IDS);
    setCreating(false);
    openModal(t.id);
  };

  const openModal = (taskId: string) => {
    setModalTaskId(taskId);
    setRoundInput("");
  };

  const closeModal = () => {
    setModalTaskId(null);
    setRoundInput("");
  };

  const runRound = async (task: CompareTask) => {
    const userPrompt = roundInput.trim();
    if (!userPrompt) {
      window.alert("请输入用户提示词");
      return;
    }
    setBusyTaskId(task.id);
    const userMsg = {
      id: uid("msg"),
      role: "user" as const,
      content: userPrompt,
      createdAt: Date.now(),
    };
    try {
      const outs = await Promise.all(
        task.modelIds.map(async (mid) => {
          const model = MODEL_PRESETS.find((m) => m.id === mid)!;
          const r = await mockAssistantReply({
            model,
            systemPrompt: task.systemPrompt,
            userProfile: "（对比任务：无用户画像）",
            visibleMessages: [userMsg],
            fewShot: null,
          });
          return [mid, { content: r.content, score: null }] as const;
        })
      );
      const results: CompareRound["results"] = {};
      for (const [mid, v] of outs) results[mid] = v;
      const round: CompareRound = {
        id: uid("rnd"),
        userPrompt,
        results,
        bestModelId: null,
        createdAt: Date.now(),
      };
      onChangeTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, rounds: [...t.rounds, round] } : t))
      );
      setRoundInput("");
    } catch (e) {
      console.error(e);
      window.alert("并行调用失败");
    } finally {
      setBusyTaskId(null);
    }
  };

  // 更新某轮的评分（自动保存）
  const updateRoundScore = useCallback((taskId: string, roundId: string, modelId: string, score: number | null) => {
    onChangeTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          rounds: t.rounds.map((r) =>
            r.id === roundId
              ? {
                  ...r,
                  results: {
                    ...r.results,
                    [modelId]: { ...r.results[modelId], score },
                  },
                }
              : r
          ),
        };
      })
    );
  }, [onChangeTasks]);

  // 选择最优模型（点击卡片）
  const selectBestModel = useCallback((taskId: string, roundId: string, modelId: string) => {
    onChangeTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          rounds: t.rounds.map((r) =>
            r.id === roundId ? { ...r, bestModelId: modelId } : r
          ),
        };
      })
    );
  }, [onChangeTasks]);

  const endTask = (task: CompareTask) => {
    if (task.rounds.length === 0) {
      window.alert("至少需要完成一轮测试才能结束任务");
      return;
    }
    const modelStats: Record<string, { totalScore: number; scoredRounds: number; avgScore: number | null; winCount: number }> = {};
    task.modelIds.forEach((mid) => {
      modelStats[mid] = { totalScore: 0, scoredRounds: 0, avgScore: null, winCount: 0 };
    });
    task.rounds.forEach((r) => {
      Object.entries(r.results).forEach(([mid, res]) => {
        if (res.score != null) {
          modelStats[mid].totalScore += res.score;
          modelStats[mid].scoredRounds++;
        }
      });
      if (r.bestModelId) {
        modelStats[r.bestModelId].winCount++;
      }
    });
    Object.values(modelStats).forEach((stat) => {
      if (stat.scoredRounds > 0) {
        stat.avgScore = Math.round((stat.totalScore / stat.scoredRounds) * 10) / 10;
      }
    });
    let bestModelId: string | null = null;
    let bestScore = -1;
    let bestWins = -1;
    Object.entries(modelStats).forEach(([mid, stat]) => {
      const score = stat.avgScore ?? -1;
      const wins = stat.winCount;
      if (score > bestScore || (score === bestScore && wins > bestWins)) {
        bestScore = score;
        bestWins = wins;
        bestModelId = mid;
      }
    });
    onChangeTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: "completed",
              summary: {
                totalRounds: task.rounds.length,
                modelStats,
                bestModelId,
                endedAt: Date.now(),
              },
            }
          : t
      )
    );
    closeModal();
  };

  const deleteTask = (id: string) => {
    if (!window.confirm("确定删除此对比任务？")) return;
    onChangeTasks((prev) => prev.filter((t) => t.id !== id));
    if (modalTaskId === id) closeModal();
  };

  const getModelLabel = (id: string) => MODEL_PRESETS.find((m) => m.id === id)?.label ?? id;

  const modalTask = tasks.find((t) => t.id === modalTaskId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>生文模型对比</h2>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          配置系统提示词和模型，进行多轮对比测试。每轮输入用户提示词，并行调用各模型，人工评分并选出最优。结束后生成汇总报告。
        </p>
      </div>

      {/* 创建任务按钮 */}
      {!creating && (
        <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => setCreating(true)}>
          ＋ 新建对比任务
        </button>
      )}

      {/* 创建任务表单 */}
      {creating && (
        <div className="panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="label">新建对比任务</div>
          <input
            className="input"
            placeholder="任务名称"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <textarea
            className="textarea-field"
            rows={3}
            placeholder="系统提示词"
            value={formSystemPrompt}
            onChange={(e) => setFormSystemPrompt(e.target.value)}
          />
          <div>
            <div className="label">选择对比模型（2-4个）</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {selectableModels.map((m) => {
                const on = formModelIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="chip"
                    style={{ cursor: "pointer", borderColor: on ? "var(--accent)" : undefined }}
                  >
                    <input type="checkbox" checked={on} style={{ marginRight: 6 }} onChange={() => toggleModel(m.id)} />
                    {m.label}
                  </label>
                );
              })}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6 }}>
              已选：{formModelIds.map(getModelLabel).join(" / ")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={createTask}>
              开始任务
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      <div className="scroll-y" style={{ flex: 1 }}>
        <div className="label" style={{ marginBottom: 8 }}>任务列表</div>
        {tasks.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>暂无任务。点击上方按钮创建。</p>
        ) : (
          tasks.map((task) => {
            const isRunning = task.status === "running";
            const summary = task.summary;
            return (
              <div key={task.id} className="panel" style={{ padding: "1rem", marginBottom: 12 }}>
                {/* 任务概览 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <strong style={{ fontSize: "1rem" }}>{task.name}</strong>
                    <span
                      className="badge"
                      style={{
                        background: isRunning ? "rgba(37,99,235,0.1)" : "rgba(22,163,74,0.1)",
                        color: isRunning ? "var(--accent)" : "#16a34a",
                      }}
                    >
                      {isRunning ? "进行中" : "已完成"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {task.rounds.length} 轮 · {task.modelIds.length} 模型
                    </span>
                    {isRunning ? (
                      <button type="button" className="btn" onClick={() => openModal(task.id)}>
                        继续测试
                      </button>
                    ) : (
                      <button type="button" className="btn" onClick={() => openModal(task.id)}>
                        查看详情
                      </button>
                    )}
                    <button type="button" className="btn btn-danger" onClick={() => deleteTask(task.id)}>
                      删除
                    </button>
                  </div>
                </div>

                {/* 模型列表 */}
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 8 }}>
                  模型：{task.modelIds.map(getModelLabel).join(" / ")}
                </div>

                {/* 已完成任务摘要 */}
                {!isRunning && summary && (
                  <div
                    className="panel"
                    style={{
                      marginTop: 12,
                      padding: "0.75rem",
                      background: "var(--accent-soft)",
                      borderColor: "rgba(37,99,235,0.25)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>总轮数</span>
                        <div style={{ fontWeight: 700 }}>{summary.totalRounds}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>最优模型</span>
                        <div style={{ fontWeight: 700, color: "var(--accent)" }}>
                          {summary.bestModelId ? getModelLabel(summary.bestModelId) : "—"}
                        </div>
                      </div>
                      {Object.entries(summary.modelStats).map(([mid, s]) => (
                        <div key={mid}>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{getModelLabel(mid)}</span>
                          <div style={{ fontWeight: 600 }}>
                            均分{s.avgScore ?? "—"} · 胜{s.winCount}轮
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 8 }}>
                      结束时间：{new Date(summary.endedAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 详情弹窗 */}
      {modalTask && (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "90vw", maxWidth: 1200, maxHeight: "90vh" }}
          >
            <div className="modal-head">
              <div>
                <strong>{modalTask.name}</strong>
                <span
                  className="badge"
                  style={{
                    marginLeft: 12,
                    background: modalTask.status === "running" ? "rgba(37,99,235,0.1)" : "rgba(22,163,74,0.1)",
                    color: modalTask.status === "running" ? "var(--accent)" : "#16a34a",
                  }}
                >
                  {modalTask.status === "running" ? "进行中" : "已完成"}
                </span>
              </div>
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                关闭
              </button>
            </div>
            <div className="modal-body scroll-y">
              {/* 系统提示词 */}
              <div className="panel" style={{ padding: "0.75rem", marginBottom: 16, background: "var(--bg-subtle)" }}>
                <div className="label" style={{ marginBottom: 6 }}>系统提示词</div>
                <pre style={{ margin: 0, fontSize: "0.78rem", whiteSpace: "pre-wrap" }}>{modalTask.systemPrompt}</pre>
              </div>

              {/* 轮次列表 */}
              {modalTask.rounds.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="label" style={{ marginBottom: 12 }}>测试轮次（点击卡片选择最优）</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {modalTask.rounds.map((round, idx) => (
                      <div key={round.id} className="panel" style={{ padding: "0.85rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <strong>第 {idx + 1} 轮</strong>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                            {new Date(round.createdAt).toLocaleString("zh-CN")}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                            marginBottom: 12,
                            padding: "0.5rem",
                            background: "var(--bg-subtle)",
                            borderRadius: 6,
                          }}
                        >
                          用户提示词：{round.userPrompt}
                        </div>

                        {/* 各模型输出 - 点击卡片选择最优 */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${Math.min(modalTask.modelIds.length, 3)}, 1fr)`,
                            gap: 10,
                          }}
                        >
                          {modalTask.modelIds.map((mid) => {
                            const res = round.results[mid];
                            const isBest = round.bestModelId === mid;
                            const isRunning = modalTask.status === "running";
                            return (
                              <div
                                key={mid}
                                className="panel"
                                onClick={() => {
                                  if (isRunning) {
                                    selectBestModel(modalTask.id, round.id, mid);
                                  }
                                }}
                                style={{
                                  padding: "0.65rem",
                                  background: isBest ? "rgba(22,163,74,0.12)" : "var(--bg-subtle)",
                                  borderColor: isBest ? "rgba(22,163,74,0.5)" : "var(--border)",
                                  borderWidth: isBest ? "2px" : "1px",
                                  cursor: isRunning ? "pointer" : "default",
                                  transition: "all 0.2s",
                                  position: "relative",
                                }}
                              >
                                <div style={{ fontWeight: 700, fontSize: "0.8rem", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                  {getModelLabel(mid)}
                                  {isBest && (
                                    <span style={{ color: "#16a34a" }}>★ 最优</span>
                                  )}
                                </div>
                                <pre
                                  style={{
                                    margin: 0,
                                    whiteSpace: "pre-wrap",
                                    fontSize: "0.72rem",
                                    maxHeight: 200,
                                    overflow: "auto",
                                    marginBottom: 8,
                                  }}
                                >
                                  {res?.content ?? "—"}
                                </pre>

                                {/* 评分输入 */}
                                {isRunning && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>评分：</span>
                                    <input
                                      className="input"
                                      type="number"
                                      min={0}
                                      max={10}
                                      step={0.5}
                                      placeholder="0-10"
                                      value={res?.score ?? ""}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const score = raw === "" ? null : Number(raw);
                                        updateRoundScore(modalTask.id, round.id, mid, score);
                                      }}
                                      style={{ width: 70, fontSize: "0.78rem" }}
                                    />
                                  </div>
                                )}
                                {!isRunning && res?.score != null && (
                                  <div style={{ fontSize: "0.78rem", color: "var(--accent)" }}>分数：{res.score}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 进行中的任务：添加新轮次（放在下面） */}
              {modalTask.status === "running" && (
                <div style={{ marginBottom: 20, padding: "1rem", background: "var(--bg-subtle)", borderRadius: 8 }}>
                  <div className="label" style={{ marginBottom: 8 }}>
                    第 {modalTask.rounds.length + 1} 轮测试
                  </div>
                  <textarea
                    className="textarea-field"
                    rows={2}
                    placeholder="输入本轮用户提示词..."
                    value={roundInput}
                    onChange={(e) => setRoundInput(e.target.value)}
                    disabled={busyTaskId === modalTask.id}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyTaskId === modalTask.id}
                      onClick={() => runRound(modalTask)}
                    >
                      {busyTaskId === modalTask.id ? "生成中..." : "运行本轮"}
                    </button>
                  </div>
                </div>
              )}

              {/* 结束任务按钮 */}
              {modalTask.status === "running" && modalTask.rounds.length > 0 && (
                <div style={{ marginTop: 20, textAlign: "center" }}>
                  <button type="button" className="btn btn-primary" onClick={() => endTask(modalTask)}>
                    结束任务并生成报告
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
