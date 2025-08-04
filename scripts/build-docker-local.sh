#!/bin/bash

# Build and test Docker image locally
# This script helps developers test the Docker build before pushing

set -e

echo "Building Docker image locally..."
docker build -t mcp-gitlab-jira:local .

echo "Testing Docker image..."
docker run --rm mcp-gitlab-jira:local npm --version

echo "✅ Docker image built and tested successfully!"
echo "To run the container:"
echo "docker run -d --name mcp-gitlab-jira-test \\"
echo "  -e GITLAB_URL=\"your-gitlab-url\" \\"
echo "  -e GITLAB_ACCESS_TOKEN=\"your-token\" \\"
echo "  -e ATLASSIAN_SITE_NAME=\"your-site\" \\"
echo "  -e ATLASSIAN_USER_EMAIL=\"your-email\" \\"
echo "  -e ATLASSIAN_API_TOKEN=\"your-api-token\" \\"
echo "  mcp-gitlab-jira:local"
