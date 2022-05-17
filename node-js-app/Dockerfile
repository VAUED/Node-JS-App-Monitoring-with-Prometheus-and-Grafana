FROM node:16.10.0-alpine
WORKDIR /app
COPY package.json ./
RUN npm i
COPY index.js ./
EXPOSE 8080
CMD node index.js