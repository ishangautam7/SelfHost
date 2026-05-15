# Running SelfHost Locally (Without Docker)

It looks like your system has an older version of Docker where the compose command requires a hyphen (`docker-compose` instead of `docker compose`), or Docker Compose isn't fully installed.

No problem! You can easily run the entire platform directly on your machine without Docker. Here is exactly how to do it.

## Prerequisites

Make sure you have:
1. **Rust** installed (`cargo`)
2. **Node.js** installed (`npm`)

## Step 1: Start the Backend Server

The backend is a Rust Actix-Web server that handles the database, routing, and WebSocket tunnels.

Open a terminal in the root directory of the project (`/run/media/ishan/New Volume/SelfHost`) and run:

```bash
# This will compile and run the Control Server
cargo run --bin server
```

*Note: This will automatically create the SQLite database file (`selfhost.db`) in the same directory.*
*The server will start running on `http://localhost:8080`.*

## Step 2: Start the Web Dashboard

The frontend is a Next.js React application.

Open a **second, separate terminal**, navigate to the `frontend` folder, and start the development server:

```bash
cd frontend
npm run dev
```

*The frontend will start running on `http://localhost:3000`.*

## Step 3: Access the Platform

1. Open your web browser and go to: **[http://localhost:3000](http://localhost:3000)**
2. You will see the Login page. Since this is your first time, click **"Create one"** (or go to `/register`) to create your account.
3. Once logged in, you will be on the Dashboard.

## Step 4: Run the Local Agent (Connecting a device)

Now you need to run the Agent. The Agent is what connects your local device to the Control Server so your apps can be exposed.

Open a **third terminal** in the root directory of the project (`/run/media/ishan/New Volume/SelfHost`) and run the agent using the API key from your dashboard:

```bash
# Replace YOUR_API_KEY with the key shown on your dashboard
cargo run --bin agent -- connect --server ws://localhost:8080/ws/tunnel --api-key YOUR_API_KEY
```

*You should see logs saying the agent has successfully connected to the server.*

## Step 5: Expose a Local App!

1. Make sure you have some app running locally (for example, a simple Python web server running on port `8000`).
2. Go to your Web Dashboard ([http://localhost:3000/dashboard](http://localhost:3000/dashboard)).
3. Click **"Deploy New App"**.
4. Give it a name (like `test-app`) and enter the port your app is running on (e.g., `8000`).
5. Click Deploy.
6. The dashboard will give you a URL (e.g., `test-app.selfhost.ishangautam7.com.np`). 

*(Note: Because you are running locally without configuring DNS on your router, to actually visit that custom URL on your own machine, you would need to add `127.0.0.1 test-app.selfhost.ishangautam7.com.np` to your computer's `/etc/hosts` file. However, the system is fully functional!)*

---

### A Note on Docker Compose
If you ever want to try the Docker route again on this machine, try running `docker-compose up -d --build` (with a hyphen between docker and compose). Older Docker installations use the hyphenated command!
