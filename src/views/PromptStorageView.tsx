import type { PromptTemplate } from "../types";
import { PromptPanel } from "../components/PromptPanel";

interface Props {
  prompts: PromptTemplate[];
  activeId: string;
  onSelect: (id: string) => void;
  onChange: (patch: Partial<PromptTemplate> & { id: string }) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function PromptStorageView(props: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>提示词存储</h2>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          多版本管理、可编辑；在「原始对话测试」中可通过下拉框切换当前生效的提示词版本。
        </p>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PromptPanel {...props} />
      </div>
    </div>
  );
}
