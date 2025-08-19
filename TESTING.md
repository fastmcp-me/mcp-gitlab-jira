# JSON-RPC Testing

Simple approach to test your MCP server with JSON-RPC requests.

## Quick Test

1. **Start debug server**: `npx tsx --inspect=9229 src/index.ts`
2. **Copy/paste** the JSON into your debug server terminal
3. **Press Enter** to send the request

## Test JSON Snippets

### JQL Search:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets_by_jql","arguments":{"jql":"updated > -7d and statusCategory = \"In Progress\""}}}
```

### List Tools:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

### Get Ticket:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_get_ticket_details","arguments":{"ticketId":"ALICE2-1000"}}}
```

## Unified Search Tool with Fuzzy Matching

The `jira_search_tickets` tool provides intelligent search with fuzzy matching capabilities, making it more user-friendly and tolerant of typos or variations:

### Simple Project Search:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"projectKey":"PROJ","maxResults":10}}}
```

### Search by Assignee:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"assigneeEmail":"user@example.com"}}}
```

### My In Progress Tickets:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"assignedToMe":true,"statusCategory":"In Progress"}}}
```

### Complex Combined Search:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"projectKey":"PROJ","assigneeEmail":"user@example.com","priority":"High","labels":["bug","urgent"],"labelsMatchAll":false,"recentDays":7}}}
```

### Recent High Priority Tickets:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"priority":"High","recentDays":3,"statusCategory":"To Do"}}}
```

### Smart Text Search:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"text":"login authentication error","projectKey":"PROJ"}}}
```

### Date Range Search:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"updatedSince":"-14d","updatedBefore":"-1d","projectKey":"PROJ"}}}
```

### Issue Type & Reporter:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"issueType":"Bug","reporter":"reporter@example.com","statusCategory":"In Progress"}}}
```

## Fuzzy Matching Examples

The search now supports intelligent fuzzy matching:

### Priority Fuzzy Matching:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"priority":"urgent"}}}
```
*Matches: "High", "Highest", "Critical", "Urgent"*

### Status Fuzzy Matching:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"status":"progress"}}}
```
*Matches: "In Progress", "In Development", "In Review"*

### Issue Type Fuzzy Matching:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"issueType":"bug"}}}
```
*Matches: "Bug", "Defect", "Issue"*

### Assignee Name Matching:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"assigneeEmail":"john"}}}
```
*Matches users with "john" in username or display name*

### Multi-Keyword Text Search:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"text":"password reset email"}}}
```
*Each word must appear somewhere in summary, description, or comments*

**Benefits**: 
- Single tool handles all search scenarios
- Intelligent fuzzy matching reduces search failures
- Agents can use natural language terms (e.g., "urgent" instead of exact priority names)
- Multi-keyword text search finds relevant tickets even with partial information
- Generates optimized JQL automatically
- Reduces tool count from 9 to 1

## Additional Examples

Here are more comprehensive examples showing the power of the unified search:

### Search My Open Tasks:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"assignedToMe":true,"statusCategory":"To Do","issueType":"Task"}}}
```

### Find Urgent Bugs in Project:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"projectKey":"PROJ","issueType":"Bug","priority":"High","labels":["urgent"]}}}
```

### Recent Work by Team Member:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"assigneeEmail":"teammate@example.com","recentDays":14,"statusCategory":"Done"}}}
```

### Overdue Items:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"updatedBefore":"2024-01-01","statusCategory":"In Progress","priority":"High"}}}
```

### Stories Created This Month:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"issueType":"Story","createdSince":"2024-08-01","projectKey":"PROJ"}}}
```

### Reporter's Bug Reports:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"reporter":"customer@example.com","issueType":"Bug","statusCategory":"To Do"}}}
```

## Quick Test Generator

For quick testing, use:
```bash
node test-request.js
```

This outputs a simple JSON request you can copy/paste into your debug server.

## Power User Examples

### Complex Multi-Criteria Search:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"projectKey":"PROJ","assigneeEmail":"user@example.com","priority":"High","labels":["bug","urgent"],"labelsMatchAll":false,"recentDays":7,"statusCategory":"In Progress","maxResults":20}}}
```
*Finds: High priority tickets in PROJ, assigned to user@example.com, with 'bug' OR 'urgent' labels, updated in last 7 days, currently In Progress*

### Sprint Planning - Find Unassigned Work:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"projectKey":"PROJ","statusCategory":"To Do","priority":"High","assigneeEmail":"Unassigned"}}}
```

### QA Review - Recent Completions:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"statusCategory":"Done","recentDays":3,"issueType":"Story","orderBy":"updated DESC"}}}
```

## All Examples in One Place

Everything is consolidated in this markdown file - clean, readable, and easy to copy/paste!