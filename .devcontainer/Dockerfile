FROM node:22.22.3-bookworm

RUN apt-get update && apt-get install -y \
  git \
  vim \
  curl \
  unzip \
  && rm -rf /var/lib/apt/lists/*

# Bun is required: package.json declares packageManager bun@1.3.14 and
# postinstall runs `bun scripts/link-workspace-bins.mjs`.
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"
ENV BUN_INSTALL=/root/.bun
ENV PATH="/root/.bun/bin:${PATH}"

# Vite+ unified toolchain CLI (`vp`), pinned to the repo's catalog version.
# The project-local vp (node_modules/.bin) must win over the global one:
# the global copy resolves `typescript` from its own tree and fails dts builds.
RUN npm install -g vite-plus@0.2.9
ENV PATH="/app/node_modules/.bin:${PATH}"

WORKDIR /app
CMD ["bash"]
