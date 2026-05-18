import type {
  CompareTask,
  ImageGenRecord,
  PromptCompareTask,
  PromptTemplate,
  StoredConversation,
  QuestionBank,
  BatchTestTask,
  PromptCategoryConfig,
} from "../types";

const KEY = "ai-console-persist-v2";

export interface PersistedBundle {
  prompts: PromptTemplate[];
  userProfile: string;
  memory?: string;
  conversations: StoredConversation[];
  images: ImageGenRecord[];
  compareTasks: CompareTask[];
  promptCompareTasks?: PromptCompareTask[];
  questionBank?: QuestionBank;
  batchTestTasks?: BatchTestTask[];
  promptCategories?: PromptCategoryConfig[];
}

export function loadBundle(): Partial<PersistedBundle> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PersistedBundle>;
  } catch {
    return null;
  }
}

export function saveBundle(bundle: PersistedBundle) {
  localStorage.setItem(KEY, JSON.stringify(bundle));
}

export { KEY as PERSISTENCE_KEY };
