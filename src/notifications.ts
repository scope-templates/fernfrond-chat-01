// Small local notification stub. In production this would push to an SMTP relay
// running alongside the app; for now it records outgoing notices so staff
// tooling and tests can assert on them.

export interface Notice {
  to: string;
  subject: string;
  body: string;
  sentAt: Date;
}

const outbox: Notice[] = [];

export function notify(to: string, subject: string, body: string): Notice {
  const notice: Notice = { to, subject, body, sentAt: new Date() };
  outbox.push(notice);
  if (process.env.NOTIFY_LOG === '1') {
    // eslint-disable-next-line no-console
    console.log(`[notify] -> ${to}: ${subject}`);
  }
  return notice;
}

export function drainOutbox(): Notice[] {
  const copy = outbox.slice();
  outbox.length = 0;
  return copy;
}

export function peekOutbox(): readonly Notice[] {
  return outbox;
}
