import type { NextConfig } from "next";

const allowedDevOrigins =
	process.env.ALLOWED_DEV_ORIGIN ?
		process.env.ALLOWED_DEV_ORIGIN.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean)
	:	[];

const nextConfig: NextConfig = {
	reactCompiler: true,
	serverExternalPackages: ["pdf-parse"],
	allowedDevOrigins: ["127.0.0.1", ...allowedDevOrigins],
};


export default nextConfig;
