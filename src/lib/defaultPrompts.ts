import type { PromptTemplate } from "../types";
import { uid } from "./ids";

export const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: uid("pt"),
    name: "默认客服",
    systemPrompt: `你是 App 内 AI 助手。回答须简洁、用简体中文。
若用户询问医疗/法律/投资，请提示「仅供参考，不构成专业意见」。
禁止编造产品不存在的功能。`,
    updatedAt: Date.now(),
    category: "general",
  },
  {
    id: uid("pt"),
    name: "压力测试 · 长上下文",
    systemPrompt:
      "你会收到多轮对话。请始终记住：用户代号是「北极星」。最后一轮要复述该代号以通过测试。",
    updatedAt: Date.now(),
    category: "general",
  },
];
