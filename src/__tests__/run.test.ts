import * as core from '@actions/core';
import { ECSClient, RunTaskCommand, DescribeTasksCommand, AssignPublicIp } from '@aws-sdk/client-ecs';
import { mockClient } from 'aws-sdk-client-mock';
import { run } from '../index';

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

describe('run', () => {
  const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>;
  const mockSetFailed = core.setFailed as jest.MockedFunction<typeof core.setFailed>;
  const mockInfo = core.info as jest.MockedFunction<typeof core.info>;
  const mockWaitUntilTasksStopped = waitUntilTasksStopped as jest.MockedFunction<typeof waitUntilTasksStopped>;

  beforeEach(() => {
    jest.clearAllMocks();
    ecsClientMock.reset();
  });

  it('should run task without waiting when wait-for-finish is false', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return 'my-task:1';
      if (name === 'ecs-cluster') return 'my-cluster';
      if (name === 'subnets') return 'subnet-123';
      if (name === 'security-groups') return 'sg-123';
      if (name === 'wait-for-finish') return 'false';
      if (name === 'wait-timeout-seconds') return '900';
      return '';
    });

    const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    ecsClientMock.on(RunTaskCommand).resolves({
      tasks: [{ taskArn }]
    });

    await run();

    expect(mockInfo).toHaveBeenCalledWith(`Started task(s): ${taskArn}`);
    expect(mockWaitUntilTasksStopped).not.toHaveBeenCalled();
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  it('should run task and wait when wait-for-finish is true', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return 'my-task:1';
      if (name === 'ecs-cluster') return 'my-cluster';
      if (name === 'subnets') return 'subnet-123';
      if (name === 'security-groups') return 'sg-123';
      if (name === 'wait-for-finish') return 'true';
      if (name === 'wait-timeout-seconds') return '1800';
      return '';
    });

    const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    
    ecsClientMock.on(RunTaskCommand).resolves({
      tasks: [{ taskArn }]
    });

    mockWaitUntilTasksStopped.mockResolvedValue({ state: 'SUCCESS' } as any);
    
    ecsClientMock.on(DescribeTasksCommand).resolves({
      tasks: [{
        taskArn,
        containers: [{ name: 'container-1', exitCode: 0 }]
      }]
    });

    await run();

    expect(mockWaitUntilTasksStopped).toHaveBeenCalledWith(
      { client: expect.any(ECSClient), maxWaitTime: 1800 },
      {
        cluster: 'my-cluster',
        tasks: [taskArn]
      }
    );
    expect(mockInfo).toHaveBeenCalledWith('All tasks completed successfully');
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  it('should set failed when task fails and wait-for-finish is true', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return 'my-task:1';
      if (name === 'ecs-cluster') return 'my-cluster';
      if (name === 'subnets') return 'subnet-123';
      if (name === 'security-groups') return 'sg-123';
      if (name === 'wait-for-finish') return 'true';
      if (name === 'wait-timeout-seconds') return '900';
      return '';
    });

    const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    
    ecsClientMock.on(RunTaskCommand).resolves({
      tasks: [{ taskArn }]
    });

    mockWaitUntilTasksStopped.mockResolvedValue({ state: 'SUCCESS' } as any);
    
    ecsClientMock.on(DescribeTasksCommand).resolves({
      tasks: [{
        taskArn,
        containers: [{ name: 'container-1', exitCode: 1 }]
      }]
    });

    await run();

    expect(mockSetFailed).toHaveBeenCalledWith('One or more tasks failed');
  });

  it('should handle errors and set failed status', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return 'my-task:1';
      if (name === 'ecs-cluster') return 'my-cluster';
      if (name === 'subnets') return '';
      if (name === 'security-groups') return 'sg-123';
      if (name === 'wait-for-finish') return 'false';
      return '';
    });

    await run();

    expect(mockSetFailed).toHaveBeenCalledWith('At least one subnet must be specified');
  });

  it('should use default timeout when not specified', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return 'my-task:1';
      if (name === 'ecs-cluster') return 'my-cluster';
      if (name === 'subnets') return 'subnet-123';
      if (name === 'security-groups') return 'sg-123';
      if (name === 'wait-for-finish') return 'true';
      if (name === 'wait-timeout-seconds') return '';
      return '';
    });

    const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    
    ecsClientMock.on(RunTaskCommand).resolves({
      tasks: [{ taskArn }]
    });

    mockWaitUntilTasksStopped.mockResolvedValue({ state: 'SUCCESS' } as any);
    
    ecsClientMock.on(DescribeTasksCommand).resolves({
      tasks: [{
        taskArn,
        containers: [{ name: 'container-1', exitCode: 0 }]
      }]
    });

    await run();

    expect(mockWaitUntilTasksStopped).toHaveBeenCalledWith(
      { client: expect.any(ECSClient), maxWaitTime: 300 },
      {
        cluster: 'my-cluster',
        tasks: [taskArn]
      }
    );
  });

  it('should handle case-insensitive wait-for-finish values', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return 'my-task:1';
      if (name === 'ecs-cluster') return 'my-cluster';
      if (name === 'subnets') return 'subnet-123';
      if (name === 'security-groups') return 'sg-123';
      if (name === 'wait-for-finish') return 'TRUE';
      if (name === 'wait-timeout-seconds') return '900';
      return '';
    });

    const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    
    ecsClientMock.on(RunTaskCommand).resolves({
      tasks: [{ taskArn }]
    });

    mockWaitUntilTasksStopped.mockResolvedValue({ state: 'SUCCESS' } as any);
    
    ecsClientMock.on(DescribeTasksCommand).resolves({
      tasks: [{
        taskArn,
        containers: [{ name: 'container-1', exitCode: 0 }]
      }]
    });

    await run();

    expect(mockWaitUntilTasksStopped).toHaveBeenCalled();
  });
});
