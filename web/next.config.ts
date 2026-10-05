import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Tên miền cũ (Chăm Sóc Ba Mẹ) chuyển sang tên miền mới, giữ nguyên đường dẫn: link mời, link đồng hồ cũ vẫn chạy.
  async redirects() {
    return [{
      source: "/:path*",
      has: [{ type: "host", value: "chamsocbame.vercel.app" }],
      destination: "https://chamsocnguoithan.vercel.app/:path*",
      permanent: true,
    }];
  },
};

export default nextConfig;
