import { useMemo, useState, useCallback } from "react";
import type {
  BatchTestTask,
  BatchTestRound,
  BatchTestResult,
  QuestionBank,
  PromptTemplate,
} from "../types";
import { MODEL_PRESETS } from "../lib/models";
import { mockAssistantReply } from "../lib/mockAI";
import { uid } from "../lib/ids";

interface Props {
  tasks: BatchTestTask[];
  onChangeTasks: (updater: (prev: BatchTestTask[]) => BatchTestTask[]) => void;
  questionBank: QuestionBank;
  prompts: PromptTemplate[];
}

const EMPTY_BANK: QuestionBank = {
  categories: [],
};

export function BatchTestView({ tasks, onChangeTasks, questionBank, prompts }: Props) {
  const bank = questionBank ?? EMPTY_BANK;

  // 创建任务相关状态
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formModelIds, setFormModelIds] = useState<string[]>(["gpt-4o"]);
  const [formPromptId, setFormPromptId] = useState("");
  const [formUserProfile, setFormUserProfile] = useState("");
  const [formMemory, setFormMemory] = useState("");

  // 任务详情/执行状态
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [runningRoundId, setRunningRoundId] = useState<string | null>(null);
  const [editingResult, setEditingResult] = useState<{ roundId: string; modelId: string } | null>(null);

  // 初始化默认值
  const activePrompt = useMemo(() => {
    return prompts.find((p) => p.id === formPromptId) ?? prompts[0];
  }, [formPromptId, prompts]);

  // 选中的分类
  const selectedCategory = useMemo(() => {
    return bank.categories.find((c) => c.id === formCategoryId);
  }, [bank.categories, formCategoryId]);

  const toggleModel = (id: string) => {
    setFormModelIds((prev) => {
      const set = new Set(prev);
      if (set.has(id)) {
        if (set.size <= 1) return prev;
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
    if (!formCategoryId) {
      window.alert("请选择问题分类");
      return;
    }
    if (formModelIds.length === 0) {
      window.alert("请至少选择1个模型");
      return;
    }
    if (!formPromptId) {
      window.alert("请选择提示词");
      return;
    }

    const category = bank.categories.find((c) => c.id === formCategoryId);
    if (!category || category.questions.length === 0) {
      window.alert("所选分类没有问题，请先添加问题");
      return;
    }

    const prompt = prompts.find((p) => p.id === formPromptId);
    if (!prompt) {
      window.alert("所选提示词不存在");
      return;
    }

    const task: BatchTestTask = {
      id: uid("bt"),
      name: formName.trim(),
      status: "running",
      questionCategoryId: formCategoryId,
      questionCount: category.questions.length,
      modelIds: formModelIds,
      promptId: formPromptId,
      systemPrompt: prompt.systemPrompt,
      userProfile: formUserProfile.trim(),
      memory: formMemory.trim(),
      rounds: [],
      createdAt: Date.now(),
    };

    onChangeTasks((prev) => [task, ...prev]);
    setFormName("");
    setFormCategoryId("");
    setFormModelIds(["gpt-4o"]);
    setFormPromptId("");
    setFormUserProfile("");
    setFormMemory("");
    setCreating(false);
    setActiveTaskId(task.id);
  };

  // 运行单个问题
  const runRound = async (task: BatchTestTask, questionIndex: number) => {
    const category = bank.categories.find((c) => c.id === task.questionCategoryId);
    if (!category) return;
    const question = category.questions[questionIndex];
    if (!question) return;

    setRunningRoundId(question.id);

    const userMsg = {
      id: uid("msg"),
      role: "user" as const,
      content: question.content,
      createdAt: Date.now(),
    };

    try {
      let mergedSystem = `${task.systemPrompt}\n\n--- User Profile ---\n${task.userProfile}`;
      if (task.memory) {
        mergedSystem = mergedSystem.concat(`\n\n--- Memory ---\n${task.memory}`);
      }

      const outs = await Promise.all(
        task.modelIds.map(async (mid) => {
          const model = MODEL_PRESETS.find((m) => m.id === mid)!;
          const r = await mockAssistantReply({
            model,
            systemPrompt: mergedSystem,
            userProfile: task.userProfile,
            visibleMessages: [userMsg],
            fewShot: null,
          });
          return [
            mid,
            {
              content: r.content,
              score: null,
              verdict: "pending",
              optimizationNotes: "",
              questionType: undefined,
              intent: undefined,
              imageGenPrompt: r.imageGen?.imagePrompt,
              createdAt: Date.now(),
            } as BatchTestResult,
          ] as const;
        })
      );

      const results: Record<string, BatchTestResult> = {};
      for (const [mid, v] of outs) results[mid] = v;

      const round: BatchTestRound = {
        id: uid("btr"),
        questionId: question.id,
        questionContent: question.content,
        results,
        bestModelId: null,
        createdAt: Date.now(),
      };

      onChangeTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, rounds: [...t.rounds, round] } : t))
      );
    } catch (e) {
      console.error(e);
      window.alert("运行失败");
    } finally {
      setRunningRoundId(null);
    }
  };

  // 批量运行所有未测试的问题
  const runAllRounds = async (task: BatchTestTask) => {
    const category = bank.categories.find((c) => c.id === task.questionCategoryId);
    if (!category) return;

    const testedQuestionIds = new Set(task.rounds.map((r) => r.questionId));
    const untestedQuestions = category.questions.filter((q) => !testedQuestionIds.has(q.id));

    if (untestedQuestions.length === 0) {
      window.alert("所有问题已测试完成");
      return;
    }

    for (let i = 0; i < untestedQuestions.length; i++) {
      const questionIndex = category.questions.findIndex((q) => q.id === untestedQuestions[i].id);
      if (questionIndex >= 0) {
        await runRound(task, questionIndex);
      }
    }
  };

  // 更新结果评分
  const updateResultScore = useCallback(
    (taskId: string, roundId: string, modelId: string, score: number | null) => {
      onChangeTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            rounds: t.rounds.map((r) =>
              r.id === roundId
                ? { ...r, results: { ...r.results, [modelId]: { ...r.results[modelId], score } } }
                : r
            ),
          };
        })
      );
    },
    [onChangeTasks]
  );

  // 更新优化备注
  const updateResultNotes = useCallback(
    (taskId: string, roundId: string, modelId: string, notes: string) => {
      onChangeTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            rounds: t.rounds.map((r) =>
              r.id === roundId
                ? {
                    ...r,
                    results: { ...r.results, [modelId]: { ...r.results[modelId], optimizationNotes: notes } },
                  }
                : r
            ),
          };
        })
      );
    },
    [onChangeTasks]
  );

  // 选择最优模型
  const selectBestModel = useCallback(
    (taskId: string, roundId: string, modelId: string) => {
      onChangeTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            rounds: t.rounds.map((r) => (r.id === roundId ? { ...r, bestModelId: modelId } : r)),
          };
        })
      );
    },
    [onChangeTasks]
  );

  // 结束任务
  const endTask = (task: BatchTestTask) => {
    if (task.rounds.length === 0) {
      window.alert("至少需要完成一轮测试才能结束任务");
      return;
    }

    const modelStats: Record<string, { totalScore: number; scoredRounds: number; avgScore: number | null; winCount: number }> = {};
    task.modelIds.forEach((mid) => {
      modelStats[mid] = { totalScore: 0, scoredRounds: 0, avgScore: null, winCount: 0 };
    });

    task.rounds.forEach((r) => {
      // 统计每个模型的评分
      Object.entries(r.results).forEach(([mid, res]) => {
        if (res.score != null) {
          modelStats[mid].totalScore += res.score;
          modelStats[mid].scoredRounds++;
        }
      });
      // 统计最优模型
      if (r.bestModelId && modelStats[r.bestModelId]) {
        modelStats[r.bestModelId].winCount++;
      }
    });

    Object.values(modelStats).forEach((stat) => {
      if (stat.scoredRounds > 0) {
        stat.avgScore = Math.round((stat.totalScore / stat.scoredRounds) * 10) / 10;
      }
    });

    // 找出胜出最多的模型
    let bestModelId: string | null = null;
    let maxWins = 0;
    Object.entries(modelStats).forEach(([mid, stat]) => {
      if (stat.winCount > maxWins) {
        maxWins = stat.winCount;
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
    setActiveTaskId(null);
  };

  const deleteTask = (id: string) => {
    if (!window.confirm("确定删除此批量测试任务？")) return;
    onChangeTasks((prev) => prev.filter((t) => t.id !== id));
    if (activeTaskId === id) setActiveTaskId(null);
  };

  const getModelLabel = (id: string) => MODEL_PRESETS.find((m) => m.id === id)?.label ?? id;

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  // 获取任务进度
  const getTaskProgress = (task: BatchTestTask) => {
    const testedCount = task.rounds.length;
    const totalCount = task.questionCount;
    return { testedCount, totalCount };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      {/* 标题栏 */}
      <div>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>批量测试</h2>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          选择问题库中的问题，配置模型和提示词，批量执行测试并进行人工评测
        </p>
      </div>

      {/* 创建任务按钮 */}
      {!creating && !activeTaskId && (
        <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => setCreating(true)}>
          ＋ 新建批量测试任务
        </button>
      )}

      {/* 创建任务表单 */}
      {creating && !activeTaskId && (
        <div className="panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="label">新建批量测试任务</div>

          <input className="input" placeholder="任务名称" value={formName} onChange={(e) => setFormName(e.target.value)} />

          {/* 问题分类选择 */}
          <div>
            <div className="label">选择问题分类</div>
            <select className="select" value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)}>
              <option value="">请选择...</option>
              {bank.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.questions.length} 条问题)
                </option>
              ))}
            </select>
            {selectedCategory && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
                将测试 {selectedCategory.questions.length} 条问题
              </div>
            )}
          </div>

          {/* 模型选择 */}
          <div>
            <div className="label">选择测试模型（1-4个）</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MODEL_PRESETS.map((m) => {
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

          {/* 提示词选择 */}
          <div>
            <div className="label">选择提示词</div>
            <select className="select" value={formPromptId} onChange={(e) => setFormPromptId(e.target.value)}>
              <option value="">请选择...</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {activePrompt && (
              <div
                className="panel"
                style={{ marginTop: 8, padding: "0.5rem", fontSize: "0.75rem", maxHeight: 100, overflow: "auto" }}
              >
                <strong>系统提示词预览：</strong>
                <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{activePrompt.systemPrompt.slice(0, 200)}...</pre>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div>
            <div className="label">User Profile</div>
            <textarea
              className="textarea-field"
              rows={2}
              placeholder="注入上下文..."
              value={formUserProfile}
              onChange={(e) => setFormUserProfile(e.target.value)}
            />
          </div>

          {/* Memory */}
          <div>
            <div className="label">Memory</div>
            <textarea
              className="textarea-field"
              rows={2}
              placeholder="多轮记忆..."
              value={formMemory}
              onChange={(e) => setFormMemory(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={createTask}>
              创建任务
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* 任务详情视图 */}
      {activeTask && (
        <div className="panel" style={{ flex: 1, padding: "1rem", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          {/* 任务头部 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <strong style={{ fontSize: "1rem" }}>{activeTask.name}</strong>
              <span
                className="badge"
                style={{
                  marginLeft: 12,
                  background: activeTask.status === "running" ? "rgba(37,99,235,0.1)" : "rgba(22,163,74,0.1)",
                  color: activeTask.status === "running" ? "var(--accent)" : "#16a34a",
                }}
              >
                {activeTask.status === "running" ? "进行中" : "已完成"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {activeTask.status === "running" && (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => runAllRounds(activeTask)}>
                    运行全部未测问题
                  </button>
                  <button type="button" className="btn" onClick={() => endTask(activeTask)}>
                    结束任务
                  </button>
                </>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => setActiveTaskId(null)}>
                返回列表
              </button>
            </div>
          </div>

          {/* 任务配置摘要 */}
          <div
            className="panel"
            style={{ padding: "0.75rem", background: "var(--bg-subtle)", display: "flex", gap: 16, flexWrap: "wrap" }}
          >
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>问题分类</span>
              <div style={{ fontWeight: 600 }}>{bank.categories.find((c) => c.id === activeTask.questionCategoryId)?.name}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>问题数量</span>
              <div style={{ fontWeight: 600 }}>{activeTask.questionCount}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>模型</span>
              <div style={{ fontWeight: 600 }}>{activeTask.modelIds.map(getModelLabel).join(" / ")}</div>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>进度</span>
              <div style={{ fontWeight: 600 }}>
                {getTaskProgress(activeTask).testedCount} / {getTaskProgress(activeTask).totalCount}
              </div>
            </div>
          </div>

          {/* 结果列表 */}
          <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 未测试的问题 */}
            {activeTask.status === "running" && (
              <div>
                <div className="label" style={{ marginBottom: 8 }}>
                  待测试问题（点击运行）
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(() => {
                    const category = bank.categories.find((c) => c.id === activeTask.questionCategoryId);
                    if (!category) return null;
                    const testedIds = new Set(activeTask.rounds.map((r) => r.questionId));
                    const untested = category.questions.filter((q) => !testedIds.has(q.id));

                    if (untested.length === 0) {
                      return <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>所有问题已测试完成</div>;
                    }

                    return untested.map((q) => (
                      <div
                        key={q.id}
                        className="panel"
                        style={{ padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      >
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: "var(--border)",
                              color: "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            {category.questions.findIndex((qq) => qq.id === q.id) + 1}
                          </span>
                          <span style={{ fontSize: "0.9rem" }}>{q.content}</span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={runningRoundId === q.id}
                          onClick={() => {
                            const questionIndex = category.questions.findIndex((qq) => qq.id === q.id);
                            runRound(activeTask, questionIndex);
                          }}
                        >
                          {runningRoundId === q.id ? "运行中..." : "运行测试"}
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* 已测试的问题结果 */}
            {activeTask.rounds.length > 0 && (
              <div style={{ flex: 1 }}>
                <div className="label" style={{ marginBottom: 8 }}>
                  测试结果（{activeTask.rounds.length} 条）
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {activeTask.rounds.map((round, idx) => (
                    <div key={round.id} className="panel" style={{ padding: "0.85rem" }}>
                      {/* 问题标题 */}
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: "var(--accent-soft)",
                              color: "var(--accent)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <strong style={{ fontSize: "0.95rem" }}>{round.questionContent}</strong>
                        </div>
                      </div>

                      {/* 白盒数据展示（如果有） */}
                      {Object.values(round.results).some((r) => r.imageGenPrompt) && (
                        <div
                          className="panel"
                          style={{
                            marginBottom: 12,
                            padding: "0.5rem",
                            background: "rgba(37,99,235,0.05)",
                            fontSize: "0.75rem",
                          }}
                        >
                          <strong>生图提示词：</strong>
                          {Object.values(round.results).find((r) => r.imageGenPrompt)?.imageGenPrompt}
                        </div>
                      )}

                      {/* 各模型结果卡片 */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: `repeat(${Math.min(activeTask.modelIds.length, 2)}, 1fr)`,
                          gap: 12,
                        }}
                      >
                        {activeTask.modelIds.map((mid) => {
                          const res = round.results[mid];
                          const isBest = round.bestModelId === mid;
                          const isEditing = editingResult?.roundId === round.id && editingResult?.modelId === mid;

                          if (!res) {
                            return (
                              <div key={mid} className="panel" style={{ padding: "0.65rem", background: "var(--bg-subtle)" }}>
                                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{getModelLabel(mid)}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>未运行</div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={mid}
                              className="panel"
                              onClick={() => {
                                if (activeTask.status === "running" && activeTask.modelIds.length > 1) {
                                  selectBestModel(activeTask.id, round.id, mid);
                                }
                              }}
                              style={{
                                padding: "0.65rem",
                                background: isBest ? "rgba(22,163,74,0.12)" : "var(--bg-subtle)",
                                borderColor: isBest ? "rgba(22,163,74,0.5)" : "var(--border)",
                                borderWidth: isBest ? "2px" : "1px",
                                cursor: activeTask.status === "running" && activeTask.modelIds.length > 1 ? "pointer" : "default",
                                position: "relative",
                              }}
                            >
                              {/* 模型名称 */}
                              <div style={{ fontWeight: 700, fontSize: "0.8rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                {getModelLabel(mid)}
                                {isBest && <span style={{ color: "#16a34a" }}>★ 最优</span>}
                              </div>

                              {/* 回复内容 */}
                              <pre
                                style={{
                                  margin: "0 0 12px",
                                  whiteSpace: "pre-wrap",
                                  fontSize: "0.78rem",
                                  maxHeight: 150,
                                  overflow: "auto",
                                  background: "var(--bg)",
                                  padding: "0.5rem",
                                  borderRadius: 4,
                                }}
                              >
                                {res.content}
                              </pre>

                              {/* 评测区域 */}
                              {isEditing ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>评分：</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={10}
                                      step={0.5}
                                      placeholder="0-10"
                                      value={res.score ?? ""}
                                      onChange={(e) => {
                                        const score = e.target.value === "" ? null : Number(e.target.value);
                                        updateResultScore(activeTask.id, round.id, mid, score);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="input"
                                      style={{ fontSize: "0.75rem", width: 80 }}
                                    />
                                  </div>
                                  <textarea
                                    placeholder="备注..."
                                    value={res.optimizationNotes}
                                    onChange={(e) => updateResultNotes(activeTask.id, round.id, mid, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="textarea-field"
                                    style={{ fontSize: "0.75rem", minHeight: 50 }}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ fontSize: "0.7rem" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingResult(null);
                                    }}
                                  >
                                    完成
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                  {/* Score */}
                                  {res.score != null && (
                                    <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>评分: {res.score}</span>
                                  )}
                                  {/* Notes indicator */}
                                  {res.optimizationNotes && (
                                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>有备注</span>
                                  )}
                                  {/* Edit button */}
                                  <button
                                    type="button"
                                    className="btn"
                                    style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingResult({ roundId: round.id, modelId: mid });
                                    }}
                                  >
                                    编辑
                                  </button>
                                </div>
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
          </div>
        </div>
      )}

      {/* 任务列表 */}
      {!activeTaskId && (
        <div className="scroll-y" style={{ flex: 1 }}>
          <div className="label" style={{ marginBottom: 8 }}>任务列表</div>
          {tasks.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>暂无任务。点击上方按钮创建。</p>
          ) : (
            tasks.map((task) => {
              const isRunning = task.status === "running";
              const progress = getTaskProgress(task);
              const category = bank.categories.find((c) => c.id === task.questionCategoryId);

              return (
                <div key={task.id} className="panel" style={{ padding: "1rem", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
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
                        {progress.testedCount}/{task.questionCount} 问题 · {task.modelIds.length} 模型
                      </span>
                      {isRunning ? (
                        <button type="button" className="btn" onClick={() => setActiveTaskId(task.id)}>
                          继续测试
                        </button>
                      ) : (
                        <button type="button" className="btn" onClick={() => setActiveTaskId(task.id)}>
                          查看详情
                        </button>
                      )}
                      <button type="button" className="btn btn-danger" onClick={() => deleteTask(task.id)}>
                        删除
                      </button>
                    </div>
                  </div>

                  {/* 任务详情 */}
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 8 }}>
                    分类：{category?.name ?? "未知"} · 模型：{task.modelIds.map(getModelLabel).join(" / ")}
                  </div>

                  {/* 进度条 */}
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: "var(--border)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${(progress.testedCount / task.questionCount) * 100}%`,
                          height: "100%",
                          background: "var(--accent)",
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", minWidth: 60 }}>
                      {Math.round((progress.testedCount / task.questionCount) * 100)}%
                    </span>
                  </div>

                  {/* 已完成任务摘要 */}
                  {!isRunning && task.summary && (
                    <div
                      className="panel"
                      style={{
                        marginTop: 12,
                        padding: "0.75rem",
                        background: "var(--accent-soft)",
                        borderColor: "rgba(37,99,235,0.25)",
                      }}
                    >
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>总问题数</span>
                          <div style={{ fontWeight: 700 }}>{task.summary.totalRounds}</div>
                        </div>
                        {Object.entries(task.summary.modelStats).map(([mid, s]) => {
                          const isWinner = task.summary?.bestModelId === mid;
                          return (
                            <div key={mid} style={{ position: "relative" }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{getModelLabel(mid)}</span>
                              <div style={{ fontWeight: 600 }}>
                                均分{s.avgScore ?? "—"} · 胜出<span style={{ color: isWinner ? "#16a34a" : "var(--text)", fontWeight: 700 }}>{s.winCount}</span>次
                              </div>
                              {isWinner && (
                                <span style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: 600 }}>🏆 胜出最多</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 8 }}>
                        结束时间：{new Date(task.summary.endedAt).toLocaleString("zh-CN")}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
