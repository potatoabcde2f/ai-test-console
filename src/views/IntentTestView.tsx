import { useState } from "react";
import type {
  IntentTestTask,
  IntentTestItem,
  IntentTestDataset,
  QuestionBank,
  PromptTemplate,
} from "../types";
import { MODEL_PRESETS } from "../lib/models";
import { mockAssistantReply } from "../lib/mockAI";
import { uid } from "../lib/ids";

interface Props {
  tasks: IntentTestTask[];
  onChangeTasks: (updater: (prev: IntentTestTask[]) => IntentTestTask[]) => void;
  datasets: IntentTestDataset[];
  onChangeDatasets: (updater: (prev: IntentTestDataset[]) => IntentTestDataset[]) => void;
  questionBank: QuestionBank;
  prompts: PromptTemplate[];
}

const EMPTY_BANK: QuestionBank = {
  categories: [],
};

export function IntentTestView({
  tasks,
  onChangeTasks,
  datasets,
  onChangeDatasets,
  questionBank,
  prompts,
}: Props) {
  const bank = questionBank ?? EMPTY_BANK;

  // 视图模式: "datasets" | "tasks" | "createDataset" | "createTask" | "datasetDetail" | "taskDetail"
  const [viewMode, setViewMode] = useState<"datasets" | "tasks" | "createDataset" | "createTask" | "datasetDetail" | "taskDetail">("datasets");

  // 当前选中的评测集/任务ID
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // 评测集编辑状态
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [datasetFormName, setDatasetFormName] = useState("");
  const [datasetFormDesc, setDatasetFormDesc] = useState("");
  const [datasetFormIntentTypes, setDatasetFormIntentTypes] = useState<string[]>(["查询", "购买", "投诉", "咨询", "其他"]);
  const [datasetFormItems, setDatasetFormItems] = useState<IntentTestItem[]>([]);
  const [newIntentType, setNewIntentType] = useState("");
  const [importCategoryId, setImportCategoryId] = useState("");

  // 任务创建状态
  const [taskFormName, setTaskFormName] = useState("");
  const [taskFormPromptId, setTaskFormPromptId] = useState("");
  const [taskFormModelId, setTaskFormModelId] = useState(MODEL_PRESETS[0]?.id ?? "");
  const [taskFormDatasetId, setTaskFormDatasetId] = useState("");

  // 任务运行状态
  const [runningItemId, setRunningItemId] = useState<string | null>(null);

  // 当前数据
  const activeDataset = datasets.find((d) => d.id === activeDatasetId);
  const activeTask = tasks.find((t) => t.id === activeTaskId);

  // ==================== 评测集管理 ====================

  // 开始创建评测集
  const startCreateDataset = () => {
    setEditingDatasetId(null);
    setDatasetFormName("");
    setDatasetFormDesc("");
    setDatasetFormIntentTypes(["查询", "购买", "投诉", "咨询", "其他"]);
    setDatasetFormItems([]);
    setNewIntentType("");
    setImportCategoryId("");
    setViewMode("createDataset");
  };

  // 开始编辑评测集
  const startEditDataset = (dataset: IntentTestDataset) => {
    setEditingDatasetId(dataset.id);
    setDatasetFormName(dataset.name);
    setDatasetFormDesc(dataset.description ?? "");
    setDatasetFormIntentTypes([...dataset.intentTypes]);
    setDatasetFormItems(dataset.items.map((item) => ({ ...item })));
    setNewIntentType("");
    setImportCategoryId("");
    setViewMode("createDataset");
  };

  // 保存评测集
  const saveDataset = () => {
    if (!datasetFormName.trim()) {
      window.alert("请填写评测集名称");
      return;
    }
    if (datasetFormItems.length === 0) {
      window.alert("请至少添加一个评测项");
      return;
    }

    const now = Date.now();
    if (editingDatasetId) {
      // 更新现有评测集
      onChangeDatasets((prev) =>
        prev.map((d) =>
          d.id === editingDatasetId
            ? {
                ...d,
                name: datasetFormName.trim(),
                description: datasetFormDesc.trim(),
                intentTypes: datasetFormIntentTypes,
                items: datasetFormItems,
                updatedAt: now,
              }
            : d
        )
      );
    } else {
      // 创建新评测集
      const newDataset: IntentTestDataset = {
        id: uid("itd"),
        name: datasetFormName.trim(),
        description: datasetFormDesc.trim(),
        intentTypes: datasetFormIntentTypes,
        items: datasetFormItems,
        createdAt: now,
        updatedAt: now,
      };
      onChangeDatasets((prev) => [...prev, newDataset]);
    }
    setViewMode("datasets");
  };

  // 删除评测集
  const deleteDataset = (id: string) => {
    const relatedTasks = tasks.filter((t) => t.items.some((i) => datasets.find((d) => d.id === id)?.items.some((di) => di.id === i.id)));
    if (relatedTasks.length > 0) {
      if (!window.confirm(`该评测集已被 ${relatedTasks.length} 个任务使用，确定删除吗？`)) return;
    } else {
      if (!window.confirm("确定删除此评测集？")) return;
    }
    onChangeDatasets((prev) => prev.filter((d) => d.id !== id));
    if (activeDatasetId === id) setActiveDatasetId(null);
  };

  // 从问题库导入到评测集
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

  // 添加空评测项
  const addDatasetItem = () => {
    setDatasetFormItems((prev) => [
      ...prev,
      { id: uid("iti"), question: "", humanLabel: "", createdAt: Date.now() },
    ]);
  };

  // 更新评测项
  const updateDatasetItem = (id: string, field: "question" | "humanLabel", value: string) => {
    setDatasetFormItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // 删除评测项
  const deleteDatasetItem = (id: string) => {
    setDatasetFormItems((prev) => prev.filter((item) => item.id !== id));
  };

  // 添加意图类型
  const addIntentType = () => {
    const type = newIntentType.trim();
    if (!type) return;
    if (datasetFormIntentTypes.includes(type)) {
      window.alert("该意图类型已存在");
      return;
    }
    setDatasetFormIntentTypes((prev) => [...prev, type]);
    setNewIntentType("");
  };

  // 删除意图类型
  const removeIntentType = (type: string) => {
    setDatasetFormIntentTypes((prev) => prev.filter((t) => t !== type));
  };

  // ==================== 测试任务管理 ====================

  // 开始创建任务
  const startCreateTask = () => {
    if (datasets.length === 0) {
      window.alert("请先创建评测集");
      return;
    }
    setTaskFormName("");
    setTaskFormPromptId(prompts[0]?.id ?? "");
    setTaskFormModelId(MODEL_PRESETS[0]?.id ?? "");
    setTaskFormDatasetId(datasets[0]?.id ?? "");
    setViewMode("createTask");
  };

  // 创建任务
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

    const prompt = prompts.find((p) => p.id === taskFormPromptId);
    if (!prompt) {
      window.alert("所选提示词不存在");
      return;
    }

    const task: IntentTestTask = {
      id: uid("itt"),
      name: taskFormName.trim(),
      status: "running",
      items: dataset.items.map((item) => ({ ...item })), // 复制评测集数据
      promptId: taskFormPromptId,
      systemPrompt: prompt.systemPrompt,
      modelId: taskFormModelId,
      progress: { current: 0, total: dataset.items.length },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onChangeTasks((prev) => [task, ...prev]);
    setViewMode("tasks");
  };

  // 删除任务
  const deleteTask = (id: string) => {
    if (!window.confirm("确定删除此测试任务？")) return;
    onChangeTasks((prev) => prev.filter((t) => t.id !== id));
    if (activeTaskId === id) {
      setActiveTaskId(null);
      setViewMode("tasks");
    }
  };

  // 运行单个评测项
  const runItem = async (task: IntentTestTask, itemId: string) => {
    const item = task.items.find((i) => i.id === itemId);
    if (!item) return;

    setRunningItemId(itemId);

    try {
      const model = MODEL_PRESETS.find((m) => m.id === task.modelId)!;
      const result = await mockAssistantReply({
        model,
        systemPrompt: task.systemPrompt,
        userProfile: "",
        visibleMessages: [
          {
            id: uid("msg"),
            role: "user",
            content: item.question,
            createdAt: Date.now(),
          },
        ],
        fewShot: null,
      });

      const aiLabel = result.content.trim();
      const isMatch = aiLabel === item.humanLabel;

      onChangeTasks((prev) =>
        prev.map((t) => {
          if (t.id !== task.id) return t;
          return {
            ...t,
            items: t.items.map((i) =>
              i.id === itemId ? { ...i, aiLabel, isMatch } : i
            ),
            progress: {
              current: t.items.filter((i) => i.aiLabel !== undefined).length,
              total: t.items.length,
            },
            updatedAt: Date.now(),
          };
        })
      );
    } catch (e) {
      console.error(e);
      window.alert("运行失败");
    } finally {
      setRunningItemId(null);
    }
  };

  // 运行所有未测试项
  const runAllItems = async (task: IntentTestTask) => {
    const untestedItems = task.items.filter((i) => !i.aiLabel);
    if (untestedItems.length === 0) {
      window.alert("所有评测项已完成");
      return;
    }

    for (const item of untestedItems) {
      await runItem(task, item.id);
    }
  };

  // 结束任务
  const endTask = (task: IntentTestTask) => {
    const matchedCount = task.items.filter((i) => i.isMatch).length;
    const failedCount = task.items.filter((i) => i.aiLabel && !i.isMatch).length;
    const testedCount = matchedCount + failedCount;
    const accuracy = testedCount > 0 ? Math.round((matchedCount / testedCount) * 100) : 0;

    onChangeTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: "completed",
              summary: {
                totalItems: task.items.length,
                matchedCount,
                failedCount,
                accuracy,
                endedAt: Date.now(),
              },
            }
          : t
      )
    );
    if (viewMode === "taskDetail") {
      setViewMode("tasks");
    }
  };

  // 辅助函数
  const getModelLabel = (id: string) => MODEL_PRESETS.find((m) => m.id === id)?.label ?? id;
  const getPromptLabel = (id: string) => prompts.find((p) => p.id === id)?.name ?? id;

  // ==================== 渲染 ====================

  // 评测集列表视图
  const renderDatasetsView = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>意图识别评测集</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            创建和管理评测集，人工标注后可用于多次测试
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
                  <span
                    className="badge"
                    style={{
                      marginLeft: 12,
                      background: "rgba(37,99,235,0.1)",
                      color: "var(--accent)",
                    }}
                  >
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
              {dataset.description && (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 8 }}>
                  {dataset.description}
                </div>
              )}
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>
                意图类型: {dataset.intentTypes.join(" / ")}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // 评测集编辑/创建视图
  const renderDatasetEditView = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{editingDatasetId ? "编辑评测集" : "新建评测集"}</h2>
        <button type="button" className="btn" onClick={() => setViewMode("datasets")}>
          ← 返回
        </button>
      </div>

      <div className="panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "auto" }}>
        {/* 基本信息 */}
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

        {/* 意图类型配置 */}
        <div className="panel" style={{ padding: "0.75rem", background: "var(--bg-subtle)" }}>
          <div className="label">意图类型定义</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {datasetFormIntentTypes.map((type) => (
              <span
                key={type}
                className="chip"
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                {type}
                <button
                  type="button"
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#dc2626", fontSize: "0.75rem" }}
                  onClick={() => removeIntentType(type)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              placeholder="新增意图类型"
              value={newIntentType}
              onChange={(e) => setNewIntentType(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addIntentType(); }}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn" onClick={addIntentType}>添加</button>
          </div>
        </div>

        {/* 从问题库导入 */}
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
            <button
              type="button"
              className="btn btn-primary"
              onClick={importFromQuestionBank}
              disabled={!importCategoryId}
            >
              导入
            </button>
          </div>
        </div>

        {/* 评测集编辑表格 */}
        <div style={{ flex: 1, minHeight: 200 }}>
          <div className="label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>评测项（共 {datasetFormItems.length} 条）</span>
            <button type="button" className="btn" style={{ fontSize: "0.75rem" }} onClick={addDatasetItem}>
              ＋ 添加评测项
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflow: "auto" }}>
            {/* 表头 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 40px", gap: 8, padding: "8px", background: "var(--bg-subtle)", fontWeight: 600, fontSize: "0.8rem" }}>
              <span>问题</span>
              <span>人工标注意图</span>
              <span></span>
            </div>
            {/* 表格行 */}
            {datasetFormItems.map((item) => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 150px 40px", gap: 8, padding: "4px 8px", alignItems: "center" }}>
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
                  <option value="">请选择...</option>
                  {datasetFormIntentTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
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
            保存评测集
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setViewMode("datasets")}>
            取消
          </button>
        </div>
      </div>
    </div>
  );

  // 评测集详情视图
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

        <div className="panel" style={{ padding: "0.75rem", background: "var(--bg-subtle)", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>评测项数量</span>
            <div style={{ fontWeight: 600 }}>{activeDataset.items.length}</div>
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>意图类型</span>
            <div style={{ fontWeight: 600 }}>{activeDataset.intentTypes.join(" / ")}</div>
          </div>
        </div>

        <div className="panel" style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* 表头 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 8, padding: "8px", background: "var(--bg-subtle)", fontWeight: 600, fontSize: "0.8rem" }}>
              <span>问题</span>
              <span>人工标注意图</span>
            </div>
            {/* 表格行 */}
            {activeDataset.items.map((item) => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 8, padding: "8px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: "0.85rem" }}>{item.question}</span>
                <span style={{ fontSize: "0.85rem" }}>{item.humanLabel || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 任务列表视图
  const renderTasksView = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>意图识别测试任务</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            选择评测集和模型，运行意图识别测试
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" onClick={() => setViewMode("datasets")}>
            查看评测集
          </button>
          <button type="button" className="btn btn-primary" onClick={startCreateTask}>
            ＋ 新建测试任务
          </button>
        </div>
      </div>

      <div className="scroll-y" style={{ flex: 1 }}>
        {tasks.length === 0 ? (
          <div className="panel" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            <p>暂无测试任务</p>
            <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={startCreateTask}>
              创建第一个任务
            </button>
          </div>
        ) : (
          tasks.map((task) => {
            const isRunning = task.status === "running";
            const testedCount = task.items.filter((i) => i.aiLabel).length;

            return (
              <div key={task.id} className="panel" style={{ padding: "1rem", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "1rem" }}>{task.name}</strong>
                    <span
                      className="badge"
                      style={{
                        marginLeft: 12,
                        background: isRunning ? "rgba(37,99,235,0.1)" : "rgba(22,163,74,0.1)",
                        color: isRunning ? "var(--accent)" : "#16a34a",
                      }}
                    >
                      {isRunning ? "进行中" : "已完成"}
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
                      {isRunning ? "继续测试" : "查看详情"}
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => deleteTask(task.id)}>
                      删除
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 8 }}>
                  模型: {getModelLabel(task.modelId)} · 提示词: {getPromptLabel(task.promptId)} · {testedCount}/{task.items.length} 已测
                </div>
                {task.summary && (
                  <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: "0.78rem" }}>
                    <span>
                      准确率: <strong style={{ color: task.summary.accuracy >= 80 ? "#16a34a" : task.summary.accuracy >= 60 ? "#ca8a04" : "#dc2626" }}>
                        {task.summary.accuracy}%
                      </strong>
                    </span>
                    <span>通过: <strong style={{ color: "#16a34a" }}>{task.summary.matchedCount}</strong></span>
                    <span>不通过: <strong style={{ color: "#dc2626" }}>{task.summary.failedCount}</strong></span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // 任务创建视图
  const renderTaskCreateView = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>新建测试任务</h2>
        <button type="button" className="btn" onClick={() => setViewMode("tasks")}>
          ← 返回
        </button>
      </div>

      <div className="panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <input
          className="input"
          placeholder="任务名称"
          value={taskFormName}
          onChange={(e) => setTaskFormName(e.target.value)}
        />

        <div>
          <div className="label">选择评测集</div>
          <select
            className="select"
            value={taskFormDatasetId}
            onChange={(e) => setTaskFormDatasetId(e.target.value)}
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.items.length} 条)
              </option>
            ))}
          </select>
          {taskFormDatasetId && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
              将使用评测集中的 {datasets.find((d) => d.id === taskFormDatasetId)?.items.length} 条评测项
            </div>
          )}
        </div>

        <div>
          <div className="label">选择模型</div>
          <select
            className="select"
            value={taskFormModelId}
            onChange={(e) => setTaskFormModelId(e.target.value)}
          >
            {MODEL_PRESETS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="label">选择提示词</div>
          <select
            className="select"
            value={taskFormPromptId}
            onChange={(e) => setTaskFormPromptId(e.target.value)}
          >
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
          <button type="button" className="btn btn-primary" onClick={createTask}>
            创建任务
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setViewMode("tasks")}>
            取消
          </button>
        </div>
      </div>
    </div>
  );

  // 任务详情视图
  const renderTaskDetailView = () => {
    if (!activeTask) return null;
    const isRunning = activeTask.status === "running";
    const testedCount = activeTask.items.filter((i) => i.aiLabel).length;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
        {/* 任务头部 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <strong style={{ fontSize: "1rem" }}>{activeTask.name}</strong>
            <span
              className="badge"
              style={{
                marginLeft: 12,
                background: isRunning ? "rgba(37,99,235,0.1)" : "rgba(22,163,74,0.1)",
                color: isRunning ? "var(--accent)" : "#16a34a",
              }}
            >
              {isRunning ? "进行中" : "已完成"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {isRunning && (
              <>
                <button type="button" className="btn btn-primary" onClick={() => runAllItems(activeTask)}>
                  运行全部未测
                </button>
                <button type="button" className="btn" onClick={() => endTask(activeTask)}>
                  结束任务
                </button>
              </>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setViewMode("tasks")}>
              返回列表
            </button>
          </div>
        </div>

        {/* 任务配置摘要 */}
        <div className="panel" style={{ padding: "0.75rem", background: "var(--bg-subtle)", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>模型</span>
            <div style={{ fontWeight: 600 }}>{getModelLabel(activeTask.modelId)}</div>
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>评测项</span>
            <div style={{ fontWeight: 600 }}>{activeTask.items.length}</div>
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>进度</span>
            <div style={{ fontWeight: 600 }}>{testedCount} / {activeTask.items.length}</div>
          </div>
          {activeTask.summary && (
            <>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>准确率</span>
                <div style={{ fontWeight: 600, color: activeTask.summary.accuracy >= 80 ? "#16a34a" : activeTask.summary.accuracy >= 60 ? "#ca8a04" : "#dc2626" }}>
                  {activeTask.summary.accuracy}%
                </div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>通过/不通过</span>
                <div style={{ fontWeight: 600 }}>
                  <span style={{ color: "#16a34a" }}>{activeTask.summary.matchedCount}</span> / <span style={{ color: "#dc2626" }}>{activeTask.summary.failedCount}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 评测结果表格 */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* 表头 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 80px 100px", gap: 8, padding: "10px", background: "var(--bg-subtle)", fontWeight: 600, fontSize: "0.8rem", position: "sticky", top: 0 }}>
              <span>问题</span>
              <span>人工标注</span>
              <span>AI识别</span>
              <span>结果</span>
              <span>操作</span>
            </div>
            {/* 表格行 */}
            {activeTask.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 120px 80px 100px",
                  gap: 8,
                  padding: "8px 10px",
                  alignItems: "center",
                  background: item.isMatch === false ? "rgba(220,38,38,0.05)" : item.isMatch === true ? "rgba(22,163,74,0.05)" : "transparent",
                  borderLeft: item.isMatch === false ? "3px solid #dc2626" : item.isMatch === true ? "3px solid #16a34a" : "none",
                }}
              >
                <span style={{ fontSize: "0.85rem" }}>{item.question}</span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{item.humanLabel}</span>
                <span style={{ fontSize: "0.8rem", color: item.aiLabel ? "var(--text)" : "var(--text-muted)" }}>
                  {item.aiLabel ?? "—"}
                </span>
                <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                  {item.isMatch === true && <span style={{ color: "#16a34a" }}>✓ 通过</span>}
                  {item.isMatch === false && <span style={{ color: "#dc2626" }}>✗ 不通过</span>}
                  {item.isMatch === undefined && <span style={{ color: "var(--text-muted)" }}>待测试</span>}
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                  disabled={runningItemId === item.id || !isRunning}
                  onClick={() => runItem(activeTask, item.id)}
                >
                  {runningItemId === item.id ? "测试中..." : item.aiLabel ? "重测" : "测试"}
                </button>
              </div>
            ))}
          </div>
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
    case "taskDetail":
      return renderTaskDetailView();
    default:
      return renderDatasetsView();
  }
}
