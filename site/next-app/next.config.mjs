/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Chrome Local Network Access consent headers. Without these, a
        // public-origin portal iframe (https://portal.sitecorecloud.io) cannot
        // load http://localhost:3000 — Chrome's PNA policy blocks the embed.
        // See setup/scaffold.md Scaffold 2 step 8 + testing-debug.md § 3a-quater.
        //
        // IMPORTANT: do NOT add `Access-Control-Allow-Credentials: true` here.
        // The combination `Allow-Origin: *` + `Allow-Credentials: true` is
        // spec-forbidden and browsers silently reject the response.
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Private-Network", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, Access-Control-Request-Private-Network",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
