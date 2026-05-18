import { useRef } from "react";
import type { ChatMessage } from "../types";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  input: string;
  onInput: (v: string) => void;
  onSend: () => void;
  onUploadImage: (file: File) => void;
}

export function ChatArea({
  messages,
  loading,
  input,
  onInput,
  onSend,
  onUploadImage,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onUploadImage(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onUploadImage(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="panel"
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* 头部 */}
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>对话区</span>
      </div>

      {/* 消息区域 */}
      <div className="scroll-y" style={{ flex: 1, padding: "1rem" }}>
        {messages.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: 0 }}>
            发送第一条消息开始测试。支持拖拽或点击上传图片。
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "min(720px, 92%)",
                padding: "0.65rem 0.85rem",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: m.role === "user" ? "var(--accent-soft)" : "var(--bg-subtle)",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {m.role === "user" ? "Tester" : "Assistant"}
                </span>
                {m.modelId && (
                  <span className="chip" style={{ fontSize: "0.65rem" }}>
                    {m.modelId}
                  </span>
                )}
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.875rem",
                  lineHeight: 1.55,
                }}
              >
                {m.content}
              </pre>
              {/* 图片展示 */}
              {m.images && m.images.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {m.images.map((img, idx) => (
                    <div key={idx} style={{ position: "relative" }}>
                      <img
                        src={img.url}
                        alt=""
                        style={{
                          maxWidth: 200,
                          maxHeight: 200,
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          objectFit: "cover",
                        }}
                      />
                      {img.type === "generated" && (
                        <span
                          className="chip"
                          style={{
                            position: "absolute",
                            bottom: 4,
                            right: 4,
                            fontSize: "0.65rem",
                            background: "rgba(0,0,0,0.7)",
                            color: "white",
                          }}
                        >
                          AI生成
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
              <span className="typing-dot">●</span>
              <span className="typing-dot" style={{ animationDelay: "0.2s" }}>
                ●
              </span>
              <span className="typing-dot" style={{ animationDelay: "0.4s" }}>
                ●
              </span>
              <span>模型生成中…</span>
            </div>
          )}
        </div>
      </div>

      {/* 输入区域 */}
      <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* 输入框 */}
        <textarea
          className="textarea-field"
          rows={2}
          style={{ flex: 1, resize: "none" }}
          placeholder="输入测试话术…（Enter 发送，Shift+Enter 换行。支持拖拽上传图片）"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />

        {/* 按钮区域 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {/* 图片上传按钮 */}
            <button
              type="button"
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              📎 上传图片
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || !input.trim()}
            onClick={onSend}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
