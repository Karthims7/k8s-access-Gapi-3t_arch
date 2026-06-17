# Kubernetes Gateway API Microservices Demo (JioFiber & Docker Desktop Network Guide)

This project is a working demonstration of a **three-tier microservices architecture** deployed locally on a **Docker Desktop Kubernetes cluster** and routed via the **Kubernetes Gateway API (Envoy Gateway)**. It is configured as a hybrid deployment, where frontend and API pods run inside Kubernetes, but route data directly to the native **PostgreSQL server running on your Mac host**.

---

## 🏗️ Architecture Overview

```
[ External User / Local Browser ]
             │
             ▼
      [ Port 80 (HTTP) ]
             │
             ▼
┌────────────────────────────────────────────────────────┐
│ Kubernetes Cluster (Docker Desktop VM)                 │
│                                                        │
│   1. Envoy Proxy (Configured via my-gateway)           │
│      ├── Routes /api/*  ──► 2. backend-service (Port 5000)
│      └── Routes /*      ──► 3. frontend-service (Port 80)
└─────────────────────────────────┬──────────────────────┘
                                  │ Direct Database link (via host.docker.internal:5432)
                                  ▼
┌────────────────────────────────────────────────────────┐
│ Mac Host Machine (Your Laptop)                         │
│                                                        │
│   4. Native PostgreSQL Database (tasks_db)             │
└────────────────────────────────────────────────────────┘
```

---

## 🛠️ Step-by-Step Implementation Guide

### Step 1: Project Structure
The folder is organized into:
* `/backend`: Node.js Express server communicating with PostgreSQL.
* `/frontend`: HTML/JS/CSS client served using Nginx.
* `/k8s`: Declarative Kubernetes manifests for services and ingress routing.

---

### Step 2: Build the Container Images
Images are built locally in the Docker Desktop daemon:
```bash
# Build the API Backend
docker build -t k8s-demo-backend:latest ./backend

# Build the Nginx Frontend
docker build -t k8s-demo-frontend:latest ./frontend
```

---

### Step 3: Set up Kubernetes Gateway API (Envoy Gateway)
Traditional `Ingress` is replaced by the role-oriented Gateway API. 

1. **Install Gateway API Custom Resource Definitions (CRDs):**
   ```bash
   kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.1.0/standard-install.yaml
   ```
2. **Install Envoy Gateway Controller:**
   ```bash
   kubectl apply --server-side -f https://github.com/envoyproxy/gateway/releases/download/v1.1.0/install.yaml
   ```
3. **Configure GatewayClass & Gateway (`k8s/gateway.yaml`):**
   * Prepend a `GatewayClass` targeting `gateway.envoyproxy.io/gatewayclass-controller`.
   * Bind the `Gateway` and `HTTPRoute` to split traffic: paths under `/api` route to the backend, and everything else routes to the Nginx web host.
   ```bash
   kubectl apply -f k8s/gateway.yaml
   ```

---

### Step 4: Connect Kubernetes to the Mac Host PostgreSQL
To use your laptop's Homebrew-installed database instead of a containerized database:

1. **Change the Database Host IP:**
   In `k8s/backend.yaml`, set `DB_HOST` to **`host.docker.internal`**. Docker Desktop resolves this hostname to your Mac host's loopback interface.
2. **Expose Local PostgreSQL to the Network:**
   Open your macOS PostgreSQL configuration files (usually in `/opt/homebrew/var/postgres/` or `/opt/homebrew/var/postgresql@16/`):
   * In `postgresql.conf`, set:
     ```text
     listen_addresses = '*'
     ```
   * In `pg_hba.conf`, authorize connections from any IP (suitable for local testing):
     ```text
     host    all             all             0.0.0.0/0               trust
     ```
   * Restart local PostgreSQL:
     ```bash
     brew services restart postgresql@16
     ```
3. **Create the Database on your Mac:**
   ```bash
   createdb tasks_db
   ```
4. **Deploy Application Pods:**
   Deploy the application manifests using `kubectl apply -f k8s/`. Setting `imagePullPolicy: Always` ensures the pods load your newly built images from the Docker daemon.

---

## 🌐 JioFiber Network Setup & Access (IP Address Guide)

Exposing this local setup to other devices involves handling both **Local Area Network (LAN)** and **Wide Area Network (WAN / Public Internet)** routing.

### 1. Local Network Access (Within the same Wi-Fi)
Your Mac is assigned a local private IP address by the JioFiber router: e.g., **`192.168.xxx.xxx`**.
* **Accessing the App:** Any device connected to the same Jio Wi-Fi can access the task planner by visiting:
  `http://192.168.xxx.xxx/`
* **Prerequisite:** You must disable or configure the **macOS Firewall** under *System Settings > Network > Firewall* to allow incoming traffic to port 80.

### 2. External Network Access (Jio Router Port Forwarding)
To allow people outside your home network to access it via the internet:

* **Router Settings Navigation:**
  1. Log into your JioFiber gateway page (commonly **`192.168.xxx.xxx`**).
  2. Navigate to **Security** -> **Firewall** -> **Port Forwarding**.
  3. Click **Add New** and save these values:
     * **Action:** `Allow Always` (or `Forward Always`)
     * **Services:** `HTTP` (Port 80)
     * **Source IP:** `Any`
     * **Destination IP:** **`192.168.xxx.xxx`** (Your Mac's Local IP)
     * **Internal Port:** `80`

#### Why Port Forwarding over Public IPv4 fails on JioFiber:
When you check your address on sites like *whatismyipaddress.com*, it shows your WAN public IP: e.g., **`49.37.xxx.xxx`**.
Trying to visit `http://49.37.xxx.xxx/` will fail. 

JioFiber uses **CGNAT (Carrier-Grade NAT)** for IPv4 routing. The public IP address `49.37.xxx.xxx` is shared among hundreds of households. Since you do not have a unique public IPv4 address, traffic arriving at Jio's servers cannot find a path to your specific router.

### 3. Bypassing CGNAT (The modern, easiest solution)
To securely expose your local Kubernetes cluster to the public internet instantly:
1. Install **ngrok**:
   ```bash
   brew install ngrok/ngrok/ngrok
   ```
2. Start the tunnel:
   ```bash
   ngrok http 80
   ```
3. Copy the generated secure URL (e.g., `https://xxxx-xx-xx-xx.ngrok-free.app`) and open it on any device. ngrok bypasses both router port-forwarding restrictions and firewalls entirely.
