import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AuthPageClient } from "./auth-page-client";

export const metadata: Metadata = {
	title: "Sign in",
	description: "Sign in to your Jobclock workspace to manage your job search.",
	robots: { index: false, follow: false },
};

export default async function AuthPage() {
	if (isSupabaseConfigured()) {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (user) {
			redirect("/dashboard");
		}
	}

	return <AuthPageClient />;
}
