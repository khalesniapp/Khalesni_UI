import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Cookie-based locale (§9), so no routing middleware — just the request config.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // §15: type errors must fail the build, never ship.
  // (Next 16 removed the `eslint` config key along with `next lint`; linting
  // is its own `npm run lint` step now.)
  typescript: { ignoreBuildErrors: false },
};

export default withNextIntl(nextConfig);
