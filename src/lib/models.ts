import type { ModelPreset } from "../types";

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    description: "通用多模态旗舰（示例配置）",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "OpenAI",
    description: "低成本高频回归",
  },
  {
    id: "o3-mini",
    label: "o3-mini",
    provider: "OpenAI",
    description: "推理向任务",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4-mini",
    provider: "OpenAI",
    description: "占位：你可改为任意内部路由名",
  },
  {
    id: "claude-3-5-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    description: "对照组 / 竞品模型",
  },
];

/** 生图模型预设 */
export const IMAGE_GEN_MODELS: ModelPreset[] = [
  {
    id: "flux-schnell",
    label: "FLUX Schnell",
    provider: "Black Forest Labs",
    description: "快速生图",
  },
  {
    id: "flux-dev",
    label: "FLUX Dev",
    provider: "Black Forest Labs",
    description: "开发版生图",
  },
  {
    id: "dall-e-3",
    label: "DALL-E 3",
    provider: "OpenAI",
    description: "OpenAI 生图",
  },
  {
    id: "stable-diffusion-xl",
    label: "Stable Diffusion XL",
    provider: "Stability AI",
    description: "开源生图",
  },
];

export function getModelLabel(id: string): string {
  const all = [...MODEL_PRESETS, ...IMAGE_GEN_MODELS];
  return all.find((m) => m.id === id)?.label ?? id;
}
