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
import { PlatformIntroView } from "./views/PlatformIntroView";
import { MODEL_PRESETS, IMAGE_GEN_MODELS } from "./lib/models";
import { DEFAULT_PROMPTS } from "./lib/defaultPrompts";
import { uid } from "./lib/ids";
import { loadBundle, saveBundle } from "./lib/storage";
import { DEFAULT_USER_PROFILE } from "./lib/userProfile";
import { DEFAULT_QUESTION_BANK } from "./lib/defaultQuestionBank";

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

  const [textModelId, _setTextModelId] = useState(() => loadBundle()?.textModelId ?? MODEL_PRESETS[0]?.id ?? "");
  const [imageModelId, _setImageModelId] = useState(() => loadBundle()?.imageModelId ?? IMAGE_GEN_MODELS[0]?.id ?? "");

  const [userProfile, _setUserProfile] = useState(() => loadBundle()?.userProfile ?? DEFAULT_USER_PROFILE);
  const [memory, _setMemory] = useState(() => loadBundle()?.memory ?? "");

  const [_messages, _setMessages] = useState<ChatMessage[]>([]);
  const [_input, _setInput] = useState("");
  const [_loading, _setLoading] = useState(false);
  const [_evaluation, _setEvaluation] = useState<Evaluation>(defaultEval);
  const [_dialogueSessionId, _setDialogueSessionId] = useState(() => uid("dlg"));

  const [images, _setImages] = useState<ImageGenRecord[]>(() => loadBundle()?.images ?? []);

  const addImageGenRecord = (record: ImageGenRecord) => {
    _setImages((prev: ImageGenRecord[]) => [record, ...prev]);
  };

  // 对话状态 - 提升到 App 层级，切换 tab 不清空
  const [dialogueMessages, setDialogueMessages] = useState<any[]>([]);
  const [dialogueChatId, setDialogueChatId] = useState<string>("");
  const [dialogueInput, setDialogueInput] = useState("");
  const [dialogueLoading, setDialogueLoading] = useState(false);
  const [dialoguePendingImages, setDialoguePendingImages] = useState<any[]>([]);
  const [dialogueFollowUpQuestions, setDialogueFollowUpQuestions] = useState<string[]>([]);
  const [dialogueVerdict, setDialogueVerdict] = useState<"pass" | "fail" | "pending">("pending");
  const [dialogueScore, setDialogueScore] = useState<number | null>(null);
  const [dialogueOptimizations, setDialogueOptimizations] = useState("");
  const [dialogueTags, setDialogueTags] = useState<string[]>([]);

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
    // 如果没有数据或分类为空，使用默认数据
    if (!b?.questionBank || b.questionBank.categories.length === 0) {
      return DEFAULT_QUESTION_BANK;
    }
    return b.questionBank;
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

  // const _configLocked = _messages.length > 0;
  // Unused variables kept for compatibility
  // const configLockHint = "";
  // const canSaveToLibrary = false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const send = null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const uploadImage = null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const saveToLibrary = null;

  const patchPrompt = useCallback((patch: Partial<PromptTemplate> & { id: string }) => {
    setPrompts((prev) =>
      prev.map((p) => (p.id === patch.id ? { ...p, ...patch, updatedAt: Date.now() } : p))
    );
  }, []);

  const newPrompt = useCallback((category?: string) => {
    const p: PromptTemplate = {
      id: uid("pt"),
      name: "",
      systemPrompt: "",
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
        return prev.filter((p) => p.id !== id);
      });
    },
    []
  );

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
          {nav === "platformIntro" && <PlatformIntroView />}
          {nav === "dialogue" && (
            <DialogueTestView
              onSaveToConversations={(conv) => setConversations((prev) => [conv, ...prev])}
              onSaveImageGen={addImageGenRecord}
              externalMessages={dialogueMessages}
              setExternalMessages={setDialogueMessages}
              externalChatId={dialogueChatId}
              setExternalChatId={setDialogueChatId}
              externalInput={dialogueInput}
              setExternalInput={setDialogueInput}
              externalLoading={dialogueLoading}
              setExternalLoading={setDialogueLoading}
              externalPendingImages={dialoguePendingImages}
              setExternalPendingImages={setDialoguePendingImages}
              externalFollowUpQuestions={dialogueFollowUpQuestions}
              setExternalFollowUpQuestions={setDialogueFollowUpQuestions}
              externalVerdict={dialogueVerdict}
              setExternalVerdict={setDialogueVerdict}
              externalScore={dialogueScore}
              setExternalScore={setDialogueScore}
              externalOptimizations={dialogueOptimizations}
              setExternalOptimizations={setDialogueOptimizations}
              externalTags={dialogueTags}
              setExternalTags={setDialogueTags}
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
            />
          )}
          {nav === "intentTest" && (
            <IntentTestView
              tasks={intentTestTasks}
              onChangeTasks={setIntentTestTasks}
              datasets={intentTestDatasets}
              onChangeDatasets={setIntentTestDatasets}
              questionBank={questionBank}
            />
          )}
        </div>
      </main>
    </div>
  );
}
