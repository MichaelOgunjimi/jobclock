import { describe, expect, it } from "vitest"
import {
  CV_A4_HEIGHT_MM,
  CV_A4_HEIGHT_PX,
  CV_A4_WIDTH_MM,
  CV_A4_WIDTH_PX,
  CV_PRINT_SAFE_BOTTOM_GUARD_MM,
  CV_PRINT_SAFE_HEIGHT_MM,
  CV_PRINT_SAFE_HEIGHT_PX,
  getCvPrintSafeBoundaryPositions,
  isOverCvPrintSafeHeight,
  mmToCssPx,
} from "./cv-page-metrics"

describe("CV page metrics", () => {
  it("uses A4 paper dimensions", () => {
    expect(CV_A4_WIDTH_MM).toBe(210)
    expect(CV_A4_HEIGHT_MM).toBe(297)
    expect(CV_A4_WIDTH_PX).toBeCloseTo(793.7, 1)
    expect(CV_A4_HEIGHT_PX).toBeCloseTo(1122.5, 1)
  })

  it("sets the print safe limit inside A4", () => {
    expect(CV_PRINT_SAFE_BOTTOM_GUARD_MM).toBe(4)
    expect(CV_PRINT_SAFE_HEIGHT_MM).toBe(293)
    expect(CV_PRINT_SAFE_HEIGHT_PX).toBeCloseTo(mmToCssPx(293), 4)
  })

  it("detects content beyond the print safe limit", () => {
    expect(isOverCvPrintSafeHeight(CV_PRINT_SAFE_HEIGHT_PX)).toBe(false)
    expect(isOverCvPrintSafeHeight(CV_PRINT_SAFE_HEIGHT_PX + 0.01)).toBe(true)
  })

  it("returns a boundary line for each page crossed", () => {
    expect(getCvPrintSafeBoundaryPositions(CV_PRINT_SAFE_HEIGHT_PX)).toEqual([])
    expect(getCvPrintSafeBoundaryPositions(CV_PRINT_SAFE_HEIGHT_PX + 1)).toHaveLength(1)
    expect(getCvPrintSafeBoundaryPositions(CV_PRINT_SAFE_HEIGHT_PX + CV_A4_HEIGHT_PX + 1)).toHaveLength(2)
  })
})
