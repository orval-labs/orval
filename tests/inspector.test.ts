import { describe, expect, it, beforeAll } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('MCP Generated Server Inspector Test', () => {
  const generatedServerDir = path.join(__dirname, './generated/mcp/single');
  const generatedServerWithMutatorDir = path.join(
    __dirname,
    './generated/mcp/single-mutator',
  );

  beforeAll(() => {
    // Verify the compiled server exists
    const serverPath = path.join(generatedServerDir, 'dist/server.js');
    if (!fs.existsSync(serverPath)) {
      throw new Error(
        'Compiled MCP server not found. Run: yarn build:mcp-server first',
      );
    }
  });

  it('should start generated MCP server without errors', (done) => {
    // Start the compiled server directly
    const serverProcess = spawn(
      'node',
      [path.join(generatedServerDir, 'dist/server.js')],
      {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' },
      },
    );

    let errorOutput = '';
    let serverStarted = false;

    // The server logs to stderr
    serverProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;

      // Check for successful server start
      if (output.includes('MCP server running on stdio')) {
        serverStarted = true;
        // Server started successfully
        serverProcess.kill('SIGTERM');
        done();
      }
    });

    serverProcess.on('error', (error) => {
      done(new Error(`Failed to start server: ${error.message}`));
    });

    serverProcess.on('exit', (code, signal) => {
      if (signal === 'SIGTERM' && serverStarted) {
        // Expected exit
        return;
      }
      if (code !== 0 && code !== null && !serverStarted) {
        done(new Error(`Server exited with code ${code}: ${errorOutput}`));
      }
    });

    // Timeout after 3 seconds
    setTimeout(() => {
      if (!serverStarted) {
        serverProcess.kill('SIGTERM');
        done(new Error('Server did not start within 3 seconds'));
      }
    }, 3000);
  });

  it('should generate expected tools from petstore.yaml', () => {
    // Validate the generated files contain expected tools
    const serverPath = path.join(generatedServerDir, 'server.ts');
    const handlersPath = path.join(generatedServerDir, 'handlers.ts');

    const serverContent = fs.readFileSync(serverPath, 'utf-8');
    const handlersContent = fs.readFileSync(handlersPath, 'utf-8');

    // Expected tools from petstore.yaml
    const expectedTools = [
      { tool: 'listPets', handler: 'listPetsHandler' },
      { tool: 'createPets', handler: 'createPetsHandler' },
      { tool: 'showPetById', handler: 'showPetByIdHandler' },
      { tool: 'deletePetById', handler: 'deletePetByIdHandler' },
      { tool: 'healthCheck', handler: 'healthCheckHandler' },
    ];

    for (const { tool, handler } of expectedTools) {
      // Check tool registration in server.ts
      expect(serverContent).toContain(`server.tool(\n  '${tool}'`);
      expect(serverContent).toContain(handler);

      // Check handler export in handlers.ts
      expect(handlersContent).toContain(`export const ${handler}`);
    }

    // Check for MCP SDK imports
    expect(serverContent).toContain('@modelcontextprotocol/sdk/server/mcp.js');
    expect(serverContent).toContain(
      '@modelcontextprotocol/sdk/server/stdio.js',
    );
  });
});
