FROM node:22-bookworm-slim

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PYTHON_BIN=python3
ENV PDF_PIPELINE=python

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/package.json
COPY apps/worker/requirements.txt apps/worker/requirements.txt

RUN pnpm install --filter worker --prod --frozen-lockfile
RUN python3 -m pip install --break-system-packages --no-cache-dir -r apps/worker/requirements.txt

COPY apps/worker apps/worker

WORKDIR /app/apps/worker

RUN node -e "require('./index').verifyPythonBridge().then(()=>console.log('worker preflight ok'))"

CMD ["node", "index.js"]
