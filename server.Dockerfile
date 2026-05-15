FROM rust:1-alpine as builder

WORKDIR /usr/src/app
# Install system dependencies needed for compilation
RUN apk add --no-cache musl-dev sqlite-dev openssl-dev build-base pkgconfig

# Copy entire workspace
COPY . .

# Build the server crate
RUN cargo build --release --bin server

FROM alpine:latest
RUN apk add --no-cache sqlite-libs libgcc

WORKDIR /app
COPY --from=builder /usr/src/app/target/release/server /usr/local/bin/server

# Create data directory for sqlite
RUN mkdir -p /data

CMD ["server"]
