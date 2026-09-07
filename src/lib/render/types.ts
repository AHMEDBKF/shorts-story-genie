export type RendererKey = "shotstack" | "ffmpeg";

export type RenderStatus =
  | { status: "pending" }
  | { status: "done"; url: string }
  | { status: "failed"; error: string };

export interface VideoRenderer {
  key: RendererKey;
  label: string;
  /** `paid` renderers are never used unless the user explicitly allowed them. */
  costTier: "free" | "paid";
  /** True when everything this renderer needs (key, worker address…) is present. */
  isConfigured(context: RendererContext): Promise<boolean>;
  /** Submits the job and returns the renderer's own id for the running render. */
  submit(jobId: string, context: RendererContext): Promise<string>;
  /** Asks the renderer how a submitted render is doing. */
  poll(renderId: string, context: RendererContext): Promise<RenderStatus>;
}

export interface RendererContext {
  userId: string;
  ffmpegWorkerUrl: string | null;
}

/** Scene-by-scene timeline the renderers share. */
export interface TimelineScene {
  sceneNumber: number;
  start: number;
  length: number;
  imageUrl: string;
  audioUrl: string | null;
  caption: string;
  animation: string | null;
}

export interface Timeline {
  jobId: string;
  width: 1080;
  height: 1920;
  fps: 25;
  totalSeconds: number;
  scenes: TimelineScene[];
  subtitlesVtt: string | null;
  musicUrl: string | null;
}
