import logger from "../utils/logger";
import config from "../config/env";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
  name: string;
  threshold: number;
  timeout: number;
  onStateChange?: (state: CircuitState) => void;
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private successes: number = 0;
  private readonly name: string;
  private readonly threshold: number;
  private readonly timeout: number;
  private readonly onStateChange?: (state: CircuitState) => void;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.threshold = options.threshold;
    this.timeout = options.timeout;
    this.onStateChange = options.onStateChange;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.transitionTo("HALF_OPEN");
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.successes++;

    if (this.state === "HALF_OPEN") {
      if (this.successes >= 3) {
        this.transitionTo("CLOSED");
      }
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      this.transitionTo("OPEN");
    } else if (this.state === "CLOSED" && this.failures >= this.threshold) {
      this.transitionTo("OPEN");
    }
  }

  private transitionTo(newState: CircuitState) {
    const previousState = this.state;
    this.state = newState;

    if (newState === "CLOSED") {
      this.failures = 0;
      this.successes = 0;
    } else if (newState === "HALF_OPEN") {
      this.successes = 0;
    }

    logger.info(`Circuit breaker ${this.name} state change: ${previousState} -> ${newState}`);

    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  reset() {
    this.state = "CLOSED";
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
  }
}

class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  register(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const breaker = new CircuitBreaker({
      name,
      threshold: options?.threshold ?? config.circuitBreaker.threshold,
      timeout: options?.timeout ?? config.circuitBreaker.timeout,
      onStateChange: options?.onStateChange,
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getAll(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  getStats() {
    const stats: Record<string, { state: CircuitState; failures: number }> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = {
        state: breaker.getState(),
        failures: breaker.getFailures(),
      };
    }
    return stats;
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

export const createCircuitBreaker = (name: string, options?: Partial<CircuitBreakerOptions>) => {
  return circuitBreakerRegistry.register(name, options);
};
