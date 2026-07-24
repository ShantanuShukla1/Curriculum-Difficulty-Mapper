#!/bin/bash

set -e

TAG=${1:-latest}

IMAGE="container.cs.vt.edu/nathan925/jsn-capstone/frontend:$TAG"

echo "Building frontend image..."
docker build --platform=linux/amd64 -t "$IMAGE" .

echo "Pushing frontend image..."
docker push "$IMAGE"

echo "Frontend image pushed successfully:"
echo "$IMAGE"