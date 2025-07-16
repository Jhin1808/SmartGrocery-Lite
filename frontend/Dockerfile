# Use the official Node LTS image
FROM node:20-slim

# Set your working directory in the container
WORKDIR /app

# Copy only package.json and package-lock.json first
# This lets Docker cache `npm install` unless these files change
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of your source code
COPY . .

# Enable reliable file watching inside Docker
ENV CHOKIDAR_USEPOLLING=true
# Tell React’s dev server to listen on all interfaces
ENV HOST=0.0.0.0

# Expose the port React uses by default
EXPOSE 3000

# Start the development server
CMD ["npm", "start"]

