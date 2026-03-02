import { useMemo, useState } from 'react'
import type { Card } from '../types'

export interface FilterState {
  labels: string[]
  assignees: number[]
  overdue: boolean
}

export function useCardFilters(cards: Card[]) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<FilterState>({
    labels: [],
    assignees: [],
    overdue: false,
  })

  const filteredCards = useMemo(() => {
    let result = [...cards]

    // Search filter (title + description)
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      result = result.filter(
        (card) =>
          card.title.toLowerCase().includes(search) ||
          card.description?.toLowerCase().includes(search)
      )
    }

    // Labels filter
    if (filters.labels.length > 0) {
      result = result.filter((card) =>
        filters.labels.some((label) => card.labels?.includes(label))
      )
    }

    // Assignees filter
    if (filters.assignees.length > 0) {
      result = result.filter((card) =>
        filters.assignees.some((userId) => card.assignees?.includes(userId))
      )
    }

    // Overdue filter
    if (filters.overdue) {
      const now = new Date()
      result = result.filter((card) => {
        if (!card.dueDate) return false
        return new Date(card.dueDate) < now
      })
    }

    return result
  }, [cards, searchTerm, filters])

  return {
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    filteredCards,
    hasActiveFilters: searchTerm !== '' || 
      filters.labels.length > 0 || 
      filters.assignees.length > 0 || 
      filters.overdue,
  }
}