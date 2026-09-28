/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [".monkeycode-ai.live"],
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? "http://localhost:3001";
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/uploads/:path*", destination: `${backend}/uploads/:path*` },
      { source: "/socket.io/:path*", destination: `${backend}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
