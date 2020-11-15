CREATE TABLE IF NOT EXISTS poll_meta (
    uuid uuid PRIMARY KEY,
    ended timestamp,
    question text,
    free_response boolean
);

CREATE TABLE IF NOT EXISTS poll_responses (
    uuid uuid,
    idx int,
    response text,

    PRIMARY KEY (uuid, idx)
);

CREATE TABLE IF NOT EXISTS vote (
    uuid uuid,
    poll_uuid uuid,
    response_idx int,
    custom_response text,

    PRIMARY KEY (poll_uuid, uuid)
);