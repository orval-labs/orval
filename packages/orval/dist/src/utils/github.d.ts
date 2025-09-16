import https from 'node:https';
import SwaggerParser from '@apidevtools/swagger-parser';
export declare const getGithubSpecReq: ({ accessToken, repo, owner, branch, path, }: {
    accessToken: string;
    repo: string;
    owner: string;
    branch: string;
    path: string;
}) => [https.RequestOptions, string];
export declare const getGithubAcessToken: (githubTokenPath: string) => Promise<string>;
export declare const getGithubOpenApi: (url: string) => Promise<string>;
export declare const githubResolver: {
    order: number;
    canRead(file: SwaggerParser.FileInfo): boolean;
    read(file: SwaggerParser.FileInfo): Promise<string>;
};
//# sourceMappingURL=github.d.ts.map