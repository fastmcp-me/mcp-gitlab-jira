import { Version3Client } from 'jira.js';
import { levenshteinDistance } from './utils.js';
import {
  JiraConfig,
  JiraTicket,
  JiraComment,
  JiraTransition,
  JiraTicketUpdatePayload,
  JiraField,
  JiraCustomFieldUpdatePayload,
} from './jira';

export class JiraService {
  private client: Version3Client;
  private config: JiraConfig;
  private storyPointsFieldId: string | undefined;
  private allFieldsCache: JiraField[] | undefined;

  constructor(config: JiraConfig) {
    this.config = config;
    this.client = new Version3Client({
      host: config.apiBaseUrl,
      authentication: {
        basic: {
          email: config.userEmail,
          apiToken: config.apiToken,
        },
      },
    });
  }

  

  async getTicketDetails(ticketId: string): Promise<JiraTicket> {
    try {
      const issue = await this.client.issues.getIssue({
        issueIdOrKey: ticketId,
      });

      return issue.fields as JiraTicket;
    } catch (error) {
      console.error(
        `Error fetching Jira ticket details for ${ticketId}:`,
        error,
      );
      throw error;
    }
  }

  async getTicketComments(ticketId: string): Promise<JiraComment[]> {
    try {
      const commentsResponse = await this.client.issueComments.getComments({
        issueIdOrKey: ticketId,
      });

      return (
        commentsResponse.comments?.map((comment: any) => ({
          id: comment.id,
          author: {
            displayName: comment.author.displayName,
            emailAddress: comment.author.emailAddress,
          },
          body: comment.body.content
            ?.map((block: any) =>
              block.content?.map((item: any) => item.text).join(''),
            )
            .join('\n'),
          created: comment.created,
          updated: comment.updated,
        })) || []
      );
    } catch (error) {
      console.error(
        `Error fetching Jira ticket comments for ${ticketId}:`,
        error,
      );
      throw error;
    }
  }

  private async getStoryPointsFieldId(): Promise<string> {
    if (this.storyPointsFieldId) {
      return this.storyPointsFieldId;
    }

    try {
      const fields = await this.getAllFields();
      const storyPointsField = fields.find(
        (field) =>
          field.name
            ?.toLowerCase()
            .trim()
            .replaceAll(' ', '')
            .replaceAll('_', '')
            .replaceAll('-', '') === 'storypoints',
      );

      if (!storyPointsField || !storyPointsField.id) {
        throw new Error(
          'Could not find the Story Points field for this Jira instance.',
        );
      }

      this.storyPointsFieldId = storyPointsField.id;
      return this.storyPointsFieldId;
    } catch (error) {
      console.error('Error fetching Jira fields:', error);
      throw new Error('Could not retrieve custom field ID for Story Points.');
    }
  }

  

  private async getFieldId(fieldName: string): Promise<string> {
    const allFields = await this.getAllFields();
    const normalizedFieldName = fieldName
      .toLowerCase()
      .trim()
      .replace(/\s+|_|-/g, ' ');

    const rankedFields = allFields
      .map((field) => {
        const normalizedCandidateName = field.name
          .toLowerCase()
          .trim()
          .replace(/\s+|_|-/g, ' ');
        const distance = levenshteinDistance(
          normalizedFieldName,
          normalizedCandidateName,
        );
        return { field, distance };
      })
      .sort((a, b) => a.distance - b.distance);

    if (rankedFields.length === 0) {
      throw new Error('No fields found in Jira.');
    }

    const bestMatch = rankedFields[0];

    if (!bestMatch.field.id) {
      throw new Error(`Could not find a field named "${fieldName}" in Jira.`);
    }

    return bestMatch.field.id;
  }

  async updateTicket(
    ticketId: string,
    payload: JiraTicketUpdatePayload,
  ): Promise<void> {
    try {
      const fields: { [key: string]: any } = {};

      if (payload.summary) {
        fields.summary = payload.summary;
      }
      if (payload.labels) {
        fields.labels = payload.labels;
      }
      if (payload.description) {
        fields.description = {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: payload.description }],
            },
          ],
        };
      }
      if (payload.assigneeAccountId) {
        fields.assignee = { accountId: payload.assigneeAccountId };
      }
      if (payload.reporterAccountId) {
        fields.reporter = { accountId: payload.reporterAccountId };
      }
      if (payload.priorityId) {
        fields.priority = { id: payload.priorityId };
      }
      if (payload.fixVersions) {
        fields.fixVersions = payload.fixVersions.map((v) => ({ name: v }));
      }
      if (payload.components) {
        fields.components = payload.components.map((c) => ({ name: c }));
      }
      if (payload.duedate) {
        fields.duedate = payload.duedate;
      }

      await this.client.issues.editIssue({
        issueIdOrKey: ticketId,
        fields,
      });
      console.log(`Jira ticket ${ticketId} updated successfully.`);
    } catch (error) {
      console.error(`Error updating Jira ticket ${ticketId}:`, error);
      throw error;
    }
  }

  async updateCustomFields(
    ticketId: string,
    payload: JiraCustomFieldUpdatePayload,
  ): Promise<void> {
    try {
      const fields: { [key: string]: any } = {};

      for (const key in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          const fieldId = await this.getFieldId(key);
          fields[fieldId] = payload[key];
        }
      }

      await this.client.issues.editIssue({
        issueIdOrKey: ticketId,
        fields,
      });
      console.log(`Jira ticket ${ticketId} custom fields updated successfully.`);
    } catch (error) {
      console.error(`Error updating Jira ticket custom fields ${ticketId}:`, error);
      throw error;
    }
  }

  /**
   * Adds a comment to a Jira ticket.
   */
  async addCommentToTicket(ticketId: string, comment: string): Promise<void> {
    try {
      await this.client.issueComments.addComment({
        issueIdOrKey: ticketId,
        comment: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: comment }],
            },
          ],
        },
      });
      console.log(`Comment added to Jira ticket ${ticketId}.`);
    } catch (error) {
      console.error(`Error adding comment to Jira ticket ${ticketId}:`, error);
      throw error;
    }
  }

  async searchTicketsByJQL(jql: string): Promise<JiraTicket[]> {
    try {
      const searchResults =
        await this.client.issueSearch.searchForIssuesUsingJql({ jql });

      return (
        searchResults.issues?.map((issue: any) => ({
          id: issue.id,
          key: issue.key,
          summary: issue.fields.summary ?? '',
          description: issue.fields.description?.content
            ?.map((block: any) =>
              block.content?.map((item: any) => item.text).join(''),
            )
            .join('\n'),
          status: issue.fields.status.name ?? '',
        })) || []
      );
    } catch (error) {
      console.error(`Error searching Jira tickets with JQL: ${jql}:`, error);
      throw error;
    }
  }

  /**
   * Creates a new Jira ticket using the provided parameters.
   * @param params The createIssue parameters for Jira API.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createTicket(params: any): Promise<void> {
    try {
      if (params.fields) {
        // Jira's description field expects Atlassian Document Format (ADF).
        // If a plain string is provided, or if it's missing, convert it to the ADF structure.
        if (
          typeof params.fields.description === 'string' ||
          !params.fields.description
        ) {
          const descriptionText =
            params.fields.description ||
            params.fields.summary ||
            'not provided by agent';
          params.fields.description = {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: descriptionText }],
              },
            ],
          };
        }
      }
      await this.client.issues.createIssue(params);
      console.log('Jira ticket created successfully.');
    } catch (error) {
      console.error('Error creating Jira ticket:', error);
      throw error;
    }
  }

  async getAvailableTransitions(ticketId: string): Promise<JiraTransition[]> {
    try {
      const transitions = await this.client.issues.getTransitions({
        issueIdOrKey: ticketId,
      });
      return (
        transitions.transitions
          ?.filter((transition) => transition.id && transition.name)
          .map((transition: any) => ({
            id: transition.id!,
            name: transition.name!,
            to: {
              name: transition.to?.name || '',
            },
          })) || []
      );
    } catch (error) {
      console.error(
        `Error fetching available transitions for Jira ticket ${ticketId}:`,
        error,
      );
      throw error;
    }
  }

  async transitionTicket(
    ticketId: string,
    transitionId: string,
  ): Promise<void> {
    try {
      await this.client.issues.doTransition({
        issueIdOrKey: ticketId,
        transition: {
          id: transitionId,
        },
      });
      console.log(
        `Jira ticket ${ticketId} transitioned successfully with transition ID ${transitionId}.`,
      );
    } catch (error) {
      console.error(`Error transitioning Jira ticket ${ticketId}:`, error);
      throw error;
    }
  }

  async getAllFields(): Promise<JiraField[]> {
    if (this.allFieldsCache) {
      return this.allFieldsCache;
    }

    try {
      const fields = await this.client.issueFields.getFields();
      this.allFieldsCache = fields as JiraField[];
      return this.allFieldsCache;
    } catch (error) {
      console.error('Error fetching Jira fields:', error);
      throw error;
    }
  }
}
