#!/usr/bin/env node

// Simple test to verify MCP server responds to list_tools request
import { spawn } from 'child_process';

console.log('Testing MCP server tool listing...');

const env = {
  ...process.env,
  GITLAB_URL: 'https://gitlab.example.com',
  GITLAB_ACCESS_TOKEN: 'dummy-token'
};

const child = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: env,
  cwd: process.cwd()
});

// Send a list_tools request
const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list'
};

child.stdin.write(JSON.stringify(request) + '\n');
child.stdin.end();

let output = '';

child.stdout.on('data', (data) => {
  output += data.toString();
});

child.stderr.on('data', (data) => {
  console.error('Server stderr:', data.toString());
});

child.on('close', (code) => {
  console.log('Server output:', output);
  
  try {
    const response = JSON.parse(output);
    if (response.result && response.result.tools) {
      console.log(`✅ SUCCESS: Found ${response.result.tools.length} tools`);
      console.log('Tools:', response.result.tools.map(t => t.name));
    } else {
      console.log('❌ ERROR: No tools found in response');
      console.log('Response:', response);
    }
  } catch (e) {
    console.log('❌ ERROR: Failed to parse response as JSON');
    console.log('Raw output:', output);
  }
});
