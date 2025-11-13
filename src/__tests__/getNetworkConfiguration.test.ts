import * as core from '@actions/core';
import { getNetworkConfiguration } from '../index';

jest.mock('@actions/core');

describe('getNetworkConfiguration', () => {
  const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should parse single subnet and security group', () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'subnets') return 'subnet-12345678';
      if (name === 'security-groups') return 'sg-12345678';
      return '';
    });

    const result = getNetworkConfiguration();

    expect(result).toEqual({
      awsvpcConfiguration: {
        subnets: ['subnet-12345678'],
        securityGroups: ['sg-12345678'],
        assignPublicIp: 'DISABLED'
      }
    });
  });

  it('should parse multiple comma-separated subnets and security groups', () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'subnets') return 'subnet-111, subnet-222, subnet-333';
      if (name === 'security-groups') return 'sg-111, sg-222';
      return '';
    });

    const result = getNetworkConfiguration();

    expect(result).toEqual({
      awsvpcConfiguration: {
        subnets: ['subnet-111', 'subnet-222', 'subnet-333'],
        securityGroups: ['sg-111', 'sg-222'],
        assignPublicIp: 'DISABLED'
      }
    });
  });

  it('should trim whitespace from subnet and security group IDs', () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'subnets') return '  subnet-111  ,  subnet-222  ';
      if (name === 'security-groups') return '  sg-111  ,  sg-222  ';
      return '';
    });

    const result = getNetworkConfiguration();

    expect(result.awsvpcConfiguration?.subnets).toEqual(['subnet-111', 'subnet-222']);
    expect(result.awsvpcConfiguration?.securityGroups).toEqual(['sg-111', 'sg-222']);
  });

  it('should filter out empty strings from subnets', () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'subnets') return 'subnet-111,,subnet-222,';
      if (name === 'security-groups') return 'sg-111';
      return '';
    });

    const result = getNetworkConfiguration();

    expect(result.awsvpcConfiguration?.subnets).toEqual(['subnet-111', 'subnet-222']);
  });

  it('should throw error when no subnets are provided', () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'subnets') return '';
      if (name === 'security-groups') return 'sg-12345678';
      return '';
    });

    expect(() => getNetworkConfiguration()).toThrow('At least one subnet must be specified');
  });

  it('should throw error when only empty subnets are provided', () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'subnets') return '  ,  ,  ';
      if (name === 'security-groups') return 'sg-12345678';
      return '';
    });

    expect(() => getNetworkConfiguration()).toThrow('At least one subnet must be specified');
  });

  it('should throw error when no security groups are provided', () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'subnets') return 'subnet-12345678';
      if (name === 'security-groups') return '';
      return '';
    });

    expect(() => getNetworkConfiguration()).toThrow('At least one security group must be specified');
  });

  it('should throw error when only empty security groups are provided', () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'subnets') return 'subnet-12345678';
      if (name === 'security-groups') return '  ,  ,  ';
      return '';
    });

    expect(() => getNetworkConfiguration()).toThrow('At least one security group must be specified');
  });
});
