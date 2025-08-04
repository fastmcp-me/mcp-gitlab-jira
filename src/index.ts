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
import { GitLabConfig, GitLabPosition } from './gitlab.js';
import { JiraService } from './jira.service.js';
import { levenshteinDistance } from './utils.js';
import {
  JiraConfig,
  JiraTicketUpdatePayload,
  JiraCustomFieldUpdatePayload,
} from './jira.js';

// Load GitLab configuration from environment variables
const gitlabUrl = process.env.GITLAB_URL;
const gitlabAccessToken = process.env.GITLAB_ACCESS_TOKEN;

let gitlabService: GitLabService | undefined;
try {
  if (gitlabUrl && gitlabAccessToken) {
    const gitlabConfig: GitLabConfig = {
      url: gitlabUrl,
      accessToken: gitlabAccessToken,
    };
    gitlabService = new GitLabService(gitlabConfig);
    console.error('GitLab service initialized');
  } else {
    console.warn(
      'Warning: GITLAB_URL and GITLAB_ACCESS_TOKEN environment variables are not set. GitLab tools will be unavailable.',
    );
  }
} catch (error) {
  console.error('Error initializing GitLab service:', error);
}

// Load Jira configuration from environment variables
const jiraApiBaseUrl = process.env.ATLASSIAN_SITE_NAME;
const jiraUserEmail = process.env.ATLASSIAN_USER_EMAIL;
const jiraApiToken = process.env.ATLASSIAN_API_TOKEN;

let jiraService: JiraService | undefined;
try {
  if (jiraApiBaseUrl && jiraUserEmail && jiraApiToken) {
    const jiraConfig: JiraConfig = {
      apiBaseUrl: jiraApiBaseUrl,
      userEmail: jiraUserEmail,
      apiToken: jiraApiToken,
    };
    jiraService = new JiraService(jiraConfig);
    console.error('Jira service initialized');
  } else {
    console.warn(
      'Warning: ATLASSIAN_SITE_NAME, ATLASSIAN_USER_EMAIL, and ATLASSIAN_API_TOKEN environment variables are not set. Jira tools will be unavailable.',
    );
  }
} catch (error) {
  console.error('Error initializing Jira service:', error);
}

// Define all possible tools
const allTools: Tool[] = [
  {
    name: 'gitlab_get_merge_request_details',
    description:
      'Fetches detailed information about a GitLab Merge Request, including file diffs.',
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
    name: 'gitlab_get_file_content',
    description:
      'Fetches the content of a specific file at a given SHA in a GitLab project.',
    inputSchema: {
      type: 'object',
      properties: {
        mrUrl: {
          type: 'string',
          description:
            'The URL of the GitLab Merge Request (used to derive project path).',
        },
        filePath: {
          type: 'string',
          description: 'The path of the file to fetch.',
        },
        sha: {
          type: 'string',
          description:
            'The SHA of the commit or branch to fetch the file from.',
        },
      },
      required: ['mrUrl', 'filePath', 'sha'],
    },
  },
  {
    name: 'gitlab_add_comment_to_merge_request',
    description:
      'Adds a comment to a GitLab Merge Request. Can be a general comment, a reply to an existing discussion, or an inline comment on a specific line.',
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
          description:
            'Optional: The ID of an existing discussion to reply to.',
        },
        position: {
          type: 'object',
          description:
            'Optional: Position object for inline comments, specifying file paths, SHAs, and line numbers.',
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
    name: 'gitlab_list_merge_requests',
    description: 'Lists merge requests for a given GitLab project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description:
            'The path of the GitLab project (e.g., "namespace/project-name").',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'gitlab_assign_reviewers_to_merge_request',
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
    name: 'gitlab_list_project_members',
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
    name: 'gitlab_list_project_members_by_project_name',
    description:
      'Lists all members (contributors) of a given GitLab project by project name.',
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
    name: 'gitlab_list_projects_by_name',
    description:
      'Filters GitLab projects by name using a fuzzy, case-insensitive match.',
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
    name: 'gitlab_list_all_projects',
    description:
      'Lists all accessible GitLab projects. (Try to use list_projects_by_name as it is more efficient)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'gitlab_list_all_releases',
    description: 'Fetches releases for a given GitLab project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description:
            'The path of the GitLab project (e.g., "namespace/project-name").',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'gitlab_list_releases_since_version',
    description:
      'Filters releases for a given GitLab project since a specific version.',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: {
          type: 'string',
          description: 'The name or partial name of the GitLab project.',
        },
        sinceVersion: {
          type: 'string',
          description: 'The version to filter releases since (e.g., "1.0.0").',
        },
      },
      required: ['projectName', 'sinceVersion'],
    },
  },
  {
    name: 'gitlab_get_user_id_by_username',
    description: 'Retrieves the GitLab user ID for a given username.',
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'The username of the GitLab user.',
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'gitlab_get_user_activities',
    description:
      'Fetches activities for a given GitLab user by their username, optionally filtered by date.',
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'The username of the GitLab user.',
        },
        sinceDate: {
          type: 'string',
          format: 'date',
          description:
            'Optional: Activities since this date (YYYY-MM-DD). Defaults to 1 day ago if not provided.',
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'jira_get_jira_ticket_details',
    description: 'Fetches detailed information about a Jira ticket.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'The ID of the Jira ticket (e.g., "JIRA-123").',
        },
      },
      required: ['ticketId'],
    },
  },
  {
    name: 'jira_get_jira_ticket_comments',
    description: 'Fetches comments for a Jira ticket.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'The ID of the Jira ticket.',
        },
      },
      required: ['ticketId'],
    },
  },
  {
    name: 'jira_add_comment_to_ticket',
    description: 'Adds a comment to a Jira ticket.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'The ID of the Jira ticket.',
        },
        comment: {
          type: 'string',
          description: 'The comment to add to the ticket.',
        },
      },
      required: ['ticketId', 'comment'],
    },
  },
  {
    name: 'jira_search_tickets_by_jql',
    description:
      'Searches for Jira tickets using a JQL (Jira Query Language) string.',
    inputSchema: {
      type: 'object',
      properties: {
        jql: {
          type: 'string',
          description: 'The JQL query string.',
        },
      },
      required: ['jql'],
    },
  },
  {
    name: 'jira_create_ticket',
    description: 'Creates a new Jira ticket with given fields.',
    inputSchema: {
      type: 'object',
      properties: {
        fields: {
          type: 'object',
          description: 'Jira createIssue fields payload.',
        },
      },
      required: ['fields'],
    },
  },
  {
    name: 'jira_get_available_transitions',
    description: 'Fetches available transitions for a Jira ticket.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'The ID of the Jira ticket (e.g., "JIRA-123").',
        },
      },
      required: ['ticketId'],
    },
  },
  {
    name: 'jira_update_ticket',
    description: 'Updates a Jira ticket with standard fields like summary, description, labels, and story points.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'The ID or key of the Jira ticket to update.',
        },
        payload: {
          type: 'object',
          description: 'An object containing the fields to update.',
          properties: {
            summary: { type: 'string', description: 'The new summary for the ticket.' },
            description: { type: 'string', description: 'The new description for the ticket.' },
            labels: { type: 'array', items: { type: 'string' }, description: 'The labels to set on the ticket.' },
            assigneeAccountId: { type: 'string', description: 'The account ID of the new assignee.' },
            reporterAccountId: { type: 'string', description: 'The account ID of the new reporter.' },
            priorityId: { type: 'string', description: 'The ID of the new priority.' },
            fixVersions: { type: 'array', items: { type: 'string' }, description: 'The names of the fix versions.' },
            components: { type: 'array', items: { type: 'string' }, description: 'The names of the components.' },
            duedate: { type: 'string', description: 'The new due date in YYYY-MM-DD format.' },
          },
        },
      },
      required: ['ticketId', 'payload'],
    },
  },
  {
    name: 'jira_update_custom_fields',
    description: 'Updates custom fields on a Jira ticket.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'The ID or key of the Jira ticket to update.',
        },
        payload: {
          type: 'object',
          description: 'An object containing the custom fields to update. The keys of the object are the field names, and the values are the new values.',
        },
      },
      required: ['ticketId', 'payload'],
    },
  },
  {
    name: 'jira_transition_ticket',
    description: 'Transitions a Jira ticket to a new status by name.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'The ID or key of the Jira ticket to transition.',
        },
        statusName: {
          type: 'string',
          description: 'The name of the status to transition to. The tool will find the closest match.',
        },
      },
      required: ['ticketId', 'statusName'],
    },
  },
  {
    name: 'jira_get_all_fields',
    description: 'Fetches the list of all fields from Jira.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Filter tools based on service availability
const availableTools = allTools.filter((tool) => {
  if (tool.name.startsWith('gitlab_')) {
    return !!gitlabService;
  }
  if (tool.name.startsWith('jira_')) {
    return !!jiraService;
  }
  return true;
});

// Initialize the MCP server
const server = new Server(
  { name: 'gitlab-jira-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: availableTools };
});

// Handle tool calls
server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'gitlab_get_merge_request_details': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const { mrUrl } = args as { mrUrl: string };
          const result =
            await gitlabService.getMergeRequestDetailsFromUrl(mrUrl);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'gitlab_get_file_content': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const { mrUrl, filePath, sha } = args as {
            mrUrl: string;
            filePath: string;
            sha: string;
          };
          const result = await gitlabService.getFileContentFromMrUrl(
            mrUrl,
            filePath,
            sha,
          );
          return {
            content: [
              {
                type: 'text',
                text: result,
              },
            ],
          };
        }

        case 'gitlab_add_comment_to_merge_request': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const { mrUrl, commentBody, discussionId, position } = args as {
            mrUrl: string;
            commentBody: string;
            discussionId?: string;
            position?: GitLabPosition;
          };
          const result = await gitlabService.addCommentToMergeRequestFromUrl(
            mrUrl,
            commentBody,
            discussionId,
            position,
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

        case 'gitlab_list_merge_requests': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const { projectPath } = args as { projectPath: string };
          const result = await gitlabService.listMergeRequests(projectPath);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'gitlab_assign_reviewers_to_merge_request': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const { mrUrl, reviewerIds } = args as {
            mrUrl: string;
            reviewerIds: number[];
          };
          const result =
            await gitlabService.assignReviewersToMergeRequestFromUrl(
              mrUrl,
              reviewerIds,
            );
          return {
            content: [
              {
                type: 'text',
                text: `Reviewers assigned successfully: ${JSON.stringify(
                  result,
                )}`,
              },
            ],
          };
        }

        case 'gitlab_list_project_members': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const { mrUrl } = args as { mrUrl: string };
          const result = await gitlabService.listProjectMembersFromMrUrl(mrUrl);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'gitlab_list_project_members_by_project_name': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const { projectName } = args as { projectName: string };
          const result =
            await gitlabService.listProjectMembersByProjectName(projectName);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'gitlab_list_projects_by_name': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const { projectName } = args as { projectName: string };
          const result = await gitlabService.filterProjectsByName(projectName);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'gitlab_list_all_projects': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const result = await gitlabService.listProjects();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'gitlab_list_all_releases': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const { projectPath } = args as { projectPath: string };
          const result = await gitlabService.getReleases(projectPath);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'gitlab_list_releases_since_version': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const { projectName, sinceVersion } = args as {
            projectName: string;
            sinceVersion: string;
          };
          const projects =
            await gitlabService.filterProjectsByName(projectName);
          if (projects.length === 0) {
            throw new Error(`No project found with name: ${projectName}`);
          }
          const projectPath = projects[0].path_with_namespace;
          const result = await gitlabService.filterReleasesSinceVersion(
            projectPath,
            sinceVersion,
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

        case 'gitlab_get_user_id_by_username': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const { username } = args as { username: string };
          const userId = await gitlabService.getUserIdByUsername(username);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ userId }, null, 2),
              },
            ],
          };
        }

        case 'gitlab_get_user_activities': {
          if (!gitlabService) {
            throw new Error('GitLab service is not initialized.');
          }
          const { username, sinceDate } = args as {
            username: string;
            sinceDate?: string;
          };
          const userId = await gitlabService.getUserIdByUsername(username);
          let activities;
          if (sinceDate) {
            activities = await gitlabService.getUserActivities(
              userId,
              new Date(sinceDate),
            );
          } else {
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            activities = await gitlabService.getUserActivities(
              userId,
              oneDayAgo,
            );
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(activities, null, 2),
              },
            ],
          };
        }

        case 'jira_get_jira_ticket_details': {
          if (!jiraService) {
            throw new Error('Jira service is not initialized.');
          }
          const { ticketId } = args as { ticketId: string };
          const result = await jiraService.getTicketDetails(ticketId);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'jira_get_jira_ticket_comments': {
          if (!jiraService) {
            throw new Error('Jira service is not initialized.');
          }
          const { ticketId } = args as { ticketId: string };
          const result = await jiraService.getTicketComments(ticketId);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'jira_add_comment_to_ticket': {
          if (!jiraService) {
            throw new Error('Jira service is not initialized.');
          }
          const { ticketId, comment } = args as {
            ticketId: string;
            comment: string;
          };
          await jiraService.addCommentToTicket(ticketId, comment);
          return {
            content: [
              {
                type: 'text',
                text: `Comment added to Jira ticket ${ticketId} successfully.`,
              },
            ],
          };
        }

        case 'jira_search_tickets_by_jql': {
          if (!jiraService) {
            throw new Error('Jira service is not initialized.');
          }
          const { jql } = args as { jql: string };
          const result = await jiraService.searchTicketsByJQL(jql);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'jira_create_ticket': {
            if (!jiraService) {
                throw new Error('Jira service is not initialized.');
            }
            const { fields } = args as { fields: any };
            await jiraService.createTicket(fields);
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Jira ticket created successfully.',
                    },
                ],
            };
        }

        case 'jira_get_available_transitions': {
          if (!jiraService) {
            throw new Error('Jira service is not initialized.');
          }
          const { ticketId } = args as { ticketId: string };
          const result = await jiraService.getAvailableTransitions(ticketId);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'jira_update_ticket': {
          if (!jiraService) {
            throw new Error('Jira service is not initialized.');
          }
          const { ticketId, payload } = args as {
            ticketId: string;
            payload: JiraTicketUpdatePayload;
          };
          await jiraService.updateTicket(ticketId, payload);
          return {
            content: [
              {
                type: 'text',
                text: `Ticket ${ticketId} updated successfully.`,
              },
            ],
          };
        }

        case 'jira_update_custom_fields': {
          if (!jiraService) {
            throw new Error('Jira service is not initialized.');
          }
          const { ticketId, payload } = args as {
            ticketId: string;
            payload: JiraCustomFieldUpdatePayload;
          };
          await jiraService.updateCustomFields(ticketId, payload);
          return {
            content: [
              {
                type: 'text',
                text: `Custom fields for ticket ${ticketId} updated successfully.`,
              },
            ],
          };
        }

        case 'jira_transition_ticket': {
          if (!jiraService) {
            throw new Error('Jira service is not initialized.');
          }
          const { ticketId, statusName } = args as {
            ticketId: string;
            statusName: string;
          };
          const availableTransitions = await jiraService.getAvailableTransitions(ticketId);
          if (availableTransitions.length === 0) {
            throw new Error(`No available transitions for ticket ${ticketId}.`);
          }

          const bestMatch = availableTransitions.reduce(
            (best: { distance: number; transition: any }, transition: any) => {
              const distance = levenshteinDistance(statusName, transition.name);
              if (distance < best.distance) {
                return { distance, transition };
              }
              return best;
            },
            { distance: Infinity, transition: availableTransitions[0] },
          );

          await jiraService.transitionTicket(ticketId, bestMatch.transition.id);
          return {
            content: [
              {
                type: 'text',
                text: `Ticket ${ticketId} transitioned to ${bestMatch.transition.name} successfully.`,
              },
            ],
          };
        }

        case 'jira_get_all_fields': {
          if (!jiraService) {
            throw new Error('Jira service is not initialized.');
          }
          const result = await jiraService.getAllFields();
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
      throw new Error(
        `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GitLab/Jira MCP server started');
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});