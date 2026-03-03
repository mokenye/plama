import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface SearchFiltersProps {
  onSearchChange: (search: string) => void
  onFilterChange: (filters: FilterState) => void
  members: { id: number; name: string }[]
  currentFilters: FilterState
  boardLabels: string[]
}

export interface FilterState {
  labels: string[]
  assignees: number[]
  overdue: boolean
}


export default function SearchFilters({
  onSearchChange,
  onFilterChange,
  members,
  currentFilters,
  boardLabels,
}: SearchFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })

  // Anchor dropdown to Filters button, align right edges
  useEffect(() => {
    if (showFilters && filterButtonRef.current) {
      const rect = filterButtonRef.current.getBoundingClientRect()
      const MARGIN = 8
      const idealWidth = Math.min(480, window.innerWidth - MARGIN * 2)
      const idealLeft = rect.right + window.scrollX - idealWidth
      const left = Math.max(MARGIN, Math.min(idealLeft, window.innerWidth - idealWidth - MARGIN))
      setDropdownPos({
        top: rect.bottom + window.scrollY + 6,
        left,
        width: idealWidth,
      })
    }
  }, [showFilters])

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!showFilters) return
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') { e.stopPropagation(); setShowFilters(false) }
        return
      }
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        filterButtonRef.current && !filterButtonRef.current.contains(e.target as Node)
      ) {
        setShowFilters(false)
      }
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('keydown', handler as EventListener, true)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', handler as EventListener, true)
    }
  }, [showFilters])

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    onSearchChange(value)
  }

  const toggleLabel = (label: string) => {
    const newLabels = currentFilters.labels.includes(label)
      ? currentFilters.labels.filter(l => l !== label)
      : [...currentFilters.labels, label]
    onFilterChange({ ...currentFilters, labels: newLabels })
  }

  const toggleAssignee = (userId: number) => {
    const newAssignees = currentFilters.assignees.includes(userId)
      ? currentFilters.assignees.filter(id => id !== userId)
      : [...currentFilters.assignees, userId]
    onFilterChange({ ...currentFilters, assignees: newAssignees })
  }

  const toggleOverdue = () => {
    onFilterChange({ ...currentFilters, overdue: !currentFilters.overdue })
  }

  const clearFilters = () => {
    setSearchTerm('')
    onSearchChange('')
    onFilterChange({ labels: [], assignees: [], overdue: false })
    setShowFilters(false)
  }

  const activeFilterCount =
    currentFilters.labels.length +
    currentFilters.assignees.length +
    (currentFilters.overdue ? 1 : 0) +
    (searchTerm ? 1 : 0)

  const dropdown = showFilters ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 9999,
      }}
      className="bg-white/80 dark:bg-gray-800/75 backdrop-blur-md rounded-lg shadow-2xl border border-white/40 dark:border-gray-700/60 p-4"
    >
      <div className="space-y-4">
        {/* Labels Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
            Labels
          </label>
          <div className="flex flex-wrap gap-2">
            {boardLabels.map((label) => (
              <button
                key={label}
                onClick={() => toggleLabel(label)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  currentFilters.labels.includes(label)
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Assignees Filter */}
        {members.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
              Assigned to
            </label>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => toggleAssignee(member.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1 ${
                    currentFilters.assignees.includes(member.id)
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                  {member.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Overdue Filter */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={currentFilters.overdue}
              onChange={toggleOverdue}
              className="w-4 h-4 text-indigo-500 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Show only overdue cards
            </span>
          </label>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className="relative" data-search-filters>
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search cards..."
            className="w-full px-3 py-1.5 pl-8 bg-white/15 backdrop-blur border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white/40 text-sm"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 text-xs">
            
          </span>
          {searchTerm && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
            >
              ×
            </button>
          )}
        </div>

        {/* Filters Button */}
        <button
          ref={filterButtonRef}
          data-filter-toggle
          onClick={() => setShowFilters(!showFilters)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            activeFilterCount > 0
              ? 'bg-indigo-500 text-white'
              : 'bg-white/20 backdrop-blur text-white hover:bg-white/30'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-white/30 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition"
          >
            Clear
          </button>
        )}
      </div>

      {dropdown}
    </div>
  )
}