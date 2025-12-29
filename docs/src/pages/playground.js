import { Banner } from 'components/Banner';
import { Footer } from 'components/Footer';
import { Nav } from 'components/Nav';
import { Seo } from 'components/Seo';
import { Sticky } from 'components/Sticky';
import Head from 'next/head';
import { Playground } from '../components/playground/Playground';

export const PlaygroundPage = () => {
  return (
    <>
      <Seo
        title="orval"
        description="orval generates type-safe JS clients (TypeScript) from any valid OpenAPI v3 or Swagger v2 specification, either in yaml or json formats. 🍺"
      />
      <Head>
        <title>orval - Restful client generator</title>
      </Head>
      <div className="bg-gray-50 h-full min-h-full">
        <Banner />
        <Sticky>
          <Nav />
        </Sticky>
        <div className="pt-8">
          <Playground height="75vh" />
        </div>
        <Footer />
      </div>
    </>
  );
};

export default PlaygroundPage;
