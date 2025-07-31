# MCP GitLab Jira Server

A Model Context Protocol (MCP) server for GitLab and Jira integration. This server allows AI agents like gemini-cli to interact with your GitLab and Jira instances.

## Features

- **List Projects**: Get all accessible GitLab projects
- **List Merge Requests**: Get merge requests for a specific project
- **Get Merge Request Details**: Fetch comprehensive details including diffs, discussions, and existing feedback
- **Add Comments**: Add comments to merge requests (general, replies, or inline comments)

## Setup

### Prerequisites

- Node.js 18+ 
- GitLab Personal Access Token with API access
- Access to a GitLab instance (on-premise or GitLab.com)

### Installation

1. **Clone and build the project:**
   ```bash
   cd mcp-gitlab-cli
   npm install
   npm run build
   ```

2. **Set up environment variables:**
   ```bash
   export GITLAB_URL="https://your-gitlab-instance.com"
   export GITLAB_ACCESS_TOKEN="your-personal-access-token"
   ```

3. **Install globally (optional but recommended)**:
   ```bash
   npm link
   ```
   This allows you to use `mcp-gitlab` command from anywhere.

4. **Test the server manually**:
   ```bash
   # Test that the server starts without errors (if globally linked)
   echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | mcp-gitlab
   
   # Or test directly
   node dist/index.js
   ```
   The server should start and log "GitLab MCP server started" to stderr.

### Using with MCP Clients

#### Configuration for gemini-cli or other MCP clients

Create or update your MCP configuration file (usually `~/.mcp/config.json` or similar):

**Option 1: Using globally linked command (recommended)**:
```json
{
  "mcpServers": {
    "gitlab-mcp": {
      "command": "mcp-gitlab",
      "env": {
        "GITLAB_URL": "https://your-gitlab-instance.com",
        "GITLAB_ACCESS_TOKEN": "your-personal-access-token"
      }
    }
  }
}
```

**Option 2: Using absolute path**:
```json
{
  "mcpServers": {
    "gitlab-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-gitlab-cli/dist/index.js"],
      "env": {
        "GITLAB_URL": "https://your-gitlab-instance.com",
        "GITLAB_ACCESS_TOKEN": "your-personal-access-token"
      }
    }
  }
}
```

#### Example with gemini-cli

Once configured, you can use the GitLab tools in gemini-cli:

```bash
# Start gemini-cli with MCP servers
gemini-cli --mcp-config ~/.mcp/config.json

# Then you can ask questions like:
# "List all my GitLab projects"
# "Show me the merge requests for project ID 123"
# "Get details for merge request 45 in project 123"
# "Add a comment to merge request 45 saying 'LGTM'"
```

## Available Tools

### 1. `list_projects`
Lists all accessible GitLab projects.

**Parameters**: None

### 2. `list_merge_requests`
Lists merge requests for a specific project.

**Parameters**:
- `projectId` (number): The GitLab project ID

### 3. `get_merge_request_details`
Fetches detailed information about a merge request.

**Parameters**:
- `projectId` (number): The GitLab project ID
- `mrIid` (number): The merge request IID (internal ID)

### 4. `add_comment_to_merge_request`
Adds a comment to a merge request.

**Parameters**:
- `projectId` (number): The GitLab project ID
- `mrIid` (number): The merge request IID
- `commentBody` (string): The comment content
- `discussionId` (string, optional): ID of existing discussion to reply to
- `position` (object, optional): Position for inline comments

### 5. `filter_projects_by_name`
Filters GitLab projects by name using a fuzzy, case-insensitive match.

**Parameters**:
- `projectName` (string): The name or partial name of the project to filter by.

## Troubleshooting

### Common Issues

1. **"Cannot find module" errors**: Make sure you've run `npm install` and `npm run build`

2. **Authentication errors**: Verify your `GITLAB_ACCESS_TOKEN` has the necessary permissions:
   - `api` scope for full API access
   - `read_user` scope for user information

3. **Connection errors**: Ensure your `GITLAB_URL` is correct and accessible

4. **Server not responding**: Check that the MCP server process is running and the path in your config is correct

### Debug Mode

To see detailed logs, you can run the server directly:

```bash
export GITLAB_URL="your-url"
export GITLAB_ACCESS_TOKEN="your-token"
node dist/index.js
```

## Development

### Project Structure

- `index.ts`: Main MCP server implementation
- `gitlabOnPremMcp.ts`: GitLab API client
- `gitlab.ts`: Type definitions
- `dist/`: Compiled JavaScript output

### Adding New Features

1. Add new methods to `GitLabOnPremMcp` class
2. Define new tools in the `tools` array in `index.ts`
3. Add corresponding case in the tool handler
4. Rebuild with `npm run build`

## License

ISC
