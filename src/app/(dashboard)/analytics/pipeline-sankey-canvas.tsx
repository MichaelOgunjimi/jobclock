"use client"

import { useEffect, useRef, useState, type PointerEvent, type SVGProps, type WheelEvent } from "react"
import { Move, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"
import { APPLICATION_STATUS_OPTIONS, type PipelineFlowLink, type PipelineMetrics } from "../applications/pipeline-metrics"

const formatter = new Intl.NumberFormat("en-GB")
const zoomFormatter = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 0 })
const MIN_ZOOM = 0.6
const MAX_ZOOM = 1.8
const ZOOM_STEP = 0.15
const SANKEY_VIEW_STORAGE_KEY = "jobclock:analytics:sankey-view"

type SankeyNodeKey = string

type SankeyNodeDetails = {
  x: number
  y: number
  width: number
  height: number
  label: string
  value: number
  accent: string
}

interface SankeyViewState {
  pan: { x: number; y: number }
  zoom: number
  nodeOffsets: Record<string, { x: number; y: number }>
}

type DragState =
  | {
      kind: "canvas"
      pointerId: number
      startX: number
      startY: number
      originX: number
      originY: number
    }
  | {
      kind: "node"
      key: SankeyNodeKey
      pointerId: number
      startX: number
      startY: number
      originX: number
      originY: number
    }

interface Props {
  metrics: PipelineMetrics
  links: PipelineFlowLink[]
  maxLinkCount: number
  focusedStatus: string | null
}

export function PipelineSankeyCanvas({ metrics, links, maxLinkCount, focusedStatus }: Props) {
  const [hasHydratedView, setHasHydratedView] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { x: number; y: number }>>({})
  const dragRef = useRef<DragState | null>(null)
  const nodeMap = applyNodeOffsets(buildSankeyNodeMap(metrics), nodeOffsets)
  const strokeFor = (value: number) => {
    if (value <= 0) return 1.5

    const weightedShare = Math.sqrt(value / Math.max(maxLinkCount, 1))
    return Math.min(16, 3 + weightedShare * 13)
  }
  const isHome = pan.x === 0 && pan.y === 0 && zoom === 1 && Object.keys(nodeOffsets).length === 0

  useEffect(() => {
    const restoreId = window.setTimeout(() => {
      const storedView = readStoredSankeyView()
      setPan(storedView.pan)
      setZoom(storedView.zoom)
      setNodeOffsets(storedView.nodeOffsets)
      setHasHydratedView(true)
    }, 0)

    return () => window.clearTimeout(restoreId)
  }, [])

  useEffect(() => {
    if (!hasHydratedView) return

    writeStoredSankeyView({ pan, zoom, nodeOffsets })
  }, [hasHydratedView, pan, zoom, nodeOffsets])

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    dragRef.current = {
      kind: "canvas",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag || drag.kind !== "canvas" || drag.pointerId !== event.pointerId) return

    setPan({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    })
  }

  function stopDrag(event: PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
  }

  function handleNodePointerDown(key: SankeyNodeKey, event: PointerEvent<SVGGElement>) {
    const offset = nodeOffsets[key] ?? { x: 0, y: 0 }
    dragRef.current = {
      kind: "node",
      key,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    }
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handleNodePointerMove(event: PointerEvent<SVGGElement>) {
    const drag = dragRef.current
    if (!drag || drag.kind !== "node" || drag.pointerId !== event.pointerId) return

    setNodeOffsets((current) => ({
      ...current,
      [drag.key]: {
        x: drag.originX + (event.clientX - drag.startX) / zoom,
        y: drag.originY + (event.clientY - drag.startY) / zoom,
      },
    }))
    event.stopPropagation()
  }

  function stopNodeDrag(event: PointerEvent<SVGGElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return

    dragRef.current = null
    event.stopPropagation()
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  function resetView() {
    setPan({ x: 0, y: 0 })
    setZoom(1)
    setNodeOffsets({})
  }

  function changeZoom(delta: number) {
    setZoom((current) => clampZoom(current + delta))
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    if (!event.ctrlKey && !event.metaKey) return

    event.preventDefault()
    changeZoom(event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)
  }

  return (
    <div className="relative overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/20 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Move className="h-3.5 w-3.5" />
            Drag canvas or stages
          </div>
          {!isHome && (
            <div className="border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
              Custom layout saved
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center border border-border bg-background">
            <button
              type="button"
              onClick={() => changeZoom(-ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Zoom out Sankey view"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span
              data-testid="sankey-zoom-level"
              className="min-w-14 border-x border-border px-2 text-center text-[11px] font-semibold tabular-nums text-muted-foreground"
            >
              {zoomFormatter.format(zoom)}
            </span>
            <button
              type="button"
              onClick={() => changeZoom(ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
              className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Zoom in Sankey view"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={resetView}
            disabled={isHome}
            className="inline-flex h-8 items-center gap-2 border border-border bg-background px-3 text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Reset Sankey view"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      <div className="overflow-hidden px-4 py-6">
        <svg
          data-testid="sankey-canvas"
          role="img"
          aria-label="Draggable Sankey diagram showing application status transitions"
          viewBox="0 0 980 380"
          className="min-h-[320px] min-w-full touch-none cursor-grab text-foreground active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onPointerLeave={stopDrag}
          onWheel={handleWheel}
        >
          <defs>
            {APPLICATION_STATUS_OPTIONS.map((option) => (
              <marker
                key={option.value}
                data-testid={`sankey-arrow-marker-${option.value}`}
                id={`sankey-arrow-${option.value}`}
                markerWidth="9"
                markerHeight="9"
                refX="8"
                refY="4.5"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 1 1 L 8 4.5 L 1 8 z" fill={option.sankeyColor} />
              </marker>
            ))}
          </defs>
          <rect x="0" y="0" width="980" height="380" fill="transparent" />
          <g data-testid="sankey-viewport" transform={`translate(${pan.x} ${pan.y})`}>
            <g data-testid="sankey-zoom-layer" transform={`scale(${zoom})`}>
              {links.map((link) => {
                const from = nodeMap[link.from]
                const to = nodeMap[link.to]
                if (!from || !to) return null
                const isMuted = focusedStatus !== null && focusedStatus !== link.from && focusedStatus !== link.to
                return (
                  <g key={`${link.from}-${link.to}`}>
                    <SankeyPath
                      data-testid={`sankey-link-${link.from}-${link.to}`}
                      d={buildLinkPath(from, to)}
                      color={to.accent}
                      markerId={`sankey-arrow-${link.to}`}
                      title={`${formatter.format(link.count)} applications moved from ${from.label} to ${to.label}.`}
                      width={strokeFor(link.count)}
                      muted={isMuted}
                    />
                  </g>
                )
              })}

              {Object.entries(nodeMap).map(([key, node]) => (
                <SankeyNode
                  key={key}
                  nodeKey={key}
                  x={node.x}
                  y={node.y}
                  label={node.label}
                  value={node.value}
                  accent={node.accent}
                  compact={key !== "start"}
                  onPointerDown={handleNodePointerDown}
                  onPointerMove={handleNodePointerMove}
                  onPointerUp={stopNodeDrag}
                />
              ))}
            </g>
          </g>
        </svg>
        {links.length === 0 && (
          <p className="px-2 pb-2 text-sm text-muted-foreground">
            No recorded transitions yet. New status changes will appear here as stage-to-stage paths.
          </p>
        )}
      </div>
    </div>
  )
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))))
}

function readStoredSankeyView(): SankeyViewState {
  const fallback = getDefaultSankeyView()
  if (typeof window === "undefined") return fallback

  try {
    const raw = window.localStorage.getItem(SANKEY_VIEW_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<SankeyViewState>

    return {
      pan: isPoint(parsed.pan) ? parsed.pan : fallback.pan,
      zoom: typeof parsed.zoom === "number" ? clampZoom(parsed.zoom) : fallback.zoom,
      nodeOffsets: isNodeOffsetMap(parsed.nodeOffsets) ? parsed.nodeOffsets : fallback.nodeOffsets,
    }
  } catch {
    return fallback
  }
}

function writeStoredSankeyView(view: SankeyViewState) {
  if (typeof window === "undefined") return

  if (isDefaultSankeyView(view)) {
    window.localStorage.removeItem(SANKEY_VIEW_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(SANKEY_VIEW_STORAGE_KEY, JSON.stringify(view))
}

function getDefaultSankeyView(): SankeyViewState {
  return { pan: { x: 0, y: 0 }, zoom: 1, nodeOffsets: {} }
}

function isDefaultSankeyView(view: SankeyViewState) {
  return view.pan.x === 0 && view.pan.y === 0 && view.zoom === 1 && Object.keys(view.nodeOffsets).length === 0
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { x?: unknown }).x === "number" &&
    typeof (value as { y?: unknown }).y === "number"
  )
}

function isNodeOffsetMap(value: unknown): value is Record<string, { x: number; y: number }> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false

  return Object.values(value).every(isPoint)
}

function SankeyPath({
  d,
  color,
  width,
  markerId,
  title,
  muted = false,
  ...pathProps
}: {
  d: string
  color: string
  width: number
  markerId: string
  title: string
  muted?: boolean
} & SVGProps<SVGPathElement>) {
  return (
    <path
      {...pathProps}
      d={d}
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeWidth={width}
      markerEnd={`url(#${markerId})`}
      opacity={muted ? 0.16 : 0.42}
    >
      <title>{title}</title>
    </path>
  )
}

function SankeyNode({
  nodeKey,
  x,
  y,
  label,
  value,
  accent,
  compact = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  nodeKey: SankeyNodeKey
  x: number
  y: number
  label: string
  value: number
  accent: string
  compact?: boolean
  onPointerDown: (key: SankeyNodeKey, event: PointerEvent<SVGGElement>) => void
  onPointerMove: (event: PointerEvent<SVGGElement>) => void
  onPointerUp: (event: PointerEvent<SVGGElement>) => void
}) {
  const width = compact ? 168 : 190
  const height = compact ? 30 : 62

  return (
    <g
      data-testid={`sankey-node-${nodeKey}`}
      transform={`translate(${x} ${y})`}
      className="cursor-move"
      onPointerDown={(event) => onPointerDown(nodeKey, event)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="0"
        fill="var(--card)"
        stroke="var(--border)"
      />
      <rect x="0" y="0" width="4" height={height} fill={accent} />
      <text x="18" y={compact ? 20 : 24} fill="currentColor" fontSize={compact ? "12" : "13"} fontWeight="700">
        {label}
      </text>
      <text x={width - 18} y={compact ? 20 : 43} fill="currentColor" fontSize={compact ? "13" : "24"} fontWeight="500" textAnchor="end">
        {formatter.format(value)}
      </text>
    </g>
  )
}

function buildLinkPath(from: SankeyNodeDetails, to: SankeyNodeDetails) {
  const startX = from.x + from.width
  const startY = from.y + from.height / 2
  const endX = to.x
  const endY = to.y + to.height / 2

  if (endX <= startX) {
    const loopX = Math.max(startX, endX) + 120
    return `M ${startX} ${startY} C ${loopX} ${startY}, ${loopX} ${endY}, ${endX} ${endY}`
  }

  return `M ${startX} ${startY} C ${startX + 96} ${startY}, ${endX - 96} ${endY}, ${endX} ${endY}`
}

function applyNodeOffsets(
  map: Record<string, SankeyNodeDetails>,
  offsets: Record<string, { x: number; y: number }>
) {
  return Object.fromEntries(
    Object.entries(map).map(([key, node]) => {
      const offset = offsets[key]
      if (!offset) return [key, node]
      return [key, { ...node, x: node.x + offset.x, y: node.y + offset.y }]
    })
  ) as Record<string, SankeyNodeDetails>
}

function buildSankeyNodeMap(metrics: PipelineMetrics) {
  const map: Record<string, SankeyNodeDetails> = {}

  const positions: Record<string, { x: number; y: number }> = {
    saved: { x: 44, y: 154 },
    applied: { x: 264, y: 154 },
    screening: { x: 484, y: 154 },
    interview: { x: 704, y: 154 },
    offer: { x: 724, y: 64 },
    rejected: { x: 724, y: 244 },
    withdrawn: { x: 724, y: 292 },
    ghosted: { x: 724, y: 340 },
  }

  for (const option of APPLICATION_STATUS_OPTIONS) {
    const position = positions[option.value]
    if (!position) continue
    map[option.value] = {
      x: position.x,
      y: position.y,
      width: 168,
      height: 30,
      label: option.label,
      value: metrics.statusCounts[option.value],
      accent: option.sankeyColor,
    }
  }

  return map
}
