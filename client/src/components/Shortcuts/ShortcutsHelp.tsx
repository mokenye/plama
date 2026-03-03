import { formatShortcut } from '../../hooks/useKeyboardShortcuts'

interface ShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutItem {
  key: string
  ctrl?: boolean
  shift?: boolean
  description: string
  category: string
}

const shortcuts: ShortcutItem[] = [
  // Navigation
  { key: '/', description: 'Focus search', category: 'Navigation' },
  { key: 'Escape', description: 'Close modal/dropdown', category: 'Navigation' },
  { key: 'h', shift: true, description: 'Go to dashboard', category: 'Navigation' },

  // Actions
  { key: 'n', description: 'New card (on board)', category: 'Actions' },
  { key: 'l', description: 'New list (on board)', category: 'Actions' },
  { key: 'a', description: 'Open activity log', category: 'Actions' },
  { key: 'f', description: 'Toggle filters', category: 'Actions' },
  { key: 's', description: 'Open board settings', category: 'Actions' },

  // Global
  { key: '?', description: 'Show shortcuts help', category: 'Global' },
  { key: 'd', description: 'Toggle dark mode', category: 'Global' },
]

export default function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  if (!isOpen) return null

  const categories = Array.from(new Set(shortcuts.map(s => s.category)))

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts
                    .filter((s) => s.category === category)
                    .map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {shortcut.description}
                        </span>
                        <kbd className="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-700 dark:text-gray-300 shadow-sm">
                          {formatShortcut(shortcut)}
                        </kbd>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pro Tip */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Tip:</strong> Press <kbd className="px-2 py-0.5 bg-white dark:bg-gray-700 rounded text-xs font-mono">?</kbd> anytime to see this help
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}