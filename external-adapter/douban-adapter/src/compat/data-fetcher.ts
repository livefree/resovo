import { createDoubanDetailsService } from '../core/details.service.js';
import type { DoubanSubjectDetails } from '../core/details.types.js';
import {
  createHostRuntime,
  type HostRuntimeDeps,
} from '../adapters/host-runtime.js';

export function createDetailsDataFetcher(deps: HostRuntimeDeps) {
  const runtime = createHostRuntime(deps);
  const service = createDoubanDetailsService(runtime);

  return {
    async getDataById(subjectId: string): Promise<DoubanSubjectDetails | null> {
      const response = await service.getById(subjectId);
      if (response.code === 200 && response.data) {
        return response.data;
      }
      return null;
    },
  };
}
