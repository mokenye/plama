const ADJECTIVES = [
  'Swift', 'Quiet', 'Bold', 'Clever', 'Lucky', 'Sunny', 'Brave', 'Calm',
  'Eager', 'Gentle', 'Jolly', 'Nimble', 'Witty', 'Breezy', 'Cosmic', 'Vivid',
];

const ANIMALS = [
  'Fox', 'Otter', 'Falcon', 'Panda', 'Wolf', 'Heron', 'Lynx', 'Sparrow',
  'Badger', 'Dolphin', 'Raven', 'Koala', 'Tiger', 'Seal', 'Hawk', 'Rabbit',
];

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

// Simple display name for a guest session e.g. "Swift Fox"
export const generateGuestName = (): string => `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
