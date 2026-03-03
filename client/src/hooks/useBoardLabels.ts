import { useMemo } from 'react'
import type { Card } from '../types'

// Default labels always available as a starting point
export const DEFAULT_LABELS = [
  'Bug',
  'Feature',
  'Urgent',
  'Low Priority',
  'Design',
  'Backend',
  'Frontend',
  'Testing',
]

/**
 * Derives the full set of unique labels from all cards on the board,
 * merged with the defaults. This means any custom label added to a card
 * automatically appears in filters and other cards' label lists.
 */
export function useBoardLabels(cards: Card[]) {
  const allLabels = useMemo(() => {
    const fromCards = cards.flatMap((c) => c.labels ?? [])
    const merged = new Set([...DEFAULT_LABELS, ...fromCards])
    return Array.from(merged).sort()
  }, [cards])

  return allLabels
}