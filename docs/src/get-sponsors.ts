import { graphql } from '@octokit/graphql';

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

export const getSponsors = async () => {
  let sponsors: any[] = [];

  const fetchPage = async (cursor = '') => {
    const res: any = await graphqlWithAuth(
      `
      query ($cursor: String) {
        viewer {
          sponsorshipsAsMaintainer(first: 100, after: $cursor, includePrivate: false) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                createdAt
                sponsorEntity {
                  ... on User {
                    name
                    login
                    email
                    avatarUrl
                  }
                  ... on Organization {
                    name
                    login
                    email
                    avatarUrl
                  }
                }
                tier {
                  id
                  monthlyPriceInDollars
                }
                privacyLevel
              }
            }
          }
        }
      }
      `,
      {
        cursor,
      },
    );

    const {
      viewer: {
        sponsorshipsAsMaintainer: {
          pageInfo: { hasNextPage, endCursor },
          edges,
        },
      },
    } = res;

    sponsors = [
      ...sponsors,
      ...edges.map((edge) => {
        const {
          node: { createdAt, sponsorEntity, tier, privacyLevel },
        } = edge;

        if (!sponsorEntity) {
          return null;
        }

        const { name, login, email, avatarUrl } = sponsorEntity;

        return {
          name,
          login,
          email,
          tier,
          createdAt,
          privacyLevel,
          avatarUrl,
        };
      }),
    ];

    if (hasNextPage) {
      await fetchPage(endCursor);
    }
  };

  await fetchPage();

  return sponsors.filter(Boolean);
};
