#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { GitLabService } from './gitlab.service.js';
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

const gitlabMcp = new GitLabService(gitlabConfig);

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
        mrUrl: {
          type: 'string',
          description: 'The URL of the GitLab Merge Request.',
        },
      },
      required: ['mrUrl'],
    },
  },
  {
    name: 'add_comment_to_merge_request',
    description: 'Adds a comment to a GitLab Merge Request. Can be a general comment, a reply to an existing discussion, or an inline comment on a specific line.',
    inputSchema: {
      type: 'object',
      properties: {
        mrUrl: {
          type: 'string',
          description: 'The URL of the GitLab Merge Request.',
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
      required: ['mrUrl', 'commentBody'],
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
        projectPath: {
          type: 'string',
          description: 'The path of the GitLab project (e.g., "namespace/project-name").',
        },
      },
      required: ['projectPath'],
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
        const { mrUrl } = args as { mrUrl: string };
        const result = await gitlabMcp.getMergeRequestDetailsFromUrl(mrUrl);
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
        const { mrUrl, commentBody, discussionId, position } = args as {
          mrUrl: string;
          commentBody: string;
          discussionId?: string;
          position?: any;
        };
        const result = await gitlabMcp.addCommentToMergeRequestFromUrl(
          mrUrl,
          commentBody,
          discussionId,
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
        const { projectPath } = args as { projectPath: string };
        const result = await gitlabMcp.listMergeRequests(projectPath);
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
