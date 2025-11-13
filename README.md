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
| `task-definition` | The family and revision (family:revision) or full ARN of the task definition to run | Yes | - |
| `ecs-cluster` | The short name or full ARN of the cluster on which to run your task | Yes | - |
| `subnets` | Comma-separated list of subnet IDs for the task | Yes | - |
| `security-groups` | Comma-separated list of security group IDs for the task | Yes | - |
| `wait-for-finish` | Whether to wait for the task to finish (true/false) | No | `false` |
| `wait-timeout-seconds` | Maximum seconds to wait for task completion (only used if wait-for-finish is true) | No | `900` |

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
- No subnets are provided
- No security groups are provided
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
    }
  ]
}
```

## License

This project is available under the MIT License.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
