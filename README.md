# Kervyn
### AI-Powered PCBA Manufacturing Quality Intelligence Platform

Kervyn is a web-based manufacturing monitoring and product quality analysis platform designed for **Printed Circuit Board Assembly (PCBA)** manufacturing environments. It integrates production traceability, inspection results, defect monitoring, rework analysis and AI-powered analytics into a centralized dashboard.

Built for **ExaThon India 2026 – Factories, Fleets & Supply Chains**.

> Transform manufacturing data into actionable intelligence.

---

## Overview

Modern manufacturing environments generate large volumes of production and quality data across multiple process stages, machines and inspection systems. Identifying quality issues, monitoring production performance and investigating defects can become difficult when this information is distributed across different systems.

Kervyn addresses this challenge by bringing manufacturing data together in a unified platform powered by Exasol and Sarvam AI.

The platform enables users to:

- Monitor PCBA production and quality performance.
- Analyse inspection results and manufacturing defects.
- Track process-stage performance and production trends.
- Investigate rework activities and associated costs.
- Explore manufacturing data through natural-language queries.
- Generate analytical reports and visualizations.
- Make more informed manufacturing and quality decisions.

## Key Features

### 1. Manufacturing Datasheet

A centralized analytics dashboard that retrieves manufacturing information directly from Exasol.

**Features:**
- Production and quality KPI monitoring.
- Process-stage filtering.
- Defect-category and severity analysis.
- Inspection pass/failure statistics.
- Process-stage performance comparison.
- Production and defect trends.
- Detailed inspection records.
- Search and filter functionality.
- Real-time data refresh through the backend API.
- JSON export of the complete datasheet data.

### 2. Kervyn AI – Manufacturing Intelligence Copilot

Kervyn AI enables users to investigate manufacturing data using natural-language questions instead of manually writing SQL queries.

Users can ask analytical questions such as:

- Which manufacturing stage has the highest defect count?
- Compare inspection failures across different process stages.
- What are the most frequently occurring defect categories?
- Analyse rework costs across production orders.
- Identify machines with unusually high process durations.
- Show the trend of defects over a selected period.
- Analyse inspection pass and failure rates.
- Investigate the relationship between detected defects and their suspected origins.

#### AI Analytical Workflow

Kervyn uses a structured AI query-planning architecture to generate and execute database queries.

1. **Natural-language input:** The user submits a manufacturing-related question.
2. **Query planning:** Sarvam AI interprets the question and generates a structured query plan.
3. **Validation:** The backend validates the requested tables, columns, filters, aggregations and relationships against the approved database schema.
4. **SQL compilation:** The validated query plan is converted into SQL by the backend.
5. **Database execution:** The generated SQL query is executed against Exasol.
6. **Evidence processing:** The retrieved database records are processed into structured analytical evidence.
7. **AI analysis:** Sarvam AI generates an analytical response grounded in the retrieved database results.
8. **Visualization:** The frontend renders the response along with supported charts and tables.

#### AI Query Safety

The AI analytical query workflow implements several safeguards:

- Schema-based table and column allowlisting.
- Explicitly approved table relationships.
- Structured query plans instead of unrestricted AI-generated SQL.
- Validation of selected fields, filters and aggregations.
- Rejection of unapproved SQL expressions and raw SQL fragments.
- Maximum of five tables per query.
- Maximum of twelve selected fields.
- Maximum of twelve filters.
- Maximum result limit of 200 rows.
- Bounded conversation history.
- Request timeout handling.
- Rate limiting of 15 AI requests per minute.

These restrictions apply to the AI analytical query workflow and should not be interpreted as making every backend API endpoint read-only.

### 3. Analytical Visualizations

Kervyn AI can return structured visualizations alongside its analytical responses.

Supported visualization types include:

- **Bar Charts:** Compare defect counts, inspection results and manufacturing categories.
- **Line Charts:** Analyse production and quality trends over time.
- **Pie Charts:** Understand meaningful proportions and distributions.
- **Data Tables:** Examine detailed analytical results.

The AI chat also supports Markdown-formatted responses and conversation PDF export.

### 4. PCBA Manufacturing Traceability

Kervyn uses a relational database model to represent the entities and events involved in PCBA manufacturing.

The database includes:

| Table | Description |
|---|---|
| PRODUCT | Product information, codes, names and revisions |
| PROCESS_STAGE | Manufacturing process stages and sequence |
| DEFECT_TYPE | Defect classifications and severity |
| MACHINE | Manufacturing machine information |
| WORK_ORDER | Production orders and planned quantities |
| BOARD_UNIT | Individual PCB assemblies and traceability |
| PROCESS_EVENT | Board-level manufacturing process history |
| INSPECTION_RESULT | Inspection results and measured parameters |
| DEFECT_EVENT | Defect detection and origin information |
| REWORK_EVENT | Rework actions, costs and retest outcomes |

This data model connects products, work orders, individual boards, manufacturing stages, machines, inspections, defects and rework events.

It also distinguishes between the stage where a defect is detected and the stage where its origin is suspected or confirmed, supporting more meaningful root-cause investigations.

### 5. About Kervyn

The application includes a dedicated About panel describing the platform, its purpose and its core capabilities:

- Production Monitoring
- Quality Analytics
- AI-Powered Analysis

---

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 19 |
| Frontend Tooling | Vite 8 |
| Backend | Node.js |
| API Framework | Express 5 |
| Analytical Database | Exasol |
| Database Driver | @exasol/exasol-driver-ts |
| Database Communication | WebSocket |
| AI Provider | Sarvam AI |
| Default AI Model | sarvam-105b |
| Charts | Custom SVG-based visualizations and Recharts dependency |
| Icons | Lucide React |
| Markdown Rendering | React Markdown and remark-gfm |
| PDF Export | html2canvas and jsPDF |
| Environment Configuration | dotenv |

---

## System Architecture

The following diagram illustrates the overall architecture of Kervyn.

\`\`\`mermaid
flowchart TD
    USER[User]

    subgraph FRONTEND["Frontend - React + Vite"]
        DASH[Manufacturing Dashboard]
        DS[Manufacturing Datasheet]
        CHAT[Kervyn AI Chat]
        VIS[Charts and Visualizations]
    end

    subgraph BACKEND["Backend - Node.js + Express"]
        API[REST API]
        ANALYTICS[Analytics Engine]
        AI[AI Chat Router]
        VALIDATE[Query Plan Validator]
        COMPILER[SQL Query Compiler]
    end

    subgraph AI_LAYER["AI Layer"]
        PLANNER[Sarvam AI Query Planner]
        ANALYST[Sarvam AI Analyst]
    end

    DB[(Exasol Database)]

    USER --> DASH
    DASH --> DS
    DASH --> CHAT

    DS --> API
    API --> ANALYTICS
    ANALYTICS --> DB

    CHAT --> AI
    AI --> PLANNER
    PLANNER --> VALIDATE
    VALIDATE --> COMPILER
    COMPILER --> DB

    DB --> ANALYST
    ANALYST --> VIS
    VIS --> CHAT
    DB --> API
    API --> DS
\`\`\`

### Application Workflow

- The React frontend provides the dashboard, datasheet and AI chat interface.
- The Express backend handles API requests and database communication.
- Exasol stores the manufacturing and quality data.
- The AI query planner translates natural-language questions into structured query plans.
- The backend validates and compiles those plans before database execution.
- Sarvam AI analyses the retrieved evidence and generates responses.
- The frontend renders analytical responses, charts and tables.

---

## Repository Structure

\`\`\`text
Kervyn/
│
├── server/
│   ├── aiChat.js
│   ├── get-cert.js
│   └── index.js
│
├── src/
│   ├── assets/
│   │
│   ├── components/
│   │   ├── aboutPopup/
│   │   │   ├── AboutPopup.jsx
│   │   │   └── AboutPopup.css
│   │   │
│   │   ├── aibox/
│   │   │   ├── AIBox.jsx
│   │   │   └── AIBox.css
│   │   │
│   │   └── datasheet/
│   │       ├── Datasheet.jsx
│   │       └── Datasheet.css
│   │
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
│
├── db.sql
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
\`\`\`

### Important Files

| File | Purpose |
|---|---|
| server/index.js | Express server, Exasol connection and REST API |
| server/aiChat.js | AI query planning, validation, SQL compilation and analytical chat |
| server/get-cert.js | Exasol TLS certificate retrieval utility |
| src/App.jsx | Main React application |
| src/components/datasheet/Datasheet.jsx | Manufacturing datasheet and analytics interface |
| src/components/aibox/AIBox.jsx | Kervyn AI chat interface |
| src/components/aboutPopup/AboutPopup.jsx | About Kervyn modal |
| db.sql | Database schema and sample data |
| vite.config.js | Frontend development configuration |
| package.json | Project dependencies and scripts |

---

---

## Installation and Setup

### Prerequisites

- Node.js and npm.
- Git.
- An Exasol database (Exasol Personal is used for the demonstrated deployment).
- An Exasol account with the required database permissions.
- A Sarvam AI API key.
- Network connectivity between the Kervyn backend and Exasol.
- For the Azure deployment: an Azure subscription, Azure CLI, and Exasol Launcher.

Official resources:

- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [Exasol Personal Documentation](https://docs.exasol.com/db/latest/get_started/exasol_personal.htm)
- [Exasol Personal Quick Start Guide](https://docs.exasol.com/db/latest/get_started/quick_start_guide.htm)
- [Exasol Download Portal](https://www.exasol.com/downloads/)
- [Azure Portal](https://portal.azure.com/)
- [Azure CLI Installation](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
- [Sarvam AI](https://www.sarvam.ai/)

### 1. Clone the Repository and Install Dependencies

```bash
git clone https://github.com/Rishikesh00760/Kervyn.git
cd Kervyn
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
PORT=4000

EXASOL_HOST=exacluster.local
EXASOL_PORT=8563
EXASOL_USER=sys
EXASOL_PASSWORD=YOUR_EXASOL_PASSWORD

FRONTEND_ORIGIN=http://localhost:5173

SARVAM_API_KEY=YOUR_SARVAM_API_KEY
SARVAM_MODEL=sarvam-105b
```

Replace the placeholders with the credentials and configuration for your own deployment. `EXASOL_HOST` must be a hostname that resolves from the machine running the backend; see **Exasol Personal – Azure Deployment and Host Configuration** below.

**Never commit your actual `.env` file, database password, API keys, private keys, or other deployment secrets to GitHub.** Keep `.env.example` limited to placeholder values.

## Exasol Personal – Azure Deployment and Host Configuration

This section describes the Exasol Personal deployment used for Kervyn, including Azure provisioning, hostname mapping, TLS setup, and database initialization.

### 1. Create and Configure an Azure Account

1. Open the [Azure Portal](https://portal.azure.com/).
2. Sign in or create an Azure account.
3. Create or select an Azure subscription.
4. Install Azure CLI on your development machine.
5. Open PowerShell and authenticate:

```powershell
az login
```

6. Verify the selected subscription:

```powershell
az account show
```

Make sure the intended subscription is selected before deploying Exasol.

### 2. Install Exasol Launcher

Exasol Personal is installed and managed using the Exasol Launcher command-line utility.

For Linux or macOS:

```bash
curl https://downloads.exasol.com/exasol-personal/installer.sh | sh
```

For Windows, download Exasol Launcher from the [Exasol Download Portal](https://www.exasol.com/downloads/) and add the executable to a directory included in your system `PATH`.

Verify the installation:

```bash
exasol help
```

If the command is not recognized, add the installation directory to `PATH` and reopen the terminal.

### 3. Create a Deployment Directory

Create a dedicated directory for the Exasol deployment and run the deployment commands from it.

```powershell
mkdir exasol-deployment
cd exasol-deployment
```

Keep this directory and its generated configuration files safe.

### 4. Deploy Exasol Personal on Azure

For the Kervyn demonstration deployment, the following command was used:

```bash
exasol install azure ubuntu --location eastus --instance-type Standard_E4s_v4 --cluster-size 1 --blob-archive-enabled=false
```

| Parameter | Description |
|---|---|
| `azure` | Selects Azure as the deployment platform |
| `ubuntu` | Selects the Ubuntu installation preset |
| `--location eastus` | Deploys resources in the East US Azure region |
| `--instance-type Standard_E4s_v4` | Selects the Azure VM size |
| `--cluster-size 1` | Creates a single-node cluster |
| `--blob-archive-enabled=false` | Disables the optional blob archive configuration |

Choose a VM size and region supported by your Azure subscription and the current Exasol Personal requirements. The command provisions the required cloud infrastructure and installs Exasol Personal. Provisioning may take several minutes.

When installation finishes, retrieve the deployment and connection information:

```bash
exasol info
```

You can open a database session with:

```bash
exasol connect
```

Then test the connection:

```sql
SELECT 1;
```

Keep the deployment directory because it contains important deployment configuration and connection information.

### 5. Configure Exasol Personal

After installation:

1. Confirm that the Exasol deployment is running.
2. Retrieve its connection information using `exasol info`.
3. Identify the database endpoint hostname or IP address.
4. Confirm the database port and credentials.
5. Connect using an Exasol SQL client or another compatible database client.
6. Verify that SQL queries execute successfully.

Kervyn uses the following database settings:

```env
EXASOL_HOST=exacluster.local
EXASOL_PORT=8563
EXASOL_USER=sys
EXASOL_PASSWORD=YOUR_EXASOL_PASSWORD
```

Use the credentials generated or configured for your deployment. Do not publish passwords or deployment secrets.

### 6. Create the `exacluster.local` Hostname

#### Why Kervyn uses `exacluster.local`

In the current Kervyn deployment, the Exasol connection works using the hostname `exacluster.local` rather than connecting directly through the public IP address.

A hostname alias can be created in the operating system's hosts file. This maps the hostname to the actual IP address of the Exasol database endpoint. It is also important to use the hostname expected by the database TLS certificate: connecting through a different hostname or IP address can cause TLS hostname-verification errors.

#### Step 1: Identify the Exasol database endpoint IP

Retrieve the deployment information:

```bash
exasol info
```

Identify the IP address corresponding to the Exasol database endpoint. For a cloud deployment, prefer the appropriate private IP address when the backend and database communicate through the same private network.

Do not assume that the Azure VM's public IP is the correct database endpoint.

#### Step 2: Open the hosts file on the backend machine

The hosts file must be modified on the machine where the Kervyn backend runs.

**Ubuntu/Linux:**

```bash
sudo nano /etc/hosts
```

**Windows:**

Open Notepad as Administrator and open:

```text
C:\Windows\System32\drivers\etc\hosts
```

If the file is not visible in the file picker, select **All Files**.

#### Step 3: Add the hostname mapping

Add this entry at the end of the hosts file:

```text
<EXASOL_PRIVATE_IP> exacluster.local
```

Replace `<EXASOL_PRIVATE_IP>` with the actual IP address of the Exasol database endpoint.

For example, if the verified endpoint IP is `10.0.0.5`:

```text
10.0.0.5 exacluster.local
```

The example IP is illustrative only. Use the address belonging to your own deployment. Save the file.

#### Step 4: Verify hostname resolution

On Ubuntu/Linux:

```bash
getent hosts exacluster.local
```

On Windows PowerShell:

```powershell
Resolve-DnsName exacluster.local
```

The hostname should resolve to the IP address entered in the hosts file.

#### Step 5: Test database port connectivity

On Windows:

```powershell
Test-NetConnection exacluster.local -Port 8563
```

On Linux:

```bash
nc -vz exacluster.local 8563
```

A successful test confirms network reachability through the configured hostname. It does not, by itself, confirm database authentication or TLS validation.

**Important:** A hosts-file entry is local to the operating system on which it is created. If the backend runs on another machine or VM, configure the hostname mapping there as well. If the backend is moved to another cloud network, configure suitable private DNS or another supported hostname-resolution mechanism. Do not assume that `exacluster.local` resolves from a developer laptop or an unrelated public network.

### 7. Configure the Kervyn `EXASOL_HOST` Variable

Once `exacluster.local` resolves correctly from the backend machine, configure the `.env` file in the Kervyn project root:

```env
PORT=4000

EXASOL_HOST=exacluster.local
EXASOL_PORT=8563
EXASOL_USER=sys
EXASOL_PASSWORD=YOUR_EXASOL_PASSWORD

FRONTEND_ORIGIN=http://localhost:5173

SARVAM_API_KEY=YOUR_SARVAM_API_KEY
SARVAM_MODEL=sarvam-105b
```

The important setting is:

```env
EXASOL_HOST=exacluster.local
```

Do not add a protocol prefix or port number to `EXASOL_HOST`; the port is configured separately. Use the hostname that resolves from the machine running the backend. Restart the backend after changing environment variables.

### 8. Configure the Exasol TLS Certificate

Kervyn expects the Exasol server certificate at:

```text
server/exasol-server.pem
```

The repository includes a certificate retrieval utility. With a Node.js version that supports `--env-file`, run this command from the project root:

```bash
node --env-file=.env server/get-cert.js
```

The utility retrieves the peer certificate and saves it in PEM format. The backend uses the saved certificate for its Exasol TLS connection.

**Security note:** The retrieval utility disables certificate verification during the initial certificate retrieval. This is only a bootstrap mechanism. Verify the displayed SHA-256 fingerprint through a trusted channel before trusting the certificate. Use a hostname that matches the certificate identity; if the certificate identifies the server as `exacluster.local`, connecting through an unrelated IP address or hostname may cause a certificate hostname mismatch. Do not publish private keys or unverified certificates.

### 9. Initialize the Kervyn Database

The repository includes the database setup script:

```text
db.sql
```

Open it using an Exasol-compatible SQL client and execute it against your Exasol database. The script creates the `KERVYN` schema, its tables, and sample demonstration records.

You can open a database session from the Exasol deployment directory:

```bash
exasol connect
```

Then execute the statements from `db.sql` using your database client.

Verify the schema:

```sql
SELECT CURRENT_SCHEMA;
```

Inspect the created tables and confirm that the sample data has been loaded.

The SQL script contains synthetic demonstration data. It is intended for initial development setup and should not be executed repeatedly against an existing database without checking its effects.

### 10. Manage the Exasol Cloud Deployment

| Command | Purpose |
|---|---|
| `exasol info` | Display deployment and connection information |
| `exasol connect` | Open a SQL session |
| `exasol shell host` | Open an SSH session to the compute host |
| `exasol stop` | Stop the deployment's compute instances |
| `exasol start` | Start the deployment again |
| `exasol destroy` | Remove the deployment and associated cloud resources |

**Azure cost consideration:** Stopping Exasol Personal stops its compute instances, but storage and networking resources may continue to incur charges. After restarting, check `exasol info` and update the hostname mapping if the database endpoint IP has changed. Use `exasol destroy` only when you intend to remove the deployment and its associated resources.

## Backend API Setup

The Node.js backend uses Express to handle database connectivity, analytics requests, AI query processing, and communication between the frontend and external AI services.

### 1. Install Dependencies

From the project root:

```bash
npm install
```

### 2. Configure the Environment

Confirm that the `.env` file contains the API port, Exasol hostname and port, Exasol username and password, allowed frontend origin, and Sarvam AI API key. See **Configure Environment Variables** above.

### 3. Start the Backend

```bash
npm run server:dev
```

The backend normally runs at:

```text
http://localhost:4000
```

### 4. Verify the API and Database Connection

Open the health endpoint:

```text
http://localhost:4000/api/health
```

A successful response should indicate that the API is running and provide database connectivity information. For example:

```json
{
  "status": "ok",
  "database": "KERVYN"
}
```

The exact response may contain additional fields depending on the implementation.

### 5. Start the Frontend

Open another terminal in the project root:

```bash
npm run dev
```

Vite normally serves the development frontend at:

```text
http://localhost:5173
```

Open the displayed local URL in your browser. Make sure `FRONTEND_ORIGIN` matches the origin used by the browser.

### 6. Build the Frontend for Deployment

To create a production frontend build:

```bash
npm run build
```

The resulting build can be hosted using a suitable web server or static hosting service. Configure the frontend to communicate with the deployed backend API. Do not expose Exasol credentials or Sarvam API keys in frontend environment variables or browser-side code.

### Azure Application Deployment Notes

The Kervyn backend can run on the same Azure VM as Exasol or on a separate application server.

- Install Node.js and npm on the backend host.
- Clone the Kervyn repository and install its dependencies.
- Configure the backend `.env` file.
- Ensure that the backend host can resolve `exacluster.local` and reach Exasol over the required private network.
- Restrict Exasol port `8563` to trusted application hosts or private network sources.
- Allow SSH only from trusted IP addresses.
- Avoid exposing database access directly to the public internet.
- If the frontend and backend are hosted separately, configure the frontend to communicate with the backend API rather than connecting directly to Exasol.
- Use HTTPS for production frontend and API traffic.


---

## API Documentation

Kervyn exposes REST API endpoints through its Express backend.

### General Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/health | Check database connectivity |
| GET | /api/tables | Retrieve supported resources and fields |
| GET | /api/analytics | Retrieve manufacturing analytics |
| GET | /api/:resource | Retrieve resource records |
| GET | /api/:resource/:id | Retrieve a specific record |
| POST | /api/:resource | Insert a record |
| PUT | /api/:resource/:id | Update a record |
| DELETE | /api/:resource/:id | Delete a record |

### AI Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/ai/chat | Submit a natural-language analytical query |
| DELETE | /api/ai/session/:sessionId | Clear a conversation session |

### Supported Resources

The backend supports the following manufacturing resources:

- products
- stages
- defectTypes
- machines
- workOrders
- boards
- processEvents
- inspections
- defects
- rework

### Analytics Parameters

The analytics endpoint supports:

| Parameter | Description |
|---|---|
| stage | Filter analytics by process stage; defaults to all |
| days | Reporting period in days, with a backend maximum of 90 days |

Example:

\`\`\`http
GET /api/analytics?stage=all&days=30
\`\`\`

### AI Chat Request

Example request:

\`\`\`http
POST /api/ai/chat
Content-Type: application/json
\`\`\`

Request body:

\`\`\`json
{
  "message": "Compare defect counts across manufacturing stages",
  "sessionId": null
}
\`\`\`

The API returns:

- AI-generated analytical response.
- Structured visualization data.
- Conversation session ID.
- Database tables used as evidence.

---

## Security Considerations

Kervyn implements structured query validation and other safeguards in its AI analytical workflow. However, the current implementation should be treated as a development and demonstration application rather than a fully production-hardened system.

Before using Kervyn with real manufacturing data or exposing it to an untrusted network, consider implementing:

- User authentication.
- Role-based access control.
- Authorization for all database CRUD operations.
- Least-privilege Exasol database credentials.
- Secure secret management.
- Production-ready CORS configuration.
- Network restrictions and firewall policies.
- Audit logging and monitoring.
- Certificate fingerprint verification.
- Appropriate data privacy and retention policies.

The generic resource endpoints support database mutations. The AI analytical query workflow has separate query restrictions; the entire application is not currently guaranteed to be read-only.

---

## Current Project Scope

Kervyn currently focuses on PCBA manufacturing monitoring and quality intelligence.

The implemented scope includes:

- React-based manufacturing dashboard.
- Exasol database integration.
- Production and quality analytics.
- Structured PCBA manufacturing data model.
- AI-assisted analytical query generation.
- Validated SQL query compilation.
- Database-backed AI responses.
- Analytical charts and tables.
- Datasheet data export.
- AI conversation PDF export.

The included sample data is synthetic and intended for development and demonstration.

Authentication, production deployment configuration, comprehensive automated testing and full production security hardening are not currently included.

---

## Future Scope

Potential areas for further development include:

- Predictive quality analytics.
- Early defect detection using machine learning.
- Anomaly detection across production parameters.
- Automated root-cause analysis.
- Machine performance and downtime monitoring.
- Production bottleneck identification.
- Advanced process optimization.
- Real-time manufacturing event ingestion.
- Role-based dashboards for quality engineers and production managers.
- Automated quality alerts and notifications.

---

## Project Information

| Detail | Information |
|---|---|
| Project | Kervyn |
| Event | ExaThon India 2026 |
| Track | Factories, Fleets & Supply Chains |
| Domain | PCBA Manufacturing |
| Database | Exasol |
| AI Integration | Sarvam AI |
| Frontend | React |
| Backend | Node.js and Express |
| Repository | [GitHub – Kervyn](https://github.com/Rishikesh00760/Kervyn) |

---

## License

This project is intended to be distributed under the MIT License.

See the [LICENSE](https://github.com/Rishikesh00760/Kervyn/blob/main/LICENSE) file for details.

---

**Kervyn — Smarter Manufacturing. Better Quality.**

*Transforming PCBA manufacturing data into meaningful quality intelligence.*

