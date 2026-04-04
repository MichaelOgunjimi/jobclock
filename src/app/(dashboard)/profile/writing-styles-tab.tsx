"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useDismissibleLayer } from "@/hooks/use-dismissible-layer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
	Plus,
	Trash2,
	Pencil,
	X,
	FileText,
	Upload,
	Loader2,
	AlertTriangle,
	Lock,
} from "lucide-react";
import type { WritingStyle, WritingStyleTone } from "@/lib/supabase/database.types";
import { saveWritingStyle, deleteWritingStyle } from "./actions";

export const TONES: { value: WritingStyleTone; label: string; description: string }[] = [
	{
		value: "professional",
		label: "Professional",
		description: "Formal and polished",
	},
	{
		value: "enthusiastic",
		label: "Enthusiastic",
		description: "Energetic and passionate",
	},
	{
		value: "conservative",
		label: "Conservative",
		description: "Traditional and measured",
	},
	{
		value: "story",
		label: "Story",
		description: "Narrative about your journey",
	},
];

function FileUploadZone({ onContent }: { onContent: (text: string) => void }) {
	const [parsing, setParsing] = useState(false);

	const onDrop = useCallback(
		async (accepted: File[]) => {
			const file = accepted[0];
			if (!file) return;
			setParsing(true);
			const fd = new FormData();
			fd.append("file", file);
			try {
				const res = await fetch("/api/cover-letter/parse", {
					method: "POST",
					body: fd,
				});
				const data = await res.json();
				if (!res.ok) {
					toast.error(data.error ?? "Failed to parse file");
					return;
				}
				onContent(data.content);
				toast.success("Content extracted from file");
			} catch {
				toast.error("Failed to parse file");
			} finally {
				setParsing(false);
			}
		},
		[onContent],
	);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: {
			"application/pdf": [".pdf"],
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
				[".docx"],
			"application/msword": [".doc"],
		},
		maxFiles: 1,
		disabled: parsing,
	});

	return (
		<div
			{...getRootProps()}
			className={[
				"cursor-pointer border border-dashed p-4 text-center transition-colors",
				isDragActive ?
					"border-foreground/40 bg-secondary"
				:	"border-border bg-secondary hover:border-foreground/30",
				parsing ? "pointer-events-none opacity-60" : "",
			].join(" ")}
		>
			<input {...getInputProps()} />
			{parsing ?
				<div className="flex items-center justify-center gap-2 text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					<span className="text-xs">Extracting text…</span>
				</div>
			:	<div className="flex items-center justify-center gap-2 text-muted-foreground">
					<Upload className="h-4 w-4" />
					<span className="text-xs">
						{isDragActive ? "Drop to import" : "Import from PDF or DOCX"}
					</span>
				</div>
			}
		</div>
	);
}

function DeleteDialog({
	style,
	onConfirm,
	onCancel,
	isPending,
}: {
	style: WritingStyle;
	onConfirm: () => void;
	onCancel: () => void;
	isPending: boolean;
}) {
	const dialogRef = useRef<HTMLDivElement>(null);

	useDismissibleLayer({
		enabled: true,
		onDismiss: onCancel,
		refs: [dialogRef],
	});

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				className="w-full max-w-md border border-border bg-background shadow-lg"
			>
				<div className="flex items-center justify-between border-b border-border px-5 py-4">
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center border border-destructive/20 bg-destructive/8 text-destructive">
							<AlertTriangle className="h-4 w-4" />
						</div>
						<div>
							<h2 className="text-sm font-medium">Delete writing style?</h2>
							<p className="text-xs text-muted-foreground">
								{style.label}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onCancel}
						className="text-muted-foreground hover:text-foreground transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
				<div className="px-5 py-4">
					<p className="text-sm text-muted-foreground">
						This can&apos;t be undone. The writing style will be permanently removed.
					</p>
				</div>
				<div className="flex justify-end gap-2 border-t border-border px-5 py-4">
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={onConfirm}
						disabled={isPending}
					>
						{isPending ? "Deleting…" : "Delete"}
					</Button>
				</div>
			</div>
		</div>
	);
}

function StyleForm({
	initial,
	onSave,
	onCancel,
}: {
	initial?: WritingStyle;
	onSave: (style: WritingStyle) => void;
	onCancel: () => void;
}) {
	const [content, setContent] = useState(initial?.content ?? "");
	const [isPending, startTransition] = useTransition();

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		fd.set("content", content);
		startTransition(async () => {
			const result = await saveWritingStyle(fd);
			if (result?.error) {
				toast.error(result.error);
			} else if (result?.style) {
				toast.success(initial ? "Writing style updated" : "Writing style saved");
				onSave(result.style as WritingStyle);
			}
		});
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{initial && <input type="hidden" name="id" value={initial.id} />}

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5">
					<Label>Label</Label>
					<Input
						name="label"
						defaultValue={initial?.label ?? ""}
						placeholder="e.g. My Software Style"
						required
					/>
				</div>
				<div className="space-y-1.5">
					<Label>Default Tone</Label>
					<select
						name="default_tone"
						defaultValue={initial?.default_tone ?? "professional"}
						className="form-select"
					>
						{TONES.map((t) => (
							<option key={t.value} value={t.value}>
								{t.label} — {t.description}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="space-y-1.5">
				<Label>Structure</Label>
				<FileUploadZone onContent={setContent} />
				<textarea
					name="content"
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder="Write or import your writing structure. The AI will use this as a guide for how to organise your cover letter."
					rows={10}
					required
					className="flex min-h-60 w-full border border-input bg-muted px-4 py-3 text-[13px] tracking-[0.02em] outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/15 resize-none"
				/>
			</div>

			<div className="flex gap-2 justify-end">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" disabled={isPending}>
					{isPending ?
						"Saving…"
					: initial ?
						"Save Changes"
					:	"Add Writing Style"}
				</Button>
			</div>
		</form>
	);
}

export function WritingStylesTab({
	builtIns,
	userStyles: initialUserStyles,
}: {
	builtIns: WritingStyle[];
	userStyles: WritingStyle[];
}) {
	const [userStyles, setUserStyles] = useState(initialUserStyles);
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const toneLabel = (tone: WritingStyleTone) =>
		TONES.find((t) => t.value === tone)?.label ?? "Professional";

	function handleSave(style: WritingStyle) {
		setUserStyles((prev) => {
			const exists = prev.find((s) => s.id === style.id);
			return exists ?
					prev.map((s) => (s.id === style.id ? style : s))
				:	[style, ...prev];
		});
		setCreating(false);
		setEditingId(null);
	}

	function confirmDelete(id: string) {
		const fd = new FormData();
		fd.append("id", id);
		startTransition(async () => {
			await deleteWritingStyle(fd);
			setUserStyles((prev) => prev.filter((s) => s.id !== id));
			setDeletingId(null);
			toast.success("Writing style deleted");
		});
	}

	const deletingStyle = userStyles.find((s) => s.id === deletingId);

	return (
		<>
			{deletingStyle && (
				<DeleteDialog
					style={deletingStyle}
					onConfirm={() => confirmDelete(deletingId!)}
					onCancel={() => setDeletingId(null)}
					isPending={isPending}
				/>
			)}

			<div className="space-y-6">
				{/* Built-in styles */}
				<div className="space-y-3">
					<p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
						Built-in
					</p>
					<div className="space-y-2">
						{builtIns.map((style) => (
							<Card key={style.id}>
								<CardContent className="pt-4 pb-4">
									<div className="flex items-start justify-between gap-2">
										<div>
											<p className="text-sm font-medium">{style.label}</p>
											<p className="text-xs text-muted-foreground mt-0.5">
												Default tone: {toneLabel(style.default_tone)}
											</p>
										</div>
										<span className="flex items-center gap-1 text-[11px] text-muted-foreground/60 border border-border px-2 py-1 shrink-0">
											<Lock className="h-3 w-3" />
											Built-in
										</span>
									</div>
									<p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line mt-2">
										{style.content}
									</p>
								</CardContent>
							</Card>
						))}
					</div>
				</div>

				{/* User styles */}
				<div className="space-y-3">
					<p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
						Your Styles
					</p>

					{userStyles.length === 0 && !creating && (
						<Card>
							<CardContent className="py-10 text-center text-muted-foreground">
								<FileText className="mx-auto mb-4 h-8 w-8 opacity-30" />
								<p className="text-sm">No custom writing styles yet.</p>
								<p className="text-xs mt-1 opacity-60">
									Add your own structure or import from a PDF/DOCX.
								</p>
							</CardContent>
						</Card>
					)}

					{userStyles.map((style) => (
						<Card key={style.id}>
							<CardContent className="pt-4 pb-4">
								{editingId === style.id ?
									<StyleForm
										initial={style}
										onSave={handleSave}
										onCancel={() => setEditingId(null)}
									/>
								:	<div className="space-y-3">
										<div className="flex items-start justify-between gap-2">
											<div>
												<p className="text-sm font-medium">{style.label}</p>
												<p className="text-xs text-muted-foreground mt-0.5">
													Default tone: {toneLabel(style.default_tone)}
												</p>
											</div>
											<div className="flex gap-1">
												<button
													type="button"
													onClick={() => setEditingId(style.id)}
													className="text-muted-foreground hover:text-foreground transition-colors p-1"
												>
													<Pencil className="h-3.5 w-3.5" />
												</button>
												<button
													type="button"
													onClick={() => setDeletingId(style.id)}
													className="text-muted-foreground hover:text-destructive transition-colors p-1"
												>
													<Trash2 className="h-3.5 w-3.5" />
												</button>
											</div>
										</div>
										<p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-line">
											{style.content}
										</p>
									</div>
								}
							</CardContent>
						</Card>
					))}

					{creating ?
						<Card>
							<CardContent className="pt-4">
								<div className="flex items-center justify-between mb-4">
									<p className="text-sm font-medium">New Writing Style</p>
									<button
										type="button"
										onClick={() => setCreating(false)}
										className="text-muted-foreground hover:text-foreground transition-colors"
									>
										<X className="h-4 w-4" />
									</button>
								</div>
								<StyleForm
									onSave={handleSave}
									onCancel={() => setCreating(false)}
								/>
							</CardContent>
						</Card>
					:	<Button
							variant="outline"
							className="w-full"
							onClick={() => setCreating(true)}
						>
							<Plus className="h-4 w-4" />
							Add Writing Style
						</Button>
					}
				</div>
			</div>
		</>
	);
}
