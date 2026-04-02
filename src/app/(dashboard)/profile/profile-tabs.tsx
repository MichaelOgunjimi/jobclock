"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { ArrowUpRight, Check, FileText, ShieldCheck, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CvCardActions } from "./cv-card-actions";
import { CvUploadDialog } from "./cv-upload-dialog";
import { CoverLettersTab } from "./cover-letters-tab";
import { savePreferences } from "./actions";
import type {
	CoverLetterTemplate,
	CvData,
} from "@/lib/supabase/database.types";

type CvRow = {
	id: string;
	name: string | null;
	is_primary: boolean | null;
	created_at: string;
	parsed_json: unknown;
};

export const EXPERIENCE_LEVELS = [
	{ value: "graduate", label: "Graduate / Entry Level" },
	{ value: "junior", label: "Junior (1–3 yrs)" },
	{ value: "mid", label: "Mid (3-5 yrs" },
	{ value: "senior", label: "Senior (5+ yrs" },
] as const;

type ProfileData = {
	desired_roles: string[] | null;
	locations_uk: string[] | null;
	target_salary_min: number | null;
	right_to_work_uk: boolean | null;
	experience_level: string[] | null;
} | null;

export function ProfileTabs({
	cvs,
	coverLetters,
	profile,
}: {
	cvs: CvRow[];
	coverLetters: CoverLetterTemplate[];
	profile: ProfileData;
}) {
	const router = useRouter();
	const searchParams = useSearchParams();

	const [roles, setRoles] = useState<string[]>(profile?.desired_roles ?? []);
	const [locations, setLocations] = useState<string[]>(
		profile?.locations_uk ?? [],
	);
	const [salary, setSalary] = useState(
		profile?.target_salary_min?.toString() ?? "",
	);
	const [rightToWork, setRightToWork] = useState(
		profile?.right_to_work_uk ?? false,
	);
	const [experienceLevels, setExperienceLevels] = useState<string[]>(
		profile?.experience_level ?? ([] as string[]),
	);
	const [isPending, startTransition] = useTransition();
	const [isTabPending, startTabTransition] = useTransition();
	const [savedPrefs, setSavedPrefs] = useState({
		roles: profile?.desired_roles ?? [],
		locations: profile?.locations_uk ?? [],
		salary: profile?.target_salary_min?.toString() ?? "",
		rightToWork: profile?.right_to_work_uk ?? false,
		experienceLevels: profile?.experience_level ?? ([] as string[]),
	});

	const isPreferencesDirty =
		JSON.stringify(roles) !== JSON.stringify(savedPrefs.roles) ||
		JSON.stringify(locations) !== JSON.stringify(savedPrefs.locations) ||
		salary !== savedPrefs.salary ||
		rightToWork !== savedPrefs.rightToWork ||
		JSON.stringify(experienceLevels) !==
			JSON.stringify(savedPrefs.experienceLevels);

	function handleSavePreferences() {
		if (!isPreferencesDirty) return;
		startTransition(async () => {
			const result = await savePreferences({
				desiredRoles: roles,
				locationsUk: locations,
				targetSalaryMin: salary ? Number(salary) : null,
				rightToWorkUk: rightToWork,
				experienceLevel: experienceLevels,
			});
			if (result?.error) {
				toast.error(result.error);
			} else {
				toast.success("Preferences saved");
				setSavedPrefs({
					roles,
					locations,
					salary,
					rightToWork,
					experienceLevels,
				});
			}
		});
	}
	const validTabs = ["cvs", "cover-letters", "preferences"];
	const activeTab =
		validTabs.includes(searchParams.get("tab") ?? "") ?
			searchParams.get("tab")!
		:	"cvs";

	function handleTabChange(value: string) {
		startTabTransition(() => {
			const params = new URLSearchParams(searchParams.toString());
			params.set("tab", value);
			router.replace(`/profile?${params.toString()}`, { scroll: false });
		});
	}

	return (
		<Tabs value={activeTab} onValueChange={handleTabChange}>
			<TabsList
				className={cn("mb-8 transition-opacity", isTabPending && "opacity-60")}
			>
				<TabsTrigger value="cvs">CVs</TabsTrigger>
				<TabsTrigger value="cover-letters">Cover Letters</TabsTrigger>
				<TabsTrigger value="preferences">Preferences</TabsTrigger>
			</TabsList>

			{/* CVs Tab */}
			<TabsContent value="cvs">
				<div className="flex justify-end mb-4">
					<CvUploadDialog />
				</div>
				{cvs.length > 0 ?
					<div className="grid auto-rows-fr gap-4 lg:grid-cols-2">
						{cvs.map((cv) => {
							const parsed = cv.parsed_json as CvData | null;
							const label = cv.name ?? parsed?.name ?? "Untitled CV";
							const skills = parsed?.skills?.slice(0, 4) ?? [];
							const expCount = parsed?.experience?.length ?? 0;
							return (
								<Card
									key={cv.id}
									size="sm"
									className={cn(
										"group relative gap-0 overflow-hidden border-border/90 bg-card transition-[border-color,transform,box-shadow] hover:-translate-y-px hover:border-foreground/15 hover:shadow-[0_18px_40px_-30px_rgba(10,10,10,0.28)]",
										cv.is_primary &&
											"border-foreground/20 bg-secondary/20 shadow-[0_18px_40px_-34px_rgba(10,10,10,0.34)]",
									)}
								>
									<Link
										href={`/profile/${cv.id}`}
										className="flex flex-1 flex-col gap-5 p-5 sm:p-6"
									>
										<div className="flex items-center justify-between gap-3 border-b border-border/80 pb-4">
											<div className="min-w-0">
												<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
													{cv.is_primary ? "Primary CV" : "Saved CV"}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Updated{" "}
													{formatDistanceToNow(new Date(cv.created_at), {
														addSuffix: true,
													})}
												</p>
											</div>
											<span className="flex size-9 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
												<ArrowUpRight className="h-4 w-4" />
											</span>
										</div>

										<div className="flex min-w-0 items-start gap-4">
											<div
												className={cn(
													"flex size-12 shrink-0 items-center justify-center border bg-secondary text-muted-foreground",
													cv.is_primary &&
														"border-foreground/15 bg-background text-foreground",
												)}
											>
												{cv.is_primary ?
													<Star className="h-4.5 w-4.5" />
												:	<FileText className="h-4.5 w-4.5" />}
											</div>
											<div className="min-w-0 space-y-2">
												<div className="space-y-1">
													<p className="line-clamp-2 text-lg font-medium leading-tight tracking-[-0.02em] text-foreground">
														{label}
													</p>
													<p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
														{expCount} experience{" "}
														{expCount === 1 ? "entry" : "entries"}
													</p>
												</div>
											</div>
										</div>

										{skills.length > 0 && (
											<div className="flex flex-wrap gap-2">
												{skills.map((s) => (
													<span
														key={s}
														className="border border-border bg-background px-2.5 py-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase"
													>
														{s}
													</span>
												))}
											</div>
										)}

										<div className="mt-auto flex items-center justify-between gap-3 border-t border-border/80 pt-4">
											<p className="text-xs text-muted-foreground">
												{skills.length > 0 ?
													`${skills.length} highlighted skill${skills.length === 1 ? "" : "s"}`
												:	"No highlighted skills yet"}
											</p>
											<span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-foreground">
												View details
											</span>
										</div>
									</Link>
									<CvCardActions
										cvId={cv.id}
										isPrimary={cv.is_primary ?? false}
									/>
								</Card>
							);
						})}
					</div>
				:	<Card>
						<CardContent className="py-14 text-center text-muted-foreground">
							<FileText className="mx-auto mb-4 h-10 w-10 opacity-30" />
							<p className="text-sm">
								No CVs yet. Upload your first one to get started.
							</p>
						</CardContent>
					</Card>
				}
			</TabsContent>

			{/* Cover Letters Tab */}
			<TabsContent value="cover-letters">
				<CoverLettersTab initialLetters={coverLetters} />
			</TabsContent>

			{/* Preferences Tab */}
			<TabsContent value="preferences">
				<Card>
					<CardContent className="pt-6">
						<div className="space-y-5">
							<div className="grid gap-5 md:grid-cols-2">
								<div className="space-y-2">
									<Label>Target Roles</Label>
									<TagInput
										value={roles}
										onChange={setRoles}
										placeholder="Type a role and press Enter…"
									/>
									<p className="text-xs text-muted-foreground">
										Press Enter or comma to add each role
									</p>
								</div>
								<div className="space-y-2">
									<Label>Preferred Locations</Label>
									<TagInput
										value={locations}
										onChange={setLocations}
										placeholder="Type a city and press Enter…"
									/>
									<p className="text-xs text-muted-foreground">
										e.g. London, Manchester, Remote — press Enter to add each
									</p>
								</div>
								<div className="space-y-2 md:col-span-2">
									<Label>Experience Level</Label>
									<div className="flex flex-wrap gap-2">
										{EXPERIENCE_LEVELS.map((level) => {
											const active = experienceLevels.includes(level.value);
											return (
												<button
													key={level.value}
													type="button"
													onClick={() =>
														setExperienceLevels((prev) =>
															active ?
																prev.filter((v) => v !== level.value)
															:	[...prev, level.value],
														)
													}
													className={cn(
														"border px-4 py-2 text-sm font-medium transition-colors",
														active ?
															"border-foreground bg-foreground text-background"
														:	"border-border bg-secondary text-muted-foreground hover:text-foreground",
													)}
												>
													{level.label}
												</button>
											);
										})}
									</div>
									<p className="text-xs text-muted-foreground">
										Used to filter Adzuna and Reed results
									</p>
								</div>

								<div className="space-y-2">
									<Label>Minimum Salary (£)</Label>
									<Input
										type="number"
										value={salary}
										onChange={(e) => setSalary(e.target.value)}
										placeholder="30000"
									/>
								</div>
								<div className="space-y-2">
									<Label id="right-to-work-label">Right to Work UK</Label>
									<button
										type="button"
										role="checkbox"
										aria-checked={rightToWork}
										aria-labelledby="right-to-work-label"
										onClick={() => setRightToWork((value) => !value)}
										className={cn(
											"flex min-h-14 w-full items-center gap-3 border px-4 py-3 text-left transition-colors",
											rightToWork ?
												"border-foreground/15 bg-secondary text-foreground"
											:	"border-border bg-background text-muted-foreground hover:text-foreground",
										)}
									>
										<span
											className={cn(
												"flex size-9 shrink-0 items-center justify-center border transition-colors",
												rightToWork ?
													"border-foreground bg-foreground text-background"
												:	"border-border bg-secondary text-transparent",
											)}
										>
											<Check className="h-4 w-4" />
										</span>
										<span className="min-w-0 space-y-1">
											<span className="flex items-center gap-2 text-sm font-medium text-foreground">
												<ShieldCheck className="h-4 w-4 text-muted-foreground" />
												Right to work confirmed
											</span>
											<span className="block text-xs text-muted-foreground">
												I have the right to work in the UK
											</span>
										</span>
									</button>
								</div>
							</div>
							<Button
								onClick={handleSavePreferences}
								disabled={!isPreferencesDirty || isPending}
								className="min-w-44"
							>
								{isPending ? "Saving…" : "Save Preferences"}
							</Button>
						</div>
					</CardContent>
				</Card>
			</TabsContent>
		</Tabs>
	);
}
