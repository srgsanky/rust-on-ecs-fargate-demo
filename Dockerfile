# Use build arg for platform
ARG TARGETPLATFORM=linux/arm64

####################################################################
# Build rust code in container
####################################################################
# Container for building rust code
# Use a Rust official image for build
FROM --platform=$TARGETPLATFORM rust:latest AS builder
# This will autocreate /app if it doesn't already exist.
WORKDIR /app
# First, copy only the Cargo.toml file
COPY benchmark-demo/Cargo.toml ./
# Create src directory
RUN mkdir src
# Build dependencies only (this layer will be cached unless Cargo.toml changes)
RUN cargo build --release || true

# Only the following commands run when you iterate on the application code without adding new dependencies to Cargo.toml

# Now copy the source code (this will invalidate cache when source changes)
COPY benchmark-demo/src ./src
# Build the actual application to create the binary
RUN cargo build --release
####################################################################


####################################################################
# Runtime container configuration
####################################################################
# Use Amazon Linux as the runtime image
FROM --platform=$TARGETPLATFORM public.ecr.aws/amazonlinux/amazonlinux:2023
# Install procps-ng (for pgrep) - using dnf
RUN dnf install -y procps-ng && dnf clean all
WORKDIR /app
# Copy the binary from the build container to the runtime container
COPY --from=builder /app/target/release/benchmark-demo .
ENTRYPOINT ["./benchmark-demo"]
####################################################################