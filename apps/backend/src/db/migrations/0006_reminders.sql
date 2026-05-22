-- 0006 — Per-customer follow-up reminders. In-dashboard only (no push/email).
-- Each reminder is a due date + optional note, attached to a contact, and can
-- be marked done.

CREATE TABLE IF NOT EXISTS reminders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  due_at       TIMESTAMPTZ NOT NULL,
  note         TEXT,
  done         BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reminders_due_idx ON reminders(due_at) WHERE done = FALSE;
CREATE INDEX IF NOT EXISTS reminders_contact_idx ON reminders(contact_id);
