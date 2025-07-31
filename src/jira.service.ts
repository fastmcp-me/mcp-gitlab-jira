import { Version3Client } from 'jira.js';
import { JiraConfig, JiraTicket, JiraComment, JiraTransition } from './jira';

export class JiraService {
  private client: Version3Client;
  private config: JiraConfig;

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

      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary ?? '',
        description: issue.fields.description?.content
          ?.map((block: any) =>
            block.content?.map((item: any) => item.text).join('')
          )
          .join('\n'),
        status: issue.fields.status.name ?? '',
      };
    } catch (error) {
      console.error(`Error fetching Jira ticket details for ${ticketId}:`, error);
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
              block.content?.map((item: any) => item.text).join('')
            )
            .join('\n'),
          created: comment.created,
          updated: comment.updated,
        })) || []
      );
    } catch (error) {
      console.error(`Error fetching Jira ticket comments for ${ticketId}:`, error);
      throw error;
    }
  }

  async addLabelsToTicket(ticketId: string, labels: string[]): Promise<void> {
    try {
      await this.client.issues.editIssue({
        issueIdOrKey: ticketId,
        update: {
          labels: [{ set: labels }],
        },
      });
      console.log(`Labels added to Jira ticket ${ticketId} successfully.`);
    } catch (error) {
      console.error(`Error adding labels to Jira ticket ${ticketId}:`, error);
      throw error;
    }
  }

  async searchTicketsByJQL(jql: string): Promise<JiraTicket[]> {
    try {
      const searchResults = await this.client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({ jql });

      return (
        searchResults.issues?.map((issue: any) => ({
          id: issue.id,
          key: issue.key,
          summary: issue.fields.summary ?? '',
          description: issue.fields.description?.content
            ?.map((block: any) =>
              block.content?.map((item: any) => item.text).join('')
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
   * Creates a new Jira ticket with the given createIssue parameters.
   * @param params The createIssue parameters for Jira API (must include fields object).
   */
  /**
   * Creates a new Jira ticket using the provided parameters.
   * @param params The createIssue parameters for Jira API.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createTicket(params: any): Promise<void> {
    try {
      await this.client.issues.createIssue(params);
      console.log('Jira ticket created successfully.');
    } catch (error) {
      console.error('Error creating Jira ticket:', error);
      throw error;
    }
  }

  async getAvailableTransitions(ticketId: string): Promise<JiraTransition[]> {
    try {
      const transitions = await this.client.issues.getTransitions({ issueIdOrKey: ticketId });
      return (
        transitions.transitions?.filter((transition) => transition.id && transition.name)
          .map((transition) => ({
            id: transition.id!,
            name: transition.name!,
            to: {
              name: transition.to?.name || '',
            },
          })) || []
      );
    } catch (error) {
      console.error(`Error fetching available transitions for Jira ticket ${ticketId}:`, error);
      throw error;
    }
  }
}
