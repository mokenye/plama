import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: number;
  email: string;
  name: string;
  isGuest?: boolean;
}

export const signToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
};

// --------------------------------
// Shareable board invite links
// Lets anyone with the link (including a guest session) join a board
// without needing to know a member's email up front.
// --------------------------------
interface InviteTokenPayload {
  boardId: number;
  purpose: 'board-invite';
}

export const signInviteToken = (boardId: number): string => {
  return jwt.sign({ boardId, purpose: 'board-invite' } as InviteTokenPayload, process.env.JWT_SECRET!, {
    expiresIn: '7d',
  } as jwt.SignOptions);
};

export const verifyInviteToken = (token: string): InviteTokenPayload => {
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as InviteTokenPayload;
  if (payload.purpose !== 'board-invite') {
    throw new Error('Invalid invite token');
  }
  return payload;
};