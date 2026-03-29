export default function FlashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-indigo-50">
      {children}
    </div>
  )
}