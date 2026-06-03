import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageGenRecord, StoredConversation } from "../types";
import { uid } from "../lib/ids";

interface DebugFlowItem {
  template?: string;
  chat_svc?: string;
  output?: string;
}

interface MessageImage {
  url: string;
  type: "upload" | "generated";
  status?: "uploading" | "done";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  images?: MessageImage[];
  metadata?: {
    chatId?: string;
    debugFlow?: DebugFlowItem[];
    rawResponse?: { status: number; msg: string; data: unknown };
    requestPayload?: Record<string, unknown>;
  };
}

interface APIConfig {
  baseUrl: string;
  chatSvc: string;
  promptClosetChat: string;
  promptClosetChatSum: string;
  promptClosetChatImage: string;
  promptClosetTrendFilter: string;
  promptClosetChatDetect: string;
  promptClosetChatProduct: string;
  promptImgExtractSystem: string;
  debug: string;
  followUpPrompt: string;
}

interface APIVisualizerViewProps {
  onSaveToConversations?: (conv: StoredConversation) => void;
  onSaveImageGen?: (record: ImageGenRecord) => void;
  // 外部状态（用于保持对话）
  externalMessages?: any[];
  setExternalMessages?: (messages: any[]) => void;
  externalChatId?: string;
  setExternalChatId?: (chatId: string) => void;
  externalInput?: string;
  setExternalInput?: (input: string) => void;
  externalLoading?: boolean;
  setExternalLoading?: (loading: boolean) => void;
  externalPendingImages?: any[];
  setExternalPendingImages?: (images: any[]) => void;
  externalFollowUpQuestions?: string[];
  setExternalFollowUpQuestions?: (questions: string[]) => void;
  externalVerdict?: "pass" | "fail" | "pending";
  setExternalVerdict?: (verdict: "pass" | "fail" | "pending") => void;
  externalScore?: number | null;
  setExternalScore?: (score: number | null) => void;
  externalOptimizations?: string;
  setExternalOptimizations?: (opt: string) => void;
  externalTags?: string[];
  setExternalTags?: (tags: string[]) => void;
}

export function DialogueTestView({
  onSaveToConversations,
  onSaveImageGen,
  externalMessages,
  setExternalMessages,
  externalChatId,
  setExternalChatId,
  externalInput,
  setExternalInput,
  externalLoading,
  setExternalLoading,
  externalPendingImages,
  setExternalPendingImages,
  externalFollowUpQuestions,
  setExternalFollowUpQuestions,
  externalVerdict,
  setExternalVerdict,
  externalScore,
  setExternalScore,
  externalOptimizations,
  setExternalOptimizations,
  externalTags,
  setExternalTags,
}: APIVisualizerViewProps) {
  // 使用外部状态或内部状态
  const [internalMessages, setInternalMessages] = useState<Message[]>([]);
  const messages = externalMessages !== undefined ? externalMessages : internalMessages;
  const setMessages: React.Dispatch<React.SetStateAction<Message[]>> = (value) => {
    if (setExternalMessages) {
      const newValue = typeof value === 'function' ? (value as Function)(messages) : value;
      setExternalMessages(newValue);
    } else {
      setInternalMessages(value);
    }
  };

  const [internalChatId, setInternalChatId] = useState<string>("");
  const chatId = externalChatId !== undefined ? externalChatId : internalChatId;
  const setChatId = (value: string | ((prev: string) => string)) => {
    if (setExternalChatId) {
      const newValue = typeof value === 'function' ? (value as Function)(chatId) : value;
      setExternalChatId(newValue);
    } else {
      setInternalChatId(value as any);
    }
  };

  const [internalInput, setInternalInput] = useState("");
  const input = externalInput !== undefined ? externalInput : internalInput;
  const setInput = (value: string | ((prev: string) => string)) => {
    if (setExternalInput) {
      const newValue = typeof value === 'function' ? (value as Function)(input) : value;
      setExternalInput(newValue);
    } else {
      setInternalInput(value as any);
    }
  };

  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;
  const setLoading = (value: boolean | ((prev: boolean) => boolean)) => {
    if (setExternalLoading) {
      const newValue = typeof value === 'function' ? (value as Function)(loading) : value;
      setExternalLoading(newValue);
    } else {
      setInternalLoading(value as any);
    }
  };

  const [internalPendingImages, setInternalPendingImages] = useState<MessageImage[]>([]);
  const pendingImages = externalPendingImages !== undefined ? externalPendingImages : internalPendingImages;
  const setPendingImages: React.Dispatch<React.SetStateAction<MessageImage[]>> = (value) => {
    if (setExternalPendingImages) {
      const newValue = typeof value === 'function' ? (value as Function)(pendingImages) : value;
      setExternalPendingImages(newValue);
    } else {
      setInternalPendingImages(value);
    }
  };

  const [internalFollowUpQuestions, setInternalFollowUpQuestions] = useState<string[]>([]);
  const followUpQuestions = externalFollowUpQuestions !== undefined ? externalFollowUpQuestions : internalFollowUpQuestions;
  const setFollowUpQuestions = setExternalFollowUpQuestions || setInternalFollowUpQuestions;

  const [internalVerdict, setInternalVerdict] = useState<"pass" | "fail" | "pending">("pending");
  const verdict = externalVerdict !== undefined ? externalVerdict : internalVerdict;
  const setVerdict = setExternalVerdict || setInternalVerdict;

  const [internalScore, setInternalScore] = useState<number | null>(null);
  const score = externalScore !== undefined ? externalScore : internalScore;
  const setScore = setExternalScore || setInternalScore;

  const [internalOptimizations, setInternalOptimizations] = useState("");
  const optimizations = externalOptimizations !== undefined ? externalOptimizations : internalOptimizations;
  const setOptimizations = setExternalOptimizations || setInternalOptimizations;

  const [internalTags, setInternalTags] = useState<string[]>([]);
  const tags = externalTags !== undefined ? externalTags : internalTags;
  const setTags = setExternalTags || setInternalTags;

  const [showConfig, setShowConfig] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast 状态（内部状态即可）
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });

  const TAG_PRESETS = ["幻觉", "语气", "合规", "长度", "格式", "拒答", "多轮记忆"];

const DEFAULT_FOLLOW_UP_PROMPT = `你是一个穿搭追问模拟器。

根据下方提供的对话内容，模拟用户接下来最可能主动提出的 3 个穿搭问题。

要求：
- 每个问题字数控制在 10 字左右（5~13 字均可）
- 以用户第一人称视角提问，语气真实自然，像用户自己在思考后脱口而出
- 问题围绕穿搭主题展开，角度各有差异，涵盖以下维度中的不同方向：
  · 场景延伸（这套能穿去约会 / 上班吗？）
  · 单品挖掘（我有一条白裤子怎么搭？）
  · 风格探索（怎么穿出法式 / 学院风？）
  · 情绪需求（想显瘦 / 显高有什么技巧？）
  · 实用痛点（衣橱有很多衣服却不知道怎么配）
- 问题要具体、有画面感，避免宽泛提问
- 每个问题的出发点不同，不能重复同一维度
- 只输出 JSON，不要输出任何其他内容，不要加 markdown 代码块

输出格式：
{
  "questions": [
    { "id": 1, "text": "问题一" },
    { "id": 2, "text": "问题二" },
    { "id": 3, "text": "问题三" }
  ]
}

对话内容：
{{conversation}}`;  const [config, setConfig] = useState<APIConfig>({
    baseUrl: "http://192.168.15.62:8082",
    chatSvc: "closet_gpt54mini",
    promptClosetChat: "",
    promptClosetChatSum: "",
    promptClosetChatImage: "",
    promptClosetTrendFilter: "",
    promptClosetChatDetect: "",
    promptClosetChatProduct: "",
    promptImgExtractSystem: "",
    debug: "model_debug",
    followUpPrompt: DEFAULT_FOLLOW_UP_PROMPT,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // 生成追问问题
  const generateFollowUpQuestions = useCallback(async (contextMessages: Message[]) => {
    console.log("🔥 [追问生成] 函数被调用，消息数:", contextMessages.length);
    if (contextMessages.length === 0) {
      console.warn("🔥 [追问生成] 消息数为0，跳过");
      return;
    }
    console.log("🔥 [追问生成] 开始生成追问...");

    try {
      // 构建对话上下文
      const conversationContext = contextMessages
        .map((msg) => `${msg.role === "user" ? "用户" : "AI"}: ${msg.content}`)
        .join("\n\n");

      const response = await fetch("/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer sk-530e813f50e071db5481f7f3ae89bd6a181fcaaea9822c203e644af8af80c630",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: config.followUpPrompt.replace("{{conversation}}", conversationContext)
            }
          ],
        }),
      });

      console.log("🔥 [追问生成] API响应状态:", response.status);
      const data = await response.json();
      console.log("🔥 [追问生成] API响应数据:", JSON.stringify(data, null, 2));
      
      // 查找 content 数组中的 text 类型（跳过 thinking 类型）
      let textContent = "";
      if (data.content && Array.isArray(data.content)) {
        const textItem = data.content.find((item: any) => item.type === "text" && item.text);
        if (textItem) {
          textContent = textItem.text;
          console.log("🔥 [追问生成] 找到 text 内容:", textContent.substring(0, 100) + "...");
        } else {
          console.error("🔥 [追问生成] 未找到 text 类型的内容");
        }
      }
      
      if (textContent) {
        try {
          let text = textContent.trim();
          console.log("🔥 [追问生成] 追问原始文本:", text);

          // 去除 markdown 代码块标记
          text = text.replace(/```json\s*/, "").replace(/```\s*$/, "").trim();
          console.log("清理后文本:", text);

          // 直接解析JSON
          const parsed = JSON.parse(text);
          console.log("解析的追问:", parsed);
          if (parsed.questions && Array.isArray(parsed.questions)) {
            // 提取 text 字段
            const questionTexts = parsed.questions.map((q: { id?: number; text?: string }) => q.text || "").filter((t: string) => t.length > 0);
            console.log("设置追问问题:", questionTexts);
            setFollowUpQuestions(questionTexts.slice(0, 3));
            console.log("🔥 [追问生成] 追问问题已设置:", questionTexts.slice(0, 3));
            console.log("🔥 [追问生成] 调用 setFollowUpQuestions...");
          }
        } catch (e) {
          console.error("解析追问问题失败:", e);
          setFollowUpQuestions([]);
        }
      }
    } catch (error) {
      console.error("生成追问问题失败:", error);
      setFollowUpQuestions([]);
    }
  }, []);

  const UPLOAD_API_URL = "/api/open/upload";
  const AI_STYLIST_API_URL = "/api/ai-stylist/send-message";
  const UPLOAD_TOKEN = "7f4c2d91b8e64a3f9c2e7d15a6b84f03";

  // 处理文件上传（支持多选）- 上传到图床并获取 URL
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        console.warn("跳过非图片文件:", file.name);
        continue;
      }

      // 1. 先读取本地预览
      const localUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // 2. 添加到待发送列表（带loading状态）
      setPendingImages((prev) => [
        ...prev,
        { url: localUrl, type: "upload", status: "uploading" }
      ]);

      // 3. 上传到图床
      try {
        console.log("开始上传图片到图床:", file.name);
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(UPLOAD_API_URL, {
          method: "POST",
          mode: "cors",
          headers: {
            "x-external-token": UPLOAD_TOKEN,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log("图床返回:", data);

        if (data.isSuccess && data.data?.path) {
          const realUrl = data.data.path;
          console.log("图片上传成功, URL:", realUrl);

          // 更新 pendingImages，将本地预览替换为真实 OSS URL
          setPendingImages((prev) => {
            // 找到第一个 uploading 状态的图片并替换
            const idx = prev.findIndex((img) => img.status === "uploading");
            if (idx >= 0) {
              const newImages = [...prev];
              newImages[idx] = { url: realUrl, type: "upload", status: "done" };
              return newImages;
            }
            return prev;
          });
        } else {
          throw new Error(data.msg || "上传失败");
        }
      } catch (err) {
        console.error("上传到图床失败:", err);
        alert(`图片 "${file.name}" 上传失败: ${err instanceof Error ? err.message : "网络错误"}`);
        // 从 pendingImages 中移除失败的图片
        setPendingImages((prev) => prev.filter((img) => img.status !== "uploading"));
      }
    }
  };

  // 移除待发送图片
  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const sendMessage = useCallback(async () => {
    const prompt = input.trim();
    if ((!prompt && pendingImages.length === 0) || loading) return;

    // 保存图片副本（避免后续被清空后无法读取）
    const currentImages = [...pendingImages];

    // 构建用户消息（包含图片）
    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: prompt || "[图片]",
      timestamp: Date.now(),
      images: currentImages.length > 0 ? currentImages : undefined,
      metadata: {
        requestPayload: undefined,
      },
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingImages([]);
    setLoading(true);

    try {
      // 构建 prompt_params
      const promptParams: Record<string, string> = {};
      if (config.promptClosetChat) promptParams.prompt_closet_chat = config.promptClosetChat;
      if (config.promptClosetChatSum) promptParams.prompt_closet_chat_sum = config.promptClosetChatSum;
      if (config.promptClosetChatImage) promptParams.prompt_closet_chat_image = config.promptClosetChatImage;
      if (config.promptClosetTrendFilter) promptParams.prompt_closet_trend_filter = config.promptClosetTrendFilter;
      if (config.promptClosetChatDetect) promptParams.prompt_closet_chat_detect = config.promptClosetChatDetect;
      if (config.promptClosetChatProduct) promptParams.prompt_closet_chat_product = config.promptClosetChatProduct;
      if (config.promptImgExtractSystem) promptParams.prompt_img_extract_system = config.promptImgExtractSystem;

      const payload: Record<string, unknown> = {
        prompt,
        chat_id: chatId || undefined,
        chat_svc: config.chatSvc || undefined,
      };

      // 添加 prompt_params（如果有）
      if (Object.keys(promptParams).length > 0) {
        payload.prompt_params = promptParams;
      }

      // 添加 debug
      if (config.debug) payload.debug = config.debug;

      // 处理图片 URLs
      const allImageUrls: string[] = [];

      // 1. 用户上传的图片（已上传为 URL）
      if (currentImages.length > 0) {
        for (const img of currentImages) {
          allImageUrls.push(img.url);
        }
      }

      if (allImageUrls.length > 0) {
        payload.imageUrls = allImageUrls;
      }

      console.log("发送 payload:", payload);

      // 更新用户消息，添加请求 payload
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsg.id ? { ...m, metadata: { ...m.metadata, requestPayload: payload } } : m
        )
      );

      const apiUrl = config.baseUrl ? `${config.baseUrl}${AI_STYLIST_API_URL}` : AI_STYLIST_API_URL;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log("API Response:", data);

      if (data.status === 1 && data.data) {
        console.log("Response data:", data.data);
        console.log("debug_flow:", data.data.debug_flow);
        console.log("debugFlow:", data.data.debugFlow);

        // 保存 chat_id 用于持续对话
        if (data.data.chat_id) {
          setChatId(data.data.chat_id);
        }

        // 提取消息文本
        let content = "";
        const assistantImages: MessageImage[] = [];

        if (Array.isArray(data.data.message)) {
          for (const msg of data.data.message) {
            if (msg.type === "text") {
              content = msg.text || "";
            } else if (msg.type === "image" && msg.url) {
              // AI 返回的图片 (旧格式)
              assistantImages.push({ url: msg.url, type: "generated" });
            } else if (msg.type === "image_url" && msg.image?.url) {
              // AI 返回的图片 (新格式)
              assistantImages.push({ url: msg.image.url, type: "generated" });
            }
          }
        }

        const assistantMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: content || (assistantImages.length > 0 ? "" : "（无回复内容）"),
          timestamp: Date.now(),
          images: assistantImages.length > 0 ? assistantImages : undefined,
          metadata: {
            chatId: data.data.chat_id,
            debugFlow: (data.data.debug_flow || data.data.debugFlow) as DebugFlowItem[] | undefined,
            rawResponse: {
              status: data.status,
              msg: data.msg,
              data: data.data,
            },
          },
        };

        // AI回复完成后生成追问（在setMessages外部调用，避免状态更新冲突）
        const newMessagesForFollowUp = [...messages, assistantMsg];
        
        setMessages((prev) => {
          const newMessages = [...prev, assistantMsg];
          console.log("消息已更新，总数:");
          return newMessages;
        });
        
        // 在 setMessages 之后生成追问
        setTimeout(() => {
          console.log("准备生成追问，消息数:", newMessagesForFollowUp.length);
          generateFollowUpQuestions(newMessagesForFollowUp);
        }, 100);
        if (onSaveImageGen) {
          const debugFlow = (data.data.debug_flow || data.data.debugFlow) as DebugFlowItem[] | undefined;
          if (debugFlow && Array.isArray(debugFlow)) {
            // 1. 先检查是否为 "1: 生图需求" 分支
            const detectStep = debugFlow.find((step) => step.template === "closet_chat_detect");
            console.log("生图检测步骤:", detectStep);

            // 只有当输出为 "1"（生图需求）时才记录
            if (detectStep && detectStep.output === "1") {
              // 2. 查找 closet_chat 节点获取提示词
              const chatStep = debugFlow.find((step) => step.template === "closet_chat");
              console.log("生图提示词步骤:", chatStep);

              // 3. 查找是否有生成的图片
              const generatedImage = assistantImages.find((img) => img.type === "generated");
              console.log("生成的图片:", generatedImage);

              const imageGenRecord: ImageGenRecord = {
                id: generateId(),
                imageModel: "gpt-image-1", // 默认模型
                prompt: chatStep?.output || "",
                createdAt: Date.now(),
                previewUrl: generatedImage?.url || "",
              };
              console.log("保存生图记录:", imageGenRecord);
              onSaveImageGen(imageGenRecord);
            }
          }
        }
      } else {
        // 错误响应
        const errorMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: `错误: ${data.msg || "未知错误"}`,
          timestamp: Date.now(),
          metadata: { chatId: chatId || undefined },
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (error) {
      const errorMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: `请求失败: ${error instanceof Error ? error.message : "网络错误"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, chatId, config, pendingImages]);

  const clearChat = () => {
    setMessages([]);
    setChatId("");
    setPendingImages([]);
    setFollowUpQuestions([]);
    // 重置文件输入框，确保可以重新上传相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 保存到对话结果存储
  const saveToLibrary = () => {
    if (messages.length === 0 || !onSaveToConversations) return;
    if (verdict === "pending") {
      window.alert("请先选择「通过」或「不通过」后再保存。");
      return;
    }

    const title = window.prompt("对话标题（列表展示）", `API 对话 ${new Date().toLocaleString("zh-CN")}`);
    if (!title) return;

    // 转换 Message[] 到 ChatMessage[]
    const chatMessages = messages.map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      content: msg.content,
      images: msg.images?.map((img: MessageImage) => ({ url: img.url, type: img.type })),
      createdAt: msg.timestamp,
    }));

    const conv: StoredConversation = {
      id: uid("conv"),
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      modelId: config.chatSvc || "closet_gpt54mini",
      imageModelId: "",
      promptId: "",
      promptVersionName: "API 测试",
      systemPromptContent: JSON.stringify(config),
      userProfileSnapshot: "",
      messages: chatMessages,
      evaluation: {
        verdict,
        score,
        notes: "",
        optimizations,
        tags,
      },
    };

    onSaveToConversations(conv);
    setToast({ show: true, message: "已保存到「对话结果存储」！" });
    setTimeout(() => setToast({ show: false, message: "" }), 1000);
  };

  // 导出对话为 JSON
  const exportConversation = () => {
    if (messages.length === 0) return;

    const exportData = {
      title: `AI Stylist 对话记录 ${new Date().toLocaleString("zh-CN")}`,
      exportedAt: new Date().toISOString(),
      chatId: chatId || null,
      messageCount: messages.length,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        timestampFormatted: new Date(msg.timestamp).toLocaleString("zh-CN"),
        images: msg.images,
        metadata: msg.metadata
          ? {
              chatId: msg.metadata.chatId,
              debugFlow: msg.metadata.debugFlow,
              requestPayload: msg.metadata.requestPayload,
              rawResponse: msg.metadata.rawResponse,
            }
          : null,
      })),
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-stylist-conversation-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 发送追问问题
  const sendFollowUpQuestion = useCallback((question: string) => {
    // 清空追问气泡
    setFollowUpQuestions([]);
    // 直接设置 input 并触发发送
    setInput(question);
    // 使用 requestAnimationFrame 确保状态更新
    requestAnimationFrame(() => {
      // 手动构造发送逻辑
      const prompt = question;
      if (!prompt || loading) return;

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: prompt,
        timestamp: Date.now(),
        metadata: { requestPayload: undefined },
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInput("");
      setLoading(true);

      // 构造 payload 并发送
      const payload: Record<string, unknown> = {
        prompt,
        chat_id: chatId || undefined,
        chat_svc: config.chatSvc || undefined,
      };

      const promptParams: Record<string, string> = {};
      if (config.promptClosetChat) promptParams.prompt_closet_chat = config.promptClosetChat;
      if (config.promptClosetChatSum) promptParams.prompt_closet_chat_sum = config.promptClosetChatSum;
      if (config.promptClosetChatImage) promptParams.prompt_closet_chat_image = config.promptClosetChatImage;
      if (config.promptClosetTrendFilter) promptParams.prompt_closet_trend_filter = config.promptClosetTrendFilter;
      if (config.promptClosetChatDetect) promptParams.prompt_closet_chat_detect = config.promptClosetChatDetect;
      if (config.promptClosetChatProduct) promptParams.prompt_closet_chat_product = config.promptClosetChatProduct;
      if (config.promptImgExtractSystem) promptParams.prompt_img_extract_system = config.promptImgExtractSystem;

      if (Object.keys(promptParams).length > 0) {
        payload.prompt_params = promptParams;
      }
      if (config.debug) payload.debug = config.debug;

      // 调用 API
      const apiUrl = config.baseUrl ? `${config.baseUrl}${AI_STYLIST_API_URL}` : AI_STYLIST_API_URL;
      fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(res => res.json())
        .then(data => {
          // 处理响应...
          if (data.status === 1 && data.data) {
            if (data.data.chat_id) {
              setChatId(data.data.chat_id);
            }
            let content = "";
            const assistantImages: MessageImage[] = [];
            if (Array.isArray(data.data.message)) {
              for (const msg of data.data.message) {
                if (msg.type === "text") {
                  content = msg.text || "";
                } else if (msg.type === "image" && msg.url) {
                  assistantImages.push({ url: msg.url, type: "generated" });
                } else if (msg.type === "image_url" && msg.image?.url) {
                  assistantImages.push({ url: msg.image.url, type: "generated" });
                }
              }
            }
            const assistantMsg: Message = {
              id: generateId(),
              role: "assistant",
              content: content || (assistantImages.length > 0 ? "" : "（无回复内容）"),
              timestamp: Date.now(),
              images: assistantImages.length > 0 ? assistantImages : undefined,
              metadata: {
                chatId: data.data.chat_id,
                debugFlow: (data.data.debug_flow || data.data.debugFlow) as DebugFlowItem[] | undefined,
                rawResponse: { status: data.status, msg: data.msg, data: data.data },
              },
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setTimeout(() => generateFollowUpQuestions([...newMessages, assistantMsg]), 100);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error("发送失败:", err);
          setLoading(false);
        });
    });
  }, [messages, chatId, config, loading, AI_STYLIST_API_URL, generateFollowUpQuestions]);

  return (
    <div className="api-dialogue-view" style={{ display: "flex", flexDirection: "column" }}>
      {/* Toast 提示 */}
      {toast.show && (
        <div className="toast-notification">
          {toast.message}
        </div>
      )}

      {/* 头部 */}
      <div className="api-header-bar">
        <div className="api-title-section">
          <h2>AI Stylist 对话</h2>
          <p className="api-endpoint">
            {chatId ? `Chat ID: ${chatId}` : "新对话"}
          </p>
        </div>
        <div className="api-actions">
          <button
            type="button"
            className={`btn ${showConfig ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setShowConfig(!showConfig)}
          >
            {showConfig ? "隐藏配置" : "显示配置"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => exportConversation()}
            disabled={messages.length === 0}
            title={messages.length === 0 ? "没有可导出的对话" : "导出对话为 JSON"}
          >
            ⬇️ 导出对话
          </button>
          <button type="button" className="btn btn-danger" onClick={clearChat}>
            清空对话
          </button>
        </div>
      </div>

      {/* 配置侧边栏遮罩 */}
      {showConfig && (
        <div className="api-config-overlay" onClick={() => setShowConfig(false)} />
      )}

      {/* 配置侧边栏 */}
      {showConfig && (
        <div className="api-config-panel">
          <div className="config-header">
            <h3>⚙️ 接口配置</h3>
            <button type="button" className="config-close-btn" onClick={() => setShowConfig(false)}>
              ✕
            </button>
          </div>
          <div className="config-grid" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label className="label">Base URL (留空使用 Vite 代理)</label>
              <input
                type="text"
                className="input"
                value={config.baseUrl}
                onChange={(e) => setConfig((c) => ({ ...c, baseUrl: e.target.value }))}
                placeholder="http://192.168.15.62:8082"
              />
            </div>
            <div>
              <label className="label">chat_svc</label>
              <select
                className="input select"
                value={config.chatSvc}
                onChange={(e) => setConfig((c) => ({ ...c, chatSvc: e.target.value }))}
              >
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
              <label className="label">debug</label>
              <input
                type="text"
                className="input"
                value={config.debug}
                onChange={(e) => setConfig((c) => ({ ...c, debug: e.target.value }))}
                placeholder="model_debug"
              />
            </div>
            <div>
              <label className="label">prompt_closet_chat</label>
              <input
                type="text"
                className="input"
                value={config.promptClosetChat}
                onChange={(e) => setConfig((c) => ({ ...c, promptClosetChat: e.target.value }))}
                placeholder="自定义 chat prompt"
              />
            </div>
            <div>
              <label className="label">prompt_closet_chat_sum</label>
              <input
                type="text"
                className="input"
                value={config.promptClosetChatSum}
                onChange={(e) => setConfig((c) => ({ ...c, promptClosetChatSum: e.target.value }))}
                placeholder="自定义 summary prompt"
              />
            </div>
            <div>
              <label className="label">prompt_closet_chat_image</label>
              <input
                type="text"
                className="input"
                value={config.promptClosetChatImage}
                onChange={(e) => setConfig((c) => ({ ...c, promptClosetChatImage: e.target.value }))}
                placeholder="自定义 image prompt"
              />
            </div>
            <div>
              <label className="label">prompt_closet_trend_filter</label>
              <input
                type="text"
                className="input"
                value={config.promptClosetTrendFilter}
                onChange={(e) => setConfig((c) => ({ ...c, promptClosetTrendFilter: e.target.value }))}
                placeholder="自定义 trend filter"
              />
            </div>
            <div>
              <label className="label">prompt_closet_chat_detect</label>
              <input
                type="text"
                className="input"
                value={config.promptClosetChatDetect}
                onChange={(e) => setConfig((c) => ({ ...c, promptClosetChatDetect: e.target.value }))}
                placeholder="自定义 detect prompt"
              />
            </div>
            <div>
              <label className="label">prompt_closet_chat_product</label>
              <input
                type="text"
                className="input"
                value={config.promptClosetChatProduct}
                onChange={(e) => setConfig((c) => ({ ...c, promptClosetChatProduct: e.target.value }))}
                placeholder="自定义 product prompt"
              />
            </div>
            <div>
              <label className="label">prompt_img_extract_system</label>
              <input
                type="text"
                className="input"
                value={config.promptImgExtractSystem}
                onChange={(e) => setConfig((c) => ({ ...c, promptImgExtractSystem: e.target.value }))}
                placeholder="自定义 img extract system prompt"
              />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label className="label">追问提示词 (followUpPrompt)</label>
              <textarea
                className="input"
                rows={8}
                value={config.followUpPrompt}
                onChange={(e) => setConfig((c) => ({ ...c, followUpPrompt: e.target.value }))}
                placeholder="自定义追问提示词，使用 {{conversation}} 作为对话内容占位符"
                style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", resize: "vertical" }}
              />
              <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                提示：使用 {"{{"}conversation{"}}"} 作为对话内容占位符
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 两栏主体：对话 + 评测 */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, minHeight: 0, overflow: "hidden" }}>
        {/* 左侧：对话区 */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          {/* 对话消息 */}
          <div className="api-messages-area" style={{ flex: 1 }}>
            {messages.length === 0 ? (
              <div className="api-empty-state">
                <div className="api-welcome">
                  <h3>👗 AI Stylist API 测试</h3>
                  <p>输入消息开始测试 /api/ai-stylist/send-message 接口</p>
                  <div className="api-features">
                    <span>支持连续对话（自动保存 chat_id）</span>
                    <span>支持图片上传（自动转图床 URL）</span>
                    <span>可配置自定义 prompt 模板</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="api-messages">
                {messages.map((msg) => (
                  <div key={msg.id} className={`api-message ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === "user" ? "👤" : "🤖"}
                    </div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-role">{msg.role === "user" ? "用户" : "AI Stylist"}</span>
                        <span className="message-time">
                          {new Date(msg.timestamp).toLocaleTimeString("zh-CN")}
                        </span>
                      </div>
                      {msg.content && <div className="message-text">{msg.content}</div>}
                      {msg.images && msg.images.length > 0 && (
                        <div className="message-images">
                          {msg.images.map((img: MessageImage, idx: number) => (
                            <div
                              key={idx}
                              className="message-image-wrapper"
                              onClick={() => setPreviewImage(img.url)}
                            >
                              <img src={img.url} alt={`图片 ${idx + 1}`} className="message-image" />
                              <span className="image-badge">{img.type === "upload" ? "📤" : "🤖"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* 请求 JSON - 仅用户消息 */}
                      {msg.role === "user" && msg.metadata?.requestPayload && (
                        <details className="message-debug request-payload">
                          <summary>{"📤 请求 JSON"}</summary>
                          <pre>{String(JSON.stringify(msg.metadata.requestPayload, null, 2))}</pre>
                        </details>
                      )}
                      {/* 响应数据 - 仅 AI 消息 */}
                      {msg.role === "assistant" && msg.metadata?.rawResponse && (
                        <details className="message-debug raw-response">
                          <summary>{"📄 响应数据"}</summary>
                          <pre>{String(JSON.stringify(msg.metadata.rawResponse, null, 2))}</pre>
                        </details>
                      )}
                      {/* Debug Flow */}
                      {msg.role === "assistant" && msg.metadata?.debugFlow && Array.isArray(msg.metadata.debugFlow) && msg.metadata.debugFlow.length > 0 && (
                        <details className="message-debug">
                          <summary>{`📋 Debug Flow (${msg.metadata.debugFlow.length} 个步骤)`}</summary>
                          <div className="debug-flow-list">
                            {(msg.metadata.debugFlow as DebugFlowItem[]).map((flow, idx) => (
                              <div key={idx} className="debug-flow-item">
                                <div className="debug-flow-header">
                                  <span className="debug-step-num">步骤 {idx + 1}</span>
                                  <span className="debug-template">{flow.template || "unknown"}</span>
                                  {flow.chat_svc && <span className="debug-model">{flow.chat_svc}</span>}
                                </div>
                                <div className="debug-output">
                                  <pre>
                                    {String(flow.template === "closet_chat_detect" && flow.output
                                      ? ({
                                          "1": "1: 生图需求",
                                          "2": "2: 通用穿搭问答",
                                          "3": "3: 产品介绍相关",
                                          "4": "4: 穿搭图片推荐",
                                        }[flow.output] || flow.output)
                                      : flow.output || "(无输出)")}
                                  </pre>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="api-message assistant loading">
                    <div className="message-avatar">🤖</div>
                    <div className="message-content">
                      <div className="typing-indicator">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />

                {/* 追问气泡 */}
                {followUpQuestions.length > 0 && !loading && (
                  <div className="follow-up-bubbles">
                    <div className="follow-up-label">💡 你可能还想问：</div>
                    <div className="follow-up-questions">
                      {followUpQuestions.map((question, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="follow-up-chip"
                          onClick={() => sendFollowUpQuestion(question)}
                          disabled={loading}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="api-input-area">
            {pendingImages.length > 0 && (
              <div className="pending-images">
                {pendingImages.map((img, idx) => (
                  <div key={idx} className={`pending-image-item ${img.status === "uploading" ? "uploading" : ""}`}>
                    <img src={img.url} alt={`待发送 ${idx + 1}`} />
                    {img.status === "uploading" && (
                      <div className="upload-overlay">
                        <span className="upload-spinner"></span>
                        <span className="upload-text">上传中</span>
                      </div>
                    )}
                    <button type="button" className="remove-image-btn" onClick={() => removePendingImage(idx)}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="api-input-wrapper">
              <textarea
                className="api-textarea"
                placeholder="输入消息，按 Enter 发送，Shift+Enter 换行..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                rows={3}
              />
              <div className="api-input-actions">
                <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                  📷 上传图片
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handleFileUpload(e.target.files)} />
                <button type="button" className="api-send-btn" onClick={sendMessage} disabled={loading || (!input.trim() && pendingImages.length === 0)}>
                  {loading ? "发送中..." : "发送"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：评测区 */}
        <div className="panel scroll-y" style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
            📊 评测区
          </div>

          {/* 结论 - 必选 */}
          <div>
            <label className="label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#dc2626", fontWeight: "bold" }}>*</span>
              结论（必选）
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {(
                [
                  ["pass", "✓ 通过", "#16a34a"],
                  ["fail", "✗ 不通过", "#dc2626"],
                ] as const
              ).map(([v, label, c]) => {
                const on = verdict === v;
                return (
                  <button
                    key={v}
                    type="button"
                    className="btn"
                    onClick={() => setVerdict(v)}
                    style={on ? { borderColor: c, color: c, background: `${c}14`, flex: 1 } : { flex: 1 }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 分数 */}
          <div>
            <label className="label">评分（1-5）</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((s) => {
                const on = score === s;
                return (
                  <button
                    key={s}
                    type="button"
                    className="btn"
                    onClick={() => setScore(s)}
                    style={on ? { borderColor: "#2563eb", color: "#2563eb", background: "#2563eb14", flex: 1 } : { flex: 1 }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 优化点 */}
          <div>
            <label className="label">优化点</label>
            <textarea
              className="textarea-field"
              rows={3}
              placeholder="记录优化建议..."
              value={optimizations}
              onChange={(e) => setOptimizations(e.target.value)}
            />
          </div>

          {/* 标签 */}
          <div>
            <label className="label">问题标签</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TAG_PRESETS.map((t) => {
                const on = tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    className="chip"
                    onClick={() =>
                      on ? setTags(tags.filter((x) => x !== t)) : setTags([...tags, t])
                    }
                    style={{
                      cursor: "pointer",
                      borderColor: on ? "rgba(37,99,235,0.4)" : undefined,
                      color: on ? "var(--accent)" : undefined,
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 保存按钮 */}
          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={saveToLibrary}
              disabled={messages.length === 0 || !onSaveToConversations || verdict === "pending"}
              title={
                messages.length === 0
                  ? "没有可保存的对话"
                  : verdict === "pending"
                  ? "请先选择通过或不通过"
                  : "保存到对话结果存储"
              }
            >
              💾 保存到对话库
            </button>
            {verdict === "pending" && messages.length > 0 && (
              <p style={{ fontSize: "0.7rem", color: "#dc2626", marginTop: 4, textAlign: "center" }}>
                请先选择通过或不通过
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 图片预览弹窗 */}
      {previewImage && (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="image-preview-content">
            <img src={previewImage} alt="预览" />
            <button type="button" className="close-preview-btn" onClick={() => setPreviewImage(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
