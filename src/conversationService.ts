import type { ConversationStatus, MessageAuthor, Prisma } from '@prisma/client';
import type { Db } from './db';
import { ConflictError, NotFoundError } from './errors';
import { notify } from './notifications';

export interface OpenConversationInput {
  customerId: string;
  subject: string;
  firstMessage: string;
}

export interface PostMessageInput {
  conversationId: string;
  author: MessageAuthor;
  body: string;
  staffId?: string;
}

// The set of status transitions the shop allows. Everything else is rejected.
const ALLOWED_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  OPEN: ['WAITING_ON_CUSTOMER', 'RESOLVED', 'ARCHIVED'],
  WAITING_ON_CUSTOMER: ['OPEN', 'RESOLVED', 'ARCHIVED'],
  RESOLVED: ['OPEN', 'ARCHIVED'],
  ARCHIVED: [],
};

export class ConversationService {
  constructor(private readonly db: Db) {}

  async openConversation(input: OpenConversationInput) {
    const customer = await this.db.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) throw new NotFoundError('Customer');

    const conversation = await this.db.conversation.create({
      data: {
        subject: input.subject.trim(),
        customerId: input.customerId,
        status: 'OPEN',
        messages: {
          create: {
            author: 'CUSTOMER',
            body: input.firstMessage.trim(),
          },
        },
      },
      include: { messages: true },
    });

    notify(
      'support@fernandfrond.example',
      `New question: ${conversation.subject}`,
      `${customer.name} opened a conversation.`,
    );

    return conversation;
  }

  async postMessage(input: PostMessageInput) {
    const conversation = await this.db.conversation.findUnique({
      where: { id: input.conversationId },
      include: { customer: true },
    });
    if (!conversation) throw new NotFoundError('Conversation');
    if (conversation.status === 'ARCHIVED') {
      throw new ConflictError('Cannot post to an archived conversation');
    }

    if (input.author === 'STAFF' && !input.staffId) {
      throw new ConflictError('Staff messages require a staffId');
    }

    const message = await this.db.message.create({
      data: {
        conversationId: input.conversationId,
        author: input.author,
        body: input.body.trim(),
        staffId: input.author === 'STAFF' ? input.staffId : null,
      },
    });

    // Reflect the reply direction in the conversation status.
    let nextStatus: ConversationStatus | undefined;
    if (input.author === 'STAFF') nextStatus = 'WAITING_ON_CUSTOMER';
    if (input.author === 'CUSTOMER' && conversation.status === 'WAITING_ON_CUSTOMER') {
      nextStatus = 'OPEN';
    }

    if (nextStatus) {
      await this.db.conversation.update({
        where: { id: input.conversationId },
        data: { status: nextStatus },
      });
    }

    if (input.author === 'STAFF') {
      notify(
        conversation.customer.email,
        `Re: ${conversation.subject}`,
        'A member of our team replied to your question.',
      );
    }

    return message;
  }

  async assign(conversationId: string, staffId: string) {
    const staff = await this.db.staffMember.findUnique({ where: { id: staffId } });
    if (!staff || !staff.active) throw new NotFoundError('Active staff member');

    const conversation = await this.db.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundError('Conversation');

    return this.db.conversation.update({
      where: { id: conversationId },
      data: { assigneeId: staffId },
    });
  }

  async transition(conversationId: string, to: ConversationStatus) {
    const conversation = await this.db.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundError('Conversation');

    const allowed = ALLOWED_TRANSITIONS[conversation.status];
    if (!allowed.includes(to)) {
      throw new ConflictError(
        `Cannot move conversation from ${conversation.status} to ${to}`,
      );
    }

    return this.db.conversation.update({
      where: { id: conversationId },
      data: { status: to },
    });
  }

  async list(filter: { status?: ConversationStatus; assigneeId?: string } = {}) {
    const where: Prisma.ConversationWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.assigneeId) where.assigneeId = filter.assigneeId;

    return this.db.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { customer: true, assignee: true },
    });
  }

  async thread(conversationId: string) {
    const conversation = await this.db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: true,
        assignee: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) throw new NotFoundError('Conversation');
    return conversation;
  }
}

export { ALLOWED_TRANSITIONS };
