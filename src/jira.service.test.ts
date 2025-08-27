import { JiraService } from './jira.service';

// Mock the jira.js client
jest.mock('jira.js', () => ({
  Version3Client: jest.fn().mockImplementation(() => ({
    issues: {
      getIssue: jest.fn(),
    },
    issueFields: {
      getFields: jest.fn(),
    },
  })),
}));

describe('JiraService transformations', () => {
  let jiraService: JiraService;
  let mockClient: any;

  beforeEach(() => {
    jiraService = new JiraService({
      apiBaseUrl: 'https://test.atlassian.net',
      userEmail: 'test@example.com',
      apiToken: 'test-token',
    });
    mockClient = (jiraService as any).client;
  });

  describe('getTicketDetails', () => {
    it('should transform issue fields into flattened format', async () => {
      const mockIssue = {
        id: 'ISSUE-123',
        key: 'PROJ-123',
        fields: {
          summary: 'Test Issue',
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'This is a test description' }],
              },
            ],
          },
          status: { name: 'In Progress' },
          priority: { name: 'High' },
          labels: ['bug', 'frontend'],
          updated: '2023-01-01T00:00:00.000Z',
          created: '2022-12-01T00:00:00.000Z',
          issuetype: { name: 'Bug' },
          assignee: {
            displayName: 'John Doe',
            emailAddress: 'john@example.com',
            accountId: 'user123',
          },
          reporter: {
            displayName: 'Jane Smith',
            emailAddress: 'jane@example.com',
            accountId: 'user456',
          },
          customfield_10001: 'Custom Value',
          customfield_10002: { name: 'Epic Name' },
          customfield_10003: null, // Should be filtered out
          customfield_10004: '', // Should be filtered out
          attachment: [{ filename: 'test.pdf' }], // Should be filtered out
        },
      };

      const mockFields = [
        {
          id: 'customfield_10001',
          name: 'Story Points',
          custom: true,
          orderable: true,
          navigable: true,
          searchable: true,
          clauseNames: ['cf[10001]'],
          schema: { type: 'number' },
        },
        {
          id: 'customfield_10002',
          name: 'Epic Link',
          custom: true,
          orderable: true,
          navigable: true,
          searchable: true,
          clauseNames: ['cf[10002]'],
          schema: { type: 'string' },
        },
      ];

      mockClient.issues.getIssue.mockResolvedValue(mockIssue);
      mockClient.issueFields.getFields.mockResolvedValue(mockFields);

      const result = await jiraService.getTicketDetails('PROJ-123');

      expect(result).toEqual({
        id: 'ISSUE-123',
        key: 'PROJ-123',
        summary: 'Test Issue',
        description: 'This is a test description',
        status: 'In Progress',
        priority: 'High',
        labels: ['bug', 'frontend'],
        updated: '2023-01-01T00:00:00.000Z',
        created: '2022-12-01T00:00:00.000Z',
        issueType: 'Bug',
        assignee: {
          displayName: 'John Doe',
          emailAddress: 'john@example.com',
          accountId: 'user123',
        },
        reporter: {
          displayName: 'Jane Smith',
          emailAddress: 'jane@example.com',
          accountId: 'user456',
        },
        storyPoints: 'Custom Value',
        epicLink: 'Epic Name',
      });

      expect(mockClient.issues.getIssue).toHaveBeenCalledWith({
        issueIdOrKey: 'PROJ-123',
        expand: ['names', 'schema', 'operations', 'editmeta', 'changelog', 'renderedFields'],
      });
    });

    it('should handle null/undefined assignee and reporter', async () => {
      const mockIssue = {
        id: 'ISSUE-124',
        key: 'PROJ-124',
        fields: {
          summary: 'Test Issue Without Assignee',
          description: 'Simple description',
          status: { name: 'Open' },
          priority: { name: 'Medium' },
          labels: [],
          updated: '2023-01-01T00:00:00.000Z',
          created: '2022-12-01T00:00:00.000Z',
          issuetype: { name: 'Task' },
          assignee: null,
          reporter: null,
        },
      };

      mockClient.issues.getIssue.mockResolvedValue(mockIssue);
      mockClient.issueFields.getFields.mockResolvedValue([]);

      const result = await jiraService.getTicketDetails('PROJ-124');

      expect(result.assignee).toBeNull();
      expect(result.reporter).toBeNull();
    });
  });
});