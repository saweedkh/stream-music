FROM node:20-alpine

WORKDIR /app

COPY .npmrc /app/.npmrc
COPY package.json /app/package.json
RUN npm install

COPY . /app

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]
