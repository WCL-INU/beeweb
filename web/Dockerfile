# Use the official Node.js image from the Docker Hub
FROM node:14

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Give execute permission to wait-for-it.sh
RUN chmod +x wait-for-it.sh

# Start the app
CMD ["./wait-for-it.sh", "mariadb:3306", "--", "node", "server.js"]
