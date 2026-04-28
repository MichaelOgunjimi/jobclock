export const CV_A4_WIDTH_MM = 210
export const CV_A4_HEIGHT_MM = 297
export const CSS_PX_PER_INCH = 96
export const MM_PER_INCH = 25.4

export const CV_A4_WIDTH_STYLE = `${CV_A4_WIDTH_MM}mm`
export const CV_A4_MIN_HEIGHT_STYLE = `${CV_A4_HEIGHT_MM}mm`

export function mmToCssPx(mm: number): number {
  return (mm / MM_PER_INCH) * CSS_PX_PER_INCH
}

export const CV_A4_WIDTH_PX = mmToCssPx(CV_A4_WIDTH_MM)
export const CV_A4_HEIGHT_PX = mmToCssPx(CV_A4_HEIGHT_MM)

export interface CvPageBoundary {
  page: number
  topMm: number
  topPx: number
}

export function isOverCvA4PageHeight(heightPx: number): boolean {
  return heightPx > CV_A4_HEIGHT_PX
}

export function getCvA4PageBoundaries(heightPx: number): CvPageBoundary[] {
  const boundaries: CvPageBoundary[] = []

  for (let page = 1; heightPx > page * CV_A4_HEIGHT_PX; page += 1) {
    boundaries.push({
      page,
      topMm: page * CV_A4_HEIGHT_MM,
      topPx: page * CV_A4_HEIGHT_PX,
    })
  }

  return boundaries
}
