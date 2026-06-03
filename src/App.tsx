import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ChatMessage,
  CompareTask,
  CompareRound,
  PromptCompareTask,
  Evaluation,
  ImageGenRecord,
  NavKey,
  PromptTemplate,
  StoredConversation,
  QuestionBank,
  BatchTestTask,
  PromptCategoryConfig,
  IntentTestTask,
  IntentTestDataset,
} from "./types";
import { DEFAULT_PROMPT_CATEGORIES } from "./types";
import { Sidebar } from "./components/Sidebar";
import { DialogueTestView } from "./views/DialogueTestView";
import { ImageGenView } from "./views/ImageGenView";
import { PromptStorageView } from "./views/PromptStorageView";
import { ConversationResultsView } from "./views/ConversationResultsView";
import { ModelCompareView } from "./views/ModelCompareView";
import { PromptCompareView } from "./views/PromptCompareView";
import { QuestionBankView } from "./views/QuestionBankView";
import { BatchTestView } from "./views/BatchTestView";
import { IntentTestView } from "./views/IntentTestView";
import { MODEL_PRESETS, IMAGE_GEN_MODELS } from "./lib/models";
import { DEFAULT_PROMPTS } from "./lib/defaultPrompts";
import { mockAssistantReply } from "./lib/mockAI";
import { uid } from "./lib/ids";
import { loadBundle, saveBundle } from "./lib/storage";
import { DEFAULT_USER_PROFILE } from "./lib/userProfile";

const defaultEval = (): Evaluation => ({
  verdict: "pending",
  score: null,
  notes: "",
  optimizations: "",
  tags: [],
});

function normalizeConversations(raw: unknown): StoredConversation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const c = item as Record<string, unknown>;
    const ev = c.evaluation as Evaluation | undefined;
    return {
      id: String(c.id ?? uid("conv")),
      title: String(c.title ?? "未命名"),
      createdAt: Number(c.createdAt) || Date.now(),
      updatedAt: Number(c.updatedAt) || Date.now(),
      modelId: String(c.modelId ?? ""),
      imageModelId: String(c.imageModelId ?? ""),
      promptId: String(c.promptId ?? ""),
      promptVersionName: String(c.promptVersionName ?? ""),
      systemPromptContent: String(c.systemPromptContent ?? ""),
      userProfileSnapshot: String(c.userProfileSnapshot ?? ""),
      sessionKey: c.sessionKey != null ? String(c.sessionKey) : undefined,
      messages: Array.isArray(c.messages) ? (c.messages as ChatMessage[]) : [],
      evaluation: ev ?? defaultEval(),
    };
  });
}

function normalizeCompareTasks(raw: unknown[]): CompareTask[] {
  return raw.map((item) => {
    const t = item as Record<string, unknown>;
    // 兼容旧数据格式（单轮）
    if (t.userPrompt && !t.rounds) {
      const oldResults = (t.results || {}) as Record<string, { content: string; score: number | null }>;
      const round: CompareRound = {
        id: uid("rnd"),
        userPrompt: String(t.userPrompt),
        results: oldResults,
        bestModelId: (t.bestModelId as string) || null,
        createdAt: Number(t.createdAt) || Date.now(),
      };
      return {
        id: String(t.id ?? uid("cmp")),
        name: String(t.name ?? "未命名对比"),
        systemPrompt: String(t.systemPrompt ?? ""),
        modelIds: Array.isArray(t.modelIds) ? (t.modelIds as string[]) : ["gpt-4o", "gpt-4o-mini", "o3-mini"],
        status: t.status === "completed" ? "completed" : "running",
        rounds: [round],
        summary: t.status === "completed" ? {
          totalRounds: 1,
          modelStats: {},
          bestModelId: (t.bestModelId as string) || null,
          endedAt: Number(t.endedAt) || Date.now(),
        } : undefined,
        createdAt: Number(t.createdAt) || Date.now(),
      } as CompareTask;
    }
    // 新格式
    return {
      id: String(t.id ?? uid("cmp")),
      name: String(t.name ?? "未命名对比"),
      systemPrompt: String(t.systemPrompt ?? ""),
      modelIds: Array.isArray(t.modelIds) ? (t.modelIds as string[]) : ["gpt-4o", "gpt-4o-mini", "o3-mini"],
      status: (t.status as CompareTask["status"]) || "running",
      rounds: Array.isArray(t.rounds) ? (t.rounds as CompareRound[]) : [],
      summary: t.summary as CompareTask["summary"],
      createdAt: Number(t.createdAt) || Date.now(),
    };
  });
}

export function App() {
  const [nav, setNav] = useState<NavKey>("dialogue");

  const [prompts, setPrompts] = useState<PromptTemplate[]>(() => {
    const b = loadBundle();
    return b?.prompts?.length ? b.prompts : [...DEFAULT_PROMPTS];
  });

  const [activePromptId, setActivePromptId] = useState(() => {
    const b = loadBundle();
    const list = b?.prompts?.length ? b.prompts : [...DEFAULT_PROMPTS];
    return list[0]?.id ?? "";
  });

  const [textModelId, setTextModelId] = useState(() => loadBundle()?.textModelId ?? MODEL_PRESETS[0]?.id ?? "");
  const [imageModelId, setImageModelId] = useState(() => loadBundle()?.imageModelId ?? IMAGE_GEN_MODELS[0]?.id ?? "");

  const [userProfile, setUserProfile] = useState(() => loadBundle()?.userProfile ?? DEFAULT_USER_PROFILE);
  const [memory, setMemory] = useState(() => loadBundle()?.memory ?? "");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation>(defaultEval);
  const [dialogueSessionId, setDialogueSessionId] = useState(() => uid("dlg"));

  const [images, setImages] = useState<ImageGenRecord[]>(() => loadBundle()?.images ?? []);
  const [conversations, setConversations] = useState<StoredConversation[]>(() =>
    normalizeConversations(loadBundle()?.conversations)
  );
  const [compareTasks, setCompareTasks] = useState<CompareTask[]>(() => {
    const b = loadBundle();
    return normalizeCompareTasks(b?.compareTasks ?? []);
  });
  const [promptCompareTasks, setPromptCompareTasks] = useState<PromptCompareTask[]>(() => {
    const b = loadBundle();
    return (b?.promptCompareTasks as PromptCompareTask[]) ?? [];
  });

  const [questionBank, setQuestionBank] = useState<QuestionBank>(() => {
    const b = loadBundle();
    return b?.questionBank ?? { categories: [] };
  });

  const [batchTestTasks, setBatchTestTasks] = useState<BatchTestTask[]>(() => {
    const b = loadBundle();
    return (b?.batchTestTasks as BatchTestTask[]) ?? [];
  });

  const [intentTestTasks, setIntentTestTasks] = useState<IntentTestTask[]>(() => {
    const b = loadBundle();
    return (b?.intentTestTasks as IntentTestTask[]) ?? [];
  });

  const [intentTestDatasets, setIntentTestDatasets] = useState<IntentTestDataset[]>(() => {
    const b = loadBundle();
    return (b?.intentTestDatasets as IntentTestDataset[]) ?? [];
  });

  const [promptCategories, setPromptCategories] = useState<PromptCategoryConfig[]>(() => {
    const b = loadBundle();
    return b?.promptCategories ?? [...DEFAULT_PROMPT_CATEGORIES];
  });

  useEffect(() => {
    saveBundle({
      prompts,
      userProfile,
      memory,
      conversations,
      images,
      compareTasks,
      promptCompareTasks,
      questionBank,
      batchTestTasks,
      promptCategories,
      textModelId,
      imageModelId,
      intentTestTasks,
      intentTestDatasets,
    });
  }, [prompts, userProfile, memory, conversations, images, compareTasks, promptCompareTasks, questionBank, batchTestTasks, promptCategories, textModelId, imageModelId, intentTestTasks, intentTestDatasets]);

  const activePrompt = useMemo(() => {
    const found = prompts.find((p) => p.id === activePromptId);
    if (found) return found;
    if (prompts.length > 0) return prompts[0];
    return null;
  }, [prompts, activePromptId]);

  const configLocked = messages.length > 0;
  const configLockHint = configLocked
    ? "本轮已锁定配置；请先完成打标并「保存到对话库」，将自动清空后方可更换提示词、User Profile"
    : "当前无对话，可自由配置后开始新一轮";

  const canSaveToLibrary = messages.length > 0 && evaluation.verdict !== "pending";

  const patchPrompt = useCallback((patch: Partial<PromptTemplate> & { id: string }) => {
    setPrompts((prev) =>
      prev.map((p) => (p.id === patch.id ? { ...p, ...patch, updatedAt: Date.now() } : p))
    );
  }, []);

  const newPrompt = useCallback((category?: string) => {
    const p: PromptTemplate = {
      id: uid("pt"),
      name: "未命名模板",
      systemPrompt: "在此编写系统提示词…",
      updatedAt: Date.now(),
      category: category ?? (promptCategories[0]?.id ?? "general"),
    };
    setPrompts((prev) => [...prev, p]);
    setActivePromptId(p.id);
  }, [promptCategories]);

  const duplicatePrompt = useCallback((id: string) => {
    setPrompts((prev) => {
      const src = prev.find((x) => x.id === id);
      if (!src) return prev;
      const p: PromptTemplate = {
        ...src,
        id: uid("pt"),
        name: `${src.name} 副本`,
        updatedAt: Date.now(),
      };
      return [...prev, p];
    });
  }, []);

  const deletePrompt = useCallback(
    (id: string) => {
      setPrompts((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((p) => p.id !== id);
        if (!next.some((p) => p.id === activePromptId)) setActivePromptId(next[0]?.id ?? "");
        return next;
      });
    },
    [activePromptId]
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const visible = [...messages, userMsg];

    try {
      const mergedSystem = `${activePrompt?.systemPrompt ?? ""}\n\n--- User Profile ---\n${userProfile}`;
      const result = await mockAssistantReply({
        model: MODEL_PRESETS[0],
        systemPrompt: mergedSystem,
        userProfile,
        visibleMessages: visible,
        fewShot: null,
      });

      const asst: ChatMessage = {
        id: uid("msg"),
        role: "assistant",
        content: result.content,
        modelId: MODEL_PRESETS[0].id,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, asst]);
    } catch (e) {
      console.error(e);
      window.alert("生成失败");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, activePrompt, userProfile, dialogueSessionId]);

  const uploadImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUrl = reader.result as string;
      const userMsg: ChatMessage = {
        id: uid("msg"),
        role: "user",
        content: input.trim() || "[上传了图片]",
        images: [{ url: imageUrl, type: "upload" }],
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      setTimeout(() => {
        const asst: ChatMessage = {
          id: uid("msg"),
          role: "assistant",
          content: "我已收到您上传的图片。这是一张示例图片。",
          modelId: MODEL_PRESETS[0].id,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, asst]);
        setLoading(false);
      }, 800);
    };
    reader.readAsDataURL(file);
  }, [input]);

  const saveToLibrary = useCallback(() => {
    if (messages.length === 0) return;
    if (evaluation.verdict === "pending") {
      window.alert("请先选择「通过」或「不通过」后再保存。");
      return;
    }
    const title = window.prompt("对话标题（列表展示）", `对话 ${new Date().toLocaleString("zh-CN")}`);
    if (!title) return;
    const convId = uid("conv");
    const row: StoredConversation = {
      id: convId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      modelId: MODEL_PRESETS[0].id,
      imageModelId: "",
      promptId: activePrompt?.id ?? "",
      promptVersionName: activePrompt?.name ?? "未命名",
      systemPromptContent: activePrompt?.systemPrompt ?? "",
      userProfileSnapshot: userProfile,
      sessionKey: dialogueSessionId,
      messages: messages.map((m) => ({ ...m })),
      evaluation: { ...evaluation },
    };
    setConversations((prev) => [row, ...prev]);
    setImages((prev) =>
      prev.map((img) =>
        img.sessionKey === dialogueSessionId && !img.conversationId ? { ...img, conversationId: convId } : img
      )
    );
    setMessages([]);
    setEvaluation(defaultEval());
    setInput("");
    setDialogueSessionId(uid("dlg"));
    window.alert("已保存到「对话结果存储」。对话已清空，可重新开始新一轮。");
  }, [activePrompt, userProfile, dialogueSessionId, messages, evaluation]);

  const updateConversationEval = useCallback((id: string, ev: Evaluation) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, evaluation: { ...ev }, updatedAt: Date.now() } : c))
    );
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return (
    <div className="app-shell">
      <Sidebar active={nav} onNavigate={setNav} />
      <main className="main-area">
        <div className="main-scroll">
          {nav === "dialogue" && (
            <DialogueTestView
              prompts={prompts}
              activePromptId={activePrompt?.id ?? ""}
              onPromptChange={setActivePromptId}
              onOpenPromptLibrary={() => setNav("prompts")}
              userProfile={userProfile}
              onUserProfile={setUserProfile}
              configLocked={configLocked}
              configLockHint={configLockHint}
              messages={messages}
              loading={loading}
              input={input}
              onInput={setInput}
              onSend={send}
              onUploadImage={uploadImage}
              evaluation={evaluation}
              onEvaluation={(p) => setEvaluation((e) => ({ ...e, ...p }))}
              onSaveToLibrary={saveToLibrary}
              canSaveToLibrary={canSaveToLibrary}
              memory={memory}
              onMemory={setMemory}
              textModelId={textModelId}
              onTextModelChange={setTextModelId}
              imageModelId={imageModelId}
              onImageModelChange={setImageModelId}
            />
          )}
          {nav === "images" && <ImageGenView records={images} />}
          {nav === "prompts" && (
            <PromptStorageView
              prompts={prompts}
              categories={promptCategories}
              activeId={activePrompt?.id ?? ""}
              onSelect={setActivePromptId}
              onChange={patchPrompt}
              onDuplicate={duplicatePrompt}
              onDelete={deletePrompt}
              onNew={newPrompt}
              onChangeCategories={setPromptCategories}
            />
          )}
          {nav === "conversations" && (
            <ConversationResultsView conversations={conversations} onUpdate={updateConversationEval} onDelete={deleteConversation} />
          )}
          {nav === "compare" && <ModelCompareView tasks={compareTasks} onChangeTasks={setCompareTasks} />}
          {nav === "promptCompare" && (
            <PromptCompareView tasks={promptCompareTasks} prompts={prompts} onChangeTasks={setPromptCompareTasks} />
          )}
          {nav === "questionBank" && (
            <QuestionBankView questionBank={questionBank} onChange={setQuestionBank} />
          )}
          {nav === "batchTest" && (
            <BatchTestView
              tasks={batchTestTasks}
              onChangeTasks={setBatchTestTasks}
              questionBank={questionBank}
              prompts={prompts}
            />
          )}
          {nav === "intentTest" && (
            <IntentTestView
              tasks={intentTestTasks}
              onChangeTasks={setIntentTestTasks}
              datasets={intentTestDatasets}
              onChangeDatasets={setIntentTestDatasets}
              questionBank={questionBank}
              prompts={prompts}
            />
          )}
        </div>
      </main>
    </div>
  );
}
