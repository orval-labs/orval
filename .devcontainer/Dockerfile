FROM node:22.22.3-bookworm

RUN apt-get update && apt-get install -y \
  git \
  vim \
  curl \
  unzip \
  && rm -rf /var/lib/apt/lists/*

# Vite+ unified toolchain CLI (`vp`), pinned to the repo's catalog version.
# The project-local vp (node_modules/.bin) must win over the global one:
# the global copy resolves `typescript` from its own tree and fails dts builds.
RUN npm install -g vite-plus@0.2.9

USER node
ENV BUN_INSTALL=/home/node/.bun
ENV PATH="/app/node_modules/.bin:${BUN_INSTALL}/bin:${PATH}"

# Bun is required: package.json declares packageManager bun@1.4.2. Keep this in
# step with it: from 1.4.2 `bun install` links workspace bins (the `orval` CLI
# the samples and tests run) even before the package is built.
# SHA-256 from https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/SHASUMS256.txt
ARG TARGETARCH
ARG BUN_VERSION=1.4.2
ARG BUN_SHA256_AMD64=36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913
ARG BUN_SHA256_ARM64=54328bbc2d9c8e0c9f892c544d66c57a83b84139e34909e5ee81758f1ac8fda7
RUN set -eux; \
  case "${TARGETARCH}" in \
    amd64) BUN_ARCH=x64;     BUN_SHA256="${BUN_SHA256_AMD64}" ;; \
    arm64) BUN_ARCH=aarch64; BUN_SHA256="${BUN_SHA256_ARM64}" ;; \
    *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
  esac; \
  curl -fsSL -o /tmp/bun.zip \
    "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-${BUN_ARCH}.zip"; \
  echo "${BUN_SHA256}  /tmp/bun.zip" | sha256sum -c -; \
  mkdir -p "${BUN_INSTALL}/bin"; \
  unzip -q /tmp/bun.zip -d /tmp; \
  mv "/tmp/bun-linux-${BUN_ARCH}/bun" "${BUN_INSTALL}/bin/bun"; \
  chmod +x "${BUN_INSTALL}/bin/bun"; \
  ln -s bun "${BUN_INSTALL}/bin/bunx"; \
  rm -rf /tmp/bun.zip "/tmp/bun-linux-${BUN_ARCH}"; \
  bun --version

WORKDIR /app
CMD ["bash"]
