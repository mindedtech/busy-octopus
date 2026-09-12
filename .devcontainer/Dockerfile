FROM mcr.microsoft.com/devcontainers/javascript-node:26-bookworm

ARG CLAUDE_CODE_VERSION=2.1.247
ARG CODEX_VERSION=0.154.0

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxkbfile1 \
    libxrandr2 \
    libxss1 \
    xauth \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

COPY package.json /tmp/busy-octopus-package.json

RUN npm install --global --allow-scripts=@anthropic-ai/claude-code \
  "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
  "@openai/codex@${CODEX_VERSION}" \
  "$(node --print "require('/tmp/busy-octopus-package.json').packageManager")" \
  && rm /tmp/busy-octopus-package.json
