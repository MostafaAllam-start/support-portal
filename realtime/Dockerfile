FROM node:20-alpine

WORKDIR /app

# Install dependencies using pnpm
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN npm install -g pnpm && pnpm install

# Copy code
COPY . .

# Standalone Socket.IO server runs on PORT 3001
EXPOSE 3001

ENV PORT=3001

CMD ["npx", "tsx", "realtime/socketServer.ts"]
