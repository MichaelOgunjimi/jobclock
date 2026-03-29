"use client"

import { RefObject, useEffect } from "react"

type UseDismissibleLayerOptions = {
  enabled: boolean
  onDismiss: () => void
  refs: Array<RefObject<HTMLElement | null>>
}

export function useDismissibleLayer({
  enabled,
  onDismiss,
  refs,
}: UseDismissibleLayerOptions) {
  useEffect(() => {
    if (!enabled) return

    function isInsideLayer(target: EventTarget | null) {
      return refs.some((ref) => {
        const node = ref.current
        return node instanceof HTMLElement && target instanceof Node && node.contains(target)
      })
    }

    function handlePointerDown(event: PointerEvent) {
      if (!isInsideLayer(event.target)) {
        onDismiss()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onDismiss()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [enabled, onDismiss, refs])
}
