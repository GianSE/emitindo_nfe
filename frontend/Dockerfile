FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 5173
# serve o build; o browser (no host) chama o backend em localhost:3001
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
