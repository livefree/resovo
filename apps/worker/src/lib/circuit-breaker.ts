import { config } from '../config'
import type { CircuitState } from '../types'

/**
 * hostname 维度熔断器——双存储分工的内存热路径侧（SRCHEALTH-P3-3-B1，方案 Q4）。
 * 本模块保持纯逻辑：不 import pg，不落库；recordFailure/recordSuccess 返回
 * CircuitTransition 翻转信号，由 job 层（level1/level2）拿信号 UPSERT host_health
 * （仅翻转事件级写库，逐次调用不写——arch-reviewer 裁决 B）。
 * worker 重启不回灌内存：PG 行 cooldown_until 靠 NOW() 比较自然过期，评分侧不受重启影响。
 */

/** 熔断翻转信号：tripped=本次跨阈值进入冷却 / recovered=从有冷却记录恢复 / null=无翻转（不落库） */
export type CircuitTransition = 'tripped' | 'recovered' | null

type SiteCircuit = {
  failures: { ts: number }[]
  cooldownUntil: number | null
}

const circuits = new Map<string, SiteCircuit>()

function getCircuit(hostname: string): SiteCircuit {
  let circuit = circuits.get(hostname)
  if (!circuit) {
    circuit = { failures: [], cooldownUntil: null }
    circuits.set(hostname, circuit)
  }
  return circuit
}

function pruneWindow(circuit: SiteCircuit, now: number): void {
  const cutoff = now - config.circuitBreaker.windowMs
  circuit.failures = circuit.failures.filter((f) => f.ts > cutoff)
}

function isActive(circuit: SiteCircuit, now: number): boolean {
  return circuit.cooldownUntil !== null && now < circuit.cooldownUntil
}

export function shouldSkipSite(hostname: string, now = Date.now()): boolean {
  const circuit = getCircuit(hostname)

  if (circuit.cooldownUntil !== null) {
    if (now >= circuit.cooldownUntil) {
      circuit.cooldownUntil = null
      circuit.failures = []
      return false
    }
    pruneWindow(circuit, now)
    if (circuit.failures.length === 0) {
      circuit.cooldownUntil = null
      return false
    }
    return true
  }

  pruneWindow(circuit, now)
  return circuit.failures.length >= config.circuitBreaker.failureThreshold
}

export function recordFailure(hostname: string, now = Date.now()): CircuitTransition {
  const circuit = getCircuit(hostname)
  // 过期 cooldown 先清（防调用路径未经 shouldSkipSite 时，新一轮失败被误判为"已在冷却中"）
  if (circuit.cooldownUntil !== null && now >= circuit.cooldownUntil) {
    circuit.cooldownUntil = null
    circuit.failures = []
  }
  const beforeActive = isActive(circuit, now)
  pruneWindow(circuit, now)
  circuit.failures.push({ ts: now })
  if (circuit.failures.length >= config.circuitBreaker.failureThreshold) {
    circuit.cooldownUntil = now + config.circuitBreaker.cooldownMs
  }
  return !beforeActive && isActive(circuit, now) ? 'tripped' : null
}

export function recordSuccess(hostname: string): CircuitTransition {
  const circuit = getCircuit(hostname)
  // 'recovered' 含 cooldown 已过期但行未清的情况：PG 侧 cooldown_until 同为旧值，
  // 清 NULL + 刷 last_success_at 有观测价值；从未熔断的主机恒返回 null 不产生写放大
  const hadCooldown = circuit.cooldownUntil !== null
  circuit.failures = []
  circuit.cooldownUntil = null
  return hadCooldown ? 'recovered' : null
}

export function getCircuitState(hostname: string, now = Date.now()): CircuitState {
  const circuit = circuits.get(hostname)
  if (!circuit) return 'cleared'
  if (circuit.cooldownUntil !== null && now < circuit.cooldownUntil) return 'active'
  pruneWindow(circuit, now)
  return circuit.failures.length >= config.circuitBreaker.failureThreshold ? 'active' : 'cleared'
}

export function resetAll(): void {
  circuits.clear()
}
