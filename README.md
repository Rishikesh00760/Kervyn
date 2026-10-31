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

## Getting Started

### Prerequisites

Make sure the following are available:

- Node.js and npm.
- Access to an Exasol database.
- An Exasol account with the required database permissions.
- A Sarvam AI API key.
- Network connectivity between the backend server and Exasol.

### 1. Clone the Repository

\`\`\`bash
git clone https://github.com/Rishikesh00760/Kervyn.git
cd Kervyn
\`\`\`

### 2. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 3. Configure Environment Variables

Create a `.env` file in the project root directory.

\`\`\`env
PORT=4000

EXASOL_HOST=your-exasol-hostname
EXASOL_PORT=8563
EXASOL_USER=your-exasol-username
EXASOL_PASSWORD=your-exasol-password

FRONTEND_ORIGIN=http://localhost:5173

SARVAM_API_KEY=your-sarvam-api-key
SARVAM_MODEL=sarvam-105b
\`\`\`

Replace the placeholder values with your actual configuration.

**Important:** Never commit your actual `.env` file, database credentials or API keys to GitHub.

### 4. Configure Exasol TLS Certificate

The backend expects the Exasol server certificate at:

\`\`\`text
server/exasol-server.pem
\`\`\`

The repository includes a certificate retrieval utility.

With a Node.js version supporting `--env-file`, execute:

\`\`\`bash
node --env-file=.env server/get-cert.js
\`\`\`

The utility retrieves the peer certificate and saves it in PEM format.

**Security note:** The retrieval utility disables certificate verification during the initial certificate retrieval. Verify the displayed SHA-256 fingerprint through a trusted channel before trusting the certificate. The application subsequently uses the saved certificate for its Exasol TLS connection.

Do not publish environment-specific certificates or private keys.

### 5. Initialize the Exasol Database

Open `db.sql` using an Exasol-compatible SQL client.

Execute the script against your Exasol database to create the KERVYN schema, its tables and sample demonstration records.

The SQL script contains synthetic demonstration data. It is intended for initial development setup and should not be executed repeatedly against an existing database without checking its effects.

### 6. Start the Backend Server

Open a terminal in the project directory.

\`\`\`bash
npm run server:dev
\`\`\`

The backend server runs at:

\`\`\`text
http://localhost:4000
\`\`\`

### 7. Start the Frontend

Open another terminal.

\`\`\`bash
npm run dev
\`\`\`

Vite normally starts the frontend at:

\`\`\`text
http://localhost:5173
\`\`\`

Open the displayed local URL in your browser.

---
# Exasol Host Configuration

## Why Kervyn Uses `exacluster.local`

Kervyn's backend connects to Exasol using the hostname configured in its environment variables.

In the current deployment, the Exasol hostname is configured as:

```env
EXASOL_HOST=exacluster.local
```

This hostname is intentional. It is the hostname that works in the current Exasol environment and should not be replaced with the public IP or cloud VM hostname without verifying that the alternative works.

The `.local` hostname can resolve through the network configuration available to the machine running the backend. Its resolution depends on the deployment environment.

### Important Configuration Details

- If the Kervyn backend runs on the same machine or network where `exacluster.local` resolves, retain this hostname.
- If the backend runs on another VM, make sure that VM can resolve `exacluster.local` and reach Exasol over the required network.
- If the backend is moved to a different cloud network, the hostname may not resolve automatically. Configure appropriate private DNS or another supported hostname-resolution mechanism.
- Do not assume that `exacluster.local` will resolve from a developer's laptop or an unrelated public network.
- Do not replace it with a public IP merely because the application is deployed in Azure. First verify DNS resolution, TCP connectivity, and TLS certificate compatibility.

You can test hostname resolution from the backend machine.

On Linux:

```bash
getent hosts exacluster.local
```

On Windows PowerShell:

```powershell
Resolve-DnsName exacluster.local
```

You can also test whether the Exasol port is reachable.

On Windows:

```powershell
Test-NetConnection exacluster.local -Port 8563
```

On Linux:

```bash
nc -vz exacluster.local 8563
```

A successful connection test confirms network reachability, but does not by itself confirm that database authentication or TLS validation will succeed.

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
