const KEY = 'financert.theme'

/** Returns 'light' | 'dark' | 'system'. */
export function readTheme() {
  try {
    return localStorage.getItem(KEY) || 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme) {
  const root = document.documentElement
  // 'system' means stamping nothing, so prefers-color-scheme decides.
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* storage disabled -- the theme still applies for this session */
  }
}

export function nextTheme(current) {
  return current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system'
}

export const THEME_LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' }
