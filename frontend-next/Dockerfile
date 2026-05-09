FROM node:20-alpine

WORKDIR /app

COPY .npmrc package.json package-lock.json ./
RUN npm ci

COPY . /app

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]
