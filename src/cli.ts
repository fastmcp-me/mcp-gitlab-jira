#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { GitLabOnPremMcp } from './gitlabOnPremMcp.js';
import { GitLabConfig } from './gitlab.js';

// Load GitLab configuration from environment variables
const gitlabUrl = process.env.GITLAB_URL;
const gitlabAccessToken = process.env.GITLAB_ACCESS_TOKEN;

if (!gitlabUrl || !gitlabAccessToken) {
  console.error('Error: GITLAB_URL and GITLAB_ACCESS_TOKEN environment variables must be set.');
  process.exit(1);
}

const gitlabConfig: GitLabConfig = {
  url: gitlabUrl,
  accessToken: gitlabAccessToken,
};

const gitlabMcp = new GitLabOnPremMcp(gitlabConfig);

// Create the MCP server
const server = new Server(
  {
    name: 'gitlab-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define the tools
const tools: Tool[] = [
  {
    name: 'get_merge_request_details',
    description: 'Fetches detailed information about a GitLab Merge Request, including file diffs, discussions, and existing feedback.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'number',
          description: 'The ID of the GitLab project.',
        },
        mrIid: {
          type: 'number',
          description: 'The IID (internal ID) of the Merge Request.',
        },
      },
      required: ['projectId', 'mrIid'],
    },
  },
  {
    name: 'add_comment_to_merge_request',
    description: 'Adds a comment to a GitLab Merge Request. Can be a general comment, a reply to an existing discussion, or an inline comment on a specific line.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'number',
          description: 'The ID of the GitLab project.',
        },
        mrIid: {
          type: 'number',
          description: 'The IID (internal ID) of the Merge Request.',
        },
        commentBody: {
          type: 'string',
          description: 'The content of the comment.',
        },
        discussionId: {
          type: 'string',
          description: 'Optional: The ID of an existing discussion to reply to.',
        },
        position: {
          type: 'object',
          description: 'Optional: Position object for inline comments, specifying file paths, SHAs, and line numbers.',
          properties: {
            base_sha: { type: 'string' },
            start_sha: { type: 'string' },
            head_sha: { type: 'string' },
            position_type: { type: 'string' },
            old_path: { type: 'string' },
            new_path: { type: 'string' },
            new_line: { type: 'number' },
            old_line: { type: 'number' },
          },
        },
      },
      required: ['projectId', 'mrIid', 'commentBody'],
    },
  },
  {
    name: 'list_projects',
    description: 'Lists all accessible GitLab projects.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_merge_requests',
    description: 'Lists merge requests for a given GitLab project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'number',
          description: 'The ID of the GitLab project.',
        },
      },
      required: ['projectId'],
    },
  },
];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_merge_request_details': {
        const { projectId, mrIid } = args as { projectId: number; mrIid: number };
        const result = await gitlabMcp.getMergeRequestDetails(projectId, mrIid);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'add_comment_to_merge_request': {
        const { projectId, mrIid, commentBody, discussionId, position } = args as {
          projectId: number;
          mrIid: number;
          commentBody: string;
          discussionId?: string;
          position?: any;
        };
        const result = await gitlabMcp.addCommentToMergeRequest(
          projectId,
          mrIid,
          discussionId,
          commentBody,
          position
        );
        return {
          content: [
            {
              type: 'text',
              text: `Comment added successfully: ${JSON.stringify(result)}`,
            },
          ],
        };
      }

      case 'list_projects': {
        const result = await gitlabMcp.listProjects();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_merge_requests': {
        const { projectId } = args as { projectId: number };
        const result = await gitlabMcp.listMergeRequests(projectId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new Error(`Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GitLab MCP server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
