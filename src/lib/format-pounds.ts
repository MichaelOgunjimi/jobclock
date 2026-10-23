/** Formats pence as pounds, dropping the decimals for whole amounts (£12, £7.50). */
export function formatPounds(pence: number) {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`
}
