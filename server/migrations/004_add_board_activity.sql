-- Create board_activity table for activity log
CREATE TABLE IF NOT EXISTS board_activity (
  id SERIAL PRIMARY KEY,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  entity_name TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_board_activity_board_id ON board_activity(board_id);
CREATE INDEX IF NOT EXISTS idx_board_activity_created_at ON board_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_activity_user_id ON board_activity(user_id);