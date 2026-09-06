export type Capability = "text" | "image" | "voice" | "music";
export type CostTier = "free" | "low" | "paid";

export interface StoryDraft {
  title: string;
  hook: string;
  body: string;
  lesson: string;
  ending: string;
  estimatedSeconds: number;
}

export interface SceneDraft {
  sceneNumber: number;
  description: string;
  characters: string[];
  dialogue: string;
  narration: string;
  imagePrompt: string;
  animation: string;
  soundEffects: string;
  durationSeconds: number;
}

export interface VideoMetaDraft {
  title: string;
  description: string;
  tags: string[];
}

export interface CharacterRef {
  name: string;
  personality?: string | null;
  appearance?: string | null;
  clothes?: string | null;
  visual_style?: string | null;
}

export interface TextProvider {
  key: string;
  label: string;
  costTier: CostTier;
  writeStory(input: {
    topic: string;
    language: string;
    prompt?: string | null;
    characters: CharacterRef[];
  }): Promise<StoryDraft>;
  splitScenes(input: {
    story: StoryDraft;
    topic: string;
    language: string;
    characters: CharacterRef[];
  }): Promise<SceneDraft[]>;
  writeMetadata(input: {
    story: StoryDraft;
    topic: string;
    language: string;
  }): Promise<VideoMetaDraft>;
}

export interface ImageProvider {
  key: string;
  label: string;
  costTier: CostTier;
  /** Returns raw file bytes plus its content type and extension. */
  renderScene(input: {
    prompt: string;
    sceneNumber: number;
    totalScenes: number;
    title: string;
  }): Promise<{ bytes: Uint8Array; contentType: string; extension: string }>;
}

export interface VoiceProvider {
  key: string;
  label: string;
  costTier: CostTier;
  speak(input: {
    text: string;
    language: string;
    durationSeconds: number;
  }): Promise<{
    bytes: Uint8Array;
    contentType: string;
    extension: string;
    durationSeconds: number;
  }>;
}

export interface MusicProvider {
  key: string;
  label: string;
  costTier: CostTier;
  compose(input: {
    mood: string;
    durationSeconds: number;
  }): Promise<{
    bytes: Uint8Array;
    contentType: string;
    extension: string;
    durationSeconds: number;
  }>;
}
