import { config } from '../config'
import type { CircuitState } from '../types'

type SiteCircuit = {
  failures: { ts: number }[]
  cooldownUntil: number | null
}

const circuits = new Map<string, SiteCircuit>()

function getCircuit(siteId: string): SiteCircuit {
  let circuit = circuits.get(siteId)
  if (!circuit) {
    circuit = { failures: [], cooldownUntil: null }
    circuits.set(siteId, circuit)
  }
  return circuit
}

function pruneWindow(circuit: SiteCircuit, now: number): void {
  const cutoff = now - config.circuitBreaker.windowMs
  circuit.failures = circuit.failures.filter((f) => f.ts > cutoff)
}

export function shouldSkipSite(siteId: string, now = Date.now()): boolean {
  const circuit = getCircuit(siteId)

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

export function recordFailure(siteId: string, now = Date.now()): void {
  const circuit = getCircuit(siteId)
  pruneWindow(circuit, now)
  circuit.failures.push({ ts: now })
  if (circuit.failures.length >= config.circuitBreaker.failureThreshold) {
    circuit.cooldownUntil = now + config.circuitBreaker.cooldownMs
  }
}

export function recordSuccess(siteId: string): void {
  const circuit = getCircuit(siteId)
  circuit.failures = []
  circuit.cooldownUntil = null
}

export function getCircuitState(siteId: string, now = Date.now()): CircuitState {
  const circuit = circuits.get(siteId)
  if (!circuit) return 'cleared'
  if (circuit.cooldownUntil !== null && now < circuit.cooldownUntil) return 'active'
  pruneWindow(circuit, now)
  return circuit.failures.length >= config.circuitBreaker.failureThreshold ? 'active' : 'cleared'
}

export function resetAll(): void {
  circuits.clear()
}
