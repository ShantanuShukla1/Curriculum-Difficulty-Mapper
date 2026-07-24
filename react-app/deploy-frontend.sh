#!/bin/bash

TAG=${1:-latest}

echo "Building frontend image with tag: $TAG"

docker build --platform=linux/amd64 \
  -t container.cs.vt.edu/nathan925/jsn-capstone/frontend:$TAG \
  .

echo "Pushing frontend image..."

docker push container.cs.vt.edu/nathan925/jsn-capstone/frontend:$TAG

echo "Done."