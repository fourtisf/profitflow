/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source — Next must transpile them.
  transpilePackages: ['@profitflow/shared', '@profitflow/pnl-engine'],
};

export default nextConfig;
