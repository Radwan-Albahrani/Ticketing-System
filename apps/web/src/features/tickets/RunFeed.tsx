import { useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Radio } from 'lucide-react';
export function RunFeed({ id }: { id: string }) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/tickets/${encodeURIComponent(id)}/activity` }),
    [id],
  );
  const { messages, sendMessage, stop, error } = useChat({ transport, id: `activity-${id}` });
  useEffect(() => {
    void sendMessage({ text: 'Follow the current classification run.' });
    return () => {
      void stop();
    };
  }, [sendMessage, stop]);
  const text = messages
    .filter((message) => message.role === 'assistant')
    .flatMap((message) => message.parts)
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
  const lines = text.trim().split('\n');
  return (
    <div className="live-feed">
      <Radio size={15} />
      <div>
        <span>LIVE RUN FEED</span>
        <p aria-live="polite">
          {error
            ? 'Live feed disconnected. Saved history continues to update below.'
            : lines.at(-1) || 'Connecting to the classification run…'}
        </p>
      </div>
    </div>
  );
}
