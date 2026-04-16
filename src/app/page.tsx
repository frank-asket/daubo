import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Tagline } from "@/components/landing/Tagline";
import { FutureOfResumes } from "@/components/landing/FutureOfResumes";
import { Benefits } from "@/components/landing/Benefits";
import { PipelineShowcase } from "@/components/landing/PipelineShowcase";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ProcessStrip } from "@/components/landing/ProcessStrip";
import { Testimonials } from "@/components/landing/Testimonials";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { Footer, FooterCTA } from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <a
        href="#landing-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[300] focus:rounded-lg focus:bg-emerald-400 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-zinc-950 focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>
      <Header />
      <main id="landing-main" tabIndex={-1}>
        <Hero />
        <Tagline />
        <FutureOfResumes />
        <Benefits />
        <PipelineShowcase />
        <HowItWorks />
        <ProcessStrip />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FooterCTA />
      </main>
      <Footer />
    </>
  );
}
