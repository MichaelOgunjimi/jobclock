import { describe, expect, it } from "vitest"
import {
  CV_A4_HEIGHT_MM,
  CV_A4_HEIGHT_PX,
  CV_A4_WIDTH_MM,
  CV_A4_WIDTH_PX,
  getCvA4PageBoundaries,
  isOverCvA4PageHeight,
} from "./cv-page-metrics"

describe("CV page metrics", () => {
  it("uses A4 paper dimensions", () => {
    expect(CV_A4_WIDTH_MM).toBe(210)
    expect(CV_A4_HEIGHT_MM).toBe(297)
    expect(CV_A4_WIDTH_PX).toBeCloseTo(793.7, 1)
    expect(CV_A4_HEIGHT_PX).toBeCloseTo(1122.5, 1)
  })

  it("detects content beyond one A4 page", () => {
    expect(isOverCvA4PageHeight(CV_A4_HEIGHT_PX)).toBe(false)
    expect(isOverCvA4PageHeight(CV_A4_HEIGHT_PX + 0.01)).toBe(true)
  })

  it("returns a boundary line for each page crossed", () => {
    expect(getCvA4PageBoundaries(CV_A4_HEIGHT_PX)).toEqual([])
    expect(getCvA4PageBoundaries(CV_A4_HEIGHT_PX + 1)).toEqual([
      { page: 1, topMm: 297, topPx: CV_A4_HEIGHT_PX },
    ])
    expect(getCvA4PageBoundaries(CV_A4_HEIGHT_PX * 2 + 1)).toEqual([
      { page: 1, topMm: 297, topPx: CV_A4_HEIGHT_PX },
      { page: 2, topMm: 594, topPx: CV_A4_HEIGHT_PX * 2 },
    ])
  })
})
