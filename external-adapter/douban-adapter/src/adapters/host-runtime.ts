import type { CachePort, DoubanDetailsRuntime, LoggerPort } from '../ports/runtime.js';

export interface HostRuntimeDeps {
  fetch: typeof globalThis.fetch;
  getDoubanConfig: () => Promise<{
    cookies?: string | null;
    enablePuppeteer?: boolean;
  }>;
  fetchWithVerification: (
    url: string,
    init?: RequestInit,
  ) => Promise<Response>;
  bypassChallenge?: (
    url: string,
  ) => Promise<{
    html: string;
    cookies: unknown[];
  }>;
  cache?: CachePort;
  logger?: LoggerPort;
}

function createConsoleLogger(): LoggerPort {
  return {
    debug(message, meta) {
      console.debug(message, meta);
    },
    info(message, meta) {
      console.info(message, meta);
    },
    warn(message, meta) {
      console.warn(message, meta);
    },
    error(message, meta) {
      console.error(message, meta);
    },
  };
}

export function createHostRuntime(
  deps: HostRuntimeDeps,
): DoubanDetailsRuntime {
  return {
    fetch: deps.fetch.bind(globalThis),
    getDoubanConfig: deps.getDoubanConfig,
    fetchWithVerification: deps.fetchWithVerification,
    bypassChallenge: deps.bypassChallenge,
    cache: deps.cache,
    logger: deps.logger ?? createConsoleLogger(),
  };
}
