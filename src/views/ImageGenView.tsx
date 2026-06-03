import type { ImageGenRecord } from "../types";

interface Props {
  records: ImageGenRecord[];
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString("zh-CN");
}

export function ImageGenView({ records }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>生图结果白盒化</h2>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          展示生图 id、模型、提示词与时间。对话中触发「生图」类话术会自动写入一条 Demo 记录。
        </p>
      </div>
      <div className="table-wrap scroll-y" style={{ flex: 1 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>预览</th>
              <th>生图 ID</th>
              <th>生图模型</th>
              <th>生图提示词</th>
              <th>生图时间</th>
              <th>关联对话</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  暂无记录。在「原始对话测试」中发送包含「生图 / 出图 / 试穿 / 配图」等关键词的消息即可生成示例记录。
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id}>
                  <td style={{ width: 120 }}>
                    <img src={r.previewUrl} alt="" style={{ width: 100, height: 100, borderRadius: 8, objectFit: "contain", border: "1px solid var(--border)" }} />
                  </td>
                  <td>
                    <code style={{ fontSize: "0.75rem" }}>{r.id}</code>
                  </td>
                  <td>{r.imageModel}</td>
                  <td style={{ maxWidth: 360, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.8rem" }}>{r.prompt}</td>
                  <td style={{ whiteSpace: "nowrap", fontSize: "0.8rem", color: "var(--text-muted)" }}>{fmtTime(r.createdAt)}</td>
                  <td>
                    <code style={{ fontSize: "0.72rem" }}>{r.conversationId ?? "—"}</code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
