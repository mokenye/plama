-- Add assignees column to cards table (array of user IDs)
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS assignees INTEGER[] DEFAULT '{}';

-- Create index for faster queries on assignees
CREATE INDEX IF NOT EXISTS idx_cards_assignees ON cards USING GIN (assignees);