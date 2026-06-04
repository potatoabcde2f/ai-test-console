import { useState } from "react";
import type {
  IntentTestTask,
  IntentTestItem,
  IntentTestDataset,
  QuestionBank,
} from "../types";
import { uid } from "../lib/ids";

interface Props {
  tasks: IntentTestTask[];
  onChangeTasks: (updater: (prev: IntentTestTask[]) => IntentTestTask[]) => void;
  datasets: IntentTestDataset[];
  onChangeDatasets: (updater: (prev: IntentTestDataset[]) => IntentTestDataset[]) => void;
  questionBank: QuestionBank;
}

const EMPTY_BANK: QuestionBank = {
  categories: [],
};

// 意图类型映射
const INTENT_MAP: Record<string, string> = {
  "1": "生图需求",
  "2": "通用穿搭问答",
  "3": "产品介绍相关",
  "4": "穿搭图片推荐",
};

const AI_STYLIST_API_URL = "/api/ai-stylist/send-message";
const DEFAULT_BASE_URL = "http://192.168.15.62:8082";

export function IntentTestView({
  tasks,
  onChangeTasks,
  datasets,
  onChangeDatasets,
  questionBank,
}: Props) {
  const bank = questionBank ?? EMPTY_BANK;

  // 视图模式
  const [viewMode, setViewMode] = useState<"datasets" | "tasks" | "createDataset" | "createTask" | "datasetDetail" | "taskDetail" | "running">("datasets");

  // 当前选中的评测集/任务ID
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // 评测集编辑状态
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [datasetFormName, setDatasetFormName] = useState("");
  const [datasetFormDesc, setDatasetFormDesc] = useState("");
  const [datasetFormItems, setDatasetFormItems] = useState<IntentTestItem[]>([]);
  const [importCategoryId, setImportCategoryId] = useState("");

  // 任务创建/运行状态
  const [taskFormName, setTaskFormName] = useState("");
  const [taskFormModelId, setTaskFormModelId] = useState("");
  const [taskFormDatasetId, setTaskFormDatasetId] = useState("");
  const [taskFormDetectPrompt, setTaskFormDetectPrompt] = useState("");

  // 运行状态
  const [, setIsRunning] = useState(false);
  const [runningProgress, setRunningProgress] = useState({ current: 0, total: 0 });

  // 当前数据
  const activeDataset = datasets.find((d) => d.id === activeDatasetId);
  const activeTask = tasks.find((t) => t.id === activeTaskId);

  // ==================== 数据集管理 ====================

  const startCreateDataset = () => {
    setEditingDatasetId(null);
    setDatasetFormName("");
    setDatasetFormDesc("");
    setDatasetFormItems([]);
    setImportCategoryId("");
    setViewMode("createDataset");
  };

  const startEditDataset = (dataset: IntentTestDataset) => {
    setEditingDatasetId(dataset.id);
    setDatasetFormName(dataset.name);
    setDatasetFormDesc(dataset.description ?? "");
    setDatasetFormItems(dataset.items.map((item) => ({ ...item })));
    setImportCategoryId("");
    setViewMode("createDataset");
  };

  const saveDataset = () => {
    if (!datasetFormName.trim()) {
      window.alert("请填写数据集名称");
      return;
    }
    if (datasetFormItems.length === 0) {
      window.alert("请至少添加一个评测项");
      return;
    }

    const now = Date.now();
    if (editingDatasetId) {
      onChangeDatasets((prev) =>
        prev.map((d) =>
          d.id === editingDatasetId
            ? {
                ...d,
                name: datasetFormName.trim(),
                description: datasetFormDesc.trim(),
                items: datasetFormItems,
                updatedAt: now,
              }
            : d
        )
      );
    } else {
      const newDataset: IntentTestDataset = {
        id: uid("itd"),
        name: datasetFormName.trim(),
        description: datasetFormDesc.trim(),
        intentTypes: ["1", "2", "3", "4"],
        items: datasetFormItems,
        createdAt: now,
        updatedAt: now,
      };
      onChangeDatasets((prev) => [...prev, newDataset]);
    }
    setViewMode("datasets");
  };

  const deleteDataset = (id: string) => {
    if (!window.confirm("确定删除此数据集？")) return;
    onChangeDatasets((prev) => prev.filter((d) => d.id !== id));
    if (activeDatasetId === id) setActiveDatasetId(null);
  };

  const importFromQuestionBank = () => {
    if (!importCategoryId) {
      window.alert("请先选择问题分类");
      return;
    }
    const category = bank.categories.find((c) => c.id === importCategoryId);
    if (!category || category.questions.length === 0) {
      window.alert("所选分类没有问题");
      return;
    }
    const newItems: IntentTestItem[] = category.questions.map((q) => ({
      id: uid("iti"),
      question: q.content,
      humanLabel: "",
      createdAt: Date.now(),
    }));
    setDatasetFormItems((prev) => [...prev, ...newItems]);
    setImportCategoryId("");
  };

  const addDatasetItem = () => {
    setDatasetFormItems((prev) => [
      ...prev,
      { id: uid("iti"), question: "", humanLabel: "", createdAt: Date.now() },
    ]);
  };

  const updateDatasetItem = (id: string, field: "question" | "humanLabel", value: string) => {
    setDatasetFormItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const deleteDatasetItem = (id: string) => {
    setDatasetFormItems((prev) => prev.filter((item) => item.id !== id));
  };

  // ==================== 任务管理 ====================

  const startCreateTask = () => {
    if (datasets.length === 0) {
      window.alert("请先创建评测集");
      return;
    }
    // 自动生成名称：意图识别N
    const existingNumbers = tasks
      .map((t) => {
        const match = t.name.match(/^意图识别(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    setTaskFormName(`意图识别${nextNumber}`);
    setTaskFormModelId("");
    setTaskFormDatasetId(datasets[0]?.id ?? "");
    setTaskFormDetectPrompt("");
    setViewMode("createTask");
  };

  const createTask = () => {
    if (!taskFormName.trim()) {
      window.alert("请填写任务名称");
      return;
    }
    if (!taskFormDatasetId) {
      window.alert("请选择评测集");
      return;
    }

    const dataset = datasets.find((d) => d.id === taskFormDatasetId);
    if (!dataset) {
      window.alert("所选评测集不存在");
      return;
    }

    const task: IntentTestTask & { baseUrl?: string; detectPrompt?: string } = {
      id: uid("itt"),
      name: taskFormName.trim(),
      status: "running",
      items: dataset.items.map((item) => ({ ...item })),
      promptId: "",
      systemPrompt: taskFormDetectPrompt,
      modelId: taskFormModelId,
      progress: { current: 0, total: dataset.items.length },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      baseUrl: DEFAULT_BASE_URL,
    };

    onChangeTasks((prev) => [task, ...prev]);
    setActiveTaskId(task.id);
    setViewMode("running");
    // 自动开始运行
    setTimeout(() => runTask(task, taskFormDetectPrompt), 100);
  };

  const deleteTask = (id: string) => {
    if (!window.confirm("确定删除此测试任务？")) return;
    onChangeTasks((prev) => prev.filter((t) => t.id !== id));
    if (activeTaskId === id) {
      setActiveTaskId(null);
      setViewMode("tasks");
    }
  };

  // ==================== 运行测试 ====================

  const runTask = async (task: IntentTestTask & { baseUrl?: string }, detectPromptOverride: string = "") => {
    setIsRunning(true);
    setRunningProgress({ current: 0, total: task.items.length });

    const promptParams: Record<string, string> = {};
    if (detectPromptOverride) {
      promptParams.prompt_closet_chat_detect = detectPromptOverride;
    }

    for (let i = 0; i < task.items.length; i++) {
      const item = task.items[i];
      setRunningProgress({ current: i + 1, total: task.items.length });

      // 更新状态为运行中
      onChangeTasks((prev) =>
        prev.map((t) => {
          if (t.id !== task.id) return t;
          return {
            ...t,
            items: t.items.map((it) =>
              it.id === item.id ? { ...it, aiLabel: undefined, isMatch: undefined as boolean | undefined } : it
            ),
          };
        })
      );

      try {
        const payload: Record<string, unknown> = {
          prompt: item.question,
          chat_svc: task.modelId,
          debug: "model_debug",
        };

        if (Object.keys(promptParams).length > 0) {
          payload.prompt_params = promptParams;
        }

        const apiUrl = task.baseUrl ? `${task.baseUrl}${AI_STYLIST_API_URL}` : AI_STYLIST_API_URL;

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (data.status === 1 && data.data) {
          const debugFlow = data.data.debug_flow || data.data.debugFlow || [];
          const detectStep = debugFlow.find(
            (step: { template?: string; output?: string }) => step.template === "closet_chat_detect"
          );
          const aiLabel = detectStep?.output?.trim() || null;
          const isMatch = aiLabel ? aiLabel === item.humanLabel : undefined;

          onChangeTasks((prev) =>
            prev.map((t) => {
              if (t.id !== task.id) return t;
              return {
                ...t,
                items: t.items.map((it) =>
                  it.id === item.id ? { ...it, aiLabel, isMatch } : it
                ),
                progress: {
                  current: i + 1,
                  total: task.items.length,
                },
                updatedAt: Date.now(),
              };
            })
          );
        } else {
          throw new Error(data.msg || "API返回错误");
        }
      } catch (error) {
        console.error("测试失败:", error);
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // 计算统计
    const finalTask = tasks.find((t) => t.id === task.id);
    if (finalTask) {
      const matched = finalTask.items.filter((i) => i.isMatch).length;
      const tested = finalTask.items.filter((i) => i.aiLabel).length;
      const accuracy = tested > 0 ? Math.round((matched / tested) * 100) : 0;

      onChangeTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: "completed",
                summary: {
                  totalItems: t.items.length,
                  matchedCount: matched,
                  failedCount: tested - matched,
                  accuracy,
                  endedAt: Date.now(),
                },
              }
            : t
        )
      );
    }

    setIsRunning(false);
  };

  const rerunTask = (task: IntentTestTask & { baseUrl?: string }) => {
    // 重置所有结果
    onChangeTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: "running",
              items: t.items.map((i) => ({ ...i, aiLabel: undefined, isMatch: undefined })),
              summary: undefined,
            }
          : t
      )
    );
    setActiveTaskId(task.id);
    setViewMode("running");
    setTimeout(() => runTask(task), 100);
  };

  // ==================== 渲染 ====================

  const getModelLabel = (id: string) => id || "默认模型";

  // 数据集列表
  const renderDatasetsView = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>意图识别评测集</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            创建和管理评测集，人工标注意图类型（1-4）
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" onClick={() => setViewMode("tasks")}>
            查看测试任务
          </button>
          <button type="button" className="btn btn-primary" onClick={startCreateDataset}>
            ＋ 新建评测集
          </button>
        </div>
      </div>

      <div className="scroll-y" style={{ flex: 1 }}>
        {datasets.length === 0 ? (
          <div className="panel" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            <p>暂无评测集</p>
            <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={startCreateDataset}>
              创建第一个评测集
            </button>
          </div>
        ) : (
          datasets.map((dataset) => (
            <div
              key={dataset.id}
              className="panel"
              style={{ padding: "1rem", marginBottom: 12, cursor: "pointer" }}
              onClick={() => {
                setActiveDatasetId(dataset.id);
                setViewMode("datasetDetail");
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "1rem" }}>{dataset.name}</strong>
                  <span className="badge" style={{ marginLeft: 12, background: "rgba(37,99,235,0.1)", color: "var(--accent)" }}>
                    {dataset.items.length} 条
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditDataset(dataset);
                    }}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDataset(dataset.id);
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // 评测集编辑
  const renderDatasetEditView = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{editingDatasetId ? "编辑评测集" : "新建评测集"}</h2>
        <button type="button" className="btn" onClick={() => setViewMode("datasets")}>
          ← 返回
        </button>
      </div>

      <div className="panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "auto" }}>
        <input
          className="input"
          placeholder="评测集名称"
          value={datasetFormName}
          onChange={(e) => setDatasetFormName(e.target.value)}
        />
        <input
          className="input"
          placeholder="评测集描述（可选）"
          value={datasetFormDesc}
          onChange={(e) => setDatasetFormDesc(e.target.value)}
        />

        <div className="panel" style={{ padding: "0.75rem", background: "var(--bg-subtle)" }}>
          <div className="label">从问题库导入</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              className="select"
              value={importCategoryId}
              onChange={(e) => setImportCategoryId(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">选择分类...</option>
              {bank.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.questions.length} 条)
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={importFromQuestionBank} disabled={!importCategoryId}>
              导入
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 200 }}>
          <div className="label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>评测项（共 {datasetFormItems.length} 条）</span>
            <button type="button" className="btn" style={{ fontSize: "0.75rem" }} onClick={addDatasetItem}>
              ＋ 添加
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflow: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 50px",
                gap: 8,
                padding: "8px",
                background: "var(--bg-subtle)",
                fontWeight: 600,
                fontSize: "0.8rem",
              }}
            >
              <span>问题</span>
              <span>人工标注(1-4)</span>
              <span></span>
            </div>
            {datasetFormItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 50px",
                  gap: 8,
                  padding: "4px 8px",
                  alignItems: "center",
                }}
              >
                <input
                  className="input"
                  placeholder="输入问题"
                  value={item.question}
                  onChange={(e) => updateDatasetItem(item.id, "question", e.target.value)}
                  style={{ fontSize: "0.85rem" }}
                />
                <select
                  className="select"
                  value={item.humanLabel}
                  onChange={(e) => updateDatasetItem(item.id, "humanLabel", e.target.value)}
                  style={{ fontSize: "0.85rem" }}
                >
                  <option value="">选择...</option>
                  <option value="1">1-生图</option>
                  <option value="2">2-通用</option>
                  <option value="3">3-产品</option>
                  <option value="4">4-推荐</option>
                </select>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                  onClick={() => deleteDatasetItem(item.id)}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={saveDataset}>
            保存
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setViewMode("datasets")}>
            取消
          </button>
        </div>
      </div>
    </div>
  );

  // 评测集详情
  const renderDatasetDetailView = () => {
    if (!activeDataset) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{activeDataset.name}</h2>
            {activeDataset.description && (
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {activeDataset.description}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn" onClick={() => setViewMode("datasets")}>
              ← 返回
            </button>
            <button type="button" className="btn btn-primary" onClick={() => startEditDataset(activeDataset)}>
              编辑
            </button>
          </div>
        </div>

        <div className="panel" style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "50px 1fr 120px",
                gap: 8,
                padding: "8px",
                background: "var(--bg-subtle)",
                fontWeight: 600,
                fontSize: "0.8rem",
              }}
            >
              <span>序号</span>
              <span>问题</span>
              <span>人工标注</span>
            </div>
            {activeDataset.items.map((item, index) => (
              <div
                key={item.id}
                style={{ display: "grid", gridTemplateColumns: "50px 1fr 120px", gap: 8, padding: "8px", borderBottom: "1px solid var(--border)" }}
              >
                <span>{index + 1}</span>
                <span style={{ fontSize: "0.85rem" }}>{item.question}</span>
                <span style={{ fontSize: "0.85rem" }}>
                  {item.humanLabel ? (
                    <span className="chip">
                      {item.humanLabel}: {INTENT_MAP[item.humanLabel]}
                    </span>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 任务列表
  const renderTasksView = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>意图识别测试任务</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            运行评测集，对比人工标注与AI识别结果
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" onClick={() => setViewMode("datasets")}>
            查看评测集
          </button>
          <button type="button" className="btn btn-primary" onClick={startCreateTask}>
            ＋ 新建测试
          </button>
        </div>
      </div>

      <div className="scroll-y" style={{ flex: 1 }}>
        {tasks.length === 0 ? (
          <div className="panel" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            <p>暂无测试任务</p>
            <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={startCreateTask}>
              创建第一个测试
            </button>
          </div>
        ) : (
          tasks.map((task) => {
            const isCompleted = task.status === "completed";
            const testedCount = task.items.filter((i) => i.aiLabel).length;
            const matchedCount = task.items.filter((i) => i.isMatch).length;
            const accuracy = testedCount > 0 ? Math.round((matchedCount / testedCount) * 100) : 0;
            return (
              <div key={task.id} className="panel" style={{ padding: "1rem", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "1rem" }}>{task.name}</strong>
                    <span
                      className="badge"
                      style={{
                        marginLeft: 12,
                        background: isCompleted ? "rgba(22,163,74,0.1)" : "rgba(37,99,235,0.1)",
                        color: isCompleted ? "#16a34a" : "var(--accent)",
                      }}
                    >
                      {isCompleted ? "已完成" : "进行中"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setActiveTaskId(task.id);
                        setViewMode("taskDetail");
                      }}
                    >
                      查看详情
                    </button>
                    {isCompleted && (
                      <button type="button" className="btn btn-primary" onClick={() => rerunTask(task as IntentTestTask & { baseUrl?: string })}>
                        重新测试
                      </button>
                    )}
                    <button type="button" className="btn btn-danger" onClick={() => deleteTask(task.id)}>
                      删除
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 8 }}>
                  模型: {getModelLabel(task.modelId)} · 测试数: {task.items.length} 条 · 进度: {testedCount}/{task.items.length}
                  {testedCount > 0 && (
                    <>
                      <span style={{ marginLeft: 8 }}>|</span>
                      <span style={{ marginLeft: 8 }}>
                        通过率: <strong style={{ color: accuracy >= 80 ? "#16a34a" : accuracy >= 60 ? "#ca8a04" : "#dc2626" }}>
                          {accuracy}%
                        </strong>
                      </span>
                      <span style={{ marginLeft: 8 }}>
                        匹配: <strong style={{ color: "#16a34a" }}>{matchedCount}</strong>
                      </span>
                      <span style={{ marginLeft: 8 }}>
                        不匹配: <strong style={{ color: "#dc2626" }}>{testedCount - matchedCount}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // 创建任务
  const renderTaskCreateView = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>新建意图识别测试</h2>
          <button type="button" className="btn" onClick={() => setViewMode("tasks")}>
            ← 返回
          </button>
        </div>

        <div className="panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          <input className="input" placeholder="任务名称" value={taskFormName} onChange={(e) => setTaskFormName(e.target.value)} />

          <div>
            <div className="label">选择评测集</div>
            <select className="select" value={taskFormDatasetId} onChange={(e) => setTaskFormDatasetId(e.target.value)}>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.items.length} 条)
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="label">选择模型 (chat_svc)</div>
            <select className="select" value={taskFormModelId} onChange={(e) => setTaskFormModelId(e.target.value)}>
              <option value="">默认模型</option>
              {/* Qwen */}
              <option value="qwen">qwen</option>
              <option value="qwen-vl">qwen-vl</option>
              <option value="qwen-vl-closet">qwen-vl-closet</option>
              <option value="qwen-vl-calo">qwen-vl-calo</option>
              <option value="qwen-turbo">qwen-turbo</option>
              <option value="qwen-max">qwen-max</option>
              <option value="qwen3max">qwen3max</option>
              {/* GPT */}
              <option value="closet_gpt4o">closet_gpt4o</option>
              <option value="closet_gpt4omini">closet_gpt4omini</option>
              <option value="closet_gpt54mini">closet_gpt54mini</option>
              <option value="closet_gpt51">closet_gpt51</option>
              {/* Gemini */}
              <option value="gemini3.1flash-lite">gemini3.1flash-lite</option>
              <option value="gemini3.1pro">gemini3.1pro</option>
            </select>
          </div>

          <div>
            <div className="label">意图识别提示词（prompt_closet_chat_detect）</div>
            <textarea
              className="textarea-field"
              rows={6}
              placeholder="输入自定义意图识别提示词，留空使用系统默认"
              value={taskFormDetectPrompt}
              onChange={(e) => setTaskFormDetectPrompt(e.target.value)}
            />
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
              用于覆盖默认的 closet_chat_detect 提示词
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
            <button type="button" className="btn btn-primary" onClick={createTask}>
              开始测试
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setViewMode("tasks")}>
              取消
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 运行中视图
  const renderRunningView = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0, alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: "3rem" }}>⏳</div>
      <h2 style={{ margin: 0 }}>测试中...</h2>
      <div style={{ fontSize: "1.2rem", color: "var(--accent)" }}>
        {runningProgress.current} / {runningProgress.total}
      </div>
      <div style={{ width: 300, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            width: `${(runningProgress.current / runningProgress.total) * 100}%`,
            height: "100%",
            background: "var(--accent)",
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );

  // 任务详情
  const renderTaskDetailView = () => {
    if (!activeTask) return null;
    const isCompleted = activeTask.status === "completed";
    const testedCount = activeTask.items.filter((i) => i.aiLabel).length;
    const matchedCount = activeTask.items.filter((i) => i.isMatch).length;
    const accuracy = testedCount > 0 ? Math.round((matchedCount / testedCount) * 100) : 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{activeTask.name}</h2>
              <span
                className="badge"
                style={{
                  background: isCompleted ? "rgba(22,163,74,0.1)" : "rgba(37,99,235,0.1)",
                  color: isCompleted ? "#16a34a" : "var(--accent)",
                }}
              >
                {isCompleted ? "已完成" : "进行中"}
              </span>
            </div>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              模型: {getModelLabel(activeTask.modelId)} · 共 {activeTask.items.length} 条
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {isCompleted && (
              <button type="button" className="btn btn-primary" onClick={() => rerunTask(activeTask as IntentTestTask & { baseUrl?: string })}>
                重新测试
              </button>
            )}
            <button type="button" className="btn" onClick={() => setViewMode("tasks")}>
              返回列表
            </button>
          </div>
        </div>

        {/* 统计面板 */}
        <div className="panel" style={{ padding: "1rem", display: "flex", gap: 24 }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>测试数</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{activeTask.items.length}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>当前进度</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>
              {testedCount}/{activeTask.items.length}
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginLeft: 4 }}>
                ({Math.round((testedCount / activeTask.items.length) * 100)}%)
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>通过率</div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                color: accuracy >= 80 ? "#16a34a" : accuracy >= 60 ? "#ca8a04" : "#dc2626",
              }}
            >
              {accuracy}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>匹配</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#16a34a" }}>{matchedCount}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>不匹配</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#dc2626" }}>{testedCount - matchedCount}</div>
          </div>
        </div>

        {/* 使用的提示词 */}
        {activeTask.systemPrompt && (
          <div className="panel" style={{ padding: "0.75rem 1rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 8 }}>
              使用的意图识别提示词 (prompt_closet_chat_detect)
            </div>
            <details>
              <summary style={{ cursor: "pointer", fontSize: "0.8rem", color: "var(--accent)" }}>
                点击查看提示词内容
              </summary>
              <pre
                style={{
                  margin: "8px 0 0",
                  padding: "0.75rem",
                  background: "var(--bg-subtle)",
                  borderRadius: 6,
                  fontSize: "0.8rem",
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--font-mono)",
                  maxHeight: 200,
                  overflow: "auto",
                }}
              >
                {activeTask.systemPrompt}
              </pre>
            </details>
          </div>
        )}

        <div className="panel" style={{ flex: 1, overflow: "auto", padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 50 }}>序号</th>
                <th>问题</th>
                <th style={{ width: 160, whiteSpace: "nowrap" }}>人工打标</th>
                <th style={{ width: 160, whiteSpace: "nowrap" }}>AI打标</th>
                <th style={{ width: 100, whiteSpace: "nowrap" }}>结果</th>
              </tr>
            </thead>
            <tbody>
              {activeTask.items.map((item, index) => (
                <tr
                  key={item.id}
                  style={{
                    background:
                      item.isMatch === false
                        ? "rgba(220,38,38,0.05)"
                        : item.isMatch === true
                        ? "rgba(22,163,74,0.05)"
                        : undefined,
                  }}
                >
                  <td>{index + 1}</td>
                  <td style={{ maxWidth: 400 }}>
                    <div style={{ fontSize: "0.9rem" }}>{item.question}</div>
                  </td>
                  <td>
                    {item.humanLabel ? (
                      <span className="chip">
                        {item.humanLabel}: {INTENT_MAP[item.humanLabel]}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {item.aiLabel ? (
                      <span className="chip" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                        {item.aiLabel}: {INTENT_MAP[item.aiLabel]}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {item.isMatch === true && <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ 一致</span>}
                    {item.isMatch === false && <span style={{ color: "#dc2626", fontWeight: 600 }}>✗ 不一致</span>}
                    {item.isMatch === undefined && <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 主渲染
  switch (viewMode) {
    case "datasets":
      return renderDatasetsView();
    case "createDataset":
      return renderDatasetEditView();
    case "datasetDetail":
      return renderDatasetDetailView();
    case "tasks":
      return renderTasksView();
    case "createTask":
      return renderTaskCreateView();
    case "running":
      return renderRunningView();
    case "taskDetail":
      return renderTaskDetailView();
    default:
      return renderDatasetsView();
  }
}
