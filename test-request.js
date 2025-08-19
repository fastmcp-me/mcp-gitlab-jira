#!/usr/bin/env node

// Quick JSON generator for testing jira_search_tickets
// Usage: node test-request.js

const testRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'jira_search_tickets',
    arguments: {
      text: 'login authentication',
      priority: 'urgent',
      status: 'progress',
      recentDays: 14,
      maxResults: 5
    }
  }
};

console.log(JSON.stringify(testRequest));