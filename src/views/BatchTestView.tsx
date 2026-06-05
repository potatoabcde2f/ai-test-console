import { useState, useCallback } from "react";
import type {
  BatchTestTask,
  BatchTestRound,
  BatchTestResult,
  QuestionBank,
} from "../types";
import { uid } from "../lib/ids";

interface Props {
  tasks: BatchTestTask[];
  onChangeTasks: (updater: (prev: BatchTestTask[]) => BatchTestTask[]) => void;
  questionBank: QuestionBank;
}

const EMPTY_BANK: QuestionBank = {
  categories: [],
};

const AI_STYLIST_API_URL = "/api/ai-stylist/send-message";
const DEFAULT_BASE_URL = "http://192.168.15.62:8082";

const AVAILABLE_MODELS = [
  { id: "", label: "默认模型" },
  { id: "qwen", label: "qwen" },
  { id: "qwen-vl", label: "qwen-vl" },
  { id: "qwen-vl-closet", label: "qwen-vl-closet" },
  { id: "qwen-vl-calo", label: "qwen-vl-calo" },
  { id: "qwen-turbo", label: "qwen-turbo" },
  { id: "qwen-max", label: "qwen-max" },
  { id: "qwen3max", label: "qwen3max" },
  { id: "closet_gpt4o", label: "closet_gpt4o" },
  { id: "closet_gpt4omini", label: "closet_gpt4omini" },
  { id: "closet_gpt54mini", label: "closet_gpt54mini" },
  { id: "closet_gpt51", label: "closet_gpt51" },
  { id: "gemini3.1flash-lite", label: "gemini3.1flash-lite" },
  { id: "gemini3.1pro", label: "gemini3.1pro" },
];

export function BatchTestView({ tasks, onChangeTasks, questionBank }: Props) {
  const bank = questionBank ?? EMPTY_BANK;

  // 创建任务相关状态
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formModelIds, setFormModelIds] = useState<string[]>([]);

  // 任务详情/执行状态
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [evaluatingRoundId, setEvaluatingRoundId] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  // 当前评测的题目索引
  const [, setCurrentEvalIndex] = useState(0);

  // Toast 提示
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "info" }>({
    show: false,
    message: "",
    type: "info"
  });
  const showToast = (message: string, type: "success" | "info" = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "info" }), 2000);
  };

  const toggleModel = (id: string) => {
    setFormModelIds((prev) => {
      const set = new Set(prev);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      return [...set];
    });
  };

  // 开始创建任务
  const startCreating = () => {
    const existingNumbers = tasks
      .map((t) => {
        const match = t.name.match(/^批量测试(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    setFormName(`批量测试${nextNumber}`);
    setFormCategoryId("");
    setFormModelIds([]);
    setCreating(true);
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

    const category = bank.categories.find((c) => c.id === formCategoryId);
    if (!category || category.questions.length === 0) {
      window.alert("所选分类没有问题，请先添加问题");
      return;
    }

    const task: BatchTestTask & { baseUrl?: string } = {
      id: uid("bt"),
      name: formName.trim(),
      status: "running",
      questionCategoryId: formCategoryId,
      questionCount: category.questions.length,
      modelIds: formModelIds,
      promptId: "",
      systemPrompt: "",
      userProfile: "",
      memory: "",
      rounds: [],
      createdAt: Date.now(),
      baseUrl: DEFAULT_BASE_URL,
    };

    onChangeTasks((prev) => [task, ...prev]);
    setFormName("");
    setFormCategoryId("");
    setFormModelIds([]);
    setCreating(false);
    setActiveTaskId(task.id);
    // 自动开始运行所有问题
    setTimeout(() => runAllRounds(task), 100);
  };

  // 运行单个问题
  const runRound = async (task: BatchTestTask & { baseUrl?: string }, questionIndex: number) => {
    const category = bank.categories.find((c) => c.id === task.questionCategoryId);
    if (!category) return;
    const question = category.questions[questionIndex];
    if (!question) return;

    try {
      const outs = await Promise.all(
        task.modelIds.map(async (mid) => {
          const apiUrl = task.baseUrl ? `${task.baseUrl}${AI_STYLIST_API_URL}` : AI_STYLIST_API_URL;
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: question.content,
              chat_svc: mid,
              debug: "model_debug",
            }),
          });

          const data = await response.json();
          let content = "";

          if (data.status === 1 && data.data) {
            if (Array.isArray(data.data.message)) {
              for (const msg of data.data.message) {
                if (msg.type === "text") {
                  content = msg.text || "";
                }
              }
            }
          }

          return [
            mid,
            {
              content: content || "（无回复）",
              score: null,
              verdict: "pending",
              optimizationNotes: "",
              questionType: undefined,
              intent: undefined,
              imageGenPrompt: undefined,
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
      showToast("运行失败", "info");
    }
  };

  // 批量运行所有问题
  const runAllRounds = async (task: BatchTestTask & { baseUrl?: string }) => {
    const category = bank.categories.find((c) => c.id === task.questionCategoryId);
    if (!category) return;

    const testedQuestionIds = new Set(task.rounds.map((r) => r.questionId));
    const untestedQuestions = category.questions.filter((q) => !testedQuestionIds.has(q.id));

    for (let i = 0; i < untestedQuestions.length; i++) {
      const questionIndex = category.questions.findIndex((q) => q.id === untestedQuestions[i].id);
      if (questionIndex >= 0) {
        await runRound(task, questionIndex);
      }
    }
    showToast("所有问题已测试完成", "success");
  };

  // 选择最优模型
  const selectBestModel = useCallback(
    (taskId: string, roundId: string, modelId: string | null) => {
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

  // 保存任务
  const saveTask = (task: BatchTestTask) => {
    onChangeTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              updatedAt: Date.now(),
            }
          : t
      )
    );
    showToast("任务已保存", "success");
  };

  // 结束任务
  const endTask = (task: BatchTestTask) => {
    const unselectedRounds = task.rounds.filter((r) => !r.bestModelId);
    if (unselectedRounds.length > 0) {
      window.alert(`还有 ${unselectedRounds.length} 个问题未评选最优模型，请先完成评选`);
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
      if (r.bestModelId && modelStats[r.bestModelId]) {
        modelStats[r.bestModelId].winCount++;
      }
    });

    Object.values(modelStats).forEach((stat) => {
      if (stat.scoredRounds > 0) {
        stat.avgScore = Math.round((stat.totalScore / stat.scoredRounds) * 10) / 10;
      }
    });

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
    setEvaluatingRoundId(null);
  };

  const deleteTask = (id: string) => {
    if (!window.confirm("确定删除此批量测试任务？")) return;
    onChangeTasks((prev) => prev.filter((t) => t.id !== id));
    if (activeTaskId === id) {
      setActiveTaskId(null);
      setEvaluatingRoundId(null);
    }
  };

  const getModelLabel = (id: string) => AVAILABLE_MODELS.find((m) => m.id === id)?.label ?? id;

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  // 获取任务进度
  const getTaskProgress = (task: BatchTestTask) => {
    const testedCount = task.rounds.length;
    const totalCount = task.questionCount;
    const selectedCount = task.rounds.filter((r) => r.bestModelId).length;
    const skippedCount = task.rounds.filter((r) => r.bestModelId === "skipped").length;
    return { testedCount, totalCount, selectedCount, skippedCount };
  };

  // 获取当前需要评测的round
  const getEvaluationRounds = (task: BatchTestTask) => {
    if (showSkipped) {
      return task.rounds.filter((r) => r.bestModelId === "skipped");
    }
    return task.rounds.filter((r) => !r.bestModelId || r.bestModelId === "skipped");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      {/* Toast */}
      {toast.show && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            padding: "12px 20px",
            background: toast.type === "success" ? "#16a34a" : "var(--accent)",
            color: "#fff",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          {toast.message}
        </div>
      )}

      {/* 标题栏 */}
      <div>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>批量测试</h2>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          多模型对比评测，选出最优回复
        </p>
      </div>

      {/* 创建任务按钮 */}
      {!creating && !activeTaskId && (
        <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={startCreating}>
          ＋ 新建批量测试任务
        </button>
      )}

      {/* 创建任务表单 */}
      {creating && !activeTaskId && (
        <div className="panel" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>新建批量测试任务</div>

          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 6 }}>任务名称</div>
            <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} />
          </div>

          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 6 }}>
              选择问题分类 <span style={{ color: "#dc2626" }}>*</span>
            </div>
            <select className="select" value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)}>
              <option value="">请选择...</option>
              {bank.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.questions.length} 条问题)
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 6 }}>
              选择测试模型 <span style={{ color: "#dc2626" }}>*</span>（可多选）
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {AVAILABLE_MODELS.map((m) => {
                const on = formModelIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="chip"
                    style={{
                      cursor: "pointer",
                      borderColor: on ? "var(--accent)" : "var(--border)",
                      background: on ? "var(--accent-soft)" : "var(--bg-subtle)",
                      padding: "6px 12px",
                    }}
                  >
                    <input type="checkbox" checked={on} style={{ marginRight: 6 }} onChange={() => toggleModel(m.id)} />
                    {m.label}
                  </label>
                );
              })}
            </div>
            {formModelIds.length > 0 && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>
                已选 {formModelIds.length} 个模型：{formModelIds.map(getModelLabel).join("、")}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-primary" onClick={createTask}>
              创建并自动运行
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* 评测模式 - 单题专注模式 */}
      {activeTask && evaluatingRoundId && (
        <EvaluationView
          task={activeTask}
          roundId={evaluatingRoundId}
          onClose={() => setEvaluatingRoundId(null)}
          onSelectBest={(modelId) => {
            selectBestModel(activeTask.id, evaluatingRoundId, modelId);
            // 自动进入下一题
            const evalRounds = getEvaluationRounds(activeTask);
            const currentIndex = evalRounds.findIndex((r) => r.id === evaluatingRoundId);
            if (currentIndex < evalRounds.length - 1) {
              setEvaluatingRoundId(evalRounds[currentIndex + 1].id);
            } else {
              setEvaluatingRoundId(null);
            }
          }}
          onSkip={() => {
            selectBestModel(activeTask.id, evaluatingRoundId, "skipped");
            const evalRounds = getEvaluationRounds(activeTask);
            const currentIndex = evalRounds.findIndex((r) => r.id === evaluatingRoundId);
            if (currentIndex < evalRounds.length - 1) {
              setEvaluatingRoundId(evalRounds[currentIndex + 1].id);
            } else {
              setEvaluatingRoundId(null);
            }
          }}
          getModelLabel={getModelLabel}
        />
      )}

      {/* 任务详情视图 */}
      {activeTask && !evaluatingRoundId && (
        <TaskDetailView
          task={activeTask}
          onClose={() => setActiveTaskId(null)}
          onSave={() => saveTask(activeTask)}
          onEnd={() => endTask(activeTask)}
          onStartEval={(roundId) => {
            setEvaluatingRoundId(roundId);
            setCurrentEvalIndex(0);
          }}
          onToggleSkipped={() => setShowSkipped(!showSkipped)}
          showSkipped={showSkipped}
          getModelLabel={getModelLabel}
          getTaskProgress={getTaskProgress}
        />
      )}

      {/* 任务列表 */}
      {!activeTaskId && !creating && (
        <TaskListView
          tasks={tasks}
          bank={bank}
          onOpenTask={setActiveTaskId}
          onDeleteTask={deleteTask}
          getTaskProgress={getTaskProgress}
        />
      )}
    </div>
  );
}

// 评测视图 - 单题专注模式
interface EvaluationViewProps {
  task: BatchTestTask;
  roundId: string;
  onClose: () => void;
  onSelectBest: (modelId: string | null) => void;
  onSkip: () => void;
  getModelLabel: (id: string) => string;
}

function EvaluationView({ task, roundId, onClose, onSelectBest, onSkip, getModelLabel }: EvaluationViewProps) {
  const round = task.rounds.find((r) => r.id === roundId);
  if (!round) return null;

  const currentIndex = task.rounds.findIndex((r) => r.id === roundId) + 1;
  const total = task.rounds.length;
  const remaining = task.rounds.filter((r) => !r.bestModelId).length;

  return (
    <div className="panel" style={{ flex: 1, padding: "1.5rem", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 顶部导航 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>
            第 {currentIndex} / {total} 题 · 还剩 {remaining} 题待评
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>{task.name}</div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          返回概览
        </button>
      </div>

      {/* 进度条 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
              width: `${(task.rounds.filter((r) => r.bestModelId).length / total) * 100}%`,
              height: "100%",
              background: "#16a34a",
              transition: "width 0.3s",
            }}
          />
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", minWidth: 50 }}>
          {Math.round((task.rounds.filter((r) => r.bestModelId).length / total) * 100)}%
        </span>
      </div>

      {/* 问题卡片 */}
      <div
        className="panel"
        style={{
          padding: "1.25rem",
          background: "var(--accent-soft)",
          border: "1px solid rgba(37,99,235,0.2)",
        }}
      >
        <div style={{ fontSize: "0.75rem", color: "var(--accent)", marginBottom: 8, fontWeight: 500 }}>
          问题
        </div>
        <div style={{ fontSize: "1.1rem", lineHeight: 1.5 }}>{round.questionContent}</div>
      </div>

      {/* 模型回复对比 */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 12 }}>
          点击选择回复最优的模型
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {task.modelIds.map((mid, idx) => {
            const res = round.results[mid];
            if (!res) return null;

            return (
              <button
                key={mid}
                type="button"
                onClick={() => onSelectBest(mid)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "1rem",
                  background: "var(--bg-subtle)",
                  border: "2px solid var(--border)",
                  borderRadius: 12,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.background = "var(--accent-soft)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.background = "var(--bg-subtle)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      background: "var(--accent)",
                      color: "#fff",
                      borderRadius: 20,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    模型 {String.fromCharCode(65 + idx)}
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
                    {getModelLabel(mid)}
                  </span>
                </div>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    fontFamily: "var(--font-sans)",
                    color: "var(--text)",
                    maxHeight: 200,
                    overflow: "auto",
                  }}
                >
                  {res.content}
                </pre>
              </button>
            );
          })}
        </div>
      </div>

      {/* 底部操作 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <button type="button" className="btn" onClick={onSkip}>
          ⏭️ 跳过此题
        </button>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          点击上方模型卡片选择最优回复
        </div>
      </div>
    </div>
  );
}

// 任务详情视图
interface TaskDetailViewProps {
  task: BatchTestTask;
  onClose: () => void;
  onSave: () => void;
  onEnd: () => void;
  onStartEval: (roundId: string) => void;
  onToggleSkipped: () => void;
  showSkipped: boolean;
  getModelLabel: (id: string) => string;
  getTaskProgress: (task: BatchTestTask) => { testedCount: number; totalCount: number; selectedCount: number; skippedCount: number };
}

function TaskDetailView({
  task,
  onClose,
  onSave,
  onEnd,
  onStartEval,
  onToggleSkipped,
  showSkipped,
  getModelLabel,
  getTaskProgress,
}: TaskDetailViewProps) {
  const { testedCount, totalCount, selectedCount, skippedCount } = getTaskProgress(task);
  const isCompleted = task.status === "completed";

  return (
    <div className="panel" style={{ flex: 1, padding: "1.25rem", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 头部 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{task.name}</h3>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 20,
                fontSize: "0.75rem",
                fontWeight: 500,
                background: isCompleted ? "rgba(22,163,74,0.1)" : "rgba(37,99,235,0.1)",
                color: isCompleted ? "#16a34a" : "var(--accent)",
              }}
            >
              {isCompleted ? "已完成" : "进行中"}
            </span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
            {task.modelIds.map(getModelLabel).join("、")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!isCompleted && (
            <>
              <button type="button" className="btn" onClick={onSave}>
                保存
              </button>
              <button type="button" className="btn btn-primary" onClick={onEnd}>
                结束任务
              </button>
            </>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            返回列表
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatCard label="总问题" value={totalCount} color="var(--text)" />
        <StatCard label="已测" value={testedCount} color="#16a34a" />
        <StatCard label="已评" value={selectedCount} color="#2563eb" />
        <StatCard label="跳过" value={skippedCount} color="#ca8a04" />
      </div>

      {/* 进度条 */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>
          <span>评测进度</span>
          <span>{Math.round((selectedCount / totalCount) * 100)}%</span>
        </div>
        <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              width: `${(selectedCount / totalCount) * 100}%`,
              height: "100%",
              background: "#16a34a",
              borderRadius: 4,
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      {/* 操作栏 */}
      {!isCompleted && (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1, padding: "12px 24px", fontSize: "1rem" }}
            onClick={() => {
              const nextRound = task.rounds.find((r) => !r.bestModelId);
              if (nextRound) {
                onStartEval(nextRound.id);
              }
            }}
            disabled={selectedCount >= totalCount}
          >
            {selectedCount === 0 ? "开始评测" : "继续评测"}
          </button>
          {skippedCount > 0 && (
            <button type="button" className="btn" onClick={onToggleSkipped}>
              {showSkipped ? "隐藏跳过" : `查看跳过 (${skippedCount})`}
            </button>
          )}
        </div>
      )}

      {/* 问题列表 */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 12 }}>
          问题列表
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {task.rounds.map((round, idx) => {
            const status = round.bestModelId
              ? round.bestModelId === "skipped"
                ? "skipped"
                : "done"
              : "pending";

            if (showSkipped && status !== "skipped") return null;
            if (!showSkipped && status === "skipped") return null;

            return (
              <div
                key={round.id}
                className="panel"
                style={{
                  padding: "0.875rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  borderLeft: "3px solid",
                  borderLeftColor:
                    status === "done" ? "#16a34a" : status === "skipped" ? "#ca8a04" : "var(--border)",
                  background: status === "pending" ? "var(--bg)" : "var(--bg-subtle)",
                }}
              >
                {/* 序号 */}
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background:
                      status === "done" ? "#16a34a" : status === "skipped" ? "#ca8a04" : "var(--border)",
                    color: status === "pending" ? "var(--text-muted)" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>

                {/* 问题内容 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: 500 }}>{round.questionContent}</div>
                  {status === "done" && round.bestModelId && round.bestModelId !== "skipped" && (
                    <div style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: 2 }}>
                      已选最优：{getModelLabel(round.bestModelId)}
                    </div>
                  )}
                  {status === "skipped" && (
                    <div style={{ fontSize: "0.75rem", color: "#ca8a04", marginTop: 2 }}>已跳过</div>
                  )}
                </div>

                {/* 状态标签 */}
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    background:
                      status === "done"
                        ? "rgba(22,163,74,0.1)"
                        : status === "skipped"
                        ? "rgba(202,138,4,0.1)"
                        : "rgba(37,99,235,0.1)",
                    color: status === "done" ? "#16a34a" : status === "skipped" ? "#ca8a04" : "var(--accent)",
                    flexShrink: 0,
                  }}
                >
                  {status === "done" ? "已评测" : status === "skipped" ? "已跳过" : "待评测"}
                </span>

                {/* 操作按钮 */}
                {!isCompleted && (
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: "0.75rem", padding: "6px 12px", flexShrink: 0 }}
                    onClick={() => onStartEval(round.id)}
                  >
                    {status === "pending" ? "评测" : "重新评"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 统计卡片
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="panel"
      style={{
        padding: "1rem",
        textAlign: "center",
        border: "1px solid var(--border)",
        background: "var(--bg)",
      }}
    >
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

// 任务列表视图
interface TaskListViewProps {
  tasks: BatchTestTask[];
  bank: QuestionBank;
  onOpenTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  getTaskProgress: (task: BatchTestTask) => { testedCount: number; totalCount: number; selectedCount: number; skippedCount: number };
}

function TaskListView({ tasks, bank, onOpenTask, onDeleteTask, getTaskProgress }: TaskListViewProps) {
  return (
    <div className="scroll-y" style={{ flex: 1 }}>
      {tasks.length === 0 ? (
        <div className="panel" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
          <p>暂无任务</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tasks.map((task) => {
            const { selectedCount, totalCount } = getTaskProgress(task);
            const isRunning = task.status === "running";
            const category = bank.categories.find((c) => c.id === task.questionCategoryId);
            const progress = Math.round((selectedCount / totalCount) * 100);

            return (
              <div key={task.id} className="panel" style={{ padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: "1rem", fontWeight: 600 }}>{task.name}</span>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 12,
                          fontSize: "0.7rem",
                          background: isRunning ? "rgba(37,99,235,0.1)" : "rgba(22,163,74,0.1)",
                          color: isRunning ? "var(--accent)" : "#16a34a",
                        }}
                      >
                        {isRunning ? "进行中" : "已完成"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6 }}>
                      {category?.name} · {task.modelIds.length} 个模型 · {selectedCount}/{totalCount} 已评
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn" onClick={() => onOpenTask(task.id)}>
                      {isRunning ? "继续评测" : "查看详情"}
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => onDeleteTask(task.id)}>
                      删除
                    </button>
                  </div>
                </div>

                {/* 进度条 */}
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3 }}>
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        background: "#16a34a",
                        borderRadius: 3,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", minWidth: 35 }}>{progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
