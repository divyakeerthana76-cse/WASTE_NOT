# WasteNot – Food Surplus Redistribution Platform

WasteNot is a full-stack web application that helps reduce food waste by connecting food donors, individuals, and registered organisations. Users can publish surplus food, claim available food for personal use, or redistribute it to eligible organisations.

This repository contains the implementation of **Digital Assignment 3 (DA3) – Cloud Infrastructure and Architecture** for the WasteNot platform.

---

## Digital Assignment 3 – Cloud Infrastructure and Security

DA3 extends the WasteNot application with cloud scalability, availability, authentication, authorisation, and container security features.

### Implementation Highlights

**Q1 – Scale Your Application**
- Docker-based deployment with three backend instances.
- Nginx load balancing across the backend instances.
- Connection to the existing Supabase PostgreSQL database.
- Request distribution testing across the three instances.
- Performance comparison between one and three backend instances using Autocannon.
- Failure recovery testing by stopping a backend instance and configuring Nginx retries.
- Proposed cloud-bursting architecture for handling additional demand.

**Q2 – Secure Your Application**
- bcrypt password hashing.
- Multi-Factor Authentication (MFA) using TOTP.
- Role-Based Access Control (RBAC).
- Authorisation checks for protected Update and Delete operations.
- Docker image hardening.
- Container vulnerability scanning using Trivy.
- Identification of potential threat agents and discussion of relevant GDPR considerations.

---

## DA3 Submission Links

| Resource | Link |
|---|---|
| DA3 Source Code | [Open assignment-3 branch](https://github.com/divyakeerthana76-cse/WASTE_NOT/tree/assignment-3) |
| Q1 – Scaling Evidence | [View Q1 screenshots](DA3/Q1_Scaling/) |
| Q2 – Security Evidence | [View Q2 screenshots](DA3/Q2_Security/) |
| Architecture Documentation | [View architecture](docs/ARCHITECTURE.md) |

The evidence screenshots are organised by assignment question in the `DA3` directory.

### Evidence Folder Structure

```text
DA3/
├── Q1_Scaling/
│   ├── Q1A_01_Docker_Containers.png
│   ├── Q1A_02_Database_Connection.png
│   ├── Q1A_03_Load_Distribution.png
│   ├── Q1B_01_One_Instance.png
│   ├── Q1B_02_Three_Instances.png
│   ├── Q1C_01_Before_Failure.png
│   ├── Q1C_02_Backend_Stopped.png
│   ├── Q1C_03_After_Retry.png
│   └── Q1C_04_Nginx_Retry_Config.png
│
└── Q2_Security/
    ├── Q2A_01_Existing_Password_Hashes.png
    ├── Q2A_02_Bcrypt_Implementation_01.png
    ├── Q2A_02_Bcrypt_Implementation._02.png
    ├── Q2A_03_Upgraded_Password_Hashes.png
    ├── Q2A_04_Login_Verification.png
    ├── Q2B_01_MFA_Activation.png
    ├── Q2B_02_MFA_Implementation.png
    ├── Q2B_03_MFA_Login_Challenge.png
    ├── Q2B_04_Invalid_MFA_Rejection.png
    ├── Q2B_05_Successful_MFA_Login.png
    ├── Q2B_06_RBAC_Unauthorized_Update.png
    ├── Q2B_07_RBAC_Unauthorized_Delete.png
    ├── Q2B_08_RBAC_Admin_Update.png
    ├── Q2B_09_RBAC_Admin_Delete.png
    ├── Q2C_01_Before_Hardening.png
    ├── Q2C_02_After_Hardening_01.png
    ├── Q2C_02_After_Hardening_02.png
    ├── Q2C_03_Docker_Image_Size_Comparison.png
    └── Q2C_04_Hardened_Image_Health_Check.png
```

---

## Application Features

- User registration, login, and logout.
- bcrypt password hashing.
- Surplus food creation, viewing, updating, and deletion.
- Personal food claiming.
- Organisation-based food redistribution.
- Locality-based matching.
- Food status workflow: `AVAILABLE → CLAIMED / REDISTRIBUTED / EXPIRED`.
- Backend-side expiry and input validation.
- PostgreSQL transactions for claims.
- Dashboard statistics retrieved from PostgreSQL.
- Food Waste Prevented metric based on completed claim quantities.
- REST API endpoints.
- Responsive HTML, CSS, and JavaScript frontend.
- Supabase PostgreSQL integration.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | PostgreSQL, Supabase |
| Database Driver | pg |
| Configuration | dotenv |
| Password Security | bcrypt |
| Containerisation | Docker |
| Container Orchestration | Docker Compose |
| Load Balancing | Nginx |
| Performance Testing | Autocannon |
| Container Security | Trivy |
| Version Control | Git, GitHub |
| Cloud Hosting | Render |

---

## Application Architecture

### Original Application Architecture

```text
User Browser
     |
     v
HTML + CSS + Vanilla JavaScript
     |
     | REST / JSON
     v
Node.js + Express.js Backend
     |
     | Parameterised SQL
     v
Supabase PostgreSQL Database
```

### DA3 – Docker Scaling Architecture

The local DA3 scaling implementation uses Docker Compose to run three backend instances behind an Nginx load balancer.

```text
                   User / Client
                         |
                         v
                   Nginx Load Balancer
                      Port 8080
                         |
             Docker Compose Network
                         |
             +-----------+-----------+
             |           |           |
             v           v           v
          API 1       API 2       API 3
         Port 3000   Port 3000   Port 3000
             |           |           |
             +-----------+-----------+
                         |
                         v
                Supabase PostgreSQL
                    Cloud Database
```

Nginx distributes incoming requests across the three backend instances. All instances connect to the existing Supabase PostgreSQL database.

**Note:** The three-instance Docker Compose setup is the local scaling implementation demonstrated for DA3. It should not be confused with the separate Render deployment of the original application.

### Proposed Cloud-Bursting Architecture

Cloud bursting is discussed as a proposed extension for handling demand beyond the capacity of the primary deployment. It is an architectural proposal and is not claimed as a deployed feature.

---

## Database

WasteNot uses four main application tables:

1. `users` – Stores registered user information.
2. `surplus_food` – Stores food listings and their availability.
3. `claims` – Stores successful claim and redistribution records.
4. `organizations` – Stores registered organisation information.

Database files:

- `database/schema.sql`
- `database/seed.sql`

Refer to `docs/DATABASE_DESIGN.md` for the database design.

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/users` | User registration |
| POST | `/api/users/login` | User login |
| GET | `/api/users` | Retrieve users |
| GET | `/api/users/:id` | Retrieve a user |
| POST | `/api/surplus` | Create a food listing |
| GET | `/api/surplus` | Retrieve food listings |
| GET | `/api/surplus/:id` | Retrieve a specific listing |
| PUT | `/api/surplus/:id` | Update a food listing |
| DELETE | `/api/surplus/:id` | Delete a food listing |
| POST | `/api/claims` | Create a claim |
| GET | `/api/claims` | Retrieve claims |
| GET | `/api/claims/:id` | Retrieve a specific claim |
| GET | `/api/organizations` | Retrieve organisations |
| GET | `/api/organizations/:id` | Retrieve an organisation |
| GET | `/api/dashboard` | Retrieve dashboard statistics |

Authenticated endpoints require the appropriate authentication credentials. Protected operations must also satisfy the relevant authorisation and ownership checks.

Refer to `docs/API_DOCUMENTATION.md` for further details.

---

## Local Setup

### 1. Prerequisites

Install:

- Node.js 18 or later
- npm
- PostgreSQL or a Supabase project

For the DA3 Docker scaling implementation, Docker Desktop and Docker Compose are also required.

### 2. Clone the Repository

```bash
git clone https://github.com/divyakeerthana76-cse/WASTE_NOT.git
cd WASTE_NOT
```

To access the DA3 implementation:

```bash
git checkout assignment-3
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file using `.env.example` as a reference.

```env
DATABASE_URL=your-postgresql-connection-string
PORT=3000
AUTH_SECRET=your-long-random-secret
DB_SSL=true
```

Use the appropriate database SSL setting for your PostgreSQL provider.

**Never commit `.env` or expose database passwords, authentication secrets, or API keys.**

### 5. Initialise the Database

Run the SQL files in the following order:

1. `database/schema.sql`
2. `database/seed.sql`

These can be executed using the PostgreSQL command line or the Supabase SQL Editor.

### 6. Start the Application

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Test the health endpoint:

```text
http://localhost:3000/api/health
```

---

## DA3 – Docker Scaling Setup

The DA3 Docker Compose configuration runs three backend instances behind Nginx.

From the project root, start the services using:

```bash
docker compose up -d --build
```

Check the running containers:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs
```

Access the application through the Nginx load balancer:

```text
http://localhost:8080
```

Stop the containers:

```bash
docker compose down
```

The Docker Compose configuration and Nginx configuration in the repository define the actual service setup.

---

## Security Implementation

### Password Security

Passwords are stored as bcrypt hashes rather than plaintext passwords. The implementation uses password hashing and verification functions.

### Multi-Factor Authentication

TOTP-based MFA adds a verification step during login. Users must complete the additional verification challenge when MFA is enabled.

### Role-Based Access Control

RBAC restricts protected operations according to the authenticated user's role and applicable permissions. Update and Delete operations are checked against the relevant authorisation rules.

### Container Security

The Docker image is hardened and scanned using Trivy to identify vulnerabilities. Before-and-after scan evidence is available in `DA3/Q2_Security/`.

---

## Testing

The project uses the following testing approaches:

- API health checks.
- Database connectivity checks.
- Docker container status and log inspection.
- Request distribution testing through Nginx.
- Autocannon performance testing.
- Backend failure and Nginx retry testing.
- MFA login and invalid-code testing.
- RBAC authorisation testing.
- Trivy container vulnerability scanning.

Refer to the DA3 evidence folders for the corresponding screenshots.

---

## Deployment

The original WasteNot application has a Render deployment:

[WasteNot – Live Application](https://waste-not-1.onrender.com)

The application uses Supabase PostgreSQL as its cloud database.

The DA3 three-instance Docker Compose setup is a separate local scaling demonstration. It should not be interpreted as a three-instance production deployment on Render.

---

## Project Structure

```text
WASTE_NOT/
│
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── README.md
│
├── database/
│   ├── schema.sql
│   └── seed.sql
│
├── routes/
│   ├── users.js
│   ├── surplus.js
│   ├── claims.js
│   ├── organizations.js
│   └── dashboard.js
│
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── docs/
│   ├── API_DOCUMENTATION.md
│   ├── DATABASE_DESIGN.md
│   ├── ARCHITECTURE.md
│   └── TESTING.md
│
└── DA3/
    ├── Q1_Scaling/
    └── Q2_Security/
```

---

## Future Improvements

- Enhanced organisation account management.
- Email notifications.
- Admin moderation.
- Partial quantity allocation for multiple claims.
- Improved locality normalisation.
- Audit logging.
- Further cloud scaling and automated monitoring.

---

## Repository

**GitHub Repository:**  
https://github.com/divyakeerthana76-cse/WASTE_NOT

**DA3 Submission Branch:**  
https://github.com/divyakeerthana76-cse/WASTE_NOT/tree/assignment-3

The `assignment-3` branch contains the DA3 implementation and its supporting evidence screenshots.
