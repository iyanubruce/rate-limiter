class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private startTime: number = Date.now();

  incrementCounter(name: string, value: number = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  setGauge(name: string, value: number) {
    this.gauges.set(name, value);
  }

  recordHistogram(name: string, value: number) {
    const values = this.histograms.get(name) || [];
    values.push(value);
    if (values.length > 1000) {
      values.shift();
    }
    this.histograms.set(name, values);
  }

  getHistogramStats(name: string): { count: number; sum: number; avg: number; p50: number; p95: number; p99: number } {
    const values = this.histograms.get(name) || [];
    if (values.length === 0) {
      return { count: 0, sum: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const count = sorted.length;

    return {
      count,
      sum,
      avg: sum / count,
      p50: sorted[Math.floor(count * 0.5)] ?? 0,
      p95: sorted[Math.floor(count * 0.95)] ?? 0,
      p99: sorted[Math.floor(count * 0.99)] ?? 0,
    };
  }

  toPrometheusFormat(): string {
    const lines: string[] = [];

    lines.push("# HELP ratelimitr_info Application info");
    lines.push("# TYPE ratelimitr_info gauge");
    lines.push(`ratelimitr_info{version="1.0.0"} 1`);
    lines.push(`ratelimitr_uptime_seconds ${Math.floor((Date.now() - this.startTime) / 1000)}`);
    lines.push("");

    lines.push("# HELP ratelimitr_requests_total Total number of requests");
    lines.push("# TYPE ratelimitr_requests_total counter");
    for (const [name, value] of this.counters.entries()) {
      lines.push(`ratelimitr_requests_total{name="${name}"} ${value}`);
    }
    lines.push("");

    lines.push("# HELP ratelimitr_gauge Current gauge values");
    lines.push("# TYPE ratelimitr_gauge gauge");
    for (const [name, value] of this.gauges.entries()) {
      lines.push(`ratelimitr_gauge{name="${name}"} ${value}`);
    }
    lines.push("");

    for (const [name] of this.histograms.entries()) {
      const stats = this.getHistogramStats(name);
      lines.push(`# HELP ratelimitr_${name}_histogram ${name} histogram`);
      lines.push(`# TYPE ratelimitr_${name}_histogram summary`);
      lines.push(`ratelimitr_${name}_histogram_count ${stats.count}`);
      lines.push(`ratelimitr_${name}_histogram_sum ${stats.sum}`);
      lines.push(`ratelimitr_${name}_histogram_avg ${stats.avg}`);
      lines.push(`ratelimitr_${name}_histogram_p50 ${stats.p50}`);
      lines.push(`ratelimitr_${name}_histogram_p95 ${stats.p95}`);
      lines.push(`ratelimitr_${name}_histogram_p99 ${stats.p99}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.startTime = Date.now();
  }
}

export const metrics = new MetricsCollector();

export const trackRequest = (allowed: boolean, durationMs: number) => {
  metrics.incrementCounter(allowed ? "requests_allowed" : "requests_blocked");
  metrics.recordHistogram("request_duration_ms", durationMs);
};

export const trackRedisOperation = (operation: string, durationMs: number, success: boolean) => {
  metrics.incrementCounter(`redis_${operation}_total`);
  if (!success) {
    metrics.incrementCounter(`redis_${operation}_errors`);
  }
  metrics.recordHistogram(`redis_${operation}_duration_ms`, durationMs);
};

export const trackDbOperation = (operation: string, durationMs: number, success: boolean) => {
  metrics.incrementCounter(`db_${operation}_total`);
  if (!success) {
    metrics.incrementCounter(`db_${operation}_errors`);
  }
  metrics.recordHistogram(`db_${operation}_duration_ms`, durationMs);
};

export const trackWebSocketConnections = (count: number) => {
  metrics.setGauge("websocket_connections", count);
};
