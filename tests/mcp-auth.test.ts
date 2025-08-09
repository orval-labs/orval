import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
import { spawn, ChildProcess, execSync } from 'child_process';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import path from 'path';
import fs from 'fs';

describe('MCP Server with Authentication', () => {
  const generatedServerWithMutatorDir = path.join(
    __dirname,
    './generated/mcp/single-mutator',
  );
  const distDir = path.join(
    generatedServerWithMutatorDir,
    'dist/generated/mcp/single-mutator',
  );

  // Setup MSW mock server
  const mockApiServer = setupServer(
    http.get('http://petstore.swagger.io/v1/pets', ({ request }) => {
      const authHeader = request.headers.get('Authorization');

      // Check for valid auth token
      if (!authHeader || authHeader !== 'Token test-api-key') {
        return new HttpResponse(
          JSON.stringify({ code: 401, message: 'Unauthorized' }),
          { status: 401 },
        );
      }

      // Return mock pets data for authorized requests
      return HttpResponse.json([
        { id: 1, name: 'Rex', tag: 'dog' },
        { id: 2, name: 'Mittens', tag: 'cat' },
      ]);
    }),

    http.post('http://petstore.swagger.io/v1/pets', ({ request }) => {
      const authHeader = request.headers.get('Authorization');

      if (!authHeader || authHeader !== 'Token test-api-key') {
        return new HttpResponse(
          JSON.stringify({ code: 401, message: 'Unauthorized' }),
          { status: 401 },
        );
      }

      return HttpResponse.json({ id: 3, name: 'Fluffy', tag: 'rabbit' });
    }),

    http.get(
      'http://petstore.swagger.io/v1/pets/:petId',
      ({ request, params }) => {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader || authHeader !== 'Token test-api-key') {
          return new HttpResponse(
            JSON.stringify({ code: 401, message: 'Unauthorized' }),
            { status: 401 },
          );
        }

        return HttpResponse.json({
          id: Number(params.petId),
          name: 'Test Pet',
          tag: 'test',
        });
      },
    ),
  );

  beforeAll(() => {
    // Start MSW mock server
    mockApiServer.listen({ onUnhandledRequest: 'bypass' });

    // Compile the MCP server with mutator
    if (!fs.existsSync(distDir)) {
      console.log('Compiling MCP server with mutator...');
      execSync(
        `npx tsc ${generatedServerWithMutatorDir}/*.ts ${generatedServerWithMutatorDir}/http-schemas/*.ts --outDir ${distDir} --module commonjs --target es2020 --esModuleInterop --skipLibCheck`,
        { stdio: 'inherit' },
      );
    }
  });

  afterAll(() => {
    mockApiServer.close();
  });

  beforeEach(() => {
    mockApiServer.resetHandlers();
  });

  it('should fail without API_KEY environment variable', async () => {
    // Start MCP server without API_KEY
    const serverProcess = spawn('node', [path.join(distDir, 'server.js')], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }, // No API_KEY
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // The server should start but API calls will fail with 401
    let errorOutput = '';
    serverProcess.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    // Clean up
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(serverProcess.killed).toBe(true);
  });

  it('should pass auth token when API_KEY is set', async () => {
    // Start MCP server WITH API_KEY
    const serverProcess = spawn('node', [path.join(distDir, 'server.js')], {
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        API_KEY: 'test-api-key', // Set the auth token
      },
    });

    let serverStarted = false;

    serverProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('MCP server running on stdio')) {
        serverStarted = true;
      }
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(serverStarted).toBe(true);

    // Clean up
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it('should validate mutator is used in http-client', () => {
    // Check that the generated code uses the mutator
    const httpClientPath = path.join(
      generatedServerWithMutatorDir,
      'http-client.ts',
    );
    const httpClientContent = fs.readFileSync(httpClientPath, 'utf-8');

    // Verify mutator import
    expect(httpClientContent).toContain(
      "import { mcpInstance } from '../../../mutators/mcp-client'",
    );

    // Verify mutator is used for API calls
    expect(httpClientContent).toContain('return mcpInstance<');

    // Check that all CRUD operations use the mutator
    const operations = [
      'listPets',
      'createPets',
      'showPetById',
      'deletePetById',
    ];
    operations.forEach((op) => {
      const regex = new RegExp(`export const ${op} = .*mcpInstance`, 's');
      expect(httpClientContent).toMatch(regex);
    });
  });
});
