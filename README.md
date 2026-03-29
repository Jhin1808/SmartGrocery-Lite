# SmartGrocery-Lite

SmartGrocery-Lite is a full-stack grocery list web application that allows users to create, manage, and share grocery lists online. The project includes authentication workflows, shared list support, expiry reminder functionality, and a Docker-based local development setup.

## Overview

This project was built to provide a more practical and collaborative grocery list experience than a basic note-taking app. It uses a separated frontend and backend architecture, supports Google authentication, and was developed to strengthen experience in full-stack development, debugging, and deployment workflows.

## Features

- User registration and login
- Google authentication
- Shared grocery lists across users
- Expiry reminder support
- Multi-user list workflows
- Persistent backend data storage
- Docker-based local development setup

## Tech Stack

### Frontend
- React
- React Router
- Bootstrap / React-Bootstrap

### Backend
- FastAPI
- SQLAlchemy
- Alembic
- Authlib
- JWT-based authentication

### Infrastructure
- Docker Compose
- PostgreSQL
- Environment-based configuration

## Project Structure

```text
SmartGrocery-Lite/
├── backend/
├── frontend/
├── docker-compose.yml
├── .env.example
├── README.md
└── .gitignore
