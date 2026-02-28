-- Add due_date and labels columns to cards table
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}';

-- Create comments table
CREATE TABLE IF NOT EXISTS card_comments (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_comments_card_id ON card_comments(card_id);
CREATE INDEX IF NOT EXISTS idx_card_comments_created_at ON card_comments(created_at DESC);