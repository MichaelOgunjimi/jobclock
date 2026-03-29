import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactCompiler: true,
	serverExternalPackages: ["pdf-parse"],
	allowedDevOrigins: ["192.168.1.113", "127.0.0.1"],
};

export default nextConfig;
