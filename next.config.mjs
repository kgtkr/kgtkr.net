/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  staticPageGenerationTimeout: 180,
  output: "standalone",
  experimental: {
    // `.next/cache` のパスを変更できずnixとの相性が悪いため無効化
    // コンテナで動かす場合、どちらにしても毎回キャッシュは破棄されるため影響は小さい
    isrFlushToDisk: false,
  },
};

export default nextConfig;
