'use client';

import dynamic from 'next/dynamic';

// Use dynamic import with no SSR for the ThreeScene component
const ThreeScene = dynamic(() => import('./components/ThreeScene'), {
  ssr: false,
});

export default function Home() {
  return (
    <main>
      <ThreeScene />
    </main>
  );
}
