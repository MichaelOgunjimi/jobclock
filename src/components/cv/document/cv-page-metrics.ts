export const CV_A4_WIDTH_MM = 210
export const CV_A4_HEIGHT_MM = 297
export const CV_PRINT_SAFE_BOTTOM_GUARD_MM = 4
export const CSS_PX_PER_INCH = 96
export const MM_PER_INCH = 25.4

export const CV_A4_WIDTH_STYLE = `${CV_A4_WIDTH_MM}mm`
export const CV_A4_MIN_HEIGHT_STYLE = `${CV_A4_HEIGHT_MM}mm`

export function mmToCssPx(mm: number): number {
  return (mm / MM_PER_INCH) * CSS_PX_PER_INCH
}

export const CV_A4_WIDTH_PX = mmToCssPx(CV_A4_WIDTH_MM)
export const CV_A4_HEIGHT_PX = mmToCssPx(CV_A4_HEIGHT_MM)
export const CV_PRINT_SAFE_HEIGHT_MM = CV_A4_HEIGHT_MM - CV_PRINT_SAFE_BOTTOM_GUARD_MM
export const CV_PRINT_SAFE_HEIGHT_PX = mmToCssPx(CV_PRINT_SAFE_HEIGHT_MM)

export function isOverCvPrintSafeHeight(heightPx: number): boolean {
  return heightPx > CV_PRINT_SAFE_HEIGHT_PX
}

export function getCvPrintSafeBoundaryPositions(heightPx: number): number[] {
  const boundaries: number[] = []

  for (
    let boundary = CV_PRINT_SAFE_HEIGHT_PX;
    heightPx > boundary;
    boundary += CV_A4_HEIGHT_PX
  ) {
    boundaries.push(boundary)
  }

  return boundaries
}
