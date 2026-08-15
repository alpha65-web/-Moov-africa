CREATE TABLE notifications (
    id               UUID PRIMARY KEY,
    recipient_id     UUID        NOT NULL REFERENCES users(id),
    type             VARCHAR(40) NOT NULL,
    title            VARCHAR(255) NOT NULL,
    message          TEXT,
    read             BOOLEAN     NOT NULL DEFAULT false,
    related_offer_id UUID        REFERENCES offers(id),
    created_at       TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_unread    ON notifications(recipient_id, read) WHERE read = false;

CREATE TABLE notification_configs (
    id            UUID PRIMARY KEY,
    type          VARCHAR(40)  NOT NULL,
    channel       VARCHAR(30)  NOT NULL DEFAULT 'IN_APP',
    enabled       BOOLEAN      NOT NULL DEFAULT true,
    updated_by_id UUID         REFERENCES users(id),
    updated_at    TIMESTAMP    NOT NULL DEFAULT now(),
    UNIQUE (type, channel)
);
