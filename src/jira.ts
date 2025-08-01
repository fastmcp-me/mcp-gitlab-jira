/**
 * Shared types for Jira integration
 */

export interface JiraConfig {
  apiBaseUrl: string;
  userEmail: string;
  apiToken: string;
}

export interface JiraTicket {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface JiraComment {
  id: string;
  author: {
    displayName: string;
    emailAddress: string;
  };
  body: string;
  created: string;
  updated: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    name: string;
  };
}

export interface JiraTicketUpdatePayload {
  [key: string]: any;
}

export interface JiraTicketTransitionPayload {
  transitionId: string;
}

export interface JiraField {
  id: string;
  name: string;
  custom: boolean;
  orderable: boolean;
  navigable: boolean;
  searchable: boolean;
  clauseNames: string[];
  schema: {
    type: string;
    custom?: string;
    customId?: number;
  };
}
