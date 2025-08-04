# Docker Hub Publishing Setup

This document explains how to set up automated Docker image publishing to Docker Hub using GitHub Actions.

## Prerequisites

1. A Docker Hub account
2. A GitHub repository with this project
3. GitHub repository secrets configured

## Setting up GitHub Secrets

To enable automated publishing to Docker Hub, you need to add the following secrets to your GitHub repository:

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Add the following repository secrets:

   - `DOCKER_USERNAME`: Your Docker Hub username
   - `DOCKER_PASSWORD`: Your Docker Hub access token (recommended) or password

### Creating a Docker Hub Access Token (Recommended)

1. Log into Docker Hub
2. Go to **Account Settings** > **Security** > **Access Tokens**
3. Click **New Access Token**
4. Give it a name (e.g., "GitHub Actions")
5. Set permissions to **Read, Write, Delete**
6. Copy the generated token and use it as `DOCKER_PASSWORD`

## How it Works

The GitHub Actions workflow (`.github/workflows/docker-publish.yml`) will:

1. **On every push to master/main**: Build and push with `latest` tag
2. **On version tags** (e.g., `v1.0.0`): Build and push with version tags (`1.0.0`, `1.0`, `1`, `latest`)
3. **On pull requests**: Build only (no push) for testing

## Manual Triggering

You can also manually trigger the workflow:

1. Go to **Actions** tab in your GitHub repository
2. Select "Build and Publish Docker Image" workflow
3. Click **Run workflow**

## Image Tags

The following tags will be created automatically:

- `latest`: Always points to the latest build from the default branch
- `master` or `main`: Points to the latest build from that branch
- Version tags (when you create a git tag like `v1.0.0`):
  - `1.0.0`: Exact version
  - `1.0`: Major.minor version
  - `1`: Major version

## Publishing a New Version

To publish a new version:

1. Update the version in `package.json`
2. Commit your changes
3. Create and push a git tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. The GitHub Action will automatically build and publish the new version

## Troubleshooting

- **Build fails**: Check the GitHub Actions logs for detailed error messages
- **Authentication fails**: Verify your Docker Hub credentials in GitHub secrets
- **Push fails**: Ensure your Docker Hub account has permission to push to the repository
