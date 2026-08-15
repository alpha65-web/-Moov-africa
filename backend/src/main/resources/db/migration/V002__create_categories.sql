CREATE TABLE categories (
    id          UUID PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    description VARCHAR(500),
    parent_id   UUID         REFERENCES categories(id),
    level       INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    UNIQUE (name, level)
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
