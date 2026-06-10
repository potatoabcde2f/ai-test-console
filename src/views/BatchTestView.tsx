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
        // 最多选择3个模型
        if (set.size >= 3) {
          showToast("最多只能选择3个模型进行对比");
          return prev;
        }
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
          const images: string[] = [];

          if (data.status === 1 && data.data) {
            if (Array.isArray(data.data.message)) {
              for (const msg of data.data.message) {
                if (msg.type === "text") {
                  content = msg.text || "";
                } else if (msg.type === "image" && msg.url) {
                  images.push(msg.url);
                } else if (msg.type === "image_url" && msg.image?.url) {
                  images.push(msg.image.url);
                }
              }
            }
          }

          return [
            mid,
            {
              content: content || (images.length > 0 ? "" : "（无回复）"),
              images: images.length > 0 ? images : undefined,
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

  // 获取当前需要评测的round - 跳过的题放在最后
  const getEvaluationRounds = (task: BatchTestTask) => {
    const pendingRounds = task.rounds.filter((r) => !r.bestModelId);
    const skippedRounds = task.rounds.filter((r) => r.bestModelId === "skipped");
    const otherRounds = task.rounds.filter((r) => r.bestModelId && r.bestModelId !== "skipped");

    if (showSkipped) {
      return skippedRounds;
    }
    // 未评测的在前，已跳过放最后
    return [...pendingRounds, ...skippedRounds];
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>批量测试</h2>
        {!creating && !activeTaskId && (
          <button type="button" className="btn btn-primary" style={{ fontSize: "0.8rem" }} onClick={startCreating}>
            ＋ 新建
          </button>
        )}
      </div>

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
              选择测试模型 <span style={{ color: "#dc2626" }}>*</span>（可多选，最多3个）
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {AVAILABLE_MODELS.map((m) => {
                const on = formModelIds.includes(m.id);
                const disabled = !on && formModelIds.length >= 3;
                return (
                  <label
                    key={m.id}
                    className="chip"
                    style={{
                      cursor: disabled ? "not-allowed" : "pointer",
                      borderColor: on ? "var(--accent)" : "var(--border)",
                      background: on ? "var(--accent-soft)" : disabled ? "var(--bg-subtle)" : "var(--bg-subtle)",
                      padding: "6px 12px",
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={disabled}
                      style={{ marginRight: 6 }}
                      onChange={() => toggleModel(m.id)}
                    />
                    {m.label}
                  </label>
                );
              })}
            </div>
            {formModelIds.length > 0 && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>
                已选 {formModelIds.length} 个模型：{formModelIds.map(getModelLabel).join("、")}
                {formModelIds.length >= 3 && (
                  <span style={{ color: "#dc2626", marginLeft: 8 }}>（已达上限）</span>
                )}
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

// 评测视图 - 横向对比模式
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

  return (
    <div className="panel" style={{ flex: 1, padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
      {/* 顶部导航 - 极简 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text)" }}>{currentIndex}</strong> / {total}
        </div>
        <button type="button" className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "4px 12px" }} onClick={onClose}>
          ✕
        </button>
      </div>

      {/* 问题 - 小字体 */}
      <div
        className="panel"
        style={{
          padding: "0.5rem 0.75rem",
          background: "var(--accent-soft)",
          border: "1px solid rgba(37,99,235,0.15)",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "0.9rem", lineHeight: 1.4 }}>{round.questionContent}</div>
      </div>

      {/* 模型回复对比 - 最大化展示区域 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: task.modelIds.length === 1 ? "1fr" : task.modelIds.length === 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
          gap: 8,
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {task.modelIds.map((mid, idx) => {
          const res = round.results[mid];
          if (!res) return null;

          return (
            <button
              key={mid}
              type="button"
              onClick={() => onSelectBest(mid)}
              style={{
                display: "flex",
                flexDirection: "column",
                textAlign: "left",
                padding: "0.75rem",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                cursor: "pointer",
                transition: "all 0.15s",
                height: "100%",
                overflow: "hidden",
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
              {/* 模型标签 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                  paddingBottom: 6,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    padding: "2px 8px",
                    background: "var(--accent)",
                    color: "#fff",
                    borderRadius: 4,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                  }}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {getModelLabel(mid)}
                </span>
              </div>
              {/* 回复内容 - 最大化 */}
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                  color: "var(--text)",
                  textAlign: "left",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {res.content}
                {/* 显示图片 - 缩小并居中 */}
                {res.images && res.images.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, alignItems: "center" }}>
                    {res.images.map((imgUrl: string, imgIdx: number) => (
                      <img
                        key={imgIdx}
                        src={imgUrl}
                        alt={`生成图片 ${imgIdx + 1}`}
                        style={{
                          width: "auto",
                          height: "auto",
                          maxWidth: "100%",
                          maxHeight: 200,
                          objectFit: "contain",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                        }}
                        onClick={() => window.open(imgUrl, "_blank")}
                      />
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 底部 - 仅保留跳过 */}
      <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "4px 12px" }} onClick={onSkip}>
          跳过
        </button>
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>{task.name}</h3>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: "0.7rem",
              background: isCompleted ? "rgba(22,163,74,0.1)" : "rgba(37,99,235,0.1)",
              color: isCompleted ? "#16a34a" : "var(--accent)",
            }}
          >
            {isCompleted ? "已完成" : "进行中"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!isCompleted && (
            <>
              <button type="button" className="btn" style={{ fontSize: "0.75rem" }} onClick={onSave}>
                保存
              </button>
              <button type="button" className="btn btn-primary" style={{ fontSize: "0.75rem" }} onClick={onEnd}>
                结束
              </button>
            </>
          )}
          <button type="button" className="btn btn-ghost" style={{ fontSize: "0.75rem" }} onClick={onClose}>
            返回
          </button>
        </div>
      </div>

      {/* 统计卡片 - 精简 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <StatCard label="总" value={totalCount} />
        <StatCard label="已测" value={testedCount} />
        <StatCard label="已评" value={selectedCount} />
        <StatCard label="跳过" value={skippedCount} />
      </div>

      {/* 进度条 */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>
          <span>进度</span>
          <span>{Math.round((selectedCount / totalCount) * 100)}%</span>
        </div>
        <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              width: `${(selectedCount / totalCount) * 100}%`,
              height: "100%",
              background: "#16a34a",
              borderRadius: 3,
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      {/* 完成后的报告 */}
      {isCompleted && task.summary && (
        <div className="panel" style={{ padding: "1rem", background: "rgba(22,163,74,0.05)", border: "1px solid rgba(22,163,74,0.2)" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 12, color: "#16a34a" }}>
            🏆 评测报告
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* 胜出模型 */}
            {task.summary.bestModelId && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>胜出模型：</span>
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#16a34a" }}>
                  {getModelLabel(task.summary.bestModelId)}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  ({task.summary.modelStats[task.summary.bestModelId]?.winCount || 0} 次胜出)
                </span>
              </div>
            )}
            {/* 各模型统计 */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>各模型表现：</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {task.modelIds.map((mid) => {
                  const stats = task.summary?.modelStats[mid];
                  if (!stats) return null;
                  const winRate = task.summary ? Math.round((stats.winCount / task.summary.totalRounds) * 100) : 0;
                  return (
                    <div key={mid} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem" }}>
                      <span style={{ minWidth: 100 }}>{getModelLabel(mid)}</span>
                      <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${winRate}%`,
                            height: "100%",
                            background: mid === task.summary?.bestModelId ? "#16a34a" : "var(--accent)",
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ minWidth: 50, textAlign: "right" }}>
                        {stats.winCount}胜 ({winRate}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 操作栏 */}
      {!isCompleted && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1, padding: "8px 16px", fontSize: "0.9rem" }}
            onClick={() => {
              // 查找未评测或跳过的题目（未评测在前，跳过在后）
              const pendingRounds = task.rounds.filter((r) => !r.bestModelId);
              const skippedRounds = task.rounds.filter((r) => r.bestModelId === "skipped");
              const nextRound = pendingRounds[0] || skippedRounds[0];
              if (nextRound) {
                onStartEval(nextRound.id);
              }
            }}
            disabled={selectedCount >= totalCount}
          >
            {selectedCount === 0 ? "开始评测" : "继续评测"}
          </button>
          {skippedCount > 0 && (
            <button type="button" className="btn" style={{ fontSize: "0.75rem" }} onClick={onToggleSkipped}>
              {showSkipped ? "隐藏" : `跳过(${skippedCount})`}
            </button>
          )}
        </div>
      )}

      {/* 问题列表 */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                  padding: "0.625rem 0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderLeft: "2px solid",
                  borderLeftColor:
                    status === "done" ? "#16a34a" : status === "skipped" ? "#ca8a04" : "var(--border)",
                }}
              >
                {/* 序号 */}
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background:
                      status === "done" ? "#16a34a" : status === "skipped" ? "#ca8a04" : "var(--border)",
                    color: status === "pending" ? "var(--text-muted)" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>

                {/* 问题内容 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.85rem" }}>{round.questionContent}</div>
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
                    padding: "2px 8px",
                    borderRadius: 10,
                    fontSize: "0.65rem",
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
                  {status === "done" ? "已评" : status === "skipped" ? "跳过" : "待评"}
                </span>

                {/* 操作按钮 */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {(status === "done" || status === "skipped") && (
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: "0.7rem", padding: "4px 10px" }}
                      onClick={() => setViewingRoundId(round.id)}
                    >
                      查看
                    </button>
                  )}
                  {!isCompleted && (
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: "0.7rem", padding: "4px 10px" }}
                      onClick={() => onStartEval(round.id)}
                    >
                      {status === "pending" ? "评测" : "重评"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 统计卡片
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="panel"
      style={{
        padding: "0.5rem",
        textAlign: "center",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--text)" }}>{value}</div>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.map((task) => {
            const { selectedCount, totalCount } = getTaskProgress(task);
            const isRunning = task.status === "running";
            const category = bank.categories.find((c) => c.id === task.questionCategoryId);
            const progress = Math.round((selectedCount / totalCount) * 100);

            return (
              <div key={task.id} className="panel" style={{ padding: "0.75rem 1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{task.name}</span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: "0.65rem",
                          background: isRunning ? "rgba(37,99,235,0.1)" : "rgba(22,163,74,0.1)",
                          color: isRunning ? "var(--accent)" : "#16a34a",
                        }}
                      >
                        {isRunning ? "进行中" : "已完成"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>
                      {category?.name} · {task.modelIds.length}模型 · {selectedCount}/{totalCount}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" className="btn" style={{ fontSize: "0.75rem" }} onClick={() => onOpenTask(task.id)}>
                      {isRunning ? "继续" : "查看"}
                    </button>
                    <button type="button" className="btn btn-danger" style={{ fontSize: "0.75rem" }} onClick={() => onDeleteTask(task.id)}>
                      删除
                    </button>
                  </div>
                </div>

                {/* 进度条 */}
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2 }}>
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        background: "#16a34a",
                        borderRadius: 2,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", minWidth: 30 }}>{progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 结果回顾视图 - 只读展示已评测结果
interface ResultViewProps {
  task: BatchTestTask;
  round: BatchTestRound;
  onClose: () => void;
  getModelLabel: (id: string) => string;
}

function ResultView({ task, round, onClose, getModelLabel }: ResultViewProps) {
  const roundIndex = task.rounds.findIndex((r) => r.id === round.id) + 1;
  const total = task.rounds.length;

  return (
    <div className="panel" style={{ flex: 1, padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
      {/* 顶部导航 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>
            第 <strong style={{ color: "var(--text)" }}>{roundIndex}</strong> / {total} 题
          </span>
          {round.bestModelId && round.bestModelId !== "skipped" && (
            <span style={{ fontSize: "0.7rem", padding: "2px 8px", background: "#16a34a", color: "#fff", borderRadius: 10 }}>
              已选 {getModelLabel(round.bestModelId)}
            </span>
          )}
          {round.bestModelId === "skipped" && (
            <span style={{ fontSize: "0.7rem", padding: "2px 8px", background: "#ca8a04", color: "#fff", borderRadius: 10 }}>
              已跳过
            </span>
          )}
        </div>
        <button type="button" className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "4px 12px" }} onClick={onClose}>
          ✕ 返回
        </button>
      </div>

      {/* 问题 */}
      <div
        className="panel"
        style={{
          padding: "0.5rem 0.75rem",
          background: "var(--accent-soft)",
          border: "1px solid rgba(37,99,235,0.15)",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "0.9rem", lineHeight: 1.4 }}>{round.questionContent}</div>
      </div>

      {/* 模型回复对比 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: task.modelIds.length === 1 ? "1fr" : task.modelIds.length === 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
          gap: 8,
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {task.modelIds.map((mid, idx) => {
          const res = round.results[mid];
          if (!res) return null;
          const isWinner = round.bestModelId === mid;

          return (
            <div
              key={mid}
              style={{
                display: "flex",
                flexDirection: "column",
                textAlign: "left",
                padding: "0.75rem",
                background: isWinner ? "rgba(22,163,74,0.05)" : "var(--bg-subtle)",
                border: isWinner ? "2px solid #16a34a" : "1px solid var(--border)",
                borderRadius: 8,
                height: "100%",
                overflow: "hidden",
              }}
            >
              {/* 模型标签 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                  paddingBottom: 6,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    padding: "2px 8px",
                    background: isWinner ? "#16a34a" : "var(--accent)",
                    color: "#fff",
                    borderRadius: 4,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                  }}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", flex: 1 }}>
                  {getModelLabel(mid)}
                </span>
                {isWinner && <span style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: 600 }}>✓ 胜出</span>}
              </div>
              {/* 回复内容 */}
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                  color: "var(--text)",
                  textAlign: "left",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {res.content}
                {/* 显示图片 */}
                {res.images && res.images.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, alignItems: "center" }}>
                    {res.images.map((imgUrl: string, imgIdx: number) => (
                      <img
                        key={imgIdx}
                        src={imgUrl}
                        alt={`生成图片 ${imgIdx + 1}`}
                        style={{
                          width: "auto",
                          height: "auto",
                          maxWidth: "100%",
                          maxHeight: 200,
                          objectFit: "contain",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                        }}
                        onClick={() => window.open(imgUrl, "_blank")}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

