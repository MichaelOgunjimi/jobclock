export const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed"
export const SIDEBAR_COLLAPSED_EVENT = "sidebar-collapsed-change"

export const SIDEBAR_PREFERENCE_SCRIPT = `try{var value=localStorage.getItem("${SIDEBAR_COLLAPSED_KEY}");if(value==="true"||value==="false"){document.documentElement.dataset.sidebarCollapsed=value}}catch{}`

export function isSidebarCollapsed(value: string | undefined): boolean {
  return value === "true"
}
