#!/bin/bash

TAG=${1:-latest}

echo "Building backend image with tag: $TAG"
docker build --platform=linux/amd64 \
  -t container.cs.vt.edu/nathan925/jsn-capstone/backend:$TAG \
  .

echo "Pushing backend image..."
docker push container.cs.vt.edu/nathan925/jsn-capstone/backend:$TAG

echo "Done."
