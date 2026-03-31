import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactCompiler: true,
	serverExternalPackages: ["pdf-parse"],
	allowedDevOrigins: [
		"127.0.0.1",
		...(process.env.ALLOWED_DEV_ORIGIN ? [process.env.ALLOWED_DEV_ORIGIN] : []),
	],
};

export default nextConfig;
