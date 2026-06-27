FROM node:20-slim

# Install Chromium and all required system dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    libgbm-dev libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 \
    libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \
    libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxss1 libxtst6 ca-certificates fonts-liberation libnss3 lsb-release xdg-utils wget \
    zip unzip --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to skip downloading Chrome (we use system Chromium)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Give Node.js adequate heap memory for Puppeteer (Render free tier = 512MB)
ENV NODE_OPTIONS="--max-old-space-size=460"

# npm start runs: node scripts/patch-wwebjs.js && node index.js
CMD ["npm", "start"]
