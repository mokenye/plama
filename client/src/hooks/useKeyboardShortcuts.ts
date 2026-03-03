import { useEffect, useCallback } from 'react'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  handler: () => void
  description: string
}

// Minimal shape needed for display — matches both ShortcutConfig and ShortcutItem
interface ShortcutDisplay {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], enabled = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // Ignore if user is typing in an input/textarea,
      // UNLESS it's a modifier shortcut (Ctrl/Meta) or Escape — those should always fire
      const target = event.target as HTMLElement
      const isInInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      const isModifierCombo = event.ctrlKey || event.metaKey || event.altKey
      const isEscape = event.key === 'Escape'

      if (isInInput && !isModifierCombo && !isEscape) {
        return
      }

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase()
        // Only enforce modifiers that are explicitly required.
        // Don't block keys that naturally require Shift (e.g. '?' is Shift+/)
        const ctrlMatches = shortcut.ctrl ? event.ctrlKey || event.metaKey : true
        const shiftMatches = shortcut.shift ? event.shiftKey : true
        const altMatches = shortcut.alt ? event.altKey : true
        const metaMatches = shortcut.meta ? event.metaKey : true

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
          event.preventDefault()
          shortcut.handler()
          break
        }
      }
    },
    [shortcuts, enabled]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown, enabled])
}

// Helper to format shortcut display — accepts any object with key + optional modifiers
export function formatShortcut(shortcut: ShortcutDisplay): string {
  const keys: string[] = []

  if (shortcut.ctrl) keys.push('Ctrl')
  if (shortcut.shift) keys.push('Shift')
  if (shortcut.alt) keys.push('Alt')
  if (shortcut.meta) keys.push('⌘')

  keys.push(shortcut.key.toUpperCase())

  return keys.join(' + ')
}