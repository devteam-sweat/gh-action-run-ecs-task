# Run ECS Task GitHub Action

A GitHub Action to run an AWS ECS (Elastic Container Service) task on Fargate.

## Features

- Run ECS tasks on Fargate launch type
- Configure networking (subnets and security groups)
- Optionally wait for task completion
- Automatic exit code checking for task success/failure
- Support for custom task definitions and ECS clusters

## Prerequisites

- AWS credentials configured (use `aws-actions/configure-aws-credentials`)
- An existing ECS cluster
- A task definition (family:revision or full ARN)
- VPC with subnets and security groups configured

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `task-definition` | The family and revision (family:revision) or full ARN of the task definition to run | No* | - |
| `task-definition-from-parameter` | Lookup a task definition from an SSM String parameter | No* | - |
| `ecs-cluster` | The short name or full ARN of the cluster on which to run your task | Yes | - |
| `subnets` | Comma-separated list of subnet IDs for the task | Yes | - |
| `security-groups` | Comma-separated list of security group IDs for the task | Yes | - |
| `wait-for-finish` | Whether to wait for the task to finish (true/false) | No | `false` |
| `wait-timeout-seconds` | Maximum seconds to wait for task completion (only used if wait-for-finish is true) | No | `900` |

**Note:** Either `task-definition` or `task-definition-from-parameter` must be provided. If both are provided, `task-definition` takes precedence.

## Usage

### Basic Example

```yaml
name: Run ECS Task

on:
  push:
    branches:
      - main

jobs:
  run-task:
    runs-on: ubuntu-latest
    
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
          aws-region: us-east-1
      
      - name: Run ECS Task
        uses: devteam-sweat/gh-action-run-ecs-task@v1
        with:
          task-definition: my-task:1
          ecs-cluster: my-cluster
          subnets: subnet-12345678,subnet-87654321
          security-groups: sg-12345678
```

### Wait for Task Completion

```yaml
name: Run ECS Task and Wait

on:
  workflow_dispatch:

jobs:
  run-task:
    runs-on: ubuntu-latest
    
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
          aws-region: us-east-1
      
      - name: Run ECS Task
        uses: devteam-sweat/gh-action-run-ecs-task@v1
        with:
          task-definition: my-task:1
          ecs-cluster: my-cluster
          subnets: subnet-12345678,subnet-87654321
          security-groups: sg-12345678,sg-87654321
          wait-for-finish: true
          wait-timeout-seconds: 1800
```

### Use Task Definition from SSM Parameter

```yaml
name: Run ECS Task from SSM Parameter

on:
  workflow_dispatch:

jobs:
  run-task:
    runs-on: ubuntu-latest
    
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
          aws-region: us-east-1
      
      - name: Run ECS Task
        uses: devteam-sweat/gh-action-run-ecs-task@v1
        with:
          task-definition-from-parameter: /ecs/task-definitions/my-task
          ecs-cluster: my-cluster
          subnets: subnet-12345678,subnet-87654321
          security-groups: sg-12345678
          wait-for-finish: true
```

This is useful when you want to:
- Manage task definition versions centrally in SSM Parameter Store
- Update task definitions without modifying workflow files
- Share task definition references across multiple workflows

## Behavior

### Task Execution

- The action runs the specified task definition on the ECS cluster using Fargate launch type
- Tasks are configured with `awsvpcConfiguration` using the provided subnets and security groups
- Public IP assignment is disabled by default

### Wait for Completion

When `wait-for-finish` is set to `true`:
- The action waits for all started tasks to stop
- After tasks stop, it checks the exit codes of all containers
- If any container exits with a non-zero exit code, the action fails
- The action respects the `wait-timeout-seconds` timeout

### Error Handling

The action will fail if:
- Neither `task-definition` nor `task-definition-from-parameter` is provided
- No subnets are provided
- No security groups are provided
- The SSM parameter specified in `task-definition-from-parameter` doesn't exist or has no value
- The ECS task fails to start
- Any container exits with a non-zero code (when waiting for completion)
- The task doesn't complete within the specified timeout (when waiting for completion)

## IAM Permissions

The AWS credentials used by this action require the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:RunTask",
        "ecs:DescribeTasks"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::*:role/ecsTaskExecutionRole",
        "arn:aws:iam::*:role/ecsTaskRole"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/ecs/task-definitions/*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    }
  ]
}
```

**Note:** The `ssm:GetParameter` permission is only required if you use the `task-definition-from-parameter` input. Adjust the `Resource` ARN to match your SSM parameter naming convention and the `Condition` to match your region(s).

## Development

Requires Node 20.x (the version CI runs on).

```bash
npm ci
npm test          # vitest with coverage
npm run all       # build + pack + test — run before pushing
```

| Script | What it does |
|--------|--------------|
| `build` | Compiles `src/` to `lib/` with `tsc` |
| `pack` | Bundles `lib/index.js` into the single-file `dist/index.js` with `ncc` |
| `test` | Runs vitest with v8 coverage (see [vitest.config.ts](vitest.config.ts)) |
| `all` | `build` + `pack` + `test` |

Source lives in [src/](src/): [index.ts](src/index.ts) is the action entrypoint and [main.ts](src/main.ts) holds the logic, split into `getTaskDefinition`, `getNetworkConfiguration`, `runTask`, `waitForTasks` and the `run` orchestrator. Each has a matching test in [src/\_\_tests\_\_/](src/__tests__/), with AWS clients stubbed via `aws-sdk-client-mock`. Inputs are declared in [action.yml](action.yml) and read via `@actions/core`.

`lib/` is gitignored, but **`dist/` is committed** — it is what GitHub actually runs. You don't need to commit it yourself: the [Package workflow](.github/workflows/package.yml) rebuilds `dist/` on every push to `main` and commits it back as `(chore) updating dist`.

CI on pull requests runs the [Check workflow](.github/workflows/check.yml) (`npm test` and `npm run all`).

## Releasing

1. Merge your PR to `main`.
2. Wait for the Package workflow to push its `(chore) updating dist` commit — tagging before this lands ships a release with a stale bundle.
3. Tag that commit and push:

   ```bash
   git pull
   git tag v0.4.0
   git push origin v0.4.0
   ```

Pushing a `v*` tag triggers the [Release workflow](.github/workflows/release.yml), which creates the GitHub release. Bump `version` in [package.json](package.json) to match if you want it kept in sync.

Consumers should pin a tag (`uses: devteam-sweat/gh-action-run-ecs-task@v0.4.0`). There are no floating major-version tags, so a new release requires consumers to bump their reference.

## License

This project is available under the MIT License.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
