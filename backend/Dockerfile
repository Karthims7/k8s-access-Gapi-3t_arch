# Use lightweight official Node image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy app source code
COPY . .

# Expose backend port
EXPOSE 5000

# Start backend
CMD ["npm", "start"]
