import { Angle } from '../components/Angle';
import { Features } from '../components/Features';
import { Footer } from '../components/Footer';
import { Hero } from '../components/Hero';
import { Nav } from '../components/Nav';
import { Pricing } from '../components/Pricing';
import { Proof } from '../components/Proof';
import { Share } from '../components/Share';
import { Waitlist } from '../components/Waitlist';

export default function Page() {
  return (
    <>
      <Nav />
      <Hero />
      <Angle />
      <Proof />
      <Features />
      <Pricing />
      <Share />
      <Waitlist />
      <Footer />
    </>
  );
}
