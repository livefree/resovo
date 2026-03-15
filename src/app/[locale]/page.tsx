import { Header } from '@/components/layout/Header'

export default function HomePage() {
  return (
    <>
      <Header />
      <main
        className="flex items-center justify-center min-h-[calc(100vh-73px)]"
        style={{ background: 'var(--background)' }}
      >
        <p
          className="text-lg"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Welcome to Resovo
        </p>
      </main>
    </>
  )
}
