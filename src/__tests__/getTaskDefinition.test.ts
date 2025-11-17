import * as core from '@actions/core';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import { getTaskDefinition } from '../index';

jest.mock('@actions/core');

const ssmClientMock = mockClient(SSMClient);

describe('getTaskDefinition', () => {
  const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>;

  beforeEach(() => {
    jest.clearAllMocks();
    ssmClientMock.reset();
  });

  it('should return task-definition input when provided', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return 'my-task:1';
      if (name === 'task-definition-from-parameter') return '';
      return '';
    });

    const result = await getTaskDefinition();

    expect(result).toBe('my-task:1');
    expect(ssmClientMock.calls()).toHaveLength(0);
  });

  it('should return task definition ARN when provided', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return 'arn:aws:ecs:us-east-1:123456789012:task-definition/my-task:1';
      if (name === 'task-definition-from-parameter') return '';
      return '';
    });

    const result = await getTaskDefinition();

    expect(result).toBe('arn:aws:ecs:us-east-1:123456789012:task-definition/my-task:1');
    expect(ssmClientMock.calls()).toHaveLength(0);
  });

  it('should fetch task definition from SSM parameter when task-definition is empty', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return '';
      if (name === 'task-definition-from-parameter') return '/ecs/task-definitions/my-task';
      return '';
    });

    ssmClientMock.on(GetParameterCommand).resolves({
      Parameter: {
        Value: 'my-task:2'
      }
    });

    const result = await getTaskDefinition();

    expect(result).toBe('my-task:2');
    expect(ssmClientMock.calls()).toHaveLength(1);
    const call = ssmClientMock.call(0);
    expect(call.args[0].input).toEqual({
      Name: '/ecs/task-definitions/my-task'
    });
  });

  it('should fetch task definition ARN from SSM parameter', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return '';
      if (name === 'task-definition-from-parameter') return '/ecs/task-definitions/prod';
      return '';
    });

    ssmClientMock.on(GetParameterCommand).resolves({
      Parameter: {
        Value: 'arn:aws:ecs:us-east-1:123456789012:task-definition/my-task:5'
      }
    });

    const result = await getTaskDefinition();

    expect(result).toBe('arn:aws:ecs:us-east-1:123456789012:task-definition/my-task:5');
  });

  it('should throw error when neither input is provided', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return '';
      if (name === 'task-definition-from-parameter') return '';
      return '';
    });

    await expect(getTaskDefinition()).rejects.toThrow(
      'Either task-definition or task-definition-from-parameter input must be provided'
    );
  });

  it('should throw error when SSM parameter has no value', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return '';
      if (name === 'task-definition-from-parameter') return '/ecs/task-definitions/my-task';
      return '';
    });

    ssmClientMock.on(GetParameterCommand).resolves({
      Parameter: {
        Value: undefined
      }
    });

    await expect(getTaskDefinition()).rejects.toThrow(
      'task-definition-from-parameter SSM Parameter /ecs/task-definitions/my-task has no value'
    );
  });

  it('should throw error when SSM parameter does not exist', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return '';
      if (name === 'task-definition-from-parameter') return '/ecs/task-definitions/my-task';
      return '';
    });

    ssmClientMock.on(GetParameterCommand).resolves({
      Parameter: undefined
    });

    await expect(getTaskDefinition()).rejects.toThrow(
      'task-definition-from-parameter SSM Parameter /ecs/task-definitions/my-task has no value'
    );
  });

  it('should prefer task-definition input over task-definition-from-parameter', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'task-definition') return 'my-task:1';
      if (name === 'task-definition-from-parameter') return '/ecs/task-definitions/my-task';
      return '';
    });

    const result = await getTaskDefinition();

    expect(result).toBe('my-task:1');
    expect(ssmClientMock.calls()).toHaveLength(0);
  });
});
