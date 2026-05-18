import { useState, useRef } from "react";
import type { QuestionBank, QuestionCategory, Question } from "../types";
import { uid } from "../lib/ids";
import * as XLSX from "xlsx";

interface Props {
  questionBank: QuestionBank;
  onChange: (bank: QuestionBank) => void;
}

const EMPTY_BANK: QuestionBank = {
  categories: [],
};

export function QuestionBankView({ questionBank, onChange }: Props) {
  const bank = questionBank ?? EMPTY_BANK;
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    bank.categories[0]?.id ?? ""
  );
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newQuestionContent, setNewQuestionContent] = useState("");

  const activeCategory = bank.categories.find((c) => c.id === activeCategoryId);

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const newCategory: QuestionCategory = {
      id: uid("cat"),
      name,
      questions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const newBank = {
      ...bank,
      categories: [...bank.categories, newCategory],
    };
    onChange(newBank);
    setActiveCategoryId(newCategory.id);
    setNewCategoryName("");
  };

  const handleDeleteCategory = (categoryId: string) => {
    const newCategories = bank.categories.filter((c) => c.id !== categoryId);
    const newBank = {
      ...bank,
      categories: newCategories,
    };
    onChange(newBank);
    if (activeCategoryId === categoryId) {
      setActiveCategoryId(newCategories[0]?.id ?? "");
    }
  };

  const handleUpdateCategoryName = (categoryId: string, newName: string) => {
    const newBank = {
      ...bank,
      categories: bank.categories.map((c) =>
        c.id === categoryId ? { ...c, name: newName, updatedAt: Date.now() } : c
      ),
    };
    onChange(newBank);
    setEditingCategoryId(null);
  };

  const handleAddQuestion = () => {
    if (!activeCategoryId || !newQuestionContent.trim()) return;
    const newQuestion: Question = {
      id: uid("q"),
      content: newQuestionContent.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const newBank = {
      ...bank,
      categories: bank.categories.map((c) =>
        c.id === activeCategoryId
          ? {
              ...c,
              questions: [...c.questions, newQuestion],
              updatedAt: Date.now(),
            }
          : c
      ),
    };
    onChange(newBank);
    setNewQuestionContent("");
  };

  const handleDeleteQuestion = (questionId: string) => {
    const newBank = {
      ...bank,
      categories: bank.categories.map((c) =>
        c.id === activeCategoryId
          ? {
              ...c,
              questions: c.questions.filter((q) => q.id !== questionId),
              updatedAt: Date.now(),
            }
          : c
      ),
    };
    onChange(newBank);
  };

  const handleUpdateQuestion = (questionId: string, newContent: string) => {
    const newBank = {
      ...bank,
      categories: bank.categories.map((c) =>
        c.id === activeCategoryId
          ? {
              ...c,
              questions: c.questions.map((q) =>
                q.id === questionId
                  ? { ...q, content: newContent, updatedAt: Date.now() }
                  : q
              ),
              updatedAt: Date.now(),
            }
          : c
      ),
    };
    onChange(newBank);
    setEditingQuestionId(null);
  };

  const handleCopyQuestion = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      window.alert("已复制到剪贴板");
    });
  };

  // 导出 Excel
  const exportToExcel = () => {
    if (bank.categories.length === 0) {
      window.alert("问题库为空，无法导出");
      return;
    }

    const data: { 分类: string; 问题: string }[] = [];
    bank.categories.forEach((category) => {
      if (category.questions.length === 0) {
        data.push({ 分类: category.name, 问题: "" });
      } else {
        category.questions.forEach((q) => {
          data.push({ 分类: category.name, 问题: q.content });
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "问题库");
    XLSX.writeFile(wb, `问题库_${new Date().toLocaleDateString("zh-CN")}.xlsx`);
  };

  // 导入 Excel
  const importFromExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as { 分类?: string; 问题?: string }[];

        if (jsonData.length === 0) {
          window.alert("Excel 文件为空");
          return;
        }

        // 按分类分组
        const categoryMap = new Map<string, string[]>();
        let importCount = 0;

        jsonData.forEach((row) => {
          const categoryName = row.分类?.trim() || "未分类";
          const questionContent = row.问题?.trim();
          if (questionContent) {
            if (!categoryMap.has(categoryName)) {
              categoryMap.set(categoryName, []);
            }
            categoryMap.get(categoryName)!.push(questionContent);
            importCount++;
          }
        });

        if (importCount === 0) {
          window.alert("未找到有效的问题数据");
          return;
        }

        // 确认导入
        if (!window.confirm(`将从 Excel 导入 ${importCount} 个问题，是否继续？`)) {
          return;
        }

        const newCategories: QuestionCategory[] = [];
        categoryMap.forEach((questions, categoryName) => {
          const existingCategory = bank.categories.find((c) => c.name === categoryName);
          if (existingCategory) {
            // 合并到现有分类
            const newQuestions = questions.map((content) => ({
              id: uid("q"),
              content,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }));
            const updatedCategory = {
              ...existingCategory,
              questions: [...existingCategory.questions, ...newQuestions],
              updatedAt: Date.now(),
            };
            newCategories.push(updatedCategory);
          } else {
            // 创建新分类
            const newCategory: QuestionCategory = {
              id: uid("cat"),
              name: categoryName,
              questions: questions.map((content) => ({
                id: uid("q"),
                content,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              })),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            newCategories.push(newCategory);
          }
        });

        // 合并现有分类和新分类
        const existingCategoryNames = new Set(categoryMap.keys());
        const unchangedCategories = bank.categories.filter((c) => !existingCategoryNames.has(c.name));
        const newBank = {
          ...bank,
          categories: [...unchangedCategories, ...newCategories],
        };
        onChange(newBank);
        window.alert(`成功导入 ${importCount} 个问题`);
      } catch (error) {
        console.error(error);
        window.alert("导入失败，请检查文件格式");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      {/* 顶部标题栏 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>问题库管理</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            管理问题分类，每个分类下可添加多条问题，用于批量对话测试
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" onClick={exportToExcel}>
            📥 导出 Excel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            📤 导入 Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                importFromExcel(file);
                e.target.value = ""; // 重置以便可以重复选择同一文件
              }
            }}
          />
        </div>
      </div>

      {/* 主体区域 - 左右两栏 */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, minHeight: 0 }}>
        {/* 左侧：分类列表 */}
        <div className="panel" style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
            分类列表
          </div>

          {/* 新增分类 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              className="input"
              placeholder="输入新分类名称"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCategory();
              }}
            />
            <button type="button" className="btn btn-primary" onClick={handleAddCategory}>
              ＋ 新增分类
            </button>
          </div>

          {/* 分类列表 */}
          <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {bank.categories.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                暂无分类，请先添加
              </div>
            ) : (
              bank.categories.map((cat) => {
                const isActive = cat.id === activeCategoryId;
                return (
                  <div
                    key={cat.id}
                    onClick={() => setActiveCategoryId(cat.id)}
                    style={{
                      padding: "0.75rem",
                      borderRadius: 6,
                      background: isActive ? "var(--accent-soft)" : "var(--bg-subtle)",
                      border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    {editingCategoryId === cat.id ? (
                      <input
                        className="input"
                        style={{ flex: 1, fontSize: "0.85rem" }}
                        defaultValue={cat.name}
                        onBlur={(e) => handleUpdateCategoryName(cat.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleUpdateCategoryName(cat.id, e.currentTarget.value);
                          }
                          if (e.key === "Escape") {
                            setEditingCategoryId(null);
                          }
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        style={{
                          flex: 1,
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? "var(--accent)" : "var(--text)",
                        }}
                      >
                        {cat.name}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "2px 6px",
                        borderRadius: 10,
                        background: isActive ? "var(--accent)" : "var(--border)",
                        color: isActive ? "#fff" : "var(--text-muted)",
                      }}
                    >
                      {cat.questions.length}
                    </span>
                    {isActive && editingCategoryId !== cat.id && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: "0.7rem", padding: "2px 6px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategoryId(cat.id);
                          }}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            fontSize: "0.7rem",
                            padding: "2px 6px",
                            color: "#dc2626",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`确定删除分类「${cat.name}」吗？其中的 ${cat.questions.length} 条问题也会被删除。`)) {
                              handleDeleteCategory(cat.id);
                            }
                          }}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 右侧：问题列表 */}
        <div className="panel" style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: 12 }}>
          {!activeCategory ? (
            <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
              请先在左侧选择一个分类
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {activeCategory.name}
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  共 {activeCategory.questions.length} 条问题
                </span>
              </div>

              {/* 新增问题 */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="输入新问题内容"
                  value={newQuestionContent}
                  onChange={(e) => setNewQuestionContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddQuestion();
                  }}
                />
                <button type="button" className="btn btn-primary" onClick={handleAddQuestion}>
                  ＋ 添加问题
                </button>
              </div>

              {/* 问题列表 */}
              <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {activeCategory.questions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                    <p>该分类下暂无问题</p>
                    <p style={{ fontSize: "0.8rem" }}>在上方输入框添加第一条问题</p>
                  </div>
                ) : (
                  activeCategory.questions.map((q, index) => (
                    <div
                      key={q.id}
                      style={{
                        padding: "0.75rem",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "var(--accent-soft)",
                          color: "var(--accent)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </span>

                      <div style={{ flex: 1 }}>
                        {editingQuestionId === q.id ? (
                          <textarea
                            className="textarea-field"
                            style={{ width: "100%", minHeight: 60, fontSize: "0.85rem" }}
                            defaultValue={q.content}
                            onBlur={(e) => handleUpdateQuestion(q.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && e.ctrlKey) {
                                handleUpdateQuestion(q.id, e.currentTarget.value);
                              }
                              if (e.key === "Escape") {
                                setEditingQuestionId(null);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <div style={{ fontSize: "0.9rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                            {q.content}
                          </div>
                        )}
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
                          创建于 {new Date(q.createdAt).toLocaleString("zh-CN")}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                          onClick={() => handleCopyQuestion(q.content)}
                        >
                          复制
                        </button>
                        {editingQuestionId !== q.id && (
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                            onClick={() => setEditingQuestionId(q.id)}
                          >
                            编辑
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn"
                          style={{
                            fontSize: "0.75rem",
                            padding: "4px 10px",
                            color: "#dc2626",
                          }}
                          onClick={() => {
                            if (window.confirm("确定删除这条问题吗？")) {
                              handleDeleteQuestion(q.id);
                            }
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
