# MCP GitLab Jira Server

A Model Context Protocol (MCP) server for GitLab and Jira integration. This server allows AI agents like gemini-cli to interact with your GitLab and Jira instances.

## Features

### GitLab
- **Projects**: List all accessible projects or filter them by name.
- **Merge Requests**: List merge requests for a project, get detailed information (including diffs), add comments, and assign reviewers.
- **Files**: Get the content of a specific file at a given SHA.
- **Releases**: List all releases for a project or filter them since a specific version.
- **Users**: List project members, get a user's ID by username, and get user activities.

### Jira
- **Tickets**: Get detailed information about a ticket, get comments, add comments, search for tickets using JQL, create new tickets, get available transitions, update tickets, and transition tickets to a new status.

## Setup

### Prerequisites

- Node.js 18+
- GitLab Personal Access Token with API access
- Jira API Token
- Access to a GitLab instance (on-premise or GitLab.com)
- Access to a Jira instance

### Installation

1. **Clone and build the project:**
   ```bash
   cd mcp-gitlab-jira
   npm install
   npm run build
   ```

2. **Set up environment variables:**
   ```bash
   # GitLab
   export GITLAB_URL="https://your-gitlab-instance.com"
   export GITLAB_ACCESS_TOKEN="your-personal-access-token"

   # Jira
   export ATLASSIAN_SITE_NAME="your-atlassian-site-name"
   export ATLASSIAN_USER_EMAIL="your-email@example.com"
   export ATLASSIAN_API_TOKEN="your-jira-api-token"
   ```

3. **Install globally (optional but recommended)**:
   ```bash
   npm link
   ```
   This allows you to use `mcp-gitlab-jira` command from anywhere.

4. **Test the server manually**:
   ```bash
   # Test that the server starts without errors (if globally linked)
   echo '''{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}''' | mcp-gitlab-jira

   # Or test directly
   node dist/index.js
   ```
   The server should start and log "GitLab/Jira MCP server started" to stderr.

### Using with MCP Clients

#### Configuration for gemini-cli or other MCP clients

Create or update your MCP configuration file (usually `~/.mcp/config.json` or similar):

```json
{
  "mcpServers": {
    "gitlab-jira-mcp": {
      "command": "mcp-gitlab-jira",
      "env": {
        "GITLAB_URL": "https://your-gitlab-instance.com",
        "GITLAB_ACCESS_TOKEN": "your-personal-access-token",
        "ATLASSIAN_SITE_NAME": "your-atlassian-site-name",
        "ATLASSIAN_USER_EMAIL": "your-email@example.com",
        "ATLASSIAN_API_TOKEN": "your-jira-api-token"
      }
    }
  }
}
```

## Available Tools

### GitLab Tools

- `gitlab_get_merge_request_details`: Fetches detailed information about a GitLab Merge Request, including file diffs.
- `gitlab_get_file_content`: Fetches the content of a specific file at a given SHA in a GitLab project.
- `gitlab_add_comment_to_merge_request`: Adds a comment to a GitLab Merge Request. Can be a general comment, a reply to an existing discussion, or an inline comment on a specific line.
- `gitlab_list_merge_requests`: Lists merge requests for a given GitLab project.
- `gitlab_assign_reviewers_to_merge_request`: Assigns reviewers to a GitLab Merge Request.
- `gitlab_list_project_members`: Lists all members (contributors) of a given GitLab project.
- `gitlab_list_project_members_by_project_name`: Lists all members (contributors) of a given GitLab project by project name.
- `gitlab_list_projects_by_name`: Filters GitLab projects by name using a fuzzy, case-insensitive match.
- `gitlab_list_all_projects`: Lists all accessible GitLab projects.
- `gitlab_list_all_releases`: Fetches releases for a given GitLab project.
- `gitlab_list_releases_since_version`: Filters releases for a given GitLab project since a specific version.
- `gitlab_get_user_id_by_username`: Retrieves the GitLab user ID for a given username.
- `gitlab_get_user_activities`: Fetches activities for a given GitLab user by their username, optionally filtered by date.

### Jira Tools

- `jira_get_jira_ticket_details`: Fetches detailed information about a Jira ticket.
- `jira_get_jira_ticket_comments`: Fetches comments for a Jira ticket.
- `jira_add_comment_to_ticket`: Adds a comment to a Jira ticket.
- `jira_search_tickets_by_jql`: Searches for Jira tickets using a JQL (Jira Query Language) string.
- `jira_create_ticket`: Creates a new Jira ticket with given fields.
- `jira_get_available_transitions`: Fetches available transitions for a Jira ticket.
- `jira_update_ticket`: Updates a Jira ticket summary, description, labels.
- `jira_transition_ticket`: Transitions a Jira ticket to a new status.

## Troubleshooting

### Common Issues

1. **"Cannot find module" errors**: Make sure you've run `npm install` and `npm run build`
2. **Authentication errors**: Verify your `GITLAB_ACCESS_TOKEN`, `ATLASSIAN_USER_EMAIL`, and `ATLASSIAN_API_TOKEN` have the necessary permissions.
3. **Connection errors**: Ensure your `GITLAB_URL` and `ATLASSIAN_SITE_NAME` are correct and accessible.
4. **Server not responding**: Check that the MCP server process is running and the path in your config is correct.

### Debug Mode

To see detailed logs, you can run the server directly:

```bash
export GITLAB_URL="your-url"
export GITLAB_ACCESS_TOKEN="your-token"
export ATLASSIAN_SITE_NAME="your-atlassian-site-name"
export ATLASSIAN_USER_EMAIL="your-email@example.com"
export ATLASSIAN_API_TOKEN="your-jira-api-token"
node dist/index.js
```

## Development

### Project Structure

- `src/index.ts`: Main MCP server implementation
- `src/gitlab.service.ts`: GitLab API client
- `src/gitlab.ts`: GitLab type definitions
- `src/jira.service.ts`: Jira API client
- `src/jira.ts`: Jira type definitions
- `dist/`: Compiled JavaScript output

### Adding New Features

1. Add new methods to the `GitLabService` or `JiraService` class.
2. Define new tools in the `allTools` array in `index.ts`.
3. Add a corresponding case in the tool handler in `index.ts`.
4. Rebuild with `npm run build`.

## License

ISC