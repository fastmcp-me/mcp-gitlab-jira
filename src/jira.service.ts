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
  JiraSprint,
  JiraBoard,
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

  

  /**
   * Transform Jira issue fields into a flattened, user-friendly format
   */
  private async transformIssueFields(issue: any, allFields: JiraField[]): Promise<JiraTicket> {
    const fields = issue.fields || {};
    const fieldMap = new Map<string, string>();
    
    // Create a mapping from field ID to display name
    allFields.forEach(field => {
      fieldMap.set(field.id, field.name);
    });

    // Start with core fields that are always present
    const result: JiraTicket = {
      id: issue.id ?? '',
      key: issue.key ?? '',
      summary: fields.summary ?? '',
      description: this.extractDescription(fields.description),
      status: fields.status?.name ?? '',
      assignee: this.extractUser(fields.assignee),
      priority: fields.priority?.name ?? '',
      labels: fields.labels || [],
      updated: fields.updated ?? '',
      created: fields.created ?? '',
      issueType: fields.issuetype?.name ?? '',
      reporter: this.extractUser(fields.reporter)
    };

    // Add other system and custom fields
    Object.keys(fields).forEach(fieldId => {
      const fieldValue = fields[fieldId];
      const fieldName = fieldMap.get(fieldId) || fieldId;
      
      // Skip if already handled above or if value is empty/null
      if (this.shouldSkipField(fieldId, fieldValue)) {
        return;
      }

      // Transform the field name to be more user-friendly
      const friendlyFieldName = this.transformFieldName(fieldName);
      
      // Transform the field value to be more readable
      const transformedValue = this.transformFieldValue(fieldValue);
      
      if (transformedValue !== null && transformedValue !== undefined) {
        result[friendlyFieldName] = transformedValue;
      }
    });

    return result;
  }

  /**
   * Extract description from various formats
   */
  private extractDescription(description: any): string {
    if (!description) return '';
    
    if (typeof description === 'string') {
      return description;
    }
    
    if (description.content) {
      // Handle Atlassian Document Format (ADF)
      return this.extractTextFromADF(description.content);
    }
    
    return 'Description available (complex format)';
  }

  /**
   * Extract text content from Atlassian Document Format
   */
  private extractTextFromADF(content: any[]): string {
    if (!Array.isArray(content)) return '';
    
    return content
      .map(block => {
        if (block.type === 'paragraph' && block.content) {
          return block.content
            .map((item: any) => item.text || '')
            .join('');
        }
        return '';
      })
      .filter(text => text.trim().length > 0)
      .join('\n');
  }

  /**
   * Extract user information from user objects
   */
  private extractUser(user: any): { displayName: string; emailAddress: string; accountId: string } | null {
    if (!user) return null;
    
    return {
      displayName: user.displayName ?? '',
      emailAddress: user.emailAddress ?? '',
      accountId: user.accountId ?? ''
    };
  }

  /**
   * Determine if a field should be skipped
   */
  private shouldSkipField(fieldId: string, fieldValue: any): boolean {
    // Skip core fields already handled
    const coreFields = [
      'id', 'key', 'summary', 'description', 'status', 'assignee', 
      'priority', 'labels', 'updated', 'created', 'issuetype', 'reporter'
    ];
    
    if (coreFields.includes(fieldId)) {
      return true;
    }

    // Skip fields that are likely not useful for AI
    const skipFields = [
      'attachment', 'attachments', 'thumbnail', 'avatarUrls', 'avatar',
      'worklog', 'timetracking', 'aggregatetimetracking',
      'timeestimate', 'aggregatetimeestimate', 'timeoriginalestimate',
      'aggregatetimeoriginalestimate', 'timespent', 'aggregatetimespent',
      'workratio', 'progress', 'aggregateprogress', 'lastViewed',
      'issuelinks', 'subtasks', 'versions',
      // Service desk related fields that often contain errors
      'timeToCloseAfterResolution', 'timeToReviewNormalChange', 
      'timeToFirstResponse', 'timeToResolution', 'timeToDone',
      'timeToTriageNormalChange', 'restrictTo'
    ];
    
    if (skipFields.includes(fieldId)) {
      return true;
    }

    // Skip empty values
    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      return true;
    }

    // Skip empty arrays
    if (Array.isArray(fieldValue) && fieldValue.length === 0) {
      return true;
    }

    // Skip empty objects
    if (typeof fieldValue === 'object' && !Array.isArray(fieldValue) && Object.keys(fieldValue).length === 0) {
      return true;
    }

    // Skip fields that contain error messages
    if (typeof fieldValue === 'string' && fieldValue.includes('errorMessage')) {
      return true;
    }

    // Skip objects that contain error messages
    if (typeof fieldValue === 'object' && fieldValue.errorMessage) {
      return true;
    }

    return false;
  }

  /**
   * Transform field names to be more user-friendly
   */
  private transformFieldName(fieldName: string): string {
    // Remove common prefixes/suffixes that are not user-friendly
    let transformed = fieldName
      .replace(/^(customfield_\d+|cf_)/i, '') // Remove custom field prefixes
      .replace(/\s*\[.*\]$/, '') // Remove bracketed suffixes
      .trim();

    // Convert to camelCase if it's not already
    if (transformed.includes(' ') || transformed.includes('_') || transformed.includes('-')) {
      transformed = transformed
        .toLowerCase()
        .replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase())
        .replace(/^(.)/, (_, char) => char.toLowerCase());
    }

    // Handle some common field mappings
    const fieldMappings: { [key: string]: string } = {
      'storypoints': 'storyPoints',
      'fixversion': 'fixVersions',
      'fixversions': 'fixVersions',
      'component': 'components',
      'duedate': 'dueDate',
      'resolutiondate': 'resolutionDate',
      'lastviewed': 'lastViewed',
      'timespent': 'timeSpent',
      'timeestimate': 'timeEstimate',
      'timeoriginalestimate': 'originalEstimate',
      'issuecolor': 'issueColor',
      'issuetype': 'issueType'
    };

    return fieldMappings[transformed.toLowerCase()] || transformed;
  }

  /**
   * Transform field values to be more readable
   */
  private transformFieldValue(fieldValue: any): any {
    if (fieldValue === null || fieldValue === undefined) {
      return null;
    }

    // Handle arrays
    if (Array.isArray(fieldValue)) {
      return fieldValue
        .map(item => this.transformSingleValue(item))
        .filter(item => item !== null && item !== undefined);
    }

    return this.transformSingleValue(fieldValue);
  }

  /**
   * Transform a single field value
   */
  private transformSingleValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    // Handle string values (including JSON strings that should be parsed)
    if (typeof value === 'string') {
      // Check if it's a JSON string that contains error messages
      if (value.includes('errorMessage') || value.includes('service project you are trying to view does not exist')) {
        return null; // Skip error messages
      }
      
      // Try to parse JSON strings for better representation
      if (value.startsWith('{') && value.endsWith('}')) {
        try {
          const parsed = JSON.parse(value);
          return this.transformSingleValue(parsed);
        } catch {
          // If parsing fails, return the original string
          return value;
        }
      }
      
      return value;
    }

    // Handle objects with name property (common in Jira)
    if (typeof value === 'object' && value.name) {
      return value.name;
    }

    // Handle objects with displayName property
    if (typeof value === 'object' && value.displayName) {
      return value.displayName;
    }

    // Handle objects with value property
    if (typeof value === 'object' && value.value) {
      return value.value;
    }

    // Handle user objects
    if (typeof value === 'object' && value.accountId) {
      return value.displayName || value.emailAddress || value.accountId;
    }

    // Handle version objects
    if (typeof value === 'object' && value.name && value.released !== undefined) {
      return value.name;
    }

    // Handle parent/epic link objects
    if (typeof value === 'object' && value.key && value.fields) {
      const summary = value.fields.summary || '';
      const status = value.fields.status?.name || '';
      return `${value.key}: ${summary}${status ? ` (${status})` : ''}`;
    }

    // Handle objects that contain error messages
    if (typeof value === 'object' && value.errorMessage) {
      return null; // Skip objects with error messages
    }

    // Handle complex objects
    if (typeof value === 'object') {
      // Skip objects that look like they contain system metadata
      const systemKeys = ['self', 'id', 'iconUrl', 'avatarUrls', 'projectId'];
      const hasOnlySystemKeys = Object.keys(value).every(key => systemKeys.includes(key));
      
      if (hasOnlySystemKeys) {
        return null;
      }

      // Handle objects with key-value pairs that might be useful
      const keys = Object.keys(value);
      if (keys.length === 1 && (keys[0] === 'key' || keys[0] === 'name' || keys[0] === 'value')) {
        return value[keys[0]];
      }

      // For complex objects with multiple properties, create a readable summary
      const importantKeys = ['key', 'name', 'summary', 'status', 'value', 'displayName'];
      const importantData: { [key: string]: any } = {};
      
      for (const key of importantKeys) {
        if (value[key] !== undefined && value[key] !== null) {
          importantData[key] = value[key];
        }
      }

      // If we found important data, return a clean object
      if (Object.keys(importantData).length > 0) {
        return importantData;
      }

      // Otherwise, skip this field
      return null;
    }

    return value;
  }

  async getTicketDetails(ticketId: string): Promise<JiraTicket> {
    try {
      // Fetch the issue with all fields
      const issue = await this.client.issues.getIssue({
        issueIdOrKey: ticketId,
        expand: ['names', 'schema', 'operations', 'editmeta', 'changelog', 'renderedFields']
      });

      // Get field metadata for custom field name mapping
      const allFields = await this.getAllFields();
      
      // Transform the fields into a flattened, user-friendly format
      const transformedTicket = await this.transformIssueFields(issue, allFields);

      return transformedTicket;
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
      console.error(`Jira ticket ${ticketId} updated successfully.`);
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
      const allFields = await this.getAllFields();
      const fieldMap = new Map<string, JiraField>();
      
      // Create a mapping from field name/ID to field metadata
      allFields.forEach(field => {
        fieldMap.set(field.id, field);
        fieldMap.set(field.name, field);
      });

      for (const key in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          const fieldId = await this.getFieldId(key);
          const fieldMetadata = fieldMap.get(fieldId) || fieldMap.get(key);
          const value = payload[key];
          
          // Transform the value based on field type
          fields[fieldId] = this.transformValueForField(value, fieldMetadata);
        }
      }

      await this.client.issues.editIssue({
        issueIdOrKey: ticketId,
        fields,
      });
      console.error(`Jira ticket ${ticketId} custom fields updated successfully.`);
    } catch (error) {
      console.error(`Error updating Jira ticket custom fields ${ticketId}:`, error);
      throw error;
    }
  }

  /**
   * Transform values based on field type for proper JIRA API format
   */
  private transformValueForField(value: any, fieldMetadata?: JiraField): any {
    if (!fieldMetadata || !fieldMetadata.schema) {
      return value;
    }

    const schema = fieldMetadata.schema;
    const fieldType = schema.type;
    const customType = schema.custom;

    // Handle Sprint fields (Greenhopper/Jira Software)
    if (customType === 'com.pyxis.greenhopper.jira:gh-sprint') {
      if (typeof value === 'number') {
        // Sprint ID - return as array of numbers
        return [value];
      } else if (typeof value === 'string') {
        // Sprint name or ID string - try to parse as number first
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
          return [numValue];
        }
        // If not a number, it might be a sprint name - JIRA API typically expects IDs
        // For now, return as is and let JIRA handle the validation
        return [value];
      } else if (Array.isArray(value)) {
        // Already an array, return as is
        return value;
      }
      return [value];
    }

    // Handle Epic Link fields
    if (customType === 'com.pyxis.greenhopper.jira:gh-epic-link') {
      // Epic links expect the epic key as a string
      return String(value);
    }

    // Handle array fields
    if (fieldType === 'array') {
      if (!Array.isArray(value)) {
        return [value];
      }
      return value;
    }

    // Handle option fields (dropdowns, selects)
    if (fieldType === 'option') {
      if (typeof value === 'string') {
        return { value: value };
      } else if (typeof value === 'object' && value.value) {
        return value;
      }
      return { value: String(value) };
    }

    // Handle user fields
    if (fieldType === 'user') {
      if (typeof value === 'string') {
        // Assume it's an accountId, email, or username
        return { accountId: value };
      }
      return value;
    }

    // Handle number fields
    if (fieldType === 'number') {
      return Number(value);
    }

    // Handle date fields
    if (fieldType === 'date') {
      if (typeof value === 'string') {
        return value; // Assume it's already in YYYY-MM-DD format
      }
      return value;
    }

    // Handle datetime fields
    if (fieldType === 'datetime') {
      if (typeof value === 'string') {
        return value; // Assume it's already in ISO format
      }
      return value;
    }

    // For all other fields, return as is
    return value;
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
      console.error(`Comment added to Jira ticket ${ticketId}.`);
    } catch (error) {
      console.error(`Error adding comment to Jira ticket ${ticketId}:`, error);
      throw error;
    }
  }

  async searchTicketsByJQL(jql: string): Promise<JiraTicket[]> {
    try {
      // Debug logging for development
      if (process.env.NODE_ENV === 'development') {
        console.error('🔍 JQL Debug - Input:', jql);
        console.error('🔍 JQL Debug - API Endpoint:', this.config.apiBaseUrl);
        console.error('🔍 JQL Debug - Timestamp:', new Date().toISOString());
      }

      const searchResults =
        await this.client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({ 
          jql,
          fields: ['id', 'key', 'summary', 'description', 'status']
        });

      // Debug logging for results
      if (process.env.NODE_ENV === 'development') {
        console.error('✅ JQL Debug - Result count:', searchResults.issues?.length || 0);
        if (searchResults.issues && searchResults.issues.length > 0) {
          console.error('✅ JQL Debug - First result key:', searchResults.issues[0].key);
        }
      }

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
      console.error(`❌ JQL Debug - Error searching with JQL: ${jql}:`, error);
      
      // Enhanced error logging for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ JQL Debug - Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          jql: jql,
          timestamp: new Date().toISOString()
        });
      }
      
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
      console.error('Jira ticket created successfully.');
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
      console.error(
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

  // New tool: Get All Projects
  async getAllProjects(): Promise<any[]> {
    try {
      // Use searchProjects instead of getAllProjects
      const projects = await this.client.projects.searchProjects();
      return projects.values || [];
    } catch (error) {
      console.error('Error fetching Jira projects:', error);
      throw error;
    }
  }

  // New tool: Get Project Details
  async getProjectDetails(projectKey: string): Promise<any> {
    try {
      const project = await this.client.projects.getProject({
        projectIdOrKey: projectKey,
      });
      return project;
    } catch (error) {
      console.error(`Error fetching Jira project details for ${projectKey}:`, error);
      throw error;
    }
  }

  // New tool: Get Project Components
  async getProjectComponents(projectKey: string): Promise<any[]> {
    try {
      const components = await this.client.projectComponents.getProjectComponents({
        projectIdOrKey: projectKey,
      });
      return components;
    } catch (error) {
      console.error(`Error fetching components for project ${projectKey}:`, error);
      throw error;
    }
  }

  // New tool: Get Project Versions
  async getProjectVersions(projectKey: string): Promise<any[]> {
    try {
      const versions = await this.client.projectVersions.getProjectVersions({
        projectIdOrKey: projectKey,
      });
      return versions;
    } catch (error) {
      console.error(`Error fetching versions for project ${projectKey}:`, error);
      throw error;
    }
  }

  /**
   * Unified search method that accepts multiple criteria and builds JQL dynamically
   * This replaces all the individual search methods with a single flexible interface
   */
  async searchTickets(criteria: {
    projectKey?: string;
    assigneeEmail?: string;
    assignedToMe?: boolean;
    statusCategory?: 'To Do' | 'In Progress' | 'Done';
    status?: string;
    priority?: string;
    labels?: string[];
    labelsMatchAll?: boolean;
    updatedSince?: string;
    updatedBefore?: string;
    createdSince?: string;
    createdBefore?: string;
    recentDays?: number;
    issueType?: string;
    reporter?: string;
    text?: string;
    maxResults?: number;
    orderBy?: string;
  } = {}): Promise<JiraTicket[]> {
    const maxResults = criteria.maxResults || 50;
    const orderBy = criteria.orderBy || 'updated DESC';
    
    // Build JQL conditions array
    const conditions: string[] = [];
    
    // Project filter - use fuzzy matching if not exact match
    if (criteria.projectKey) {
      // Try exact match first, then fuzzy if it contains spaces or looks partial
      if (criteria.projectKey.includes(' ') || criteria.projectKey.length < 3) {
        conditions.push(`project in projectsWhere("name ~ '${criteria.projectKey}' OR key ~ '${criteria.projectKey}'")`);
      } else {
        conditions.push(`project = "${criteria.projectKey}"`);
      }
    }
    
    // Assignee filters
    if (criteria.assignedToMe) {
      conditions.push('assignee = currentUser()');
    } else if (criteria.assigneeEmail) {
      // Support fuzzy matching for assignee - try email, display name, or username
      if (criteria.assigneeEmail.includes('@')) {
        conditions.push(`assignee = "${criteria.assigneeEmail}"`);
      } else {
        // Fuzzy match by display name or username
        conditions.push(`assignee in membersOf("jira-users") AND assignee ~ "${criteria.assigneeEmail}"`);
      }
    }
    
    // Status filters
    if (criteria.statusCategory) {
      conditions.push(`statusCategory = "${criteria.statusCategory}"`);
    }
    if (criteria.status) {
      // Status fuzzy matching for common variations
      const statusMap: { [key: string]: string[] } = {
        'open': ['Open', 'To Do', 'New'],
        'progress': ['In Progress', 'In Development', 'In Review'],
        'review': ['In Review', 'Code Review', 'Peer Review'],
        'testing': ['Testing', 'QA', 'In Testing'],
        'done': ['Done', 'Closed', 'Resolved', 'Complete'],
        'closed': ['Closed', 'Done', 'Resolved']
      };
      
      const lowerStatus = criteria.status.toLowerCase();
      const matches = statusMap[lowerStatus];
      
      if (matches) {
        const statusConditions = matches.map(s => `status = "${s}"`);
        conditions.push(`(${statusConditions.join(' OR ')})`);
      } else {
        conditions.push(`status = "${criteria.status}"`);
      }
    }
    
    // Priority filter - with fuzzy matching
    if (criteria.priority) {
      // Common priority fuzzy matching
      const priorityMap: { [key: string]: string[] } = {
        'high': ['High', 'Highest', 'Critical', 'Urgent'],
        'medium': ['Medium', 'Normal'],
        'low': ['Low', 'Lowest', 'Minor', 'Trivial'],
        'critical': ['Critical', 'Highest'],
        'urgent': ['Urgent', 'High', 'Highest']
      };
      
      const lowerPriority = criteria.priority.toLowerCase();
      const matches = priorityMap[lowerPriority];
      
      if (matches) {
        const priorityConditions = matches.map(p => `priority = "${p}"`);
        conditions.push(`(${priorityConditions.join(' OR ')})`);
      } else {
        conditions.push(`priority = "${criteria.priority}"`);
      }
    }
    
    // Issue type filter - with fuzzy matching
    if (criteria.issueType) {
      const typeMap: { [key: string]: string[] } = {
        'bug': ['Bug', 'Defect', 'Issue'],
        'story': ['Story', 'User Story'],
        'task': ['Task', 'To Do'],
        'epic': ['Epic'],
        'feature': ['Feature', 'New Feature', 'Story']
      };
      
      const lowerType = criteria.issueType.toLowerCase();
      const matches = typeMap[lowerType];
      
      if (matches) {
        const typeConditions = matches.map(t => `issueType = "${t}"`);
        conditions.push(`(${typeConditions.join(' OR ')})`);
      } else {
        conditions.push(`issueType = "${criteria.issueType}"`);
      }
    }
    
    // Reporter filter - with fuzzy matching
    if (criteria.reporter) {
      if (criteria.reporter.includes('@')) {
        conditions.push(`reporter = "${criteria.reporter}"`);
      } else {
        // Fuzzy match by display name or username
        conditions.push(`reporter in membersOf("jira-users") AND reporter ~ "${criteria.reporter}"`);
      }
    }
    
    // Labels filter
    if (criteria.labels && criteria.labels.length > 0) {
      const labelConditions = criteria.labels.map(label => `labels = "${label}"`);
      const labelQuery = criteria.labelsMatchAll 
        ? labelConditions.join(' AND ') 
        : labelConditions.join(' OR ');
      conditions.push(`(${labelQuery})`);
    }
    
    // Date filters
    if (criteria.recentDays) {
      conditions.push(`updated >= -${criteria.recentDays}d`);
    } else {
      if (criteria.updatedSince) {
        conditions.push(`updated >= "${criteria.updatedSince}"`);
      }
      if (criteria.updatedBefore) {
        conditions.push(`updated <= "${criteria.updatedBefore}"`);
      }
    }
    
    if (criteria.createdSince) {
      conditions.push(`created >= "${criteria.createdSince}"`);
    }
    if (criteria.createdBefore) {
      conditions.push(`created <= "${criteria.createdBefore}"`);
    }
    
    // Text search - enhanced fuzzy matching across multiple fields
    if (criteria.text) {
      const searchTerms = criteria.text.trim().split(/\s+/);
      if (searchTerms.length === 1) {
        // Single term - search across summary, description, and comments
        conditions.push(`(summary ~ "${criteria.text}" OR description ~ "${criteria.text}" OR comment ~ "${criteria.text}")`);
      } else {
        // Multiple terms - each term should appear somewhere
        const termConditions = searchTerms.map(term => 
          `(summary ~ "${term}" OR description ~ "${term}" OR comment ~ "${term}")`
        );
        conditions.push(`(${termConditions.join(' AND ')})`);
      }
    }
    
    // If no conditions specified, search for recent tickets as default
    if (conditions.length === 0) {
      conditions.push('updated >= -7d');
    }
    
    // Build final JQL
    const jql = conditions.join(' AND ') + ` ORDER BY ${orderBy}`;
    
    // Debug logging for development
    if (process.env.NODE_ENV === 'development') {
      console.error('🔍 Unified Search Debug - Generated JQL:', jql);
      console.error('🔍 Unified Search Debug - Criteria:', JSON.stringify(criteria, null, 2));
    }
    
    try {
      const searchResults = await this.client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({ 
        jql,
        maxResults,
        fields: ['id', 'key', 'summary', 'description', 'status', 'assignee', 'priority', 'labels', 'updated', 'created', 'issuetype', 'reporter']
      });

      return this.mapSearchResultsToTickets(searchResults);
    } catch (error) {
      console.error(`Error in unified ticket search:`, error);
      console.error('Generated JQL:', jql);
      throw error;
    }
  }

  /**
   * Helper method to map search results to JiraTicket objects
   */
  private mapSearchResultsToTickets(searchResults: { issues?: Array<{ 
    id: string; 
    key: string; 
    fields: { 
      summary?: string; 
      description?: { 
        content?: Array<{ 
          content?: Array<{ text: string }> 
        }> 
      }; 
      status?: { name?: string }; 
      assignee?: { 
        displayName?: string; 
        emailAddress?: string; 
        accountId?: string 
      }; 
      priority?: { name?: string }; 
      labels?: string[]; 
      updated?: string; 
      created?: string;
      issuetype?: { name?: string };
      reporter?: { 
        displayName?: string; 
        emailAddress?: string; 
        accountId?: string 
      };
    } 
  }> }): JiraTicket[] {
    return (
      searchResults.issues?.map((issue) => ({
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary ?? '',
        description: typeof issue.fields.description === 'string' 
          ? issue.fields.description 
          : issue.fields.description?.content ? 'Description available (complex format)' : '',
        status: issue.fields.status?.name ?? '',
        assignee: issue.fields.assignee ? {
          displayName: issue.fields.assignee.displayName ?? '',
          emailAddress: issue.fields.assignee.emailAddress ?? '',
          accountId: issue.fields.assignee.accountId ?? ''
        } : null,
        priority: issue.fields.priority?.name ?? '',
        labels: issue.fields.labels || [],
        updated: issue.fields.updated ?? '',
        created: issue.fields.created ?? '',
        issueType: issue.fields.issuetype?.name ?? '',
        reporter: issue.fields.reporter ? {
          displayName: issue.fields.reporter.displayName ?? '',
          emailAddress: issue.fields.reporter.emailAddress ?? '',
          accountId: issue.fields.reporter.accountId ?? ''
        } : null
      })) || []
    );
  }

  /**
   * Helper method to make Agile API requests since jira.js doesn't include agile endpoints
   */
  private async makeAgileRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.config.apiBaseUrl}/rest/agile/1.0${endpoint}`;
    const auth = btoa(`${this.config.userEmail}:${this.config.apiToken}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Agile API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all boards accessible to the user
   */
  async getAllBoards(options: {
    startAt?: number;
    maxResults?: number;
    type?: 'scrum' | 'kanban';
    name?: string;
    projectKeyOrId?: string;
  } = {}): Promise<{ values: JiraBoard[]; total: number; isLast: boolean }> {
    try {
      const params = new URLSearchParams();
      if (options.startAt !== undefined) params.append('startAt', options.startAt.toString());
      if (options.maxResults !== undefined) params.append('maxResults', options.maxResults.toString());
      if (options.type) params.append('type', options.type);
      if (options.name) params.append('name', options.name);
      if (options.projectKeyOrId) params.append('projectKeyOrId', options.projectKeyOrId);

      const endpoint = `/board${params.toString() ? '?' + params.toString() : ''}`;
      const result = await this.makeAgileRequest(endpoint);
      
      return {
        values: result.values || [],
        total: result.total || 0,
        isLast: result.isLast || false
      };
    } catch (error) {
      console.error('Error fetching boards:', error);
      throw error;
    }
  }

  /**
   * Get board details by ID
   */
  async getBoardById(boardId: number): Promise<JiraBoard> {
    try {
      return await this.makeAgileRequest(`/board/${boardId}`);
    } catch (error) {
      console.error(`Error fetching board ${boardId}:`, error);
      throw error;
    }
  }

  /**
   * Get all sprints for a board
   */
  async getSprintsForBoard(boardId: number, options: {
    startAt?: number;
    maxResults?: number;
    state?: 'future' | 'active' | 'closed';
  } = {}): Promise<{ values: JiraSprint[]; total: number; isLast: boolean }> {
    try {
      const params = new URLSearchParams();
      if (options.startAt !== undefined) params.append('startAt', options.startAt.toString());
      if (options.maxResults !== undefined) params.append('maxResults', options.maxResults.toString());
      if (options.state) params.append('state', options.state);

      const endpoint = `/board/${boardId}/sprint${params.toString() ? '?' + params.toString() : ''}`;
      const result = await this.makeAgileRequest(endpoint);
      
      return {
        values: result.values || [],
        total: result.total || 0,
        isLast: result.isLast || false
      };
    } catch (error) {
      console.error(`Error fetching sprints for board ${boardId}:`, error);
      throw error;
    }
  }

  /**
   * Get sprint details by ID
   */
  async getSprintById(sprintId: number): Promise<JiraSprint> {
    try {
      return await this.makeAgileRequest(`/sprint/${sprintId}`);
    } catch (error) {
      console.error(`Error fetching sprint ${sprintId}:`, error);
      throw error;
    }
  }

  /**
   * Search for sprints in a specific board by name or ID
   */
  async searchSprints(criteria: {
    boardName?: string;
    boardId?: number;
    name?: string;
    state?: 'future' | 'active' | 'closed';
    maxResults?: number;
  } = {}): Promise<JiraSprint[]> {
    try {
      const maxResults = criteria.maxResults || 50;
      let targetBoardId: number;

      // Determine the target board ID
      if (criteria.boardId) {
        targetBoardId = criteria.boardId;
      } else if (criteria.boardName) {
        // Search for board by name
        const boardsResult = await this.getAllBoards({
          name: criteria.boardName,
          maxResults: 100
        });
        
        if (boardsResult.values.length === 0) {
          throw new Error(`No board found with name containing: ${criteria.boardName}`);
        }
        
        // Use the first matching board
        targetBoardId = boardsResult.values[0].id;
        console.log(`Found board: ${boardsResult.values[0].name} (ID: ${targetBoardId})`);
      } else {
        throw new Error('Either boardName or boardId must be provided');
      }

      // Get sprints from the target board
      const sprintResult = await this.getSprintsForBoard(targetBoardId, {
        state: criteria.state,
        maxResults
      });
      let allSprints = sprintResult.values;

      // Filter by name if provided
      if (criteria.name) {
        const nameLower = criteria.name.toLowerCase();
        allSprints = allSprints.filter(sprint => 
          sprint.name.toLowerCase().includes(nameLower)
        );
      }

      // Sort by state priority (active > future > closed) and then by name
      allSprints.sort((a, b) => {
        const stateOrder = { active: 1, future: 2, closed: 3 };
        const stateComparison = stateOrder[a.state] - stateOrder[b.state];
        if (stateComparison !== 0) return stateComparison;
        return a.name.localeCompare(b.name);
      });

      // Apply maxResults limit
      if (allSprints.length > maxResults) {
        allSprints = allSprints.slice(0, maxResults);
      }

      return allSprints;
    } catch (error) {
      console.error('Error searching sprints:', error);
      throw error;
    }
  }

  /**
   * Get issues in a specific sprint
   */
  async getIssuesForSprint(sprintId: number, options: {
    startAt?: number;
    maxResults?: number;
    jql?: string;
    fields?: string[];
  } = {}): Promise<JiraTicket[]> {
    try {
      const params = new URLSearchParams();
      if (options.startAt !== undefined) params.append('startAt', options.startAt.toString());
      if (options.maxResults !== undefined) params.append('maxResults', options.maxResults.toString());
      if (options.jql) params.append('jql', options.jql);
      if (options.fields) params.append('fields', options.fields.join(','));

      const endpoint = `/sprint/${sprintId}/issue${params.toString() ? '?' + params.toString() : ''}`;
      const result = await this.makeAgileRequest(endpoint);
      
      // Transform the issues using existing transformation logic
      const allFields = await this.getAllFields();
      return await Promise.all(
        (result.issues || []).map((issue: any) => this.transformIssueFields(issue, allFields))
      );
    } catch (error) {
      console.error(`Error fetching issues for sprint ${sprintId}:`, error);
      throw error;
    }
  }

  // Note: Sprint and board functionality now implemented using JIRA Agile API
  // The agile endpoints are available at /rest/agile/1.0/ and require proper permissions
  // Sprint/board features can now be accessed through the methods above.
}
