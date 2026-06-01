import { LandingWaves } from "./components/landing-waves";
import { LandingNavbar } from "./components/landing-navbar";
import { LandingHero } from "./components/landing-hero";
import { LandingFeatures } from "./components/landing-features";
import { LandingHow } from "./components/landing-how";
import { LandingCta } from "./components/landing-cta";
import { LandingFooter } from "./components/landing-footer";

/**
 * Landing page — shown to unauthenticated visitors at `/`.
 * Authenticated users are redirected to /dashboard by the root page.tsx.
 */
export function LandingPage() {
  return (
    <div className="relative h-dvh overflow-hidden text-slate-900 dark:text-slate-100">
      {/* Fixed viewport background — does not scroll */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden
          bg-gradient-to-b from-[#f5f7f6] via-[#eef1ef] to-[#e8ede9]
          dark:from-[#020304] dark:via-[#060809] dark:to-[#040606]"
        aria-hidden
      >
        <LandingWaves />
      </div>

      {/* Scrollable content over the fixed background */}
      <div
        data-landing-scroll
        className="relative z-[1] h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain"
      >
        <LandingNavbar />

        <main>
          <LandingHero />
          <LandingFeatures />
          <LandingHow />
          <LandingCta />
        </main>

        <LandingFooter />
      </div>
    </div>
  );
}
