import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface SearchFiltersProps {
  onSearchChange: (search: string) => void
  onFilterChange: (filters: FilterState) => void
  members: { id: number; name: string }[]
  currentFilters: FilterState
}

export interface FilterState {
  labels: string[]
  assignees: number[]
  overdue: boolean
}

const PRESET_LABELS = [
  'Bug',
  'Feature',
  'Urgent',
  'Low Priority',
  'Design',
  'Backend',
  'Frontend',
  'Testing',
]

export default function SearchFilters({
  onSearchChange,
  onFilterChange,
  members,
  currentFilters,
}: SearchFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })

  // Recalculate dropdown position whenever it opens
  useEffect(() => {
    if (showFilters && filterButtonRef.current) {
      const rect = filterButtonRef.current.closest('[data-search-filters]')?.getBoundingClientRect()
        ?? filterButtonRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 480),
      })
    }
  }, [showFilters])

  // Close dropdown on outside click
  useEffect(() => {
    if (!showFilters) return
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        filterButtonRef.current && !filterButtonRef.current.contains(e.target as Node)
      ) {
        setShowFilters(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
      className="bg-white/85 dark:bg-gray-800/75 backdrop-blur-md rounded-lg shadow-2xl border border-white/40 dark:border-gray-700/60 p-4"
    >
      <div className="space-y-4">
        {/* Labels Filter */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            🏷️ Labels
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_LABELS.map((label) => (
              <button
                key={label}
                onClick={() => toggleLabel(label)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  currentFilters.labels.includes(label)
                    ? 'bg-brand-500 text-white'
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
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              👥 Assigned To
            </label>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => toggleAssignee(member.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1 ${
                    currentFilters.assignees.includes(member.id)
                      ? 'bg-brand-500 text-white'
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
              className="w-4 h-4 text-brand-500 border-gray-300 rounded focus:ring-brand-500"
            />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              ⚠️ Show only overdue cards
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
            className="w-full px-4 py-2 pl-10 bg-white/20 backdrop-blur border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
            🔍
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
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            activeFilterCount > 0
              ? 'bg-brand-500 text-white'
              : 'bg-white/20 backdrop-blur text-white hover:bg-white/30'
          }`}
        >
          <span>🔧</span>
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
            className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition"
          >
            Clear
          </button>
        )}
      </div>

      {dropdown}
    </div>
  )
}