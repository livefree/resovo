import { createDoubanDetailsService } from '../core/details.service.js';
import type { DoubanGetByIdOptions } from '../core/details.types.js';
import { toSnakeCaseDetailsResponse } from './snake-case-details-response.js';
import {
  createHostRuntime,
  type HostRuntimeDeps,
} from '../adapters/host-runtime.js';

export function createSnakeCaseDetailsHandler(deps: HostRuntimeDeps) {
  const runtime = createHostRuntime(deps);
  const service = createDoubanDetailsService(runtime);

  return {
    async getById(subjectId: string, options?: DoubanGetByIdOptions) {
      const response = await service.getById(subjectId, options);
      return toSnakeCaseDetailsResponse(response);
    },
  };
}
