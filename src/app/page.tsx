import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Tagline } from "@/components/landing/Tagline";
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
      <Header />
      <main>
        <Hero />
        <Tagline />
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
