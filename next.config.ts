import type { NextConfig } from "next";

const allowedDevOrigins =
	process.env.ALLOWED_DEV_ORIGIN ?
		process.env.ALLOWED_DEV_ORIGIN.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean)
	:	[];

const nextConfig: NextConfig = {
	reactCompiler: true,
	output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
	serverExternalPackages: [
		"pdf-parse",
		"@sparticuz/chromium",
		"puppeteer-core",
		"@playwright/test",
		"playwright",
		"playwright-core",
	],
	// sparticuz loads its binary via path.join(__dirname, '../bin/chromium.br') —
	// a dynamic path the file tracer won't follow. Include it explicitly.
	outputFileTracingIncludes: {
		"/api/applications/[id]/cv/pdf": [
			"./node_modules/@sparticuz/chromium/bin/**",
		],
		"/api/applications/[id]/cover-letter/pdf": [
			"./node_modules/@sparticuz/chromium/bin/**",
		],
	},
	// @playwright/test ships a 257 MB Chromium that must never enter the bundle.
	outputFileTracingExcludes: {
		"/api/applications/[id]/cv/pdf": [
			"./node_modules/playwright/**",
			"./node_modules/@playwright/**",
		],
		"/api/applications/[id]/cover-letter/pdf": [
			"./node_modules/playwright/**",
			"./node_modules/@playwright/**",
		],
	},
	allowedDevOrigins: ["127.0.0.1", ...allowedDevOrigins],
};


export default nextConfig;
