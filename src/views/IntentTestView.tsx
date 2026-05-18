import { useState } from "react";
import type {
  IntentTestTask,
  IntentTestItem,
  QuestionBank,
  PromptTemplate,
} from "../types";
import { MODEL_PRESETS } from "../lib/models";
import { mockAssistantReply } from "../lib/mockAI";
import { uid } from "../lib/ids";

interface Props {
  tasks: IntentTestTask[];
  onChangeTasks: (updater: (prev: IntentTestTask[]) => IntentTestTask[]) => void;
  questionBank: QuestionBank;
  prompts: PromptTemplate[];
}

const EMPTY_BANK: QuestionBank = {
  categories: [],
};

export function IntentTestView({ tasks, onChangeTasks, questionBank, prompts }: Props) {
  const bank = questionBank ?? EMPTY_BANK;

  // 创建任务相关状态
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPromptId, setFormPromptId] = useState("");
  const [formModelId, setFormModelId] = useState(MODEL_PRESETS[0]?.id ?? "");
  const [formCategoryId, setFormCategoryId] = useState("");

  // 评测集编辑状态
  const [editingItems, setEditingItems] = useState<IntentTestItem[]>([]);
  const [intentTypes, setIntentTypes] = useState<string[]>(["查询", "购买", "投诉", "咨询", "其他"]);
  const [newIntentType, setNewIntentType] = useState("");

  // 任务详情/执行状态
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [runningItemId, setRunningItemId] = useState<string | null>(null);

  // 从问题库导入
  const importFromQuestionBank = () => {
    if (!formCategoryId) {
      window.alert("请先选择问题分类");
      return;
    }
    const category = bank.categories.find((c) => c.id === formCategoryId);
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
    setEditingItems((prev) => [...prev, ...newItems]);
    setFormCategoryId("");
  };

  // 添加空行
  const addEmptyItem = () => {
    setEditingItems((prev) => [
      ...prev,
      {
        id: uid("iti"),
        question: "",
        humanLabel: "",
        createdAt: Date.now(),
      },
    ]);
  };

  // 更新评测项
  const updateItem = (id: string, field: "question" | "humanLabel", value: string) => {
    setEditingItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // 删除评测项
  const deleteItem = (id: string) => {
    setEditingItems((prev) => prev.filter((item) => item.id !== id));
  };

  // 添加意图类型
  const addIntentType = () => {
    const type = newIntentType.trim();
    if (!type) return;
    if (intentTypes.includes(type)) {
      window.alert("该意图类型已存在");
      return;
    }
    setIntentTypes((prev) => [...prev, type]);
    setNewIntentType("");
  };

  // 删除意图类型
  const removeIntentType = (type: string) => {
    setIntentTypes((prev) => prev.filter((t) => t !== type));
  };

  // 创建任务
  const createTask = () => {
    if (!formName.trim()) {
      window.alert("请填写任务名称");
      return;
    }
    if (!formPromptId) {
      window.alert("请选择提示词");
      return;
    }
    if (editingItems.length === 0) {
      window.alert("请至少添加一个评测项");
      return;
    }

    const prompt = prompts.find((p) => p.id === formPromptId);
    if (!prompt) {
      window.alert("所选提示词不存在");
      return;
    }

    const task: IntentTestTask = {
      id: uid("itt"),
      name: formName.trim(),
      status: "running",
      items: editingItems.map((item) => ({ ...item })),
      promptId: formPromptId,
      systemPrompt: prompt.systemPrompt,
      modelId: formModelId,
      progress: { current: 0, total: editingItems.length },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onChangeTasks((prev) => [task, ...prev]);
    setFormName("");
    setFormPromptId("");
    setFormModelId(MODEL_PRESETS[0]?.id ?? "");
    setEditingItems([]);
    setCreating(false);
    setActiveTaskId(task.id);
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

      // 从AI回复中提取意图（假设回复就是意图类型）
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
              current: t.items.filter((i) => i.aiLabel !== undefined).length + 1,
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
    setActiveTaskId(null);
  };

  // 删除任务
  const deleteTask = (id: string) => {
    if (!window.confirm("确定删除此意图识别测试任务？")) return;
    onChangeTasks((prev) => prev.filter((t) => t.id !== id));
    if (activeTaskId === id) setActiveTaskId(null);
  };

  const getModelLabel = (id: string) => MODEL_PRESETS.find((m) => m.id === id)?.label ?? id;

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      {/* 标题栏 */}
      <div>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>意图识别测试</h2>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          构建评测集，配置提示词，测试AI意图识别准确率
        </p>
      </div>

      {/* 创建任务按钮 */}
      {!creating && !activeTaskId && (
        <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => setCreating(true)}>
          ＋ 新建意图识别测试
        </button>
      )}

      {/* 创建任务表单 */}
      {creating && !activeTaskId && (
        <div className="panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "auto" }}>
          <div className="label" style={{ fontSize: "1rem", fontWeight: 600 }}>新建意图识别测试任务</div>

          {/* 任务名称 */}
          <input className="input" placeholder="任务名称" value={formName} onChange={(e) => setFormName(e.target.value)} />

          {/* 模型选择 */}
          <div>
            <div className="label">选择模型</div>
            <select className="select" value={formModelId} onChange={(e) => setFormModelId(e.target.value)}>
              {MODEL_PRESETS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* 提示词选择 */}
          <div>
            <div className="label">选择提示词</div>
            <select className="select" value={formPromptId} onChange={(e) => setFormPromptId(e.target.value)}>
              <option value="">请选择...</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 意图类型配置 */}
          <div className="panel" style={{ padding: "0.75rem", background: "var(--bg-subtle)" }}>
            <div className="label">意图类型定义</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {intentTypes.map((type) => (
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
              <select className="select" value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)} style={{ flex: 1 }}>
                <option value="">选择分类...</option>
                {bank.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name} ({cat.questions.length} 条)</option>
                ))}
              </select>
              <button type="button" className="btn btn-primary" onClick={importFromQuestionBank} disabled={!formCategoryId}>
                导入
              </button>
            </div>
          </div>

          {/* 评测集编辑表格 */}
          <div style={{ flex: 1, minHeight: 200 }}>
            <div className="label">评测集（共 {editingItems.length} 条）</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflow: "auto" }}>
              {/* 表头 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 40px", gap: 8, padding: "8px", background: "var(--bg-subtle)", fontWeight: 600, fontSize: "0.8rem" }}>
                <span>问题</span>
                <span>人工标注意图</span>
                <span></span>
              </div>
              {/* 表格行 */}
              {editingItems.map((item) => (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 150px 40px", gap: 8, padding: "4px 8px", alignItems: "center" }}>
                  <input
                    className="input"
                    placeholder="输入问题"
                    value={item.question}
                    onChange={(e) => updateItem(item.id, "question", e.target.value)}
                    style={{ fontSize: "0.85rem" }}
                  />
                  <select
                    className="select"
                    value={item.humanLabel}
                    onChange={(e) => updateItem(item.id, "humanLabel", e.target.value)}
                    style={{ fontSize: "0.85rem" }}
                  >
                    <option value="">请选择...</option>
                    {intentTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-danger" style={{ padding: "2px 8px", fontSize: "0.75rem" }} onClick={() => deleteItem(item.id)}>
                    删除
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn" style={{ marginTop: 8 }} onClick={addEmptyItem}>
              ＋ 添加评测项
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={createTask}>
              创建任务
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setCreating(false); setEditingItems([]); }}>
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
                  <button type="button" className="btn btn-primary" onClick={() => runAllItems(activeTask)}>
                    运行全部未测
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
              <div style={{ fontWeight: 600 }}>
                {activeTask.items.filter((i) => i.aiLabel).length} / {activeTask.items.length}
              </div>
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
                    disabled={runningItemId === item.id}
                    onClick={() => runItem(activeTask, item.id)}
                  >
                    {runningItemId === item.id ? "测试中..." : item.aiLabel ? "重测" : "测试"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      {!activeTaskId && !creating && (
        <div className="scroll-y" style={{ flex: 1 }}>
          <div className="label" style={{ marginBottom: 8 }}>任务列表</div>
          {tasks.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>暂无任务。点击上方按钮创建。</p>
          ) : (
            tasks.map((task) => {
              const isRunning = task.status === "running";
              const testedCount = task.items.filter((i) => i.aiLabel).length;

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
                        {testedCount}/{task.items.length} 已测 · {getModelLabel(task.modelId)}
                      </span>
                      <button type="button" className="btn" onClick={() => setActiveTaskId(task.id)}>
                        {isRunning ? "继续测试" : "查看详情"}
                      </button>
                      <button type="button" className="btn btn-danger" onClick={() => deleteTask(task.id)}>
                        删除
                      </button>
                    </div>
                  </div>
                  {task.summary && (
                    <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: "0.78rem" }}>
                      <span>准确率: <strong style={{ color: task.summary.accuracy >= 80 ? "#16a34a" : task.summary.accuracy >= 60 ? "#ca8a04" : "#dc2626" }}>{task.summary.accuracy}%</strong></span>
                      <span>通过: <strong style={{ color: "#16a34a" }}>{task.summary.matchedCount}</strong></span>
                      <span>不通过: <strong style={{ color: "#dc2626" }}>{task.summary.failedCount}</strong></span>
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
