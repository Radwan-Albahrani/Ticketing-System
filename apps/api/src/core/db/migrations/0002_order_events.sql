-- Transaction timestamps can tie; an identity gives audit events a stable causal order.
ALTER TABLE ticket_events ADD COLUMN sequence bigint GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX events_sequence_idx ON ticket_events(sequence);
DROP INDEX events_ticket_idx;
CREATE INDEX events_ticket_idx ON ticket_events(owner_id,ticket_id,sequence);
