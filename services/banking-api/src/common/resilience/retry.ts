export async function withRetries<T>(
  fn: () => Promise<T>,
  opts: { retries: number; baseDelayMs: number; maxDelayMs: number }
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (attempt === opts.retries) break;
      const delay = Math.min(
        opts.maxDelayMs,
        opts.baseDelayMs * Math.pow(2, attempt)
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}
