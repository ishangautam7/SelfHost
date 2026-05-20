# SelfHost

Turn your own device into a web server. SelfHost is a complete platform that provides subdomain routing, WebSocket tunnels, and an elegant Next.js dashboard to manage your self-hosted applications.

## Key Features

- 🚀 **Zero-Config Public URLs**: Instantly get a live HTTPS subdomain routed directly to a local port (e.g., `localhost:3000`).
- 🦀 **Blazing Fast Rust Agent**: Built a highly efficient WebSocket client in Rust for secure tunneling.
- 🌐 **Modern Dashboard**: A Next.js frontend to manage multiple apps, monitor active agents, and track live status.
- 🔗 **Multi-Device Support**: Connect multiple machines using API keys and manage them from a single dashboard.
- 🐘 **Robust Architecture**: Powered by a Node.js/Express reverse proxy in the cloud and a PostgreSQL database to manage state and routing.

## Components

1. **Control Server (`/api`)**: A Node.js backend (Express + PostgreSQL) that handles user accounts, application state, subdomain routing, and WebSocket tunnel relaying.
2. **Host Agent (`/agent`)**: A Rust CLI binary that runs on your local device. It maintains a secure WebSocket tunnel to the Control Server and forwards incoming web traffic to your local applications.
3. **Frontend Dashboard (`/frontend`)**: A premium Next.js 14 (App Router) interface for users to manage their deployments, view resources, and get their agent connection commands.

## Getting Started

### 1. Set Up the Server (Your Cloud VPS)

You can deploy the API and Frontend using Node.js and a PostgreSQL database.

```bash
# In the /api directory
npm install
npm run build
node dist/index.js

# In the /frontend directory
npm install
npm run build
npm start
```

### 2. Configure DNS (Crucial)

For the subdomain routing to work, you MUST configure a wildcard DNS record for your domain.

If your domain is `ishangautam7.com.np` and you set `BASE_DOMAIN=selfhost.ishangautam7.com.np`:
- Add an `A` record for `*.selfhost` pointing to your server's IP address.
- Optionally, put a reverse proxy like Caddy, Cloudflare, or Nginx in front to handle TLS (HTTPS).

### 3. Run the Agent (Your Local Device)

On the device where your applications are actually running (e.g., your laptop, a Raspberry Pi, or a home server), you need Rust installed (https://rustup.rs/). Then run the agent from the project root:

```bash
# Run the agent using the command provided in the web dashboard
cargo run --release --bin agent -- connect \
  --server wss://api.ishangautam7.com.np/ws/tunnel \
  --api-key your-secret-api-key
```

### 4. Deploy an App

1. Start an application on your local device (e.g., a React app on port 3000).
2. Go to your SelfHost dashboard.
3. Click "Deploy New App".
4. Enter the local port number your app is running on.
5. Click "Start" on your dashboard.
6. You instantly get a public URL like `http://my-app.selfhost.ishangautam7.com.np`!

## Technology Stack

* **Backend**: Node.js, Express, PostgreSQL, WebSockets
* **Frontend**: Next.js (React), TypeScript, CSS Modules (Custom Design System)
* **Agent**: Rust, Tokio, tokio-tungstenite, Reqwest

## License

MIT
