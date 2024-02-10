FROM oven/bun:1 as base
ENV workDir /home/bun/app

WORKDIR ${workDir}

COPY package.json bun.lockb ${workDir}/

RUN bun install --frozen-lockfile --production

COPY . .

RUN mkdir  -p /home/bun/app/data
RUN chown -R bun:bun ${workDir}

ENV NODE_ENV=production

USER bun
EXPOSE 8080
ENTRYPOINT [ "bun", "run", "index.mts" ]
