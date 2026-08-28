FROM mcr.microsoft.com/devcontainers/javascript-node:26-bookworm

ARG CLAUDE_CODE_VERSION=2.1.247
ARG CODEX_VERSION=0.149.0

COPY package.json /tmp/busy-octopus-package.json

RUN npm install --global --allow-scripts=@anthropic-ai/claude-code \
  "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
  "@openai/codex@${CODEX_VERSION}" \
  "$(node --print "require('/tmp/busy-octopus-package.json').packageManager")" \
  && rm /tmp/busy-octopus-package.json
