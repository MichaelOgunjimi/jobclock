import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardTopbar } from "@/components/dashboard-topbar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!isSupabaseConfigured()) {
    redirect("/auth")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  return (
    <div className="flex min-h-screen bg-background lg:fixed lg:inset-0 lg:min-h-0 lg:overflow-hidden">
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden pt-16 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pt-0">
        <DashboardTopbar />
        {children}
      </main>
    </div>
  )
}
