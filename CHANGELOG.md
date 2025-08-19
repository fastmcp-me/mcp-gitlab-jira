# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
