/**
 * Shared types for Jira integration
 */

export interface JiraConfig {
  apiBaseUrl: string;
  userEmail: string;
  apiToken: string;
}

export interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: string;
  // Add other relevant fields as needed
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
