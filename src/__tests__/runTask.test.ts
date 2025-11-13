import * as core from '@actions/core';
import { ECSClient, RunTaskCommand, AssignPublicIp } from '@aws-sdk/client-ecs';
import { mockClient } from 'aws-sdk-client-mock';
import { runTask } from '../index';

jest.mock('@actions/core');

const ecsClientMock = mockClient(ECSClient);

describe('runTask', () => {
  const mockInfo = core.info as jest.MockedFunction<typeof core.info>;
  const mockSetFailed = core.setFailed as jest.MockedFunction<typeof core.setFailed>;

  beforeEach(() => {
    jest.clearAllMocks();
    ecsClientMock.reset();
  });

  const networkConfiguration = {
    awsvpcConfiguration: {
      subnets: ['subnet-123'],
      securityGroups: ['sg-123'],
      assignPublicIp: AssignPublicIp.DISABLED
    }
  };

  it('should successfully run a task and return task ARN', async () => {
    const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    
    ecsClientMock.on(RunTaskCommand).resolves({
      tasks: [{ taskArn }]
    });

    const ecsClient = new ECSClient();
    const result = await runTask(ecsClient, 'my-task:1', 'my-cluster', networkConfiguration);

    expect(result).toEqual([taskArn]);
    expect(mockInfo).toHaveBeenCalledWith(`Started task(s): ${taskArn}`);
  });

  it('should handle multiple tasks being started', async () => {
    const taskArn1 = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    const taskArn2 = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/def456';
    
    ecsClientMock.on(RunTaskCommand).resolves({
      tasks: [{ taskArn: taskArn1 }, { taskArn: taskArn2 }]
    });

    const ecsClient = new ECSClient();
    const result = await runTask(ecsClient, 'my-task:1', 'my-cluster', networkConfiguration);

    expect(result).toEqual([taskArn1, taskArn2]);
    expect(mockInfo).toHaveBeenCalledWith(`Started task(s): ${taskArn1}, ${taskArn2}`);
  });

  it('should throw error when no tasks are started', async () => {
    ecsClientMock.on(RunTaskCommand).resolves({
      tasks: []
    });

    const ecsClient = new ECSClient();
    
    await expect(runTask(ecsClient, 'my-task:1', 'my-cluster', networkConfiguration))
      .rejects.toThrow('No tasks were started');
    
    expect(mockSetFailed).toHaveBeenCalledWith('No tasks were started');
  });

  it('should throw error when tasks field is undefined', async () => {
    ecsClientMock.on(RunTaskCommand).resolves({});

    const ecsClient = new ECSClient();
    
    await expect(runTask(ecsClient, 'my-task:1', 'my-cluster', networkConfiguration))
      .rejects.toThrow('No tasks were started');
  });

  it('should send correct RunTaskCommand parameters', async () => {
    const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123';
    
    ecsClientMock.on(RunTaskCommand).resolves({
      tasks: [{ taskArn }]
    });

    const ecsClient = new ECSClient();
    await runTask(ecsClient, 'my-task:1', 'my-cluster', networkConfiguration);

    const calls = ecsClientMock.commandCalls(RunTaskCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toEqual({
      taskDefinition: 'my-task:1',
      cluster: 'my-cluster',
      networkConfiguration: networkConfiguration,
      launchType: 'FARGATE'
    });
  });
});
