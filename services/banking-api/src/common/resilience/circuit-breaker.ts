export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private state: CircuitState = "CLOSED";

  constructor(
    private readonly options: {
      failureThreshold: number;
      resetTimeoutMs: number;
    }
  ) {}

  getState(): CircuitState {
    if (this.state === "OPEN") {
      if (Date.now() - this.openedAt >= this.options.resetTimeoutMs) {
        this.state = "HALF_OPEN";
      }
    }
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    const st = this.getState();
    if (st === "OPEN") {
      throw new Error("Circuit breaker OPEN — aguarde antes de retentar.");
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (e) {
      this.onFailure();
      throw e;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  private onFailure() {
    this.failures += 1;
    if (this.failures >= this.options.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = Date.now();
    }
  }
}
