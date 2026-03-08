import ChatWidget from '../components/chat/ChatWidget'

export default function ChatPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10" style={{ height: 'calc(100dvh - 180px)', minHeight: '420px' }}>
      <ChatWidget inline className="h-full" />
    </div>
  )
}
