'use client';

import { type FormEvent, type RefObject, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  Inbox,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  User,
  WifiOff,
} from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/button';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { useSmsInbox } from '../_hooks/use-sms-inbox';
import type { SmsConversation, SmsMessage } from '../_types/sms';
import { formatSmsDateTime } from '../_utils/sms-formatters';
import { parseSmsError } from '../_utils/sms-errors';

type SmsInboxProps = {
  enabled: boolean;
  canSendMessages: boolean;
};

export function SmsInbox({ enabled, canSendMessages }: SmsInboxProps) {
  const controller = useSmsInbox(enabled);
  const [reply, setReply] = useState('');
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const messages = controller.messagesQuery.data ?? [];
  const unreadCount = controller.conversations.filter(
    (conversation) => conversation.hasUnread,
  ).length;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [controller.selectedConversationId, messages.length]);

  useEffect(() => {
    setReply('');
  }, [controller.selectedConversationId]);

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = reply.trim();
    if (!body || controller.replyLoading) return;
    try {
      await controller.sendReply(body);
      setReply('');
    } catch {
      // The mutation displays the API error and keeps the draft available.
    }
  };

  if (controller.conversationsQuery.isLoading) {
    return <LoadingCard label="Loading SMS inbox..." />;
  }

  if (controller.conversationsQuery.isError) {
    return (
      <AlertBanner
        tone="error"
        message={parseSmsError(
          controller.conversationsQuery.error,
          'SMS inbox could not be loaded.',
        )}
      />
    );
  }

  return (
    <section className="panel panel-content overflow-hidden">
      <div className="panel-header flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Inbox className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="panel-title">SMS inbox</h2>
            <p className="truncate text-xs text-muted">
              {controller.conversations.length} conversations
              {unreadCount > 0 ? ` · ${unreadCount} unread` : ' · All caught up'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Refresh inbox"
          loading={controller.conversationsQuery.isFetching}
          iconLeft={<RefreshCw className="h-4 w-4" />}
          onClick={() => void controller.conversationsQuery.refetch()}
        >
          Refresh
        </Button>
      </div>

      <div className="grid min-h-[620px] border-t border-border lg:grid-cols-[320px_minmax(0,1fr)]">
        <ConversationList
          conversations={controller.conversations}
          search={controller.search}
          selectedConversationId={controller.selectedConversationId}
          hiddenOnMobile={Boolean(controller.selectedConversation)}
          onSearchChange={controller.setSearch}
          onSelect={controller.selectConversation}
        />

        <div
          className={clsx(
            'min-w-0 flex-col bg-surface',
            controller.selectedConversation ? 'flex' : 'hidden lg:flex',
          )}
        >
          {!controller.selectedConversation ? (
            <NoConversationSelected />
          ) : (
            <>
              <ConversationHeader
                conversation={controller.selectedConversation}
                onBack={controller.clearSelection}
              />

              <MessageThread
                loading={controller.messagesQuery.isLoading}
                error={controller.messagesQuery.isError}
                messages={messages}
                threadEndRef={threadEndRef}
              />

              <ReplyComposer
                canSendMessages={canSendMessages}
                conversation={controller.selectedConversation}
                reply={reply}
                sending={controller.replyLoading}
                onReplyChange={setReply}
                onSubmit={submitReply}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ConversationList({
  conversations,
  search,
  selectedConversationId,
  hiddenOnMobile,
  onSearchChange,
  onSelect,
}: {
  conversations: SmsConversation[];
  search: string;
  selectedConversationId: string | null;
  hiddenOnMobile: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (conversation: SmsConversation) => void;
}) {
  return (
    <aside
      className={clsx(
        'min-w-0 flex-col border-border bg-surface lg:border-r',
        hiddenOnMobile ? 'hidden lg:flex' : 'flex',
      )}
    >
      <div className="border-b border-border p-3">
        <label className="relative block">
          <span className="sr-only">Search conversations</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            className="input w-full pl-10"
            placeholder="Search conversations"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>

      <div className="max-h-[560px] flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex h-full min-h-80 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background-secondary text-muted">
              <Inbox className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              {search ? 'No matches found' : 'No conversations yet'}
            </h3>
            <p className="mt-1 max-w-56 text-xs leading-5 text-muted">
              {search
                ? 'Try a customer name, phone number, or message.'
                : 'Sent messages and customer replies will appear here.'}
            </p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              selected={conversation.id === selectedConversationId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function ConversationListItem({
  conversation,
  selected,
  onSelect,
}: {
  conversation: SmsConversation;
  selected: boolean;
  onSelect: (conversation: SmsConversation) => void;
}) {
  const displayName = conversation.customerName || conversation.customerPhone;
  const source = conversation.store?.shopName
    || conversation.sim.alias
    || conversation.sim.carrier
    || 'SMS gateway';

  return (
    <button
      type="button"
      className={clsx(
        'group relative flex w-full items-start gap-3 border-b border-border px-4 py-3.5 text-left transition-colors',
        selected ? 'bg-primary-soft' : 'hover:bg-background-secondary',
      )}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(conversation)}
    >
      {selected ? <span className="absolute inset-y-0 left-0 w-1 bg-primary" /> : null}
      <ConversationAvatar
        label={displayName}
        emphasized={conversation.hasUnread || selected}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={clsx(
              'min-w-0 flex-1 truncate text-sm text-foreground',
              conversation.hasUnread ? 'font-bold' : 'font-semibold',
            )}
          >
            {displayName}
          </p>
          <span className="shrink-0 text-xs-tight text-muted">
            {conversation.lastMessageAt
              ? formatShortInboxTime(conversation.lastMessageAt)
              : ''}
          </span>
        </div>
        <p
          className={clsx(
            'mt-1 truncate text-xs',
            conversation.hasUnread ? 'font-medium text-foreground' : 'text-muted',
          )}
        >
          {conversation.lastMessagePreview || 'No message preview'}
        </p>
        <div className="mt-2 flex min-w-0 items-center gap-2 text-xs-tight text-muted">
          <span className="truncate">{source}</span>
          {conversation.customerName ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">{conversation.customerPhone}</span>
            </>
          ) : null}
          {conversation.hasUnread ? (
            <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
          ) : null}
        </div>
      </div>
    </button>
  );
}

function ConversationHeader({
  conversation,
  onBack,
}: {
  conversation: SmsConversation;
  onBack: () => void;
}) {
  const displayName = conversation.customerName || conversation.customerPhone;
  const simLabel = conversation.sim.alias
    || conversation.sim.carrier
    || 'Connected SIM';
  const active = conversation.sim.status === 'ACTIVE';

  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-3.5 sm:px-5">
      <button
        type="button"
        className="btn btn-ghost btn-sm lg:hidden"
        aria-label="Back to conversations"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <ConversationAvatar label={displayName} emphasized />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold text-foreground">{displayName}</h2>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted">
          <span className="truncate">{conversation.customerPhone}</span>
          {conversation.store?.shopName ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{conversation.store.shopName}</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <span className={active ? 'pill pill-success' : 'pill pill-warning'}>
          {active ? <Smartphone className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}
          {active ? 'SIM online' : 'SIM offline'}
        </span>
        <p className="mt-1.5 max-w-40 truncate text-xs-tight text-muted">{simLabel}</p>
      </div>
    </header>
  );
}

function MessageThread({
  loading,
  error,
  messages,
  threadEndRef,
}: {
  loading: boolean;
  error: boolean;
  messages: SmsMessage[];
  threadEndRef: RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-background-secondary/40 px-4 py-5 sm:px-6">
      {loading ? (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading messages...
        </div>
      ) : error ? (
        <AlertBanner tone="error" message="This message history could not be loaded." />
      ) : messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-muted shadow-sm">
            <MessageSquare className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">No messages yet</p>
          <p className="mt-1 text-xs text-muted">Write the first message below.</p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-3">
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const timestamp = getSmsTimestamp(message);
            const showDate = !previous
              || !isSameSmsDay(getSmsTimestamp(previous), timestamp);

            return (
              <div key={message.id}>
                {showDate ? <SmsDateSeparator value={timestamp} /> : null}
                <SmsMessageBubble message={message} />
              </div>
            );
          })}
          <div ref={threadEndRef} />
        </div>
      )}
    </div>
  );
}

function ReplyComposer({
  canSendMessages,
  conversation,
  reply,
  sending,
  onReplyChange,
  onSubmit,
}: {
  canSendMessages: boolean;
  conversation: SmsConversation;
  reply: string;
  sending: boolean;
  onReplyChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!canSendMessages) {
    return (
      <div className="border-t border-border bg-surface px-5 py-4 text-sm text-muted">
        You have read-only inbox access.
      </div>
    );
  }

  if (conversation.sim.status !== 'ACTIVE') {
    return (
      <div className="border-t border-border bg-surface p-4">
        <AlertBanner
          tone="warning"
          message="This SIM is offline. Verify the connected device before replying."
        />
      </div>
    );
  }

  return (
    <form className="border-t border-border bg-surface p-3 sm:p-4" onSubmit={onSubmit}>
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-background-secondary/30 p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
        <textarea
          className="min-h-20 w-full resize-none border-0 bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted"
          maxLength={160}
          placeholder={`Message ${conversation.customerName || conversation.customerPhone}`}
          value={reply}
          onChange={(event) => onReplyChange(event.target.value)}
        />
        <div className="flex items-center justify-between gap-3 border-t border-border px-2 pt-2">
          <div className="min-w-0 text-xs-tight text-muted">
            <span>{reply.length}/160</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="truncate">
              via {conversation.sim.alias || conversation.sim.carrier || 'connected SIM'}
            </span>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!reply.trim()}
            loading={sending}
            iconLeft={<Send className="h-4 w-4" />}
          >
            Send message
          </Button>
        </div>
      </div>
    </form>
  );
}

function NoConversationSelected() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <MessageSquare className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-foreground">Your SMS conversations</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-muted">
          Select a customer to review the full message history and continue the conversation.
        </p>
      </div>
    </div>
  );
}

function ConversationAvatar({
  label,
  emphasized = false,
}: {
  label: string;
  emphasized?: boolean;
}) {
  const initials = getInitials(label);

  return (
    <div
      className={clsx(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        emphasized
          ? 'bg-primary text-white'
          : 'bg-background-secondary text-muted group-hover:text-foreground',
      )}
      aria-hidden="true"
    >
      {initials || <User className="h-4 w-4" />}
    </div>
  );
}

function SmsMessageBubble({ message }: { message: SmsMessage }) {
  const outbound = message.direction === 'OUTBOUND';
  const timestamp = getSmsTimestamp(message);
  const status = getSmsStatusPresentation(message);
  const StatusIcon = status.icon;

  return (
    <div className={clsx('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[85%] sm:max-w-[72%]', outbound ? 'text-right' : 'text-left')}>
        <div
          className={clsx(
            'inline-block rounded-2xl px-4 py-2.5 text-left shadow-sm',
            outbound
              ? 'rounded-br-md bg-primary text-white'
              : 'rounded-bl-md border border-border bg-surface text-foreground',
          )}
        >
          <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body}</p>
        </div>
        <div
          className={clsx(
            'mt-1 flex items-center gap-1.5 text-xs-tight text-muted',
            outbound ? 'justify-end' : 'justify-start',
          )}
          title={formatSmsDateTime(timestamp)}
        >
          <span>{formatSmsTime(timestamp)}</span>
          <span aria-hidden="true">·</span>
          <span className={clsx('inline-flex items-center gap-1', status.tone)}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        </div>
        {message.errorMessage ? (
          <p className="mt-1 max-w-md text-xs text-destructive">{message.errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}

function SmsDateSeparator({ value }: { value: string }) {
  return (
    <div className="my-5 flex items-center gap-3" aria-label={formatSmsDay(value)}>
      <span className="h-px flex-1 bg-border" />
      <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs-tight font-medium text-muted">
        {formatSmsDay(value)}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function getSmsStatusPresentation(message: SmsMessage) {
  if (message.direction === 'INBOUND') {
    return { label: 'Received', icon: Check, tone: 'text-muted' };
  }

  switch (message.status) {
    case 'DELIVERED':
      return { label: 'Delivered', icon: CheckCheck, tone: 'text-success' };
    case 'SENT':
      return { label: 'Sent · awaiting delivery', icon: Check, tone: 'text-muted' };
    case 'FAILED':
      return { label: 'Failed', icon: AlertCircle, tone: 'text-destructive' };
    default:
      return {
        label: message.status.replaceAll('_', ' ').toLowerCase(),
        icon: Clock3,
        tone: 'text-muted',
      };
  }
}

function getSmsTimestamp(message: SmsMessage) {
  return message.receivedAt
    || message.deliveredAt
    || message.sentAt
    || message.createdAt;
}

function getInitials(value: string) {
  const normalized = value.trim();
  if (!normalized || /^\+?[\d\s()-]+$/.test(normalized)) return '';

  return normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function isSameSmsDay(left: string, right: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Manila',
  });
  return formatter.format(new Date(left)) === formatter.format(new Date(right));
}

function formatSmsDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameSmsDay(value, today.toISOString())) return 'Today';
  if (isSameSmsDay(value, yesterday.toISOString())) return 'Yesterday';

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(date);
}

function formatSmsTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}

function formatShortInboxTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = isSameSmsDay(value, now.toISOString());

  return new Intl.DateTimeFormat('en-PH', sameDay
    ? { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }
    : { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }).format(date);
}
