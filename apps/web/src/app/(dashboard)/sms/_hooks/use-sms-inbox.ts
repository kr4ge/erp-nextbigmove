'use client';

import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import {
  fetchSmsConversationMessages,
  fetchSmsConversations,
  markSmsConversationRead,
  sendSmsMessage,
} from '../_services/sms-api';
import type { SmsConversation } from '../_types/sms';
import { parseSmsError } from '../_utils/sms-errors';

const EMPTY_CONVERSATIONS: SmsConversation[] = [];

export function useSmsInbox(enabled: boolean) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const conversationsQuery = useQuery({
    queryKey: ['sms-conversations', deferredSearch],
    queryFn: () => fetchSmsConversations(deferredSearch),
    enabled,
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const conversations = conversationsQuery.data ?? EMPTY_CONVERSATIONS;
  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId,
  ) ?? null;

  const messagesQuery = useQuery({
    queryKey: ['sms-conversation-messages', selectedConversationId],
    queryFn: () => fetchSmsConversationMessages(selectedConversationId!),
    enabled: enabled && Boolean(selectedConversationId),
    staleTime: 3_000,
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  });

  const markReadMutation = useMutation({
    mutationFn: markSmsConversationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: sendSmsMessage,
    onSuccess: () => {
      addToast('success', 'Reply queued for delivery.');
      void queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
      void queryClient.invalidateQueries({
        queryKey: ['sms-conversation-messages', selectedConversationId],
      });
      void queryClient.invalidateQueries({ queryKey: ['sms-overview'] });
    },
    onError: (error: unknown) => {
      addToast('error', parseSmsError(error, 'Unable to send the reply.'));
    },
  });

  const selectConversation = (conversation: SmsConversation) => {
    setSelectedConversationId(conversation.id);
    if (conversation.hasUnread && !markReadMutation.isPending) {
      markReadMutation.mutate(conversation.id);
    }
  };

  const clearSelection = () => {
    setSelectedConversationId(null);
  };

  const sendReply = async (body: string) => {
    if (!selectedConversation) return;
    await replyMutation.mutateAsync({
      simId: selectedConversation.sim.id,
      recipientPhone: selectedConversation.customerPhoneNormalized,
      body: body.trim(),
    });
  };

  return {
    search,
    setSearch,
    conversations,
    selectedConversation,
    selectedConversationId,
    conversationsQuery,
    messagesQuery,
    replyLoading: replyMutation.isPending,
    selectConversation,
    clearSelection,
    sendReply,
  };
}
