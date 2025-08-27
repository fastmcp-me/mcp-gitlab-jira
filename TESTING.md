# JSON-RPC Testing

Simple approach to test your MCP server with JSON-RPC requests.

## Quick Test

1. **Start debug server**: `npx tsx --inspect=9229 src/index.ts`
2. **Copy/paste** the JSON into your debug server terminal
3. **Press Enter** to send the request

## Essential Test Examples

### List All Available Tools

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

### JIRA Ticket Operations

**Get Ticket Details:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_get_ticket_details","arguments":{"ticketId":"PROJ-123"}}}
```

**Search Tickets (Unified Search):**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets","arguments":{"projectKey":"PROJ","assignedToMe":true,"statusCategory":"In Progress","maxResults":10}}}
```

**Search with JQL:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_tickets_by_jql","arguments":{"jql":"updated > -7d and statusCategory = \"In Progress\""}}}
```

**Update Custom Fields:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_update_custom_fields","arguments":{"ticketId":"PROJ-123","fields":{"Story Points":"8","Sprint":326}}}}
```

### Sprint Management

**Get All Boards:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_get_all_boards","arguments":{"maxResults":20}}}
```

**Search Sprints by Board Name:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_sprints","arguments":{"boardName":"Data","state":"active","maxResults":10}}}
```

**Search Sprints by Board ID:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_search_sprints","arguments":{"boardId":33,"state":"active","maxResults":10}}}
```

**Get Sprint Issues:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_get_sprint_issues","arguments":{"sprintId":326,"maxResults":50}}}
```

### GitLab Operations

**Get Merge Request Details:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"gitlab_get_merge_request_details","arguments":{"mrUrl":"https://gitlab.example.com/namespace/project/-/merge_requests/123"}}}
```

**List Project Issues:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"gitlab_list_project_issues","arguments":{"projectPath":"namespace/project","state":"opened"}}}
```

## Quick Test Generator

For quick testing, use the included test script:

```bash
node test-request.js
```

This outputs a simple JSON request you can copy/paste into your debug server.

## Key Benefits

- **Sprint Management**: Focused board search prevents permission errors
- **Unified Search**: Single tool for most JIRA ticket searches with fuzzy matching
- **Custom Fields**: Easy updates for Story Points, Sprints, and other custom fields
- **GitLab Integration**: Complete MR and project management capabilities

For comprehensive custom field details, see the `jira_update_custom_fields` tool documentation.
