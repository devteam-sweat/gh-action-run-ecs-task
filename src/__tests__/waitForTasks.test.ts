import * as core from '@actions/core';
import { ECSClient, DescribeTasksCommand } from '@aws-sdk/client-ecs';
import { mockClient } from 'aws-sdk-client-mock';
import { waitForTasks } from '../index';

jest.mock('@actions/core');

// Mock the waitUntilTasksStopped function
jest.mock('@aws-sdk/client-ecs', () => {
  const actual = jest.requireActual('@aws-sdk/client-ecs');
  return {
    ...actual,
    waitUntilTasksStopped: jest.fn()
  };
});

import { waitUntilTasksStopped } from '@aws-sdk/client-ecs';

const ecsClientMock = mockClient(ECSClient);

describe('waitForTasks', () => {
  const mockInfo = core.info as jest.MockedFunction<typeof core.info>;
  const mockError = core.error as jest.MockedFunction<typeof core.error>;
  const mockWaitUntilTasksStopped = waitUntilTasksStopped as jest.MockedFunction<typeof waitUntilTasksStopped>;

  beforeEach(() => {
    jest.clearAllMocks();
    ecsClientMock.reset();
  });

  it('should return true when all tasks complete successfully', async () => {
    const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    
    mockWaitUntilTasksStopped.mockResolvedValue({ state: 'SUCCESS' } as any);
    
    ecsClientMock.on(DescribeTasksCommand).resolves({
      tasks: [
        {
          taskArn,
          containers: [
            { name: 'container-1', exitCode: 0 }
          ]
        }
      ]
    });

    const ecsClient = new ECSClient();
    const result = await waitForTasks(ecsClient, 'my-cluster', [taskArn], 900);

    expect(result).toBe(true);
    expect(mockInfo).toHaveBeenCalledWith(`Waiting for task(s) to stop: ${taskArn}`);
    expect(mockInfo).toHaveBeenCalledWith('Task arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123 - Container container-1 exited with code 0');
    expect(mockInfo).toHaveBeenCalledWith('All tasks completed successfully');
  });

  it('should return false when a task fails with non-zero exit code', async () => {
    const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    
    mockWaitUntilTasksStopped.mockResolvedValue({ state: 'SUCCESS' } as any);
    
    ecsClientMock.on(DescribeTasksCommand).resolves({
      tasks: [
        {
          taskArn,
          containers: [
            { name: 'container-1', exitCode: 1 }
          ]
        }
      ]
    });

    const ecsClient = new ECSClient();
    const result = await waitForTasks(ecsClient, 'my-cluster', [taskArn], 900);

    expect(result).toBe(false);
    expect(mockError).toHaveBeenCalledWith('One or more tasks failed');
  });

  it('should handle multiple containers in a task', async () => {
    const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    
    mockWaitUntilTasksStopped.mockResolvedValue({ state: 'SUCCESS' } as any);
    
    ecsClientMock.on(DescribeTasksCommand).resolves({
      tasks: [
        {
          taskArn,
          containers: [
            { name: 'container-1', exitCode: 0 },
            { name: 'container-2', exitCode: 0 }
          ]
        }
      ]
    });

    const ecsClient = new ECSClient();
    const result = await waitForTasks(ecsClient, 'my-cluster', [taskArn], 900);

    expect(result).toBe(true);
    expect(mockInfo).toHaveBeenCalledWith('Task arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123 - Container container-1 exited with code 0');
    expect(mockInfo).toHaveBeenCalledWith('Task arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123 - Container container-2 exited with code 0');
  });

  it('should handle multiple tasks', async () => {
    const taskArn1 = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    const taskArn2 = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/def456';
    
    mockWaitUntilTasksStopped.mockResolvedValue({ state: 'SUCCESS' } as any);
    
    ecsClientMock.on(DescribeTasksCommand).resolves({
      tasks: [
        {
          taskArn: taskArn1,
          containers: [{ name: 'container-1', exitCode: 0 }]
        },
        {
          taskArn: taskArn2,
          containers: [{ name: 'container-2', exitCode: 0 }]
        }
      ]
    });

    const ecsClient = new ECSClient();
    const result = await waitForTasks(ecsClient, 'my-cluster', [taskArn1, taskArn2], 900);

    expect(result).toBe(true);
    expect(mockInfo).toHaveBeenCalledWith(`Waiting for task(s) to stop: ${taskArn1}, ${taskArn2}`);
  });

  it('should return false if any container fails', async () => {
    const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    
    mockWaitUntilTasksStopped.mockResolvedValue({ state: 'SUCCESS' } as any);
    
    ecsClientMock.on(DescribeTasksCommand).resolves({
      tasks: [
        {
          taskArn,
          containers: [
            { name: 'container-1', exitCode: 0 },
            { name: 'container-2', exitCode: 137 }
          ]
        }
      ]
    });

    const ecsClient = new ECSClient();
    const result = await waitForTasks(ecsClient, 'my-cluster', [taskArn], 900);

    expect(result).toBe(false);
    expect(mockError).toHaveBeenCalledWith('One or more tasks failed');
  });

  it('should use correct timeout parameter', async () => {
    const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    
    mockWaitUntilTasksStopped.mockResolvedValue({ state: 'SUCCESS' } as any);
    
    ecsClientMock.on(DescribeTasksCommand).resolves({
      tasks: [
        {
          taskArn,
          containers: [{ name: 'container-1', exitCode: 0 }]
        }
      ]
    });

    const ecsClient = new ECSClient();
    await waitForTasks(ecsClient, 'my-cluster', [taskArn], 1800);

    expect(mockWaitUntilTasksStopped).toHaveBeenCalledWith(
      { client: ecsClient, maxWaitTime: 1800 },
      {
        cluster: 'my-cluster',
        tasks: [taskArn]
      }
    );
  });
});
