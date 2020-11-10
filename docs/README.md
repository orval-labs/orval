<p align="center">
  <img src="../logo/orval-logo-horizontal.png?raw=true" width="500" height="160" alt="orval - Restfull Client Generator" />
</p>

This is source code to orval.dev. It is forked from the [Formik](https://formik.org) docs and is built with:

- Next.js
- MDX
- Tailwind
- Algolia

## Running locally

```sh
yarn install
```

If you want to setup algolia. Just add a `.env` file with the following content:

```
NEXT_PUBLIC_ALGOLIA_APP_ID=<YOUR APP ID>
NEXT_PUBLIC_ALGOLIA_API_KEY=<YOUR API KEY>
NEXT_PUBLIC_ALGOLIA_INDEX_NAME=<YOUR INDEX NAME>
```

Now it will work. Run `yarn dev` to get going.
