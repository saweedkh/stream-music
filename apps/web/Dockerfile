FROM node:20-alpine

WORKDIR /app

# Do NOT copy .npmrc — it points to devneeds.ir which serves incomplete packages.
# Do NOT copy the lockfile — its resolved URLs also point to devneeds.ir.
# Install fresh from the official registry so all packages are complete.
COPY .npmrc package.json package-lock.json ./
RUN npm ci

COPY . /app
