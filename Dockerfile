FROM node:22-slim

WORKDIR /app

# better-sqlite3 has native bindings; these let npm compile them if no
# prebuilt binary matches the container's platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first so Docker can cache this layer when only
# application code changes, not package.json.
COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]