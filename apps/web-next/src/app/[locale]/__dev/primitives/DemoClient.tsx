'use client'

import { useState } from 'react'
import { PageTransitionController } from '@/components/primitives/page-transition/PageTransitionController'
import { SharedElement } from '@/components/primitives/shared-element'
import { useRouteStack } from '@/components/primitives/route-stack'

export function DemoClient() {
  const [key, setKey] = useState('a')
  const [disableVT, setDisableVT] = useState(false)
  const [simulateReduced, setSimulateReduced] = useState(false)
  const { state } = useRouteStack()

  function toggleKey() {
    setKey((k) => (k === 'a' ? 'b' : 'a'))
    if (simulateReduced) {
      document.documentElement.classList.add('vt-reduced')
      setTimeout(() => document.documentElement.classList.remove('vt-reduced'), 120)
    }
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-10 flex flex-col gap-10">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--fg-default)' }}>
        Primitives 演示页（仅 dev）
      </h1>

      {/* PageTransition 演示 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--fg-default)' }}>
          PageTransition
        </h2>
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
          本节演示 CSS View Transitions API 三态降级。点击【切换 key】触发过渡。
        </p>
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={toggleKey}
            className="px-4 py-2 rounded-md text-sm border"
            style={{ borderColor: 'var(--border-default)', color: 'var(--fg-default)' }}
          >
            切换 key（当前: {key}）

          </button>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg-muted)' }}>
            <input type="checkbox" checked={disableVT} onChange={(e) => setDisableVT(e.target.checked)} />
            禁用动画（disabled prop）
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg-muted)' }}>
            <input
              type="checkbox"
              checked={simulateReduced}
              onChange={(e) => setSimulateReduced(e.target.checked)}
            />
            模拟 prefers-reduced-motion
          </label>
        </div>
        <PageTransitionController transitionKey={key} disabled={disableVT}>
          <div
            className="rounded-lg p-6 text-center font-bold text-xl"
            style={{
              background: key === 'a' ? 'var(--accent-default)' : 'var(--bg-surface)',
              color: 'var(--fg-default)',
              transition: 'background var(--transition-page) var(--ease-page)',
            }}
          >
            内容区域 — key: {key}
          </div>
        </PageTransitionController>
      </section>

      {/* SharedElement 演示 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--fg-default)' }}>
          SharedElement（stub）
        </h2>
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
          当前为 noop — 渲染 div 并打 data-shared-element-id attr。FLIP 动画将在 REG-M3-01 实装。
        </p>
        <SharedElement id="demo:hero:cover" role="cover" className="inline-block">
          <div
            className="w-32 h-48 rounded-lg flex items-center justify-center text-xs font-mono"
            style={{ background: 'var(--bg-surface)', color: 'var(--fg-muted)', border: '1px solid var(--border-default)' }}
          >
            demo:hero:cover
          </div>
        </SharedElement>
      </section>

      {/* RouteStack 演示 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--fg-default)' }}>
          RouteStack（stub）
        </h2>
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
          当前为 noop — 手势逻辑将在 M5 Tab Bar 上线时实装。
        </p>
        <pre
          className="text-xs rounded-md p-4"
          style={{ background: 'var(--bg-surface)', color: 'var(--fg-muted)' }}
        >
          {JSON.stringify(state, null, 2)}
        </pre>
      </section>
    </div>
  )
}
