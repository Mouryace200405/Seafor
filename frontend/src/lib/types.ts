export interface Settings {
  has_api_key: boolean;
  api_key_hint: string;
  default_model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  tts_voice: string;
  tts_rate: number;
  auto_tts: boolean;
  context_fraction: number;
  openrouter_configured_via_env: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  context_length: number;
  max_completion_tokens: number;
  modality: string;
  input_modalities: string[];
  prompt_price: string;
  completion_price: string;
}

export interface Thread {
  id: string;
  title: string;
  model: string;
  system_prompt: string;
  enabled_skills: string[];
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string;
}

export interface Artifact {
  id: string;
  thread_id: string;
  message_id: string | null;
  title: string;
  kind: "markdown" | "code" | "text" | "html" | "svg" | "json" | "csv" | "mermaid";
  language: string;
  content: string;
  tokens_saved: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  meta: Record<string, any>;
  created_at: string;
  artifacts?: Artifact[];
  streaming?: boolean;
}

export interface Skill {
  name: string;
  description: string;
  builtin: boolean;
}

export interface Prompt {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Memory {
  id: string;
  content: string;
  kind: string;
  source_thread_id: string | null;
  pinned: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}
