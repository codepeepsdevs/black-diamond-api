FROM node:20


WORKDIR /app

# Copy Prisma configuration
COPY prisma ./

# Copy package.json and install dependencies
COPY package.json ./
RUN yarn

# Copy the entire project into the container
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN yarn build

# Expose port 3000 for the backend application
EXPOSE 3000

# Start the application
CMD ["yarn", "start:prod"]
