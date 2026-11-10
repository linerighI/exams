import { tr } from './translations';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, MessageCircle, Send } from 'lucide-react';
import type { State } from './types';
import type { Mutate } from './Staff';
import { Empty, initials } from './ui';
export function Inbox({ data, mutate, busy }: { data: State; mutate: Mutate; busy: boolean }) {
  const [contact, setContact] = useState('');
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const selected = data.contacts.find((c) => c.id === contact);
  const messages = data.messages.filter(
    (m) => m.sender_id === contact || m.recipient_id === contact,
  );
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, contact]);
  return (
    <>
      <div className="page-intro" data-reveal>
        <div className="eyebrow">{tr('GOOD DAYS START WITH A HELLO')}</div>
        <h1>
          {selected ? tr('A little catch-up') : tr('Conversations')}
          <span className="greeting-dot">.</span>
        </h1>
        <p>{tr('School and home, a little closer.')}</p>
      </div>
      {selected ? (
        <>
          <div className="chat-header">
            <button
              className="icon-button"
              aria-label={tr('Back to conversations')}
              onClick={() => setContact('')}
            >
              <ArrowLeft size={19} />
            </button>
            <span className="avatar peach">{initials(selected.name)}</span>
            <div>
              <strong>{selected.name}</strong>
              <small>
                {tr(selected.role)} · {data.school.name}
              </small>
            </div>
          </div>
          <div className="chat-messages">
            {messages.length ? (
              messages.map((m) => (
                <article
                  key={m.id}
                  className={`chat-bubble ${m.sender_id === data.user.id ? 'outgoing' : ''}`}
                >
                  <p>{m.content}</p>
                  <small>{m.created.slice(0, 16)}</small>
                </article>
              ))
            ) : (
              <Empty
                title={tr('Say a little hello')}
                detail={tr('Start a conversation with your school.')}
              />
            )}
            <div ref={end} />
          </div>
          <form
            className="chat-compose"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  '/messages',
                  { recipientId: contact, content: text },
                  tr('Message sent'),
                )
              )
                setText('');
            }}
          >
            <textarea
              rows={2}
              aria-label={tr('Your message')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              maxLength={4000}
              placeholder={tr('Write a little hello…')}
            />
            <button
              className="icon-button primary"
              aria-label={tr('Send message')}
              disabled={busy || !text.trim()}
            >
              <Send size={20} />
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="inbox-banner mint" data-reveal>
            <MessageCircle size={28} />
            <div>
              <h3>{tr('Always a conversation away.')}</h3>
              <p>{tr('Ask a question. Share a moment. Stay connected.')}</p>
            </div>
          </div>
          {data.contacts.map((c, i) => {
            const recent = data.messages
              .filter((m) => m.sender_id === c.id || m.recipient_id === c.id)
              .at(-1);
            return (
              <button
                key={c.id}
                className="contact-row"
                onClick={() => setContact(c.id)}
                data-reveal
              >
                <span className={`avatar ${['peach', 'lilac', 'mint', 'blue'][i % 4]}`}>
                  {initials(c.name)}
                </span>
                <span className="row-copy">
                  <strong>{c.name}</strong>
                  <small>{recent?.content || `${tr(c.role)} · ${tr('Say a little hello')}`}</small>
                </span>
                <ArrowUpRight size={19} />
              </button>
            );
          })}
          {!data.contacts.length && (
            <Empty
              title={tr('No contacts yet')}
              detail={tr('Your authorized school contacts will appear here.')}
            />
          )}
        </>
      )}
    </>
  );
}
