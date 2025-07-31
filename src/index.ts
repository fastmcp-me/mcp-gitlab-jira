#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolRequest,
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
// Define the tools
const tools: Tool[] = [
  {
    name: 'get_merge_request_details',
    description: 'Fetches detailed information about a GitLab Merge Request, including file diffs.',
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
    name: 'get_merge_request_discussions',
    description: 'Fetches discussions for a GitLab Merge Request.',
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
    name: 'get_file_content',
    description: 'Fetches the content of a specific file at a given SHA in a GitLab project.',
    inputSchema: {
      type: 'object',
      properties: {
        mrUrl: {
          type: 'string',
          description: 'The URL of the GitLab Merge Request (used to derive project path).',
        },
        filePath: {
          type: 'string',
          description: 'The path of the file to fetch.',
        },
        sha: {
          type: 'string',
          description: 'The SHA of the commit or branch to fetch the file from.',
        },
      },
      required: ['mrUrl', 'filePath', 'sha'],
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
  {
    name: 'assign_reviewers_to_merge_request',
    description: 'Assigns reviewers to a GitLab Merge Request.',
    inputSchema: {
      type: 'object',
      properties: {
        mrUrl: {
          type: 'string',
          description: 'The URL of the GitLab Merge Request.',
        },
        reviewerIds: {
          type: 'array',
          items: {
            type: 'number',
          },
          description: 'An array of GitLab user IDs to assign as reviewers.',
        },
      },
      required: ['mrUrl', 'reviewerIds'],
    },
  },
  {
    name: 'list_project_members',
    description: 'Lists all members (contributors) of a given GitLab project.',
    inputSchema: {
      type: 'object',
      properties: {
        mrUrl: {
          type: 'string',
          description: 'The URL of a GitLab Merge Request within the project.',
        },
      },
      required: ['mrUrl'],
    },
  },
  {
    name: 'list_project_members_by_project_name',
    description: 'Lists all members (contributors) of a given GitLab project by project name.',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: {
          type: 'string',
          description: 'The name of the GitLab project.',
        },
      },
      required: ['projectName'],
    },
  },
  {
    name: 'list_projects_by_name',
    description: 'Filters GitLab projects by name using a fuzzy, case-insensitive match.',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: {
          type: 'string',
          description: 'The name or partial name of the project to filter by.',
        },
      },
      required: ['projectName'],
    },
  },
  {
    name: 'list_all_projects',
    description: 'Lists all accessible GitLab projects. (Try to use list_projects_by_name as it is more efficient)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

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

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
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

      case 'get_merge_request_discussions': {
        const { mrUrl } = args as { mrUrl: string };
        const result = await gitlabMcp.getMergeRequestDiscussionsFromUrl(mrUrl);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_file_content': {
        const { mrUrl, filePath, sha } = args as { mrUrl: string; filePath: string; sha: string };
        const result = await gitlabMcp.getFileContentFromMrUrl(mrUrl, filePath, sha);
        return {
          content: [
            {
              type: 'text',
              text: result,
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

      case 'assign_reviewers_to_merge_request': {
        const { mrUrl, reviewerIds } = args as {
          mrUrl: string;
          reviewerIds: number[];
        };
        const result = await gitlabMcp.assignReviewersToMergeRequestFromUrl(
          mrUrl,
          reviewerIds
        );
        return {
          content: [
            {
              type: 'text',
              text: `Reviewers assigned successfully: ${JSON.stringify(
                result
              )}`,
            },
          ],
        };
      }

      case 'list_project_members': {
        const { mrUrl } = args as { mrUrl: string };
        const result = await gitlabMcp.listProjectMembersFromMrUrl(mrUrl);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_project_members_by_project_name': {
        const { projectName } = args as { projectName: string };
        const result = await gitlabMcp.listProjectMembersByProjectName(
          projectName
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_projects_by_name': {
        const { projectName } = args as { projectName: string };
        const result = await gitlabMcp.filterProjectsByName(projectName);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_all_projects': {
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