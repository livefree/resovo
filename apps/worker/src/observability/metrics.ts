import type pino from 'pino'

export type MetricName =
  | 'probe.completed'
  | 'probe.skipped_circuit'
  | 'probe.failed'
  | 'render.completed'
  | 'render.failed'
  | 'aggregate.updated'

export type MetricLabels = Record<string, string | number | boolean>

export function emitMetric(
  logger: pino.Logger,
  metric: MetricName,
  value: number,
  labels: MetricLabels = {},
): void {
  logger.info({ metric, value, ...labels }, `metric:${metric}`)
}
