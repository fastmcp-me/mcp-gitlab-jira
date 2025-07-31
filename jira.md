
# Jira Integration Setup

This document outlines the steps to set up the Jira integration for the MCP tool.

## 1. Environment Variables

To connect to your Jira instance, you need to set the following environment variables:

*   `JIRA_API_BASE_URL`: The base URL of your Jira instance (e.g., `https://your-domain.atlassian.net`).
*   `JIRA_USER_EMAIL`: The email address of the Jira user for authentication.
*   `JIRA_API_TOKEN`: An API token generated from your Atlassian account. See [Managing API tokens for your Atlassian account](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/) for instructions.

Example:

```bash
export JIRA_API_BASE_URL="https://your-domain.atlassian.net"
export JIRA_USER_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="your-api-token"
```

## 2. MCP Tools for Jira

Once configured, the following MCP tools will be available for interacting with Jira:

*   `get_jira_ticket_details`: Fetches detailed information about a Jira ticket.
    *   **Input**: `ticketId` (string) - The ID of the Jira ticket (e.g., "ALICE-123").
*   `get_jira_ticket_comments`: Fetches comments for a Jira ticket.
    *   **Input**: `ticketId` (string) - The ID of the Jira ticket.

## 3. Implementation Details

*   `src/jira.ts`: Defines interfaces and types related to Jira.
*   `src/jira.service.ts`: Contains the `JiraService` class, which encapsulates the logic for interacting with the Jira API using `jira.js`.
*   `src/index.ts`: Integrates the `JiraService` and exposes the Jira-related MCP tools.
