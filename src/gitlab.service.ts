import fetch from "node-fetch";
import {
  GitLabConfig,
  GitLabMRDetails,
  GitLabProject,
  GitLabMergeRequest,
  GitLabPosition,
  ParsedHunk,
} from "./gitlab.js";

export class GitLabService {
  private readonly config: GitLabConfig;

  constructor(config: GitLabConfig) {
    this.config = config;
  }

  private async callGitLabApi<T>(
    endpoint: string,
    method: string = "GET",
    body?: object
  ): Promise<T> {
    const url = `${this.config.url}/api/v4/${endpoint}`;
    const headers = {
      "Private-Token": this.config.accessToken,
      "Content-Type": "application/json",
    };

    const options: any = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`GitLab API Error: ${response.status} - ${errorText}`);
        throw new Error(`GitLab API Error: ${response.status} - ${errorText}`);
      }
      return response.json() as Promise<T>;
    } catch (error) {
      console.error(`Failed to call GitLab API: ${error}`);
      throw error;
    }
  }

  private parseDiff(diff: string): ParsedHunk[] {
    const hunks: ParsedHunk[] = [];
    const lines = diff.split("\n");
    let currentHunk: ParsedHunk | null = null;

    for (const line of lines) {
      if (line.startsWith("@@")) {
        // Hunk header
        const headerMatch = line.match(
          /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/
        );
        if (headerMatch) {
          if (currentHunk) {
            hunks.push(currentHunk);
          }
          currentHunk = {
            header: line,
            oldStartLine: parseInt(headerMatch[1], 10),
            oldLineCount: parseInt(headerMatch[2] || "1", 10),
            newStartLine: parseInt(headerMatch[3], 10),
            newLineCount: parseInt(headerMatch[4] || "1", 10),
            lines: [],
            isCollapsed: false,
          };
        }
      } else if (currentHunk) {
        // Hunk content
        let lineType: "add" | "remove" | "context";
        let oldLine: number | undefined;
        let newLine: number | undefined;

        if (line.startsWith("+")) {
          lineType = "add";
          newLine =
            currentHunk.newStartLine +
            currentHunk.lines.filter((l) => l.type !== "remove").length;
        } else if (line.startsWith("-")) {
          lineType = "remove";
          oldLine =
            currentHunk.oldStartLine +
            currentHunk.lines.filter((l) => l.type !== "add").length;
        } else {
          lineType = "context";
          oldLine =
            currentHunk.oldStartLine +
            currentHunk.lines.filter((l) => l.type !== "add").length;
          newLine =
            currentHunk.newStartLine +
            currentHunk.lines.filter((l) => l.type !== "remove").length;
        }

        currentHunk.lines.push({
          type: lineType,
          oldLine,
          newLine,
          content: line,
        });
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }
    return hunks;
  }

  // Utility method to parse GitLab MR URLs
  private parseMrUrl(mrUrl: string, gitlabBaseUrl: string): { projectPath: string; mrIid: number } {
    try {
      const url = new URL(mrUrl);
      const baseUrl = new URL(gitlabBaseUrl);
      
      // Ensure the URL is from the same GitLab instance
      if (url.origin !== baseUrl.origin) {
        throw new Error(`MR URL is not from the configured GitLab instance: ${gitlabBaseUrl}`);
      }
      
      // Parse the path: /{namespace}/{project}/-/merge_requests/{iid}
      const pathMatch = url.pathname.match(/^\/(.+)\/-\/merge_requests\/(\d+)/);
      if (!pathMatch) {
        throw new Error(`Invalid GitLab MR URL format: ${mrUrl}`);
      }
      
      const projectPath = pathMatch[1];
      const mrIid = parseInt(pathMatch[2], 10);
      
      return { projectPath, mrIid };
    } catch (error) {
      throw new Error(`Failed to parse GitLab MR URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Phase 2: Basic Features Implementation will go here
  // 1. Fetch Merge Request Details
  async getMergeRequestDetails(
    projectPath: string,
    mrIid: number
  ): Promise<GitLabMRDetails> {
    const encodedProjectPath = encodeURIComponent(projectPath);
    const baseUrl = `projects/${encodedProjectPath}/merge_requests/${mrIid}`;

    // First get the MR details
    const mrDetails = await this.callGitLabApi<any>(baseUrl);
    const mrChanges = await this.callGitLabApi<any>(`projects/${encodedProjectPath}/merge_requests/${mrIid}/changes`);
    const mrDiscussions = await this.callGitLabApi<any>(`projects/${encodedProjectPath}/merge_requests/${mrIid}/discussions`);

    // Map file diffs
    const fileDiffs = mrChanges.changes.map((change: any) => ({
      old_path: change.old_path,
      new_path: change.new_path,
      new_file: change.new_file,
      deleted_file: change.deleted_file,
      renamed_file: change.renamed_file,
      diff: change.diff,
    }));

    // Map discussions
    const discussions = mrDiscussions.map((discussion: any) => ({
      id: discussion.id,
      notes: discussion.notes.map((note: any) => ({
        id: note.id,
        body: note.body,
        author: {
          name: note.author.name,
          username: note.author.username,
        },
        system: note.system,
        position: note.position
          ? {
              base_sha: note.position.base_sha,
              start_sha: note.position.start_sha,
              head_sha: note.position.head_sha,
              position_type: note.position.position_type,
              old_path: note.position.old_path,
              new_path: note.position.new_path,
              new_line: note.position.new_line,
              old_line: note.position.old_line,
            }
          : undefined,
      })),
      postedAsInline: discussion.individual_note, // Assuming individual_note means inline
    }));

    // Placeholder for parsedDiffs and fileContents - requires more complex parsing
    // For now, we'll leave them as empty or basic transformations.
    const parsedDiffs = fileDiffs.map((diff: any) => ({
      filePath: diff.new_path,
      oldPath: diff.old_path,
      isNew: diff.new_file,
      isDeleted: diff.deleted_file,
      isRenamed: diff.renamed_file,
      hunks: this.parseDiff(diff.diff),
    }));

    const fileContents = new Map<
      string,
      { oldContent?: string[]; newContent?: string[] }
    >();
    // To populate fileContents, you'd need to fetch file content directly or parse diffs more deeply.

    return {
      projectPath: mrDetails.path_with_namespace,
      mrIid: mrDetails.iid.toString(),
      projectId: mrDetails.project_id,
      title: mrDetails.title,
      authorName: mrDetails.author.name,
      webUrl: mrDetails.web_url,
      sourceBranch: mrDetails.source_branch,
      targetBranch: mrDetails.target_branch,
      base_sha: mrDetails.diff_refs.base_sha,
      start_sha: mrDetails.diff_refs.start_sha,
      head_sha: mrDetails.diff_refs.head_sha,
      fileDiffs: fileDiffs,
      diffForPrompt: fileDiffs.map((diff: any) => diff.diff).join("\n"),
      parsedDiffs: parsedDiffs,
      fileContents: fileContents,
      discussions: discussions,
      existingFeedback: discussions.flatMap((discussion: any) =>
        discussion.notes
          .filter((note: any) => note.position) // Only notes with positions are feedback
          .map((note: any) => ({
            id: note.id.toString(),
            lineNumber: note.position.new_line || note.position.old_line,
            filePath: note.position.new_path || note.position.old_path,
            severity: "Info", // Default to Info, can be refined later if GitLab API provides severity
            title: "GitLab Comment",
            description: note.body,
            lineContent: "", // This would require fetching the actual line content
            position: note.position,
            status: "submitted",
            isExisting: true,
          }))
      ),
    };
  }

  // Convenience method to get MR details from URL
  async getMergeRequestDetailsFromUrl(mrUrl: string): Promise<GitLabMRDetails> {
    const { projectPath, mrIid } = this.parseMrUrl(mrUrl, this.config.url);
    return this.getMergeRequestDetails(projectPath, mrIid);
  }

  // 2. Add Comment to Merge Request
  async addCommentToMergeRequest(
    projectPath: string,
    mrIid: number,
    discussionId: string | undefined,
    commentBody: string,
    position: GitLabPosition | undefined
  ): Promise<any> {
    const encodedProjectPath = encodeURIComponent(projectPath);

    if (discussionId) {
      // Reply to an existing discussion
      return this.callGitLabApi(
        `projects/${encodedProjectPath}/merge_requests/${mrIid}/discussions/${discussionId}/notes`,
        "POST",
        { body: commentBody }
      );
    } else if (position) {
      // Add a new comment with a position (inline comment)
      return this.callGitLabApi(
        `projects/${encodedProjectPath}/merge_requests/${mrIid}/notes`,
        "POST",
        {
          body: commentBody,
          noteable_type: "MergeRequest",
          noteable_id: mrIid,
          position: {
            base_sha: position.base_sha,
            start_sha: position.start_sha,
            head_sha: position.head_sha,
            position_type: position.position_type,
            old_path: position.old_path,
            new_path: position.new_path,
            new_line: position.new_line,
            old_line: position.old_line,
          },
        }
      );
    } else {
      // Add a general comment
      return this.callGitLabApi(
        `projects/${encodedProjectPath}/merge_requests/${mrIid}/notes`,
        "POST",
        { body: commentBody }
      );
    }
  }

  // Convenience method to add comment from MR URL
  async addCommentToMergeRequestFromUrl(
    mrUrl: string,
    commentBody: string,
    discussionId?: string,
    position?: GitLabPosition
  ): Promise<any> {
    const { projectPath, mrIid } = this.parseMrUrl(mrUrl, this.config.url);
    return this.addCommentToMergeRequest(projectPath, mrIid, discussionId, commentBody, position);
  }

  // 3. List Projects
  async listProjects(): Promise<GitLabProject[]> {
    const url = `projects?membership=true&min_access_level=30&order_by=last_activity_at&sort=desc&per_page=100`;
    return this.callGitLabApi<GitLabProject[]>(url);
  }

  // 4. List Merge Requests for a Project
  async listMergeRequests(projectPath: string): Promise<GitLabMergeRequest[]> {
    const encodedProjectPath = encodeURIComponent(projectPath);
    return this.callGitLabApi<GitLabMergeRequest[]>(
      `projects/${encodedProjectPath}/merge_requests`
    );
  }
}
