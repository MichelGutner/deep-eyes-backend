# Build stage
FROM node:20.14.0-alpine as builder

EXPOSE 3001

# Install Tini for process management
RUN apk add --no-cache tini curl

WORKDIR /deep-eyes

# Copy package files
COPY . ./
COPY src ./src

RUN mkdir deep-eyes && chown -R node:node .
USER node

RUN yarn
RUN yarn build
RUN yarn db:generate


ENTRYPOINT [ "/sbin/tini", "--" ]

# Production stage
FROM builder as production
ENV NODE_ENV=production

# Install only production dependencies
RUN yarn install --production

# Copy built application from builder stage
COPY --chown=node scripts/env.sh ./env.sh
RUN ["chmod", "+x", "./env.sh" ]

ENV DATABASE_URL=postgresql://user:pass@postgres:5432/deep_eyes

RUN npm prune --production

CMD ["/bin/sh", "-c", "source /deep-eyes/env.sh && node dist/src/main.js && npm run start:prod"] 