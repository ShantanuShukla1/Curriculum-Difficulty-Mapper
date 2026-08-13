# Curriculum Difficulty Mapper

Interactive tool for visualizing course prerequisites and identifying curriculum bottlenecks. Built as a Virginia Tech Computer Science senior capstone project.

## Overview

Curriculum Difficulty Mapper turns flat prerequisite lists into an interactive directed graph, scoring courses by blocking, delay, failure rate, and frequency. It was built for Virginia Tech CS advisors and students to help spot structural bottlenecks in the curriculum and plan smarter course paths, rather than relying on a static list of prerequisites that hides how one difficult course can hold up a dozen others down the line.

## Screenshot

<img width="2513" height="1352" alt="CurrDiffMapper" src="https://github.com/user-attachments/assets/f1805e45-7e40-47cf-a202-0767c8242b4c" />

## Tech Stack

- **Frontend:** React
- **Backend:** Flask / Python
- **Database:** SQLite
- **Graph engine:** NetworkX
- **Deployment:** Kubernetes

## Repo Structure
├── backend/ Flask API, graph construction, difficulty scoring, DB schema
│ → see backend/README.md for setup instructions
├── react-app/ React frontend, graph visualization, course inspection panels
│ → see react-app/README.md for setup instructions

## Features

- Directed graph modeling of Virginia Tech's CS course prerequisites and corequisites
- Composite difficulty scoring per course based on blocking, delay, failure rate, and offering frequency
- Click-to-inspect course panels showing detailed metrics
- Hover highlighting that isolates a course's dependency chain by fading unrelated nodes
- Dynamic highlighting of a course's longest dependency chain
- CSV-based data ingestion pipeline for curriculum data
- CAS-authenticated, shareable access for cross-department advisor use
- Dataset sharing and cascade-delete support with owner-gated permissions
- Kubernetes deployment for production use

## Getting Started

This is a full-stack application with separate backend and frontend services. See the README in each directory for setup and running instructions:

- [`backend/README.md`](backend/README.md)
- [`react-app/README.md`](react-app/README.md)

## Team

- Shantanu Shukla
- Jonathan Michel
- Nathaniel Dunlap

## License

This project was developed for academic purposes as part of the Virginia Tech Computer Science capstone program.

*This is a reuploaded version from the private GitLab where this was originally being worked on
