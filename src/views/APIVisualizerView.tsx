import { useCallback, useEffect, useRef, useState } from "react";

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
    debugFlow?: unknown;
    rawResponse?: unknown;
    requestPayload?: unknown;
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
}

export function APIVisualizerView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string>("");
  const [showConfig, setShowConfig] = useState(false);
  const [pendingImages, setPendingImages] = useState<MessageImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<APIConfig>({
    baseUrl: "",
    chatSvc: "closet_gpt54mini",
    promptClosetChat: "",
    promptClosetChatSum: "",
    promptClosetChatImage: "",
    promptClosetTrendFilter: "",
    promptClosetChatDetect: "",
    promptClosetChatProduct: "",
    promptImgExtractSystem: "",
    debug: "model_debug",
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
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
        requestPayload: null, // 将在发送前填充
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

        setMessages((prev) => [...prev, assistantMsg]);
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

  return (
    <div className="api-dialogue-view">
      {/* 头部 */}
      <div className="api-header-bar">
        <div className="api-title-section">
          <h2>AI Stylist API 测试</h2>
          <p className="api-endpoint">
            POST /api/ai-stylist/send-message
            {chatId && <span className="chat-id-badge">Chat ID: {chatId}</span>}
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

      {/* 配置面板遮罩 */}
      {showConfig && (
        <div className="api-config-overlay" onClick={() => setShowConfig(false)} />
      )}

      {/* 配置面板 */}
      {showConfig && (
        <div className="api-config-panel">
          <div className="config-header">
            <h3>⚙️ 接口配置</h3>
            <button type="button" className="config-close-btn" onClick={() => setShowConfig(false)}>
              ✕
            </button>
          </div>
          <div className="config-grid">
            <div className="config-row">
              <label>
                <span>Base URL (留空使用代理)</span>
                <input
                  type="text"
                  className="input"
                  value={config.baseUrl}
                  onChange={(e) => setConfig((c) => ({ ...c, baseUrl: e.target.value }))}
                  placeholder="留空表示使用 vite 代理"
                />
              </label>
              <label>
                <span>chat_svc</span>
                <input
                  type="text"
                  className="input"
                  value={config.chatSvc}
                  onChange={(e) => setConfig((c) => ({ ...c, chatSvc: e.target.value }))}
                  placeholder="gpt-4.1"
                />
              </label>
            </div>
            <div className="config-row">
              <label>
                <span>prompt_closet_chat</span>
                <input
                  type="text"
                  className="input"
                  value={config.promptClosetChat}
                  onChange={(e) => setConfig((c) => ({ ...c, promptClosetChat: e.target.value }))}
                  placeholder="自定义 chat prompt"
                />
              </label>
              <label>
                <span>prompt_closet_chat_sum</span>
                <input
                  type="text"
                  className="input"
                  value={config.promptClosetChatSum}
                  onChange={(e) => setConfig((c) => ({ ...c, promptClosetChatSum: e.target.value }))}
                  placeholder="自定义 summary prompt"
                />
              </label>
            </div>
            <div className="config-row">
              <label>
                <span>prompt_closet_chat_image</span>
                <input
                  type="text"
                  className="input"
                  value={config.promptClosetChatImage}
                  onChange={(e) => setConfig((c) => ({ ...c, promptClosetChatImage: e.target.value }))}
                  placeholder="自定义 image prompt"
                />
              </label>
              <label>
                <span>prompt_closet_trend_filter</span>
                <input
                  type="text"
                  className="input"
                  value={config.promptClosetTrendFilter}
                  onChange={(e) => setConfig((c) => ({ ...c, promptClosetTrendFilter: e.target.value }))}
                  placeholder="自定义 trend filter"
                />
              </label>
            </div>
            <div className="config-row">
              <label>
                <span>prompt_closet_chat_detect</span>
                <input
                  type="text"
                  className="input"
                  value={config.promptClosetChatDetect}
                  onChange={(e) => setConfig((c) => ({ ...c, promptClosetChatDetect: e.target.value }))}
                  placeholder="自定义 detect prompt"
                />
              </label>
              <label>
                <span>prompt_closet_chat_product</span>
                <input
                  type="text"
                  className="input"
                  value={config.promptClosetChatProduct}
                  onChange={(e) => setConfig((c) => ({ ...c, promptClosetChatProduct: e.target.value }))}
                  placeholder="自定义 product prompt"
                />
              </label>
            </div>
            <div className="config-fullwidth">
              <label>
                <span>prompt_img_extract_system</span>
                <input
                  type="text"
                  className="input"
                  value={config.promptImgExtractSystem}
                  onChange={(e) => setConfig((c) => ({ ...c, promptImgExtractSystem: e.target.value }))}
                  placeholder="自定义 img extract system prompt"
                />
              </label>
            </div>
            <div className="config-row">
              <label>
                <span>debug</span>
                <input
                  type="text"
                  className="input"
                  value={config.debug}
                  onChange={(e) => setConfig((c) => ({ ...c, debug: e.target.value }))}
                  placeholder="model_debug"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 对话区域 */}
      <div className="api-messages-area">
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
                  {/* 显示图片 */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="message-images">
                      {msg.images.map((img, idx) => (
                        <div
                          key={idx}
                          className="message-image-wrapper"
                          onClick={() => setPreviewImage(img.url)}
                        >
                          <img
                            src={img.url}
                            alt={`图片 ${idx + 1}`}
                            className="message-image"
                          />
                          <span className="image-badge">{img.type === "upload" ? "📤" : "🤖"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.metadata?.chatId && (
                    <div className="message-meta">Chat ID: {msg.metadata.chatId}</div>
                  )}
                  {(() => {
                    const req = msg.metadata?.requestPayload;
                    if (!req || msg.role !== "user") return null;
                    return (
                      <details className="message-debug request-payload">
                        <summary>📤 请求 JSON</summary>
                        <pre>{JSON.stringify(req, null, 2)}</pre>
                      </details>
                    );
                  })()}
                  {(() => {
                    const metadata = msg.metadata;
                    if (!metadata) return null;
                    const df = metadata.debugFlow;
                    if (!Array.isArray(df) || df.length === 0) return null;
                    const flows = df as DebugFlowItem[];
                    return (
                      <details className="message-debug">
                        <summary>📋 Debug Flow ({flows.length} 个步骤)</summary>
                        <div className="debug-flow-list">
                          {flows.map((flow, idx) => (
                            <div key={idx} className="debug-flow-item">
                              <div className="debug-flow-header">
                                <span className="debug-step-num">步骤 {idx + 1}</span>
                                <span className="debug-template">{flow.template || "unknown"}</span>
                                {flow.chat_svc && <span className="debug-model">{flow.chat_svc}</span>}
                              </div>
                              <div className="debug-output">
                                <pre>{flow.output || "(无输出)"}</pre>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })()}
                  {(() => {
                    const raw = msg.metadata?.rawResponse;
                    if (!raw) return null;
                    return (
                      <details className="message-debug raw-response">
                        <summary>📄 完整响应数据</summary>
                        <pre>{JSON.stringify(raw, null, 2)}</pre>
                      </details>
                    );
                  })()}
                </div>
              </div>
            ))}
            {loading && (
              <div className="api-message assistant loading">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div
        className={`api-input-area ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 待发送图片预览 */}
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
                <button
                  type="button"
                  className="remove-image-btn"
                  onClick={() => removePendingImage(idx)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="api-input-wrapper">
          <textarea
            className="api-textarea"
            placeholder="输入消息，按 Enter 发送，Shift+Enter 换行...拖拽或点击上传图片"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={3}
          />
          <div className="api-input-actions">
            <button
              type="button"
              className="upload-btn-with-text"
              onClick={() => fileInputRef.current?.click()}
              title="上传图片"
            >
              <span className="upload-icon">📎</span>
              <span className="upload-label">上传图片</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <button
              type="button"
              className="api-send-btn"
              onClick={sendMessage}
              disabled={loading || (!input.trim() && pendingImages.length === 0)}
            >
              {loading ? "发送中..." : "发送"}
            </button>
          </div>
        </div>
        <div className="api-input-hint">
          <span>Enter 发送</span>
          <span>Shift+Enter 换行</span>
          <span>拖拽或点击 📎 上传图片</span>
          {chatId && <span>当前会话: {chatId}</span>}
        </div>
      </div>

      {/* 图片预览弹窗 */}
      {previewImage && (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="image-preview-content">
            <img src={previewImage} alt="预览" />
            <button
              type="button"
              className="close-preview-btn"
              onClick={() => setPreviewImage(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
