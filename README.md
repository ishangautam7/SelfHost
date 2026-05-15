# SelfHost 🚀

Turn your own device into a web server. SelfHost is a complete platform that provides subdomain routing, WebSocket tunnels, and an elegant Next.js dashboard to manage your self-hosted applications.

## Components

1. **Control Server (`/server`)**: A Rust backend (Actix-Web + SQLite) that handles user accounts, application state, subdomain routing, and WebSocket tunnel relaying.
2. **Host Agent (`/agent`)**: A Rust CLI binary that runs on your local device. It maintains a secure WebSocket tunnel to the Control Server and forwards incoming web traffic to your local applications.
3. **Frontend Dashboard (`/frontend`)**: A premium Next.js 14 (App Router) interface for users to manage their deployments, view resources, and get their agent connection commands.

## Getting Started

### 1. Set Up the Server (Your Cloud VPS)

The easiest way to run the server and frontend dashboard is using Docker Compose.

```bash
docker compose up -d
```

This will start:
- The Control Server on port `8080`
- The Next.js Frontend on port `3000`
- A SQLite database persisted in the `./data` directory

### 2. Configure DNS (Crucial)

For the subdomain routing to work, you MUST configure a wildcard DNS record for your domain.

If your domain is `ishangautam7.com.np` and you set `BASE_DOMAIN=selfhost.ishangautam7.com.np`:
- Add an `A` record for `*.selfhost` pointing to your server's IP address.
- Optionally, put a reverse proxy like Caddy or Nginx in front of port 8080 to handle TLS (HTTPS).

### 3. Run the Agent (Your Local Device)

On the device where your applications are actually running (e.g., your laptop, a Raspberry Pi, or a home server), run the agent:

```bash
# Build the agent
cargo build --release --bin agent

# Run the agent using the command provided in the web dashboard
./target/release/agent connect \
  --server ws://your-server-ip:8080/ws/tunnel \
  --api-key your-secret-api-key
```

### 4. Deploy an App

1. Start an application on your local device (e.g., a React app on port 3000, or an Express server on port 5000).
2. Go to your SelfHost dashboard.
3. Click "Deploy New App".
4. Enter the local port number your app is running on.
5. You instantly get a public URL like `http://my-app.selfhost.ishangautam7.com.np`!

## Technology Stack

* **Backend**: Rust, Actix-Web, Tokio, Sqlx (SQLite), actix-ws
* **Frontend**: Next.js (React), TypeScript, CSS Modules (Custom Design System)
* **Agent**: Rust, Tokio, tokio-tungstenite, Reqwest

## License

MIT
