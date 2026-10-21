"use client"

import { Check, ChevronDown } from "lucide-react"
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

export interface SelectOption<Value extends string = string> {
  value: Value
  label: ReactNode
  disabled?: boolean
}

interface SelectInputProps<Value extends string> {
  id?: string
  name?: string
  options: readonly SelectOption<Value>[]
  value?: Value
  defaultValue?: Value
  onValueChange?: (value: Value) => void
  disabled?: boolean
  required?: boolean
  className?: string
  placeholder?: ReactNode
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
}

function SelectInput<Value extends string>({
  id,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  required = false,
  className,
  placeholder = "Select an option",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: SelectInputProps<Value>) {
  const generatedId = useId()
  const listboxId = `${id ?? generatedId}-listbox`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLDivElement | null>>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const [uncontrolledValue, setUncontrolledValue] = useState<Value | null>(
    defaultValue ?? null
  )
  const selectedValue = value === undefined ? uncontrolledValue : value
  const selectedLabel = options.find((option) => option.value === selectedValue)?.label

  function enabledIndex(start: number, direction: 1 | -1) {
    if (options.length === 0) return -1
    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (start + direction * offset + options.length) % options.length
      if (!options[index].disabled) return index
    }
    return -1
  }

  function selectedIndex() {
    const index = options.findIndex((option) => option.value === selectedValue && !option.disabled)
    return index >= 0 ? index : enabledIndex(0, 1)
  }

  function openSelect(index = selectedIndex()) {
    if (disabled || index < 0) return
    setActiveIndex(index)
    setOpen(true)
  }

  function closeSelect({ restoreFocus = false } = {}) {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  function selectValue(option: SelectOption<Value>) {
    if (option.disabled) return
    if (value === undefined) setUncontrolledValue(option.value)
    onValueChange?.(option.value)
    closeSelect({ restoreFocus: true })
  }

  function moveActive(direction: 1 | -1) {
    const nextIndex = enabledIndex(activeIndex + direction, direction)
    if (nextIndex >= 0) setActiveIndex(nextIndex)
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return
    event.preventDefault()
    const index = event.key === "ArrowUp"
      ? enabledIndex(options.length - 1, -1)
      : selectedIndex()
    openSelect(index)
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLDivElement>, index: number) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      moveActive(event.key === "ArrowDown" ? 1 : -1)
      return
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      const nextIndex = event.key === "Home"
        ? enabledIndex(0, 1)
        : enabledIndex(options.length - 1, -1)
      if (nextIndex >= 0) setActiveIndex(nextIndex)
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      selectValue(options[index])
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      closeSelect({ restoreFocus: true })
      return
    }
    if (event.key === "Tab") {
      closeSelect()
      return
    }
    if (event.key.length === 1) {
      const query = event.key.toLocaleLowerCase()
      const match = options.findIndex((option, optionIndex) =>
        optionIndex !== index &&
        !option.disabled &&
        typeof option.label === "string" &&
        option.label.toLocaleLowerCase().startsWith(query)
      )
      if (match >= 0) setActiveIndex(match)
    }
  }

  function updatePosition() {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const margin = 8
    const gap = 4
    const below = window.innerHeight - rect.bottom - gap - margin
    const above = rect.top - gap - margin
    const placeAbove = below < 160 && above > below
    const availableHeight = Math.max(96, Math.min(288, placeAbove ? above : below))
    const width = Math.min(Math.max(rect.width, 288), window.innerWidth - margin * 2)
    const left = Math.min(
      Math.max(rect.left, margin),
      Math.max(margin, window.innerWidth - width - margin)
    )

    setPosition({
      left,
      width,
      maxHeight: availableHeight,
      ...(placeAbove
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    })
  }

  useLayoutEffect(() => {
    if (open) updatePosition()
  }, [open])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        closeSelect()
      }
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") closeSelect({ restoreFocus: true })
    }

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  useEffect(() => {
    if (open && position) optionRefs.current[activeIndex]?.focus()
  }, [activeIndex, open, position])

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-required={required || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        data-popup-open={open ? "" : undefined}
        data-slot="select-trigger"
        onClick={() => (open ? closeSelect() : openSelect())}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "group flex h-11 w-full min-w-0 items-center gap-3 border border-input bg-background px-4 text-left text-[13px] leading-[1.2] text-foreground outline-none transition-[border-color,box-shadow,background-color]",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/15",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-secondary disabled:opacity-50",
          className
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selectedLabel && "text-muted-foreground")}>
          {selectedLabel ?? placeholder}
        </span>
        <span className="ml-auto mr-2 flex size-4 shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
          <ChevronDown className="size-4 transition-transform duration-150 group-data-[popup-open]:rotate-180" />
        </span>
      </button>

      {name ? (
        <input
          type="hidden"
          name={name}
          value={selectedValue ?? ""}
          disabled={disabled}
        />
      ) : null}

      {open && position
        ? createPortal(
            <div
              ref={popupRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy ?? (ariaLabel ? undefined : id)}
              data-slot="select-content"
              style={position}
              className="fixed z-50 overflow-y-auto border border-border bg-popover p-1 text-popover-foreground shadow-xl"
            >
              {options.map((option, index) => {
                const selected = option.value === selectedValue
                return (
                  <div
                    key={option.value}
                    ref={(node) => { optionRefs.current[index] = node }}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={option.disabled || undefined}
                    tabIndex={index === activeIndex ? 0 : -1}
                    data-highlighted={index === activeIndex ? "" : undefined}
                    data-selected={selected ? "" : undefined}
                    onMouseMove={() => { if (!option.disabled) setActiveIndex(index) }}
                    onClick={() => selectValue(option)}
                    onKeyDown={(event) => handleOptionKeyDown(event, index)}
                    className="relative flex min-h-9 cursor-default select-none items-center py-2 pl-9 pr-3 text-[13px] leading-snug outline-none data-[highlighted]:bg-secondary data-[selected]:font-medium aria-disabled:pointer-events-none aria-disabled:opacity-45"
                  >
                    {selected ? (
                      <span className="absolute left-3 flex size-4 items-center justify-center text-foreground" aria-hidden="true">
                        <Check className="size-4" />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">{option.label}</span>
                  </div>
                )
              })}
            </div>,
            document.body
          )
        : null}
    </>
  )
}

export { SelectInput }
