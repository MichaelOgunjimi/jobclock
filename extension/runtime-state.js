;(function registerRuntimeState(root) {
  const INTERRUPTED_MESSAGE =
    "The previous extraction was interrupted. Select Try again to restart it."

  function operationKey(tab) {
    return `${tab.id}::${tab.url}`
  }

  function matchesTabAndUrl(storedState, tab) {
    return Boolean(
      storedState &&
        storedState.tabId === tab.id &&
        storedState.tabUrl === tab.url
    )
  }

  function resolveStoredState({ storedState, tab, activeOperationKeys }) {
    if (!matchesTabAndUrl(storedState, tab)) {
      return { action: "start" }
    }

    if (
      storedState.view === "loading" &&
      !activeOperationKeys.includes(storedState.operationKey)
    ) {
      return {
        action: "replace",
        state: {
          ...storedState,
          view: "error",
          operation: null,
          message: INTERRUPTED_MESSAGE,
          updatedAt: Date.now(),
        },
      }
    }

    return { action: "restore", state: storedState }
  }

  root.JobClockRuntimeState = {
    INTERRUPTED_MESSAGE,
    operationKey,
    matchesTabAndUrl,
    resolveStoredState,
  }
})(globalThis)
