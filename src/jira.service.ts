import { Version3Client } from 'jira.js';
import {
  JiraConfig,
  JiraTicket,
  JiraComment,
  JiraTransition,
  JiraTicketUpdatePayload,
  JiraField,
} from './jira';

export class JiraService {
  private client: Version3Client;
  private config: JiraConfig;
  private storyPointsFieldId: string | undefined;

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

  private async getFieldId(fieldName: string): Promise<string> {
    const allFields = await this.getAllFields();
    const normalizedFieldName = fieldName
      .toLowerCase()
      .trim()
      .replace(/\s+|_|-/g, ' ');

    const foundField = allFields.find(
      (field) =>
        field.name
          .toLowerCase()
          .trim()
          .replace(/\s+|_|-/g, ' ') === normalizedFieldName,
    );

    if (!foundField) {
      throw new Error(`Could not find a field named "${fieldName}" in Jira.`);
    }
    return foundField.id;
  }

  async updateTicket(
    ticketId: string,
    payload: JiraTicketUpdatePayload,
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
      console.log(`Jira ticket ${ticketId} updated successfully.`);
    } catch (error) {
      console.error(`Error updating Jira ticket ${ticketId}:`, error);
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
          .map((transition) => ({
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
    try {
      const fields = await this.client.issueFields.getFields();
      return fields as JiraField[];
    } catch (error) {
      console.error('Error fetching Jira fields:', error);
      throw error;
    }
  }
}
