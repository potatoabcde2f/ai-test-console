import type { ChatMessage, ModelPreset, MockReplyResult } from "../types";

const MAX_CONTEXT_MESSAGES = 32;
const FEW_SHOT_IN_CONTEXT = true;

function sliceTail(messages: ChatMessage[], maxMessages: number): ChatMessage[] {
  if (messages.length <= maxMessages) return messages;
  return messages.slice(-maxMessages);
}

export async function mockAssistantReply(params: {
  model: ModelPreset;
  systemPrompt: string;
  userProfile: string;
  visibleMessages: ChatMessage[];
  fewShot?: { user: string; assistant: string } | null;
}): Promise<MockReplyResult> {
  const { model, systemPrompt, userProfile, visibleMessages, fewShot } = params;

  await new Promise((r) => setTimeout(r, 380 + Math.random() * 700));

  let ctx = sliceTail(visibleMessages, MAX_CONTEXT_MESSAGES);
  if (FEW_SHOT_IN_CONTEXT && fewShot && fewShot.user.trim() && fewShot.assistant.trim()) {
    const fsUser: ChatMessage = {
      id: "fs_u",
      role: "user",
      content: fewShot.user,
      createdAt: 0,
    };
    const fsAsst: ChatMessage = {
      id: "fs_a",
      role: "assistant",
      content: fewShot.assistant,
      createdAt: 0,
    };
    ctx = [fsUser, fsAsst, ...ctx];
  }

  const lastUser = [...ctx].reverse().find((m) => m.role === "user");
  const userText = lastUser?.content ?? "";

  const hint =
    systemPrompt.slice(0, 80).replace(/\s+/g, " ") +
    (systemPrompt.length > 80 ? "…" : "");

  const ctxSummary = ctx
    .map((m) => `${m.role}: ${m.content.slice(0, 60)}${m.content.length > 60 ? "…" : ""}`)
    .join(" | ");

  const profileBrief =
    userProfile.split("\n")[0]?.slice(0, 60) || "（未配置用户画像）";

  let imageGen: MockReplyResult["imageGen"];
  if (/生图|出图|画一张|生成.*图|配图|试穿|搭配.*图/.test(userText)) {
    imageGen = {
      imageModel: "flux-schnell-demo",
      imagePrompt: `Soft Autumn, full-figured, casual minimalist vacation outfit, ${userText.slice(0, 120)}`,
    };
  }

  const content = [
    `【${model.label} · ${model.provider}】`,
    "",
    `用户画像摘要（已注入上下文）：${profileBrief}…`,
    "",
    `已接收：「${userText.slice(0, 200)}${userText.length > 200 ? "…" : ""}」`,
    "",
    `系统提示摘要：${hint || "（空）"}`,
    "",
    `上下文快照（${ctx.length} 条）：${ctxSummary || "（无）"}`,
    "",
    imageGen ? "（本 Demo 已触发「生图」白盒记录，请到「生图结果白盒化」查看。）" : "",
    "",
    "此为前端模拟回复。接入真实服务后替换 mockAssistantReply。",
  ]
    .filter(Boolean)
    .join("\n");

  return { content, imageGen };
}
