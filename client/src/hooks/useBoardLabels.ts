import { useMemo } from 'react'
import type { Card } from '../types'

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
 * Derives all unique labels from board cards, merged with defaults.
 * Memoised on a stable string key so it only recomputes when labels
 * actually change — not on every card position/title update.
 */
export function useBoardLabels(cards: Card[]) {
  // Build a stable cache key from only the label data, not the full cards array
  const labelKey = useMemo(
    () =>
      cards
        .flatMap((c) => c.labels ?? [])
        .sort()
        .join('|'),
    [cards]
  )

  return useMemo(() => {
    const fromCards = cards.flatMap((c) => c.labels ?? [])
    return Array.from(new Set([...DEFAULT_LABELS, ...fromCards])).sort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelKey])
}