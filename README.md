# Demo CDK app that runs Rust application in ECS fargate

* Rust application is inside the `benchmark-demo` directory.
* Dockerfile to build a container that runs the Rust application is at the top level directory. This builds the rust application in a build container that uses the same architecture as the runtime container. It copies the built binary into the runtime container.
* CDK code that builds the container, and sets up the CDK stack is inside the `cdk` directory.

To build and deploy the cdk stack, use

```bash
# From within the cdk directory
npx cdk deploy --require-approval never
```

## One time setup commands that were used to setup the project

```bash
# Install cdk
npm install -g aws-cdk
mkdir cdk && cd cdk
# Run the following only from within the cdk folder. It won't work otherwise.
cdk init app --language=typescript
cdk bootstrap
```

## Deploy and destroy the stack

```bash
# From within the cdk directory
# Deploy
npx cdk deploy --require-approval never
# Destroy the cdk stack
cdk destroy
```

## Locally test the container

```bash
docker buildx build -t benchmark-demo .
docker run --name benchmark-test benchmark-demo
docker logs benchmark-test
docker inspect benchmark-test -f '{{.State.ExitCode}}'

docker stop benchmark-test
docker rm benchmark-test
```

## ExecuteCommand on the ECS container

```bash
# Run a single command
aws ecs execute-command \
    --cluster rust-app-cdk-stack-rustappcluster986F4E58-8oJYkAhi3aUg \
    --container rust-app-container \
    --command 'pgrep benchmark-demo' \
    --interactive \
    --task 1e3875a502414b4088b01713c9edbc36

# Start a shell and you can run any command in it
aws ecs execute-command \
    --cluster rust-app-cdk-stack-rustappcluster986F4E58-8oJYkAhi3aUg \
    --container rust-app-container \
    --command '/bin/sh' \
    --interactive \
    --task 1e3875a502414b4088b01713c9edbc36
```
