export type PostingArtBindings = {
  DB: any;
  BUCKET: any;
};

declare global {
  var __POSTING_ART_ENV__: PostingArtBindings | undefined;
}

export function getRuntimeEnv() {
  if (!globalThis.__POSTING_ART_ENV__) {
    throw new Error("Posting Art storage bindings are unavailable");
  }
  return globalThis.__POSTING_ART_ENV__;
}
