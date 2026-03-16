import Pets from './pets';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <Pets />
    </main>
  );
}
