# Runs exactly what Render runs: build the React app, then serve it and the
# online API from one Node process.
#
# The previous version of this file built the app and handed it to nginx as
# static files. That silently drops the server, so online play has no API to
# talk to, and nginx listened on a hardcoded port instead of the one the host
# assigns. Anything serving this app needs to run the Node server.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Hosts inject the port to listen on; 4000 is only the local default.
ENV PORT=4000
EXPOSE 4000

CMD ["node", "server/index.mjs"]
