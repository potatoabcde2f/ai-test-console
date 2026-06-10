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
  const [showPromptConfig, setShowPromptConfig] = useState(false);

  // 测试模式：prompt_compare | model_compare
  const [testMode, setTestMode] = useState<"prompt_compare" | "model_compare">("prompt_compare");

  // 是否使用UID数据隔离（每个问题不同UID）
  const [isolateUid, setIsolateUid] = useState(false);

  // 模型对比模式：选中的模型（1-3个）
  const [formModelIds, setFormModelIds] = useState<string[]>([]);
  // Prompt对比模式：选中的单个模型
  const [formModelId, setFormModelId] = useState<string>("");

  // Prompt 对比配置
  const [promptCompareConfig, setPromptCompareConfig] = useState({
    promptKey: "prompt_closet_chat",
    promptA: "",
    promptB: "",
  });

  // Prompt 参数选项（用于下拉选择）
  const PROMPT_OPTIONS = [
    { key: "prompt_closet_chat", label: "prompt_closet_chat - 穿搭顾问对话" },
    { key: "prompt_closet_chat_detect", label: "prompt_closet_chat_detect - 意图识别" },
    { key: "prompt_img_extract_system", label: "prompt_img_extract_system - 生图提示词撰写" },
    { key: "prompt_closet_chat_image", label: "prompt_closet_chat_image - 图片穿搭顾问" },
    { key: "prompt_closet_chat_product", label: "prompt_closet_chat_product - 产品介绍" },
    { key: "prompt_closet_trend_filter", label: "prompt_closet_trend_filter - 穿搭意图解析器" },
    { key: "prompt_closet_chat_sum", label: "prompt_closet_chat_sum - 会话标题生成" },
  ];

  // 普通 Prompt 配置（非对比模式下使用）
  const [promptConfig, setPromptConfig] = useState({
    promptClosetChatDetect: "",
    promptImgExtractSystem: "",
    promptClosetChat: "",
    promptClosetChatImage: "",
    promptClosetChatProduct: "",
    promptClosetTrendFilter: "",
    promptClosetChatSum: "",
  });

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

  const selectModelForPromptCompare = (id: string) => {
    setFormModelId(id);
  };

  const toggleModelForModelCompare = (id: string) => {
    setFormModelIds((prev) => {
      const set = new Set(prev);
      if (set.has(id)) {
        set.delete(id);
      } else {
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
    setFormModelId("");
    setTestMode("prompt_compare");
    setIsolateUid(false);
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

    const category = bank.categories.find((c) => c.id === formCategoryId);
    if (!category || category.questions.length === 0) {
      window.alert("所选分类没有问题，请先添加问题");
      return;
    }

    // 根据模式验证
    if (testMode === "prompt_compare") {
      if (!promptCompareConfig.promptKey) {
        window.alert("请选择要对比的 Prompt 参数");
        return;
      }
      if (!promptCompareConfig.promptA.trim() || !promptCompareConfig.promptB.trim()) {
        window.alert("请填写 Prompt A 和 Prompt B 的内容");
        return;
      }
      // 模型可选，不选则使用默认
    } else {
      // model_compare 模式
      // 模型可选，不选则使用默认
    }

    // 生成随机 uid（10位字母数字组合）
    const generateUid = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const task: BatchTestTask & {
      baseUrl?: string;
      testUid?: string;
      promptParams?: Record<string, string>;
      isPromptCompare?: boolean;
      promptCompareKey?: string;
      promptCompareValues?: { key: string; label: string; value: string }[];
      isolateUid?: boolean;
    } = {
      id: uid("bt"),
      name: formName.trim(),
      status: "running",
      questionCategoryId: formCategoryId,
      questionCount: category.questions.length,
      modelIds: testMode === "prompt_compare" ? (formModelId ? [formModelId] : []) : formModelIds,
      promptId: "",
      systemPrompt: "",
      userProfile: "",
      memory: "",
      rounds: [],
      createdAt: Date.now(),
      baseUrl: DEFAULT_BASE_URL,
      testUid: generateUid(),
      isPromptCompare: testMode === "prompt_compare",
      isolateUid: isolateUid,
      // Prompt 对比模式
      ...(testMode === "prompt_compare" && {
        promptCompareKey: promptCompareConfig.promptKey,
        promptCompareValues: [
          { key: uid("pv"), label: "Prompt A", value: promptCompareConfig.promptA },
          { key: uid("pv"), label: "Prompt B", value: promptCompareConfig.promptB },
        ],
      }),
      // 模型对比模式：配置 prompt_params
      ...(testMode === "model_compare" && {
        promptParams: {
          ...(promptConfig.promptClosetChat && { prompt_closet_chat: promptConfig.promptClosetChat }),
          ...(promptConfig.promptClosetChatSum && { prompt_closet_chat_sum: promptConfig.promptClosetChatSum }),
          ...(promptConfig.promptClosetChatImage && { prompt_closet_chat_image: promptConfig.promptClosetChatImage }),
          ...(promptConfig.promptClosetTrendFilter && { prompt_closet_trend_filter: promptConfig.promptClosetTrendFilter }),
          ...(promptConfig.promptClosetChatDetect && { prompt_closet_chat_detect: promptConfig.promptClosetChatDetect }),
          ...(promptConfig.promptClosetChatProduct && { prompt_closet_chat_product: promptConfig.promptClosetChatProduct }),
          ...(promptConfig.promptImgExtractSystem && { prompt_img_extract_system: promptConfig.promptImgExtractSystem }),
        },
      }),
    };

    onChangeTasks((prev) => [task, ...prev]);
    setFormName("");
    setFormCategoryId("");
    setFormModelId("");
    setFormModelIds([]);
    setTestMode("prompt_compare");
    setPromptCompareConfig({
      promptKey: "prompt_closet_chat",
      promptA: "",
      promptB: "",
    });
    setPromptConfig({
      promptClosetChatDetect: "",
      promptImgExtractSystem: "",
      promptClosetChat: "",
      promptClosetChatImage: "",
      promptClosetChatProduct: "",
      promptClosetTrendFilter: "",
      promptClosetChatSum: "",
    });
    setShowPromptConfig(false);
    setCreating(false);
    setActiveTaskId(task.id);
    // 自动开始运行所有问题
    setTimeout(() => runAllRounds(task), 100);
  };

  // 运行单个问题（支持 Prompt 对比模式）
  const runRound = async (task: BatchTestTask, questionIndex: number) => {
    const category = bank.categories.find((c) => c.id === task.questionCategoryId);
    if (!category) return;
    const question = category.questions[questionIndex];
    if (!question) return;

    const isPromptCompare = task.isPromptCompare;
    const promptCompareKey = task.promptCompareKey;
    const promptCompareValues = task.promptCompareValues;
    const isolateUid = task.isolateUid;

    // 如果开启UID隔离，每个问题生成新的UID
    const generateUid = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    const currentUid = isolateUid ? generateUid() : (task.testUid || "");

    try {
      // Prompt 对比模式：运行两次，分别用 Prompt A 和 Prompt B
      const variants: Array<{ modelId: string; label: string; promptKey?: string; promptValue?: string }> = isPromptCompare && promptCompareValues
        ? promptCompareValues.map((pv) => ({ modelId: task.modelIds[0] || "", label: pv.label, promptKey: promptCompareKey, promptValue: pv.value }))
        : (task.modelIds.length > 0 ? task.modelIds : [""]).map((mid) => ({ modelId: mid, label: AVAILABLE_MODELS.find((m) => m.id === mid)?.label || (mid || "默认模型") }));

      const outs = await Promise.all(
        variants.map(async (variant) => {
          const mid = variant.modelId;
          // 本地开发使用相对路径让 Vite 代理生效，生产环境使用完整 URL
          const isDev = typeof window !== "undefined" && window.location.hostname === "localhost";
          const apiUrl = isDev
            ? AI_STYLIST_API_URL
            : (task.baseUrl || DEFAULT_BASE_URL) + AI_STYLIST_API_URL;

          // 构建 prompt_params
          const promptParams: Record<string, string> = {};
          if (isPromptCompare && variant.promptKey && variant.promptValue) {
            // Prompt 对比模式：注入对比的 prompt
            promptParams[variant.promptKey] = variant.promptValue;
          } else if (task.promptParams) {
            // 普通模式：使用配置的 prompt_params
            Object.assign(promptParams, task.promptParams);
          }

          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "uid": currentUid,
            },
            body: JSON.stringify({
              prompt: question.content,
              chat_svc: mid,
              debug: "model_debug",
              ...(Object.keys(promptParams).length > 0 && {
                prompt_params: promptParams,
              }),
            }),
          });

          const data = await response.json();
          let content = "";
          const images: string[] = [];

          // 单模型测试白盒数据
          let intentDetect = "";
          let memorySearch = "";
          let userProfileData = "";
          let imageGenPromptData = "";
          let fullResponse = "";

          if (data.status === 1 && data.data) {
            // 提取消息内容
            if (Array.isArray(data.data.message)) {
              for (const msg of data.data.message) {
                if (msg.type === "text") {
                  content = msg.text || "";
                  fullResponse = content;
                } else if (msg.type === "image" && msg.url) {
                  images.push(msg.url);
                } else if (msg.type === "image_url" && msg.image?.url) {
                  images.push(msg.image.url);
                }
              }
            }

            // 提取 debug_flow 白盒数据
            const debugFlow = data.data.debug_flow || data.data.debugFlow || [];
            debugFlow.forEach((step: { template?: string; output?: string }) => {
              if (step.template === "closet_chat_detect") {
                intentDetect = step.output?.trim() || "";
              } else if (step.template === "memory_search") {
                memorySearch = step.output?.trim() || "";
              } else if (step.template === "user_profile") {
                userProfileData = step.output?.trim() || "";
              } else if (step.template === "closet_chat") {
                // 如果 intentDetect 是 1，提取生图提示词
                if (intentDetect === "1") {
                  imageGenPromptData = step.output?.trim() || "";
                }
              }
            });
          }

          return [
            variant.label, // 用 label 作为 key（Prompt A / Prompt B 或模型名）
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
              // 单模型白盒数据
              intentDetect,
              memorySearch,
              userProfileData,
              imageGenPromptData,
              fullResponse,
            } as BatchTestResult,
          ] as const;
        })
      );

      const results: Record<string, BatchTestResult> = {};
      for (const [label, v] of outs) results[label] = v;

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
  const runAllRounds = async (task: BatchTestTask) => {
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
      window.alert(`还有 ${unselectedRounds.length} 个问题未评选，请先完成评选`);
      return;
    }

    // Prompt对比模式：统计 Prompt A/B 的胜出情况
    if (task.isPromptCompare && task.promptCompareValues) {
      const promptStats: Record<string, { totalScore: number; scoredRounds: number; avgScore: number | null; winCount: number }> = {};

      // 初始化 Prompt A/B 的统计
      task.promptCompareValues.forEach((pv) => {
        promptStats[pv.label] = { totalScore: 0, scoredRounds: 0, avgScore: null, winCount: 0 };
      });

      task.rounds.forEach((r) => {
        Object.entries(r.results).forEach(([label, res]) => {
          if (res.score != null && promptStats[label]) {
            promptStats[label].totalScore += res.score;
            promptStats[label].scoredRounds++;
          }
        });
        if (r.bestModelId && promptStats[r.bestModelId]) {
          promptStats[r.bestModelId].winCount++;
        }
      });

      Object.values(promptStats).forEach((stat) => {
        if (stat.scoredRounds > 0) {
          stat.avgScore = Math.round((stat.totalScore / stat.scoredRounds) * 10) / 10;
        }
      });

      let bestPromptLabel: string | null = null;
      let maxWins = 0;
      Object.entries(promptStats).forEach(([label, stat]) => {
        if (stat.winCount > maxWins) {
          maxWins = stat.winCount;
          bestPromptLabel = label;
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
                  // 复用 modelStats 字段存储 prompt 统计
                  modelStats: promptStats,
                  // 胜出的 Prompt 标签
                  bestModelId: bestPromptLabel,
                  endedAt: Date.now(),
                },
              }
            : t
        )
      );
      setActiveTaskId(null);
      setEvaluatingRoundId(null);
      return;
    }

    // 多模型对比模式
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
        <div className="panel" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>新建批量测试任务</div>

          {/* 任务名称 */}
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 6 }}>任务名称</div>
            <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} />
          </div>

          {/* 第一步：选择测试模式 */}
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 600 }}>1</span>
              选择测试模式
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: testMode === "prompt_compare" ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: testMode === "prompt_compare" ? "var(--accent-soft)" : "var(--bg)",
                  flex: 1,
                }}
              >
                <input type="radio" checked={testMode === "prompt_compare"} onChange={() => setTestMode("prompt_compare")} />
                <span style={{ fontSize: "0.9rem", fontWeight: testMode === "prompt_compare" ? 600 : 400 }}>🔄 Prompt 对比</span>
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: testMode === "model_compare" ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: testMode === "model_compare" ? "var(--accent-soft)" : "var(--bg)",
                  flex: 1,
                }}
              >
                <input type="radio" checked={testMode === "model_compare"} onChange={() => setTestMode("model_compare")} />
                <span style={{ fontSize: "0.9rem", fontWeight: testMode === "model_compare" ? 600 : 400 }}>🔀 模型对比</span>
              </label>
            </div>
            {testMode && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 8 }}>
                {testMode === "prompt_compare" ? "同一模型，使用两个不同 Prompt 进行对比测试" : "同一问题，使用多个模型进行对比测试"}
              </div>
            )}
          </div>

          {/* 第二步：配置变量 */}
          {testMode && (
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 600 }}>2</span>
                配置变量
              </div>

              {testMode === "prompt_compare" ? (
                /* Prompt 对比模式：填写两个 Prompt，模型可选 */
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      对比参数 <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <select
                      className="select"
                      value={promptCompareConfig.promptKey}
                      onChange={(e) => setPromptCompareConfig((c) => ({ ...c, promptKey: e.target.value }))}
                      style={{ width: "100%", padding: "8px 12px" }}
                    >
                      {PROMPT_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      Prompt A <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      style={{ fontSize: "0.85rem", resize: "vertical" }}
                      placeholder="填写第一个 prompt 内容"
                      value={promptCompareConfig.promptA}
                      onChange={(e) => setPromptCompareConfig((c) => ({ ...c, promptA: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      Prompt B <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      style={{ fontSize: "0.85rem", resize: "vertical" }}
                      placeholder="填写第二个 prompt 内容"
                      value={promptCompareConfig.promptB}
                      onChange={(e) => setPromptCompareConfig((c) => ({ ...c, promptB: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      测试模型（可选，默认使用系统默认）
                    </label>
                    <select
                      className="select"
                      value={formModelId}
                      onChange={(e) => selectModelForPromptCompare(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px" }}
                    >
                      <option value="">使用默认模型</option>
                      {AVAILABLE_MODELS.filter(m => m.id !== "").map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                /* 模型对比模式：选择模型，Prompt 可选 */
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      选择模型 <span style={{ color: "#dc2626" }}>*</span> <span style={{ fontSize: "0.75rem" }}>(1-3个)</span>
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {AVAILABLE_MODELS.filter(m => m.id !== "").map((m) => {
                        const on = formModelIds.includes(m.id);
                        const disabled = !on && formModelIds.length >= 3;
                        return (
                          <label
                            key={m.id}
                            className="chip"
                            style={{
                              cursor: disabled ? "not-allowed" : "pointer",
                              opacity: disabled ? 0.5 : 1,
                              borderColor: on ? "var(--accent)" : undefined,
                              background: on ? "var(--accent-soft)" : undefined,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={disabled}
                              style={{ marginRight: 6 }}
                              onChange={() => toggleModelForModelCompare(m.id)}
                            />
                            {m.label}
                          </label>
                        );
                      })}
                    </div>
                    {formModelIds.length > 0 && (
                      <div style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: 8 }}>
                        ✅ 已选 {formModelIds.length} 个：{formModelIds.map((id) => AVAILABLE_MODELS.find((m) => m.id === id)?.label || id).join("、")}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 第三步：选择问题 */}
          {testMode && (
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 600 }}>3</span>
                选择问题
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  问题分类 <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select className="select" value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)} style={{ width: "100%", padding: "8px 12px" }}>
                  <option value="">请选择问题分类...</option>
                  {bank.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat.questions.length} 条问题)</option>
                  ))}
                </select>
                {formCategoryId && (
                  <div style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: 8 }}>
                    ✅ 已选：{bank.categories.find((c) => c.id === formCategoryId)?.name} ({bank.categories.find((c) => c.id === formCategoryId)?.questions.length} 条问题)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* UID 数据隔离选项 */}
          {testMode && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem 1rem", background: "var(--bg-subtle)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isolateUid}
                  onChange={(e) => setIsolateUid(e.target.checked)}
                />
                <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>UID 数据隔离</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>（每个问题使用不同的 UID）</span>
              </label>
            </div>
          )}

          {/* 可选配置（折叠）- 最下面 */}
          {testMode === "model_compare" && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem 1rem" }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
                onClick={() => setShowPromptConfig(!showPromptConfig)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>Prompt 参数配置</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>（可选）</span>
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--accent)", transform: showPromptConfig ? "rotate(180deg)" : "", transition: "transform 0.2s" }}>
                  ▼
                </span>
              </div>

              {showPromptConfig && (
                <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      prompt_closet_chat_detect
                    </label>
                    <textarea
                      className="input"
                      rows={2}
                      style={{ fontSize: "0.8rem", resize: "vertical" }}
                      placeholder="自定义 detect prompt，留空使用系统默认"
                      value={promptConfig.promptClosetChatDetect}
                      onChange={(e) => setPromptConfig((c) => ({ ...c, promptClosetChatDetect: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      prompt_img_extract_system
                    </label>
                    <textarea
                      className="input"
                      rows={2}
                      style={{ fontSize: "0.8rem", resize: "vertical" }}
                      placeholder="自定义 img extract system prompt，留空使用系统默认"
                      value={promptConfig.promptImgExtractSystem}
                      onChange={(e) => setPromptConfig((c) => ({ ...c, promptImgExtractSystem: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      prompt_closet_chat
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      style={{ fontSize: "0.8rem", resize: "vertical" }}
                      placeholder="自定义 chat prompt，留空使用系统默认"
                      value={promptConfig.promptClosetChat}
                      onChange={(e) => setPromptConfig((c) => ({ ...c, promptClosetChat: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      prompt_closet_chat_image
                    </label>
                    <textarea
                      className="input"
                      rows={2}
                      style={{ fontSize: "0.8rem", resize: "vertical" }}
                      placeholder="自定义 image prompt，留空使用系统默认"
                      value={promptConfig.promptClosetChatImage}
                      onChange={(e) => setPromptConfig((c) => ({ ...c, promptClosetChatImage: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      prompt_closet_chat_product
                    </label>
                    <textarea
                      className="input"
                      rows={2}
                      style={{ fontSize: "0.8rem", resize: "vertical" }}
                      placeholder="自定义 product prompt，留空使用系统默认"
                      value={promptConfig.promptClosetChatProduct}
                      onChange={(e) => setPromptConfig((c) => ({ ...c, promptClosetChatProduct: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      prompt_closet_trend_filter
                    </label>
                    <textarea
                      className="input"
                      rows={2}
                      style={{ fontSize: "0.8rem", resize: "vertical" }}
                      placeholder="自定义 trend filter prompt，留空使用系统默认"
                      value={promptConfig.promptClosetTrendFilter}
                      onChange={(e) => setPromptConfig((c) => ({ ...c, promptClosetTrendFilter: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      prompt_closet_chat_sum
                    </label>
                    <textarea
                      className="input"
                      rows={2}
                      style={{ fontSize: "0.8rem", resize: "vertical" }}
                      placeholder="自定义 summary prompt，留空使用系统默认"
                      value={promptConfig.promptClosetChatSum}
                      onChange={(e) => setPromptConfig((c) => ({ ...c, promptClosetChatSum: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-primary" onClick={createTask}>
              创建并自动运行
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => {
              setCreating(false);
              setShowPromptConfig(false);
              setFormModelIds([]);
              setFormModelId("");
              setTestMode("prompt_compare");
              setIsolateUid(false);
              setPromptCompareConfig({
                promptKey: "prompt_closet_chat",
                promptA: "",
                promptB: "",
              });
              setPromptConfig({
                promptClosetChatDetect: "",
                promptImgExtractSystem: "",
                promptClosetChat: "",
                promptClosetChatImage: "",
                promptClosetChatProduct: "",
                promptClosetTrendFilter: "",
                promptClosetChatSum: "",
              });
            }}>
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
          getModelLabel={getModelLabel}
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

  // Prompt对比模式：使用 Prompt A/B 作为选项
  // 多模型模式：使用 modelIds
  const compareKeys = task.isPromptCompare && task.promptCompareValues
    ? task.promptCompareValues.map((v) => v.label) // ["Prompt A", "Prompt B"]
    : task.modelIds;

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

      {/* 回复对比 - 最大化展示区域 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compareKeys.length === 1 ? "1fr" : compareKeys.length === 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
          gap: 8,
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {compareKeys.map((key, idx) => {
          const res = round.results[key];
          if (!res) return null;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectBest(key)}
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
              {/* 选项标签 */}
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
                  {task.isPromptCompare ? key : getModelLabel(key)}
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
  const [viewingRoundId, setViewingRoundId] = useState<string | null>(null);

  const viewingRound = viewingRoundId ? task.rounds.find((r) => r.id === viewingRoundId) : null;

  // 查看结果视图
  if (viewingRound) {
    return (
      <ResultView
        task={task}
        round={viewingRound}
        onClose={() => setViewingRoundId(null)}
        getModelLabel={getModelLabel}
      />
    );
  }

  return (
    <div className="panel" style={{ flex: 1, padding: "1.25rem", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 头部 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
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
          {task.testUid && (
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>
              UID: <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{task.testUid}</span>
              {task.isolateUid && <span style={{ marginLeft: 8, color: "#16a34a" }}>(UID隔离)</span>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {/* 需要评测的模式才显示保存、结束按钮：多模型对比 或 Prompt对比 */}
          {!isCompleted && (task.modelIds.length > 1 || task.isPromptCompare) && (
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
        {/* 需要评测的模式才显示已评和跳过：多模型对比 或 Prompt对比 */}
        {(task.modelIds.length > 1 || task.isPromptCompare) && (
          <>
            <StatCard label="已评" value={selectedCount} />
            <StatCard label="跳过" value={skippedCount} />
          </>
        )}
        {/* 单模型非Prompt对比模式显示完成和待测 */}
        {task.modelIds.length <= 1 && !task.isPromptCompare && (
          <>
            <StatCard label="完成" value={testedCount} />
            <StatCard label="待测" value={totalCount - testedCount} />
          </>
        )}
      </div>

      {/* Prompt对比内容展示 */}
      {task.isPromptCompare && task.promptCompareValues && task.promptCompareValues.length > 0 && (
        <div className="panel" style={{ padding: "0.75rem 1rem", background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: 8, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>🔄 Prompt对比内容</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 400 }}>({task.promptCompareKey})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {task.promptCompareValues.map((pv, idx) => (
              <div key={pv.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                  <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>{pv.label}</span>
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text)",
                    background: "var(--bg)",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    maxHeight: 80,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: 1.4,
                  }}
                >
                  {pv.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prompt 参数配置展示 */}
      {task.promptParams && Object.keys(task.promptParams).length > 0 && (
        <div className="panel" style={{ padding: "0.75rem 1rem", background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>
            Prompt 参数配置
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(task.promptParams).map(([key, value]) => (
              <div key={key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--accent)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap", minWidth: 180 }}>
                  {key}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 进度条 */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>
          <span>进度</span>
          <span>{Math.round((testedCount / totalCount) * 100)}%</span>
        </div>
        <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              width: `${(testedCount / totalCount) * 100}%`,
              height: "100%",
              background: "#16a34a",
              borderRadius: 3,
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      {/* 评测报告 - 多模型或Prompt对比模式显示 */}
      {isCompleted && task.summary && (task.modelIds.length > 1 || task.isPromptCompare) && (
        <div className="panel" style={{ padding: "1rem", background: "rgba(22,163,74,0.05)", border: "1px solid rgba(22,163,74,0.2)" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 12, color: "#16a34a" }}>
            🏆 评测报告
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* 胜出项 */}
            {task.summary.bestModelId && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {task.isPromptCompare ? "胜出Prompt：" : "胜出模型："}
                </span>
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#16a34a" }}>
                  {task.isPromptCompare ? task.summary.bestModelId : getModelLabel(task.summary.bestModelId)}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  ({task.summary.modelStats[task.summary.bestModelId]?.winCount || 0} 次胜出)
                </span>
              </div>
            )}
            {/* 各选项统计 */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>
                {task.isPromptCompare ? "各Prompt表现：" : "各模型表现："}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(task.summary.modelStats).map(([key, stats]) => {
                  if (!stats) return null;
                  const winRate = task.summary ? Math.round((stats.winCount / task.summary.totalRounds) * 100) : 0;
                  const label = task.isPromptCompare ? key : getModelLabel(key);
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem" }}>
                      <span style={{ minWidth: 100 }}>{label}</span>
                      <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${winRate}%`,
                            height: "100%",
                            background: key === task.summary?.bestModelId ? "#16a34a" : "var(--accent)",
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

      {/* 操作栏 - 需要评测的模式才显示：多模型对比 或 Prompt对比 */}
      {!isCompleted && (task.modelIds.length > 1 || task.isPromptCompare) && (
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
        {/* 单模型非Prompt对比模式 - 表格视图 */}
        {task.modelIds.length <= 1 && !task.isPromptCompare ? (
          <SingleModelTableView
            task={task}
            setViewingRoundId={setViewingRoundId}
            getModelLabel={getModelLabel}
          />
        ) : (
          /* 多模型或Prompt对比模式 - 列表视图（支持评测） */
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
<<<<<<< HEAD
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
=======
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
                        已选最优：{task.isPromptCompare ? round.bestModelId : getModelLabel(round.bestModelId)}
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
>>>>>>> 7c778ea (更新批量测试功能：Prompt对比模式、UID数据隔离、浏览模式等)
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
  getModelLabel: (id: string) => string;
}

function TaskListView({ tasks, bank, onOpenTask, onDeleteTask, getTaskProgress, getModelLabel }: TaskListViewProps) {
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
                      {/* 测试模式 */}
                      {task.isPromptCompare ? (
                        <span>
                          <span style={{ color: "var(--accent)" }}>🔄 Prompt对比</span>
                          <span style={{ marginLeft: 4 }}>· {task.promptCompareKey}</span>
                          {task.modelIds.length > 0 && task.modelIds[0] && (
                            <span style={{ marginLeft: 4 }}>· 模型:{getModelLabel(task.modelIds[0])}</span>
                          )}
                        </span>
                      ) : (
                        <span>
                          <span style={{ color: "var(--accent)" }}>🔀 模型对比</span>
                          <span style={{ marginLeft: 4 }}>· {task.modelIds.length > 0 ? task.modelIds.map(mid => getModelLabel(mid)).join(" / ") : "默认模型"}</span>
                        </span>
                      )}
                      <span style={{ marginLeft: 8 }}>· {category?.name}</span>
                      <span style={{ marginLeft: 8 }}>· {selectedCount}/{totalCount}</span>
                      {(task.isolateUid) && (
                        <span style={{ marginLeft: 4, color: "#16a34a" }}>· UID隔离</span>
                      )}
                      {(task.testUid) && (
                        <span style={{ marginLeft: 8, color: "var(--accent)" }}>
                          UID: {task.testUid}
                        </span>
                      )}
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

<<<<<<< HEAD
=======
  // Prompt对比模式：使用 Prompt A/B 作为选项
  const compareKeys = task.isPromptCompare && task.promptCompareValues
    ? task.promptCompareValues.map((v) => v.label)
    : task.modelIds;

>>>>>>> 7c778ea (更新批量测试功能：Prompt对比模式、UID数据隔离、浏览模式等)
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
<<<<<<< HEAD
              已选 {getModelLabel(round.bestModelId)}
=======
              已选 {task.isPromptCompare ? round.bestModelId : getModelLabel(round.bestModelId)}
>>>>>>> 7c778ea (更新批量测试功能：Prompt对比模式、UID数据隔离、浏览模式等)
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

<<<<<<< HEAD
      {/* 模型回复对比 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: task.modelIds.length === 1 ? "1fr" : task.modelIds.length === 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
=======
      {/* 回复对比 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compareKeys.length === 1 ? "1fr" : compareKeys.length === 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
>>>>>>> 7c778ea (更新批量测试功能：Prompt对比模式、UID数据隔离、浏览模式等)
          gap: 8,
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
<<<<<<< HEAD
        {task.modelIds.map((mid, idx) => {
          const res = round.results[mid];
          if (!res) return null;
          const isWinner = round.bestModelId === mid;

          return (
            <div
              key={mid}
=======
        {compareKeys.map((key, idx) => {
          const res = round.results[key];
          if (!res) return null;
          const isWinner = round.bestModelId === key;

          return (
            <div
              key={key}
>>>>>>> 7c778ea (更新批量测试功能：Prompt对比模式、UID数据隔离、浏览模式等)
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
<<<<<<< HEAD
              {/* 模型标签 */}
=======
              {/* 选项标签 */}
>>>>>>> 7c778ea (更新批量测试功能：Prompt对比模式、UID数据隔离、浏览模式等)
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
<<<<<<< HEAD
                  {getModelLabel(mid)}
=======
                  {task.isPromptCompare ? key : getModelLabel(key)}
>>>>>>> 7c778ea (更新批量测试功能：Prompt对比模式、UID数据隔离、浏览模式等)
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

<<<<<<< HEAD
=======

// 单模型测试表格视图
interface SingleModelTableViewProps {
  task: BatchTestTask;
  setViewingRoundId: (id: string | null) => void;
  getModelLabel: (id: string) => string;
}

function SingleModelTableView({ task, getModelLabel }: SingleModelTableViewProps) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [expandedContent, setExpandedContent] = useState<{ title: string; content: string } | null>(null);
  const [browseMode, setBrowseMode] = useState(false);
  const [browseIndex, setBrowseIndex] = useState(0);
  const modelId = task.modelIds[0];
  const modelLabel = task.modelIds.length > 0 ? getModelLabel(modelId) : "默认模型";

  // 处理双击展开内容
  const handleDoubleClick = (title: string, content: string) => {
    if (content && content !== "—") {
      setExpandedContent({ title, content });
    }
  };

  // 进入浏览模式
  const enterBrowseMode = (index: number) => {
    setBrowseIndex(index);
    setBrowseMode(true);
  };

  // 上一题
  const prevQuestion = () => {
    if (browseIndex > 0) {
      setBrowseIndex(browseIndex - 1);
    }
  };

  // 下一题
  const nextQuestion = () => {
    if (browseIndex < task.rounds.length - 1) {
      setBrowseIndex(browseIndex + 1);
    }
  };

  // 浏览模式视图
  if (browseMode) {
    const round = task.rounds[browseIndex];
    const result = round.results[modelId];
    const hasContent = result?.content && result.content.trim().length > 0;
    const hasImages = result?.images && result.images.length > 0;
    const hasData = hasContent || hasImages;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        {/* 顶部导航 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--text)" }}>{browseIndex + 1}</strong> / {task.rounds.length}
            </span>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              测试模型：<strong>{modelLabel}</strong>
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn"
              style={{ fontSize: "0.75rem" }}
              onClick={prevQuestion}
              disabled={browseIndex === 0}
            >
              ← 上一题
            </button>
            <button
              type="button"
              className="btn"
              style={{ fontSize: "0.75rem" }}
              onClick={nextQuestion}
              disabled={browseIndex === task.rounds.length - 1}
            >
              下一题 →
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: "0.75rem" }}
              onClick={() => setBrowseMode(false)}
            >
              ✕ 退出浏览
            </button>
          </div>
        </div>

        {/* 问题 */}
        <div
          className="panel"
          style={{
            padding: "0.75rem 1rem",
            background: "var(--accent-soft)",
            border: "1px solid rgba(37,99,235,0.15)",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: "0.9rem", lineHeight: 1.4 }}>{round.questionContent}</div>
        </div>

        {/* 白盒数据展示 */}
        {result && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {result.intentDetect && (
              <div style={{ padding: "4px 8px", background: "var(--bg-subtle)", borderRadius: 4, fontSize: "0.75rem" }}>
                意图：<span style={{ color: result.intentDetect === "1" ? "var(--accent)" : "var(--text)" }}>{result.intentDetect}</span>
              </div>
            )}
            {result.memorySearch && (
              <div style={{ padding: "4px 8px", background: "var(--bg-subtle)", borderRadius: 4, fontSize: "0.75rem" }}>
                记忆：已检索
              </div>
            )}
            {result.intentDetect === "1" && result.imageGenPromptData && (
              <div
                style={{ padding: "4px 8px", background: "var(--bg-subtle)", borderRadius: 4, fontSize: "0.75rem", cursor: "pointer" }}
                onClick={() => handleDoubleClick("生图提示词", result.imageGenPromptData || "")}
              >
                生图提示词：点击查看
              </div>
            )}
          </div>
        )}

        {/* 回复内容 */}
        <div
          className="panel"
          style={{
            flex: 1,
            padding: "1rem",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {!hasData ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
              暂无回复数据
            </div>
          ) : (
            <>
              {/* 文字回复 */}
              {hasContent && (
                <div style={{ fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {result.content}
                </div>
              )}

              {/* 图片 */}
              {hasImages && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {result.images!.map((imgUrl: string, imgIdx: number) => (
                    <img
                      key={imgIdx}
                      src={imgUrl}
                      alt={`生成图片 ${imgIdx + 1}`}
                      style={{
                        maxWidth: "100%",
                        maxHeight: 400,
                        objectFit: "contain",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        alignSelf: "flex-start",
                      }}
                      onClick={() => setExpandedImage(imgUrl)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 图片放大弹窗 */}
        {expandedImage && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "2rem",
            }}
            onClick={() => setExpandedImage(null)}
          >
            <img
              src={expandedImage}
              alt="放大图片"
              style={{
                maxWidth: "90%",
                maxHeight: "90%",
                objectFit: "contain",
                borderRadius: 8,
              }}
            />
          </div>
        )}

        {/* 内容展开弹窗 */}
        {expandedContent && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "2rem",
            }}
            onClick={() => setExpandedContent(null)}
          >
            <div
              style={{
                background: "var(--bg)",
                borderRadius: 12,
                padding: "1.5rem",
                maxWidth: 800,
                maxHeight: "80vh",
                width: "100%",
                overflow: "auto",
                boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: "1rem" }}>{expandedContent.title}</h3>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: "0.75rem", padding: "4px 12px" }}
                  onClick={() => setExpandedContent(null)}
                >
                  ✕ 关闭
                </button>
              </div>
              <div
                style={{
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "var(--text)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {expandedContent.content || "（无内容）"}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 表格模式
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* 模型信息 */}
      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "0.5rem 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>测试模型：<strong>{modelLabel}</strong></span>
        {task.rounds.length > 0 && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: "0.75rem" }}
            onClick={() => enterBrowseMode(0)}
          >
            进入浏览模式
          </button>
        )}
      </div>

      {/* 表格 */}
      <div className="panel" style={{ padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ background: "var(--bg-subtle)" }}>
              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid var(--border)", width: 40 }}>#</th>
              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid var(--border)", minWidth: 150 }}>问题</th>
              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid var(--border)", width: 80 }}>意图识别</th>
              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid var(--border)", minWidth: 120 }}>记忆检索</th>
              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid var(--border)", minWidth: 120 }}>生图提示词</th>
              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid var(--border)", minWidth: 200 }}>答案</th>
              <th style={{ padding: "8px", textAlign: "center", borderBottom: "1px solid var(--border)", width: 80 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {task.rounds.map((round, idx) => {
              const result = round.results[modelId];
              const isTested = !!result;
              const hasTextContent = result?.content && result.content.trim().length > 0;
              const hasImages = result?.images && result.images.length > 0;

              return (
                <tr key={round.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px" }}>{idx + 1}</td>
                  <td
                    style={{ padding: "8px", maxWidth: 200, cursor: "pointer" }}
                    onDoubleClick={() => handleDoubleClick("问题", round.questionContent)}
                    title="双击查看完整内容"
                  >
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {round.questionContent}
                    </div>
                  </td>
                  <td style={{ padding: "8px" }}>
                    {isTested ? (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: "0.75rem",
                          background: result?.intentDetect === "1" ? "rgba(37,99,235,0.1)" : "var(--bg-subtle)",
                          color: result?.intentDetect === "1" ? "var(--accent)" : "var(--text)",
                        }}
                      >
                        {result?.intentDetect || "—"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    style={{ padding: "8px", cursor: "pointer" }}
                    onDoubleClick={() => handleDoubleClick("记忆检索", result?.memorySearch || "")}
                    title="双击查看完整内容"
                  >
                    {isTested ? (
                      <div style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {result?.memorySearch || "—"}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    style={{ padding: "8px", cursor: "pointer" }}
                    onDoubleClick={() => handleDoubleClick("生图提示词", result?.imageGenPromptData || "")}
                    title="双击查看完整内容"
                  >
                    {isTested && result?.intentDetect === "1" ? (
                      <div style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {result?.imageGenPromptData || "—"}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    style={{ padding: "8px", cursor: "pointer" }}
                    onDoubleClick={() => handleDoubleClick("答案", result?.fullResponse || result?.content || "")}
                    title="双击查看完整内容"
                  >
                    {isTested ? (
                      <div>
                        {/* 文字内容 - 只显示文字，不显示"无文字回复" */}
                        {hasTextContent && (
                          <div style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {result.content}
                          </div>
                        )}
                        {/* 图片缩略图 */}
                        {hasImages && (
                          <div style={{ display: "flex", gap: 4, marginTop: hasTextContent ? 4 : 0 }}>
                            {result.images!.map((imgUrl: string, imgIdx: number) => (
                              <img
                                key={imgIdx}
                                src={imgUrl}
                                alt={`图片 ${imgIdx + 1}`}
                                style={{
                                  width: 40,
                                  height: 40,
                                  objectFit: "cover",
                                  borderRadius: 4,
                                  border: "1px solid var(--border)",
                                  cursor: "pointer",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedImage(imgUrl);
                                }}
                              />
                            ))}
                          </div>
                        )}
                        {/* 既没有文字也没有图片 */}
                        {!hasTextContent && !hasImages && (
                          <span style={{ color: "var(--text-muted)" }}>（无回复内容）</span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    {isTested ? (
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: "0.7rem", padding: "4px 8px" }}
                        onClick={() => enterBrowseMode(idx)}
                      >
                        浏览
                      </button>
                    ) : (
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 图片放大弹窗 */}
      {expandedImage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "2rem",
          }}
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="放大图片"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              objectFit: "contain",
              borderRadius: 8,
            }}
          />
        </div>
      )}

      {/* 内容展开弹窗 */}
      {expandedContent && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "2rem",
          }}
          onClick={() => setExpandedContent(null)}
        >
          <div
            style={{
              background: "var(--bg)",
              borderRadius: 12,
              padding: "1.5rem",
              maxWidth: 800,
              maxHeight: "80vh",
              width: "100%",
              overflow: "auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>{expandedContent.title}</h3>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: "0.75rem", padding: "4px 12px" }}
                onClick={() => setExpandedContent(null)}
              >
                ✕ 关闭
              </button>
            </div>
            <div
              style={{
                fontSize: "0.9rem",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--text)",
                fontFamily: "var(--font-sans)",
              }}
            >
              {expandedContent.content || "（无内容）"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
>>>>>>> 7c778ea (更新批量测试功能：Prompt对比模式、UID数据隔离、浏览模式等)
