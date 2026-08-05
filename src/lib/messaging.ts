import { DEMO_IDENTITIES } from "@/lib/demo-config";
import type { UserRole } from "@/lib/types";

export const MESSAGING_STORAGE_KEY = "rebel-law-demo-conversations-v1";
export const MESSAGING_STORE_EVENT = "rebel-law-messages-changed";

export type MessagingPerson = {
  id: string;
  name: string;
  title: string;
  email: string;
  role: UserRole;
  kind: "staff" | "client";
};

export type ConversationMessage = {
  id: string;
  senderId: string;
  body: string;
  minutesAgo: number;
  readBy: string[];
};

export type Conversation = {
  id: string;
  participantIds: string[];
  subject: string;
  matterRef?: string;
  messages: ConversationMessage[];
};

export type ConversationStore = {
  version: 1;
  conversations: Conversation[];
};

export const MESSAGING_PEOPLE: MessagingPerson[] = DEMO_IDENTITIES.map((identity) => ({
  id: identity.profileId,
  name: identity.displayName,
  title: identity.title,
  email: identity.email,
  role: identity.role,
  kind: identity.role === "client" ? "client" : "staff",
}));

const personId = (role: UserRole) =>
  DEMO_IDENTITIES.find((identity) => identity.role === role)!.profileId;

export const PARTNER_ID = personId("managing_partner");
export const ATTORNEY_ID = personId("attorney");
export const PARALEGAL_ID = personId("paralegal");
export const BILLING_ID = personId("billing_staff");
export const CLIENT_ID = personId("client");

const message = (
  id: string,
  senderId: string,
  body: string,
  minutesAgo: number,
  readBy: string[]
): ConversationMessage => ({ id, senderId, body, minutesAgo, readBy });

export const INITIAL_CONVERSATION_STORE: ConversationStore = {
  version: 1,
  conversations: [
    {
      id: "conversation-partner-attorney",
      participantIds: [PARTNER_ID, ATTORNEY_ID],
      subject: "Northvale response strategy",
      matterRef: "MT-05001",
      messages: [
        message(
          "pa-1",
          PARTNER_ID,
          "Jordan, please send me your recommendation on the Northvale response before the client call.",
          190,
          [PARTNER_ID, ATTORNEY_ID]
        ),
        message(
          "pa-2",
          ATTORNEY_ID,
          "I will have the risk summary and proposed response ready by 2:00 PM.",
          145,
          [PARTNER_ID, ATTORNEY_ID]
        ),
        message(
          "pa-3",
          PARTNER_ID,
          "Thank you. Include the settlement range we discussed so I can approve it before the call.",
          42,
          [PARTNER_ID]
        ),
      ],
    },
    {
      id: "conversation-attorney-paralegal",
      participantIds: [ATTORNEY_ID, PARALEGAL_ID],
      subject: "Alvarez deposition preparation",
      matterRef: "MT-05002",
      messages: [
        message(
          "ap-1",
          ATTORNEY_ID,
          "Priya, can you confirm the medical-record exhibits are complete and in witness order?",
          310,
          [ATTORNEY_ID, PARALEGAL_ID]
        ),
        message(
          "ap-2",
          PARALEGAL_ID,
          "The records are complete. I am waiting on the court reporter's final exhibit labels.",
          255,
          [ATTORNEY_ID, PARALEGAL_ID]
        ),
        message(
          "ap-3",
          PARALEGAL_ID,
          "Labels just arrived. I will upload the final binder and send you the document link.",
          28,
          [PARALEGAL_ID]
        ),
      ],
    },
    {
      id: "conversation-attorney-client",
      participantIds: [ATTORNEY_ID, CLIENT_ID],
      subject: "Board questions on financing documents",
      matterRef: "MT-05001",
      messages: [
        message(
          "ac-1",
          CLIENT_ID,
          "Our board asked whether the investor consent language limits the next financing round.",
          420,
          [ATTORNEY_ID, CLIENT_ID]
        ),
        message(
          "ac-2",
          ATTORNEY_ID,
          "It does not prohibit another round, but two actions require majority investor consent. I will mark those sections.",
          360,
          [ATTORNEY_ID, CLIENT_ID]
        ),
        message(
          "ac-3",
          CLIENT_ID,
          "Please send the marked copy before tomorrow's board packet goes out.",
          64,
          [CLIENT_ID]
        ),
      ],
    },
    {
      id: "conversation-billing-client",
      participantIds: [BILLING_ID, CLIENT_ID],
      subject: "Invoice INV-010016 payment allocation",
      matterRef: "MT-05001",
      messages: [
        message(
          "bc-1",
          BILLING_ID,
          "Nora, we received the latest payment and need confirmation on which invoice you intended it to cover.",
          610,
          [BILLING_ID, CLIENT_ID]
        ),
        message(
          "bc-2",
          CLIENT_ID,
          "Please apply it to INV-010016. The remaining balance should be paid next week.",
          520,
          [BILLING_ID, CLIENT_ID]
        ),
        message(
          "bc-3",
          BILLING_ID,
          "Applied. The client portal now shows the updated balance.",
          95,
          [BILLING_ID]
        ),
      ],
    },
    {
      id: "conversation-partner-billing",
      participantIds: [PARTNER_ID, BILLING_ID],
      subject: "Write-off review packet",
      messages: [
        message(
          "pb-1",
          BILLING_ID,
          "The August write-off packet is ready. Two entries need your approval before billing closes.",
          780,
          [PARTNER_ID, BILLING_ID]
        ),
        message(
          "pb-2",
          PARTNER_ID,
          "I reviewed the Brook matter entry. Please add the timekeeper explanation to the other one.",
          700,
          [PARTNER_ID, BILLING_ID]
        ),
        message(
          "pb-3",
          BILLING_ID,
          "The explanation is attached and the packet is back in your approval inbox.",
          120,
          [BILLING_ID]
        ),
      ],
    },
    {
      id: "conversation-partner-paralegal",
      participantIds: [PARTNER_ID, PARALEGAL_ID],
      subject: "Case evaluation follow-up",
      matterRef: "CE-2026-4304",
      messages: [
        message(
          "pp-1",
          PARTNER_ID,
          "Priya, please confirm the intake documents are complete before I review this evaluation.",
          265,
          [PARTNER_ID, PARALEGAL_ID]
        ),
        message(
          "pp-2",
          PARALEGAL_ID,
          "Conflict search and consultation notes are complete. I am still waiting for the incident report.",
          210,
          [PARTNER_ID, PARALEGAL_ID]
        ),
        message(
          "pp-3",
          PARALEGAL_ID,
          "The client uploaded the incident report. The evaluation is ready for partner review.",
          18,
          [PARALEGAL_ID]
        ),
      ],
    },
    {
      id: "conversation-staff-docket",
      participantIds: [PARTNER_ID, ATTORNEY_ID, PARALEGAL_ID, BILLING_ID],
      subject: "Tomorrow's filing and billing calendar",
      messages: [
        message(
          "sd-1",
          PARALEGAL_ID,
          "Tomorrow's filing calendar is posted. Northvale is due at 4:00 PM.",
          330,
          [PARTNER_ID, ATTORNEY_ID, PARALEGAL_ID, BILLING_ID]
        ),
        message(
          "sd-2",
          ATTORNEY_ID,
          "I am on track for Northvale. Final attorney review starts at noon.",
          290,
          [PARTNER_ID, ATTORNEY_ID, PARALEGAL_ID, BILLING_ID]
        ),
        message(
          "sd-3",
          BILLING_ID,
          "Please submit related time entries before 5:30 PM so they make the billing cutoff.",
          75,
          [BILLING_ID]
        ),
      ],
    },
  ],
};

export const INITIAL_CONVERSATION_SNAPSHOT = JSON.stringify(INITIAL_CONVERSATION_STORE);

export function parseConversationStore(raw: string): ConversationStore {
  try {
    const parsed = JSON.parse(raw) as Partial<ConversationStore>;
    if (parsed.version !== 1 || !Array.isArray(parsed.conversations)) {
      return INITIAL_CONVERSATION_STORE;
    }
    return parsed as ConversationStore;
  } catch {
    return INITIAL_CONVERSATION_STORE;
  }
}

export function peopleAvailableTo(viewer: MessagingPerson): MessagingPerson[] {
  if (viewer.role === "client") {
    return MESSAGING_PEOPLE.filter(
      (person) => person.id === ATTORNEY_ID || person.id === BILLING_ID
    );
  }
  return MESSAGING_PEOPLE.filter((person) => person.id !== viewer.id);
}

export function personById(id: string, fallback?: MessagingPerson): MessagingPerson {
  return (
    MESSAGING_PEOPLE.find((person) => person.id === id) ??
    fallback ?? {
      id,
      name: "Unknown participant",
      title: "Contact",
      email: "",
      role: "client",
      kind: "client",
    }
  );
}
