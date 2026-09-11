/**
 * The "Install app" affordance.
 *
 * Chromium fires `beforeinstallprompt` when the PWA criteria are met and lets
 * the page defer it; Safari does not implement it at all, so on iOS the hook
 * reports `canInstall: false` for ever and the button never renders. That is
 * the correct outcome rather than a gap: iOS installs via Share → Add to Home
 * Screen, and a button that did nothing there would be worse than none.
 */

import { useEffect, useState } from 'react'

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null)

  useEffect(() => {
    function onPrompt(event) {
      // Chromium shows its own mini-infobar unless the event is cancelled;
      // holding it lets the prompt appear where it makes sense in the UI.
      event.preventDefault()
      setDeferred(event)
    }
    function onInstalled() {
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function promptInstall() {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    // The event is single-use whichever way the user answers; a second
    // prompt() on it throws.
    setDeferred(null)
  }

  return { canInstall: deferred !== null, promptInstall }
}
