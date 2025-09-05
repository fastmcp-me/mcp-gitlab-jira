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

## Custom Field Management Examples

### Priority Field Updates

The `jira_update_ticket_priority` tool allows you to update the priority of a Jira ticket using a custom Priority field with smart matching.

**Basic Priority Update:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_update_ticket_priority","arguments":{"ticketId":"PROJ-123","priority":"High"}}}
```

**Different Priority Values:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_update_ticket_priority","arguments":{"ticketId":"PROJ-123","priority":"Critical"}}}
```

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_update_ticket_priority","arguments":{"ticketId":"PROJ-456","priority":"Medium"}}}
```

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_update_ticket_priority","arguments":{"ticketId":"PROJ-789","priority":"Low"}}}
```

**Features:**
- **Smart Value Matching**: Supports exact matches, case-insensitive, and fuzzy matching (e.g., "hi" matches "High", "crit" matches "Critical")
- **Validation**: Verifies the Priority field exists and has predefined allowed values
- **Error Prevention**: Lists available options when no close match is found

### Sprint Field Updates

The `jira_update_ticket_sprint` tool allows you to assign tickets to sprints with dynamic sprint fetching and fuzzy matching.

**Basic Sprint Assignment:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_update_ticket_sprint","arguments":{"ticketId":"PROJ-123","sprintName":"Sprint 1"}}}
```

**Finding Available Sprints (will error but show options):**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jira_update_ticket_sprint","arguments":{"ticketId":"PROJ-123","sprintName":"show-me-options"}}}
```

**Features:**
- **Automatic Field Detection**: Finds Sprint custom field using case-insensitive search
- **Dynamic Sprint Fetching**: Retrieves available sprints from project's agile boards
- **Fuzzy String Matching**: Intelligent matching with adjustable thresholds
- **Sprint States**: Shows sprint states (active, future, closed) in error messages

## Expected Response Examples

### Successful Updates

**Priority Update Success:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Priority for ticket PROJ-123 updated to High successfully."
      }
    ]
  }
}
```

**Sprint Update Success:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Sprint for ticket PROJ-123 updated to \"Sprint 1\" (active) successfully."
      }
    ]
  }
}
```

### Error Responses

**Priority - No Close Match:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "No close match found for \"xyz123\". Available options: Low, Medium, High, Critical"
  }
}
```

**Sprint - Field Not Found:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Could not retrieve custom field ID for Sprint."
  }
}
```

**Sprint - No Boards for Project:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "No boards found for project PROJ. Sprints require a board to be configured."
  }
}
```

**Sprint - No Close Match:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "No close match found for \"invalid-sprint\". Available sprints: Sprint 1 (active), Sprint 2 (future), Bug Fix Sprint (active)"
  }
}
```

## Requirements

### Priority Field Requirements
- A custom field with the name "Priority" or "priority"
- Field must be accessible to the authenticated user
- Field accepts string values (typically an option/select field)

### Sprint Field Requirements
- The ticket must belong to a project that has agile boards configured
- The Sprint custom field must exist in your Jira instance
- You must have permission to edit the ticket
- The target sprint must exist and be accessible

## Best Practices

### Priority Updates
- Use standard priority names like "Critical", "High", "Medium", "Low"
- Take advantage of fuzzy matching for quick updates
- Check error messages for available options when unsure

### Sprint Updates
- Use descriptive sprint names like "Sprint 1", "Bug Fix Sprint", "Release 2.1 Sprint"
- Check sprint states - prefer assigning to active or future sprints
- Ensure the ticket's project has the sprint you're trying to assign
- Verify you have edit permissions on both the ticket and the target sprint
