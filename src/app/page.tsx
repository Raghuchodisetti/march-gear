import { Hero } from "@/components/home/hero";
import { SmartFinder } from "@/components/home/smart-finder";
import { TrendingCars } from "@/components/home/trending";
import { DiscoverCategories } from "@/components/home/categories";
import { BrowseByBrand } from "@/components/home/brands";
import { LatestLaunches } from "@/components/home/latest-launches";
import { CompareShowcase } from "@/components/home/compare-showcase";
import { PerfectCarQuiz } from "@/components/home/perfect-car-quiz";
import { UsedShowcase } from "@/components/home/used-showcase";
import { UpcomingCars } from "@/components/home/upcoming";
import { EvUniverse } from "@/components/home/ev-universe";
import { AutomotiveStories } from "@/components/home/stories";
import { ToolsSection } from "@/components/home/tools-section";
import { DealerNetwork } from "@/components/home/dealer-network";
import { Newsletter } from "@/components/home/newsletter";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SmartFinder />
      <TrendingCars />
      <BrowseByBrand />
      <DiscoverCategories />
      <LatestLaunches />
      <CompareShowcase />
      <PerfectCarQuiz />
      <UsedShowcase />
      <UpcomingCars />
      <EvUniverse />
      <AutomotiveStories />
      <ToolsSection />
      <DealerNetwork />
      <Newsletter />
    </>
  );
}
