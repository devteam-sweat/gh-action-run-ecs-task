import * as core from '@actions/core'
import {
    ECSClient,
    RunTaskCommand,
    RunTaskCommandInput,
    NetworkConfiguration,
    waitUntilTasksStopped,
    DescribeTasksCommand
} from '@aws-sdk/client-ecs'

export function getNetworkConfiguration(): NetworkConfiguration {
    const subnetsInput = core.getInput('subnets')
    const securityGroupsInput = core.getInput('security-groups')

    const subnets = subnetsInput.split(',').map(s => s.trim()).filter(s => s.length > 0)
    const securityGroups = securityGroupsInput.split(',').map(s => s.trim()).filter(s => s.length > 0)

    if (subnets.length === 0) {
        throw new Error('At least one subnet must be specified')
    }

    if (securityGroups.length === 0) {
        throw new Error('At least one security group must be specified')
    }

    return {
        awsvpcConfiguration: {
            subnets: subnets,
            securityGroups: securityGroups,
            assignPublicIp: 'DISABLED'
        }
    }
}

export async function runTask(ecsClient: ECSClient, taskDefinition: string, ecsCluster: string, networkConfiguration: NetworkConfiguration): Promise<string[]> {
    const params: RunTaskCommandInput = {
        taskDefinition: taskDefinition,
        cluster: ecsCluster,
        networkConfiguration: networkConfiguration,
        launchType: 'FARGATE',
    }

    const runTaskOut = await ecsClient.send(new RunTaskCommand(params))

    // get task Arn from runTaskOut
    const taskArns = runTaskOut.tasks?.map(task => task.taskArn!) || []
    core.info(`Started task(s): ${taskArns.join(', ')}`)

    if (taskArns.length === 0) {
        core.setFailed('No tasks were started')
        throw new Error('No tasks were started')
    }

    return taskArns
}

export async function waitForTasks(ecsClient: ECSClient, ecsCluster: string, taskArns: string[], waitTimeoutSeconds: number): Promise<boolean> {
    core.info(`Waiting for task(s) to stop: ${taskArns.join(', ')}`)

    await waitUntilTasksStopped({ client: ecsClient, maxWaitTime: waitTimeoutSeconds }, {
        cluster: ecsCluster,
        tasks: taskArns
    })

    core.info(`Task(s) have stopped, getting exit codes`)

    const taskDetails = await ecsClient.send(new DescribeTasksCommand({
        cluster: ecsCluster,
        tasks: taskArns
    }))

    let allSuccessful = true
    for (const task of taskDetails.tasks || []) {
        const containers = task.containers || []
        for (const container of containers) {
            const exitCode = container.exitCode
            core.info(`Task ${task.taskArn} - Container ${container.name} exited with code ${exitCode}`)
            if (exitCode !== 0) {
                allSuccessful = false
            }
        }
    }

    if (!allSuccessful) {
        core.error('One or more tasks failed')
        return false
    }

    core.info('All tasks completed successfully')
    return true
}

export async function run() {
    try {
        const taskDefinition = core.getInput("task-definition")
        const ecsCluster = core.getInput("ecs-cluster")
        const waitForFinish = core.getInput('wait-for-finish')
        const waitTimeoutSecondsInput = core.getInput('wait-timeout-seconds')
        const waitTimeoutSeconds = waitTimeoutSecondsInput ? parseInt(waitTimeoutSecondsInput, 10) : 300

        const networkConfiguration = getNetworkConfiguration()

        const ecsClient = new ECSClient()

        const taskArns = await runTask(ecsClient, taskDefinition, ecsCluster, networkConfiguration)

        var success = true
        if (waitForFinish.toLowerCase() === 'true') {
            success = await waitForTasks(ecsClient, ecsCluster, taskArns, waitTimeoutSeconds)
        }

        if (!success) {
            core.setFailed('One or more tasks failed')
        }
    } catch (err) {
        if (err instanceof Error) {
            core.setFailed(err.message)
            core.debug(err.stack || '')
        } else {
            core.setFailed(String(err))
        }
    }
}

if (require.main === module) {
    run()
}