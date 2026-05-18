export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** 图片内容（用户上传或 AI 生成） */
  images?: { url: string; type: "upload" | "generated" }[];
  modelId?: string;
  createdAt: number;
}

export interface ModelPreset {
  id: string;
  label: string;
  provider: string;
  description: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  updatedAt: number;
  /** 提示词分类 */
  category: "product" | "general" | "intent" | "image";
}

export type PromptCategory = "product" | "general" | "intent" | "image";

export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  product: "产品介绍提示词",
  general: "通用提示词",
  intent: "意图识别提示词",
  image: "引导生图提示词",
};

export type Verdict = "pass" | "fail" | "pending";

export interface Evaluation {
  verdict: Verdict;
  score: number | null;
  notes: string;
  optimizations: string;
  tags: string[];
}

export interface MockReplyResult {
  content: string;
  /** 当用户话术触发「生图」链路时返回，用于写入生图白盒表 */
  imageGen?: {
    imagePrompt: string;
    imageModel: string;
  };
}

export interface ImageGenRecord {
  id: string;
  imageModel: string;
  prompt: string;
  createdAt: number;
  conversationId?: string;
  sessionKey?: string;
  /** Demo 预览图 */
  previewUrl: string;
}

/** OMS 风格单条对话存档 */
export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  /** 生图模型ID */
  imageModelId: string;
  promptId: string;
  promptVersionName: string;
  /** 保存时使用的系统提示词内容快照 */
  systemPromptContent: string;
  userProfileSnapshot: string;
  /** 与对话测试会话关联，用于保存对话时回填 conversationId */
  sessionKey?: string;
  messages: ChatMessage[];
  evaluation: Evaluation;
}

export type CompareTaskStatus = "running" | "completed";

export interface CompareRound {
  id: string;
  userPrompt: string;
  results: Record<string, { content: string; score: number | null }>;
  bestModelId: string | null;
  createdAt: number;
}

export interface ModelStats {
  totalScore: number;
  scoredRounds: number;
  avgScore: number | null;
  winCount: number;
}

export interface CompareTask {
  id: string;
  name: string;
  systemPrompt: string;
  modelIds: string[];
  status: CompareTaskStatus;
  rounds: CompareRound[];
  /** 结束任务时汇总 */
  summary?: {
    totalRounds: number;
    modelStats: Record<string, ModelStats>;
    bestModelId: string | null;
    endedAt: number;
  };
  createdAt: number;
}

export interface PromptCompareTask {
  id: string;
  name: string;
  modelId: string;
  promptIds: string[];
  status: "running" | "completed";
  rounds: PromptCompareRound[];
  summary?: {
    totalRounds: number;
    promptStats: Record<string, {
      totalScore: number;
      scoredRounds: number;
      avgScore: number | null;
      winCount: number;
    }>;
    bestPromptId: string | null;
    endedAt: number;
  };
  createdAt: number;
}

export interface PromptCompareRound {
  id: string;
  userPrompt: string;
  results: Record<string, { content: string; score: number | null }>;
  bestPromptId: string | null;
  createdAt: number;
}

export type NavKey =
  | "dialogue"
  | "images"
  | "prompts"
  | "conversations"
  | "compare"
  | "promptCompare"
  | "questionBank"
  | "batchTest";

// 问题库相关类型
export interface Question {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface QuestionCategory {
  id: string;
  name: string;
  questions: Question[];
  createdAt: number;
  updatedAt: number;
}

export interface QuestionBank {
  categories: QuestionCategory[];
}

// 批量测试相关类型
export type BatchTestStatus = "running" | "completed";

/** 批量测试任务中的单个问题结果 */
export interface BatchTestResult {
  /** 模型ID */
  modelId: string;
  /** 模型回复内容 */
  content: string;
  /** 人工评分 0-10 */
  score: number | null;
  /** 是否通过 */
  verdict: Verdict;
  /** 优化点备注 */
  optimizationNotes: string;
  /** 白盒数据：问题类型 */
  questionType?: string;
  /** 白盒数据：意图识别 */
  intent?: string;
  /** 白盒数据：生图提示词（如有） */
  imageGenPrompt?: string;
  /** 创建时间 */
  createdAt: number;
}

/** 批量测试任务的单个问题轮次 */
export interface BatchTestRound {
  id: string;
  /** 问题ID */
  questionId: string;
  /** 问题内容 */
  questionContent: string;
  /** 各模型结果 */
  results: Record<string, BatchTestResult>;
  /** 最优模型ID（多模型时选择） */
  bestModelId: string | null;
  /** 创建时间 */
  createdAt: number;
}

/** 批量测试任务 */
export interface BatchTestTask {
  id: string;
  /** 任务名称 */
  name: string;
  /** 状态 */
  status: BatchTestStatus;
  /** 选中的问题分类ID */
  questionCategoryId: string;
  /** 问题数量 */
  questionCount: number;
  /** 选中的模型IDs */
  modelIds: string[];
  /** 选中的提示词ID */
  promptId: string;
  /** 系统提示词内容（快照） */
  systemPrompt: string;
  /** 用户画像 */
  userProfile: string;
  /** 记忆 */
  memory: string;
  /** 测试轮次 */
  rounds: BatchTestRound[];
  /** 汇总统计 */
  summary?: {
    totalRounds: number;
    /** 各模型统计 */
    modelStats: Record<string, {
      totalScore: number;
      scoredRounds: number;
      avgScore: number | null;
      passCount: number;
      failCount: number;
      pendingCount: number;
    }>;
    /** 平均通过率 */
    avgPassRate: number;
    /** 结束时间 */
    endedAt: number;
  };
  createdAt: number;
}

/** 批量测试配置（用于快速复用） */
export interface BatchTestConfig {
  name: string;
  promptId: string;
  userProfile: string;
  memory: string;
}
