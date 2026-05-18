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
  | "promptCompare";
