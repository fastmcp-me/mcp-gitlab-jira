#!/usr/bin/env node

// Simple test script for the GitLab MCP server
// Usage: ./test-mcp.js <method> [args...]

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, 'dist', 'index.js');

// Default environment variables for testing
const env = {
  ...process.env,
  GITLAB_URL: process.env.GITLAB_URL || 'https://gitlab.example.com',
  GITLAB_ACCESS_TOKEN: process.env.GITLAB_ACCESS_TOKEN || 'test-token'
};

const method = process.argv[2] || 'tools/list';
const args = process.argv.slice(3);

let params = {};
if (method === 'tools/call') {
  const toolName = args[0];
  const toolArgs = args.slice(1);
  
  // Parse simple arguments for testing
  const toolParams = {};
  for (let i = 0; i < toolArgs.length; i += 2) {
    const key = toolArgs[i];
    const value = toolArgs[i + 1];
    toolParams[key] = isNaN(value) ? value : Number(value);
  }
  
  params = {
    name: toolName,
    arguments: toolParams
  };
}

const request = {
  jsonrpc: '2.0',
  id: 1,
  method,
  params
};

console.log('Sending request:', JSON.stringify(request, null, 2));
console.log('---');

const child = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env
});

child.stdin.write(JSON.stringify(request) + '\n');
child.stdin.end();

let output = '';
child.stdout.on('data', (data) => {
  output += data.toString();
});

child.on('close', (code) => {
  if (output.trim()) {
    try {
      const response = JSON.parse(output.trim());
      console.log('Response:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('Raw output:', output);
    }
  }
  process.exit(code);
});
