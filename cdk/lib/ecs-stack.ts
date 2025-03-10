import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as assets from 'aws-cdk-lib/aws-ecr-assets';
import * as path from 'path';

export class EcsStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Build docker container and initialize a docker image asset
        const dockerImageAsset = new assets.DockerImageAsset(this, 'RustDockerImage', {
            // Directory containing the Dockerfile
            // __dirname will resolve the relative path, starting from the directory of this file.
            // If __dirname is not used, it will try to resolve the relative path starting from the location from where build is invoked.
            directory: path.join(__dirname, '../../'),
            exclude: [
                '**/target',  // Rust build artifacts
                'cdk', // Exclude everthing under cdk folder
                '**/node_modules',  // Exclude node_modules under cdk
                '**/cdk.out' // Exclude cdk output
            ],
            platform: assets.Platform.LINUX_ARM64,
        });

        // Try to fetch existing ECR repository, create if it doesn't exist
        const ECS_REPO_NAME = 'my-rust-app-repo';
        let repository: ecr.IRepository;
        try {
            repository = ecr.Repository.fromRepositoryName(this, 'RustEcrRepo', ECS_REPO_NAME);
        } catch {
            repository = new ecr.Repository(this, 'RustEcrRepo', {
                repositoryName: ECS_REPO_NAME,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
                imageScanOnPush: true, // Optional: enables vulnerability scanning
                lifecycleRules: [
                    {
                        maxImageCount: 5, // Keep only the 5 most recent images
                        description: 'Only keep 5 most recent images'
                    }
                ]
            });
        }

        // Create a VPC to host the ECS cluster
        const vpc = new ec2.Vpc(this, 'rust-app-vpc', { maxAzs: 2 });
        const ecsCluster = new ecs.Cluster(this, 'rust-app-cluster', { vpc });

        const taskDefinition = new ecs.FargateTaskDefinition(this, 'rust-app-task-defn', {
            // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size
            cpu: 256, // 256 (0.25 vCPU) to 16384 (16 vCPU).
            memoryLimitMiB: 512, /* 512 (0.5 GB) to 122880 (120 GB). Higher memory limits are supported only when higher vCPU count is used. */
            ephemeralStorageGiB: 20, // 20 to 200GB
            runtimePlatform: {
                cpuArchitecture: ecs.CpuArchitecture.ARM64,
                operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
            },
        });

        taskDefinition.addContainer('rust-app-container', {
            image: ecs.ContainerImage.fromDockerImageAsset(dockerImageAsset),
            logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'ecs-logs' }),
            // healthCheck is optional. This tries to make sure that the rust process is running.
            healthCheck: {
                command: ['CMD-SHELL', 'pgrep benchmark-demo || exit 1'],
                interval: cdk.Duration.seconds(30),
                timeout: cdk.Duration.seconds(5),
                retries: 3,
                startPeriod: cdk.Duration.seconds(10),
            }
        });

        // Create an ECS Service WITHOUT a Load Balancer
        const service = new ecs.FargateService(this, 'rust-app-service', {
            cluster: ecsCluster,
            taskDefinition,
            desiredCount: 1,
            assignPublicIp: false, // Set to false if inside a private subnet with NAT
            // Enable execute-command (similar to SSM in EC2)
            // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html
            // https://docs.aws.amazon.com/cli/latest/reference/ecs/execute-command.html
            enableExecuteCommand: true,
        });

        // Grant ECS task role permissions to pull from ECR
        repository.grantPull(service.taskDefinition.executionRole!);
    }
}
