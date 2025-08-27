# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.7] - 2025-08-27

### Added
- Complete JIRA Sprint and Board management system with 6 new tools:
  - `jira_get_all_boards` - List accessible boards with filtering
  - `jira_get_board_details` - Get specific board information
  - `jira_search_sprints` - Search sprints by board name or ID (focused approach)
  - `jira_get_sprint_details` - Get detailed sprint information
  - `jira_get_sprints_for_board` - List all sprints for a specific board
  - `jira_get_sprint_issues` - Get all issues in a sprint with JQL filtering
- Board name fuzzy matching for easier discovery
- Sprint state filtering (active, future, closed)
- Custom JIRA Software Agile API client with proper authentication

### Changed
- **BREAKING**: `jira_search_sprints` now requires either `boardName` or `boardId` parameter
- Focused Sprint search prevents permission errors by targeting specific boards
- Improved error handling for boards without access permissions
- Automatic duplicate removal for sprints appearing on multiple boards
- Streamlined TESTING.md documentation (reduced from 320 to 102 lines)

### Fixed
- Permission-related 400 Bad Request errors eliminated through focused board search
- Duplicate sprint results removed through intelligent deduplication
- Clean error handling that doesn't spam logs with expected permission failures

### Removed
- 14+ unnecessary test files cleaned up for better maintainability
- Verbose and redundant examples from testing documentation

## [0.1.6] - 2025-08-19

### Added
- Unified JIRA search tool (`jira_search_tickets`) that replaces 9 individual search tools with intelligent fuzzy matching
- Fuzzy matching for project names, assignee names, priorities, statuses, and issue types
- Enhanced text search across summary, description, and comments with multi-keyword support
- Comprehensive testing documentation consolidated into TESTING.md
- New GitLab pipeline, branch, and issue management tools
- New JIRA project management tools (get projects, components, versions)

### Changed
- Consolidated multiple search tools into single unified interface
- Improved JQL generation with better error handling and debug logging
- Enhanced TypeScript types for better type safety
- Simplified testing approach by removing complex debugging scripts

### Fixed
- Fixed JIRA API deprecation by migrating to `searchForIssuesUsingJqlEnhancedSearch`
- Resolved TypeScript compilation issues with proper type definitions
- Improved error handling and debug logging throughout the application

## [0.1.2] - 2025-08-01

### Fixed
- Corrected a module resolution issue by adding the `.js` extension to the import statement in `src/jira.service.ts`.
- Addressed an issue where JQL queries were not returning responses.
- Resolved a problem with the transition logic in Jira.

### Added
- Implemented functionality to update standard and custom fields in Jira tickets.
- Expanded the available Jira tools with more options.
- Added more detailed information to the README.


## [0.1.1] - 2025-08-01

### Added
- Implemented some basic functions for gitlab and jira. e.g. get request details, add comments to MR. get ticket details, add comment etc.
