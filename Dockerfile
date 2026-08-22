FROM node:20


WORKDIR /app

# Copy Prisma configuration
COPY prisma ./

# Copy dependency manifests and install the locked dependency graph
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive

# Copy the entire project into the container
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build && test -f dist/main.js

# Expose port 3000 for the backend application
EXPOSE 5000

# Start the application
CMD ["npm", "run", "start:prod"]
