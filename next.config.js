/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  webpack: function (config) {
    config.module.rules.push({
      test: /\.md$/,
      use: "raw-loader",
    });
    return config;
  },
  staticPageGenerationTimeout: 180,
  output: "standalone",
};
