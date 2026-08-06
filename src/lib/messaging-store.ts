/**
 * Browser-side helpers for the demo messaging store.
 *
 * Conversations live in localStorage so every view in the same browser (the
 * Messages page, the header indicator, notifications) reads one shared
 * inbox and updates when any of them writes.
 */
import {
  INITIAL_CONVERSATION_SNAPSHOT,
  MESSAGING_PEOPLE,
  MESSAGING_STORAGE_KEY,
  MESSAGING_STORE_EVENT,
  parseConversationStore,
  personById,
  type Conversation,
  type ConversationStore,
  type MessagingPerson,
} from "@/lib/messaging";

export function subscribeToMessages(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(MESSAGING_STORE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(MESSAGING_STORE_EVENT, onStoreChange);
  };
}

export function getMessageSnapshot() {
  try {
    return localStorage.getItem(MESSAGING_STORAGE_KEY) ?? INITIAL_CONVERSATION_SNAPSHOT;
  } catch {
    return INITIAL_CONVERSATION_SNAPSHOT;
  }
}

export function getServerMessageSnapshot() {
  return INITIAL_CONVERSATION_SNAPSHOT;
}

export function saveStore(store: ConversationStore) {
  try {
    localStorage.setItem(MESSAGING_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Keep the page usable if browser storage is unavailable.
  }
  window.dispatchEvent(new Event(MESSAGING_STORE_EVENT));
}

export function clearStore() {
  try {
    localStorage.removeItem(MESSAGING_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
  window.dispatchEvent(new Event(MESSAGING_STORE_EVENT));
}

export function readStore(raw: string): ConversationStore {
  return parseConversationStore(raw);
}

export function lastMessage(conversation: Conversation) {
  return conversation.messages[conversation.messages.length - 1];
}

export function isUnread(conversation: Conversation, viewerId: string) {
  return conversation.messages.some(
    (message) => message.senderId !== viewerId && !message.readBy.includes(viewerId)
  );
}

export function otherParticipants(conversation: Conversation, viewer: MessagingPerson) {
  return conversation.participantIds
    .filter((id) => id !== viewer.id)
    .map((id) => personById(id));
}

export function conversationLabel(conversation: Conversation, viewer: MessagingPerson) {
  const others = otherParticipants(conversation, viewer);
  if (others.length === 0) return "Personal notes";
  if (others.length <= 2) return others.map((person) => person.name).join(", ");
  return `${others[0].name}, ${others[1].name} +${others.length - 2}`;
}

/** "You" for the viewer's own messages, otherwise the sender's name. */
export function personLabel(personId: string, viewer: MessagingPerson) {
  return personId === viewer.id ? "You" : personById(personId, viewer).name;
}

export function conversationKind(conversation: Conversation, viewer: MessagingPerson) {
  if (viewer.role === "client") return "Legal team";
  return otherParticipants(conversation, viewer).some((person) => person.kind === "client")
    ? "Client"
    : "Internal";
}

/** Conversations the viewer participates in, newest activity first. */
export function conversationsFor(store: ConversationStore, viewerId: string) {
  return store.conversations
    .filter((conversation) => conversation.participantIds.includes(viewerId))
    .sort((a, b) => lastMessage(a).minutesAgo - lastMessage(b).minutesAgo);
}

export function unreadConversationsFor(store: ConversationStore, viewerId: string) {
  return conversationsFor(store, viewerId).filter((conversation) =>
    isUnread(conversation, viewerId)
  );
}

/**
 * Resolve the signed-in profile to a demo messaging person.
 * Demo Mode switches identity client-side; outside Demo Mode the seeded profile
 * IDs can differ per environment, so email is the stable fallback.
 */
export function resolveMessagingViewer(
  fallback: MessagingPerson,
  demoProfileId?: string | null
): MessagingPerson {
  if (demoProfileId) {
    return MESSAGING_PEOPLE.find((person) => person.id === demoProfileId) ?? fallback;
  }
  return (
    MESSAGING_PEOPLE.find(
      (person) => person.email.toLowerCase() === fallback.email.toLowerCase()
    ) ?? fallback
  );
}
