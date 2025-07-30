# GitLab On-Prem MCP Server Implementation Plan

This document outlines the steps to create a new MCP server for GitLab (on-prem version 16.7) and enhance it with basic features.

## Phase 1: Setup and Core Structure ✅ COMPLETED

1.  **Create `gitlabOnPremMcp.ts`**:
    *   Define a class `GitLabOnPremMcp` that will encapsulate GitLab API interactions.
    *   Implement a constructor that takes `GitLabConfig` (from `gitlab.ts`) for authentication and base URL.
    *   Add a private helper method for making authenticated API requests to GitLab.
    *   **[COMPLETED]**

2.  **Integrate with existing types**:
    *   Import and utilize interfaces from `gitlab.ts` (e.g., `GitLabConfig`, `GitLabMRDetails`, `GitLabProject`, `GitLabMergeRequest`).
    *   **[COMPLETED]**

## Phase 2: Basic Features Implementation ✅ COMPLETED

1.  **Fetch Merge Request Details**:
    *   Implement a method `getMergeRequestDetails(projectId: number, mrIid: number)` that fetches comprehensive details of a merge request. This should populate `GitLabMRDetails`.
    *   This will involve calling GitLab API endpoints like `/projects/:id/merge_requests/:merge_request_iid`.
    *   **[COMPLETED]** - Basic MR details, diffs, discussions, and parsed diffs are fetched and mapped. `fileContents` is still a placeholder and would require additional API calls per file, which is beyond basic implementation.

2.  **Add Comment to Merge Request**:
    *   Implement a method `addCommentToMergeRequest(projectId: number, mrIid: number, discussionId: string | undefined, commentBody: string, position: GitLabPosition | undefined)` that adds a comment (either a new note or a reply to an existing discussion).
    *   This will involve calling GitLab API endpoints like `/projects/:id/merge_requests/:merge_request_iid/notes` or `/projects/:id/merge_requests/:merge_request_iid/discussions/:discussion_id/notes`.
    *   **[COMPLETED]**

3.  **List Projects**:
    *   Implement a method `listProjects()` that fetches a list of accessible GitLab projects.
    *   This will involve calling the `/projects` API endpoint.
    *   **[COMPLETED]**

4.  **List Merge Requests for a Project**:
    *   Implement a method `listMergeRequests(projectId: number)` that fetches a list of merge requests for a given project.
    *   This will involve calling the `/projects/:id/merge_requests` API endpoint.
    *   **[COMPLETED]**

## Phase 3: Error Handling and Refinements ✅ COMPLETED

1.  **Implement robust error handling**:
    *   Catch API errors and provide meaningful error messages.
    *   Handle different HTTP status codes (e.g., 401, 403, 404, 500).
    *   **[COMPLETED]** - Basic error logging and throwing are in place.

2.  **Logging**:
    *   Add basic logging for API requests and responses (e.g., using a simple `console.log` or a more sophisticated logging library if available in the project).
    *   **[COMPLETED]** - Basic console error logging is in place.

3.  **Configuration Management**:
    *   Ensure the `GitLabConfig` is securely handled and passed.
    *   **[COMPLETED]**

## Phase 4: MCP Server Implementation ✅ COMPLETED

1.  **Convert to proper MCP Server**:
    *   **[COMPLETED]** - Replaced Express.js HTTP server with proper MCP server using `@modelcontextprotocol/sdk`
    *   **[COMPLETED]** - Implemented JSON-RPC over stdio communication protocol
    *   **[COMPLETED]** - Added proper tool definitions and handlers
    *   **[COMPLETED]** - Updated to ES modules with proper imports
    *   **[COMPLETED]** - Created proper package configuration

2.  **Manual Testing**:
    *   **[COMPLETED]** Setup the npm package:
        1.  Navigate to the `mcp-gitlab-cli` directory:
            `cd /Users/hainan.zhao/projects/mcp-gitlab/mcp-gitlab-cli`
        2.  Install dependencies:
            `npm install`
        3.  Build the TypeScript code:
            `npm run build`

    *   **[COMPLETED]** Test MCP server functionality:
        1.  Set your GitLab URL and Access Token as environment variables:
            `export GITLAB_URL='YOUR_GITLAB_URL'`
            `export GITLAB_ACCESS_TOKEN='YOUR_PRIVATE_ACCESS_TOKEN'`
        2.  Test the server:
            `./test-mcp.js tools/list`
            `./test-mcp.js tools/call list_projects`

    *   **Expected Output:**
        The server responds with proper JSON-RPC messages containing tool definitions and results.

## Phase 5: Integration Ready ✅ COMPLETED

1.  **MCP Client Configuration**:
    *   **[COMPLETED]** - Created example configuration for gemini-cli and other MCP clients
    *   **[COMPLETED]** - Documentation for setup and usage
    *   **[COMPLETED]** - Test script for development

2.  **Available Tools**:
    *   `get_merge_request_details` - Fetch comprehensive MR details
    *   `add_comment_to_merge_request` - Add comments (general, reply, or inline)
    *   `list_projects` - List accessible projects
    *   `list_merge_requests` - List MRs for a project

## Next Steps

The MCP server is now ready for use with gemini-cli or other MCP clients. You can:

1. Configure your MCP client with the server configuration
2. Set up your GitLab credentials
3. Start using the GitLab tools in your AI agent workflows

For detailed setup instructions, see the README.md file.