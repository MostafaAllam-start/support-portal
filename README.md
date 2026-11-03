# Ticketing Support

A support / ticketing platform built with [Next.js](https://nextjs.org), Prisma + PostgreSQL, and a standalone Socket.IO server for real-time replies and notifications.

## Architecture

The stack runs as three Docker Compose services:

| Service    | Container            | Port | Description                                                                 |
| ---------- | -------------------- | ---- | --------------------------------------------------------------------------- |
| `web`      | `ticketing-web`      | 3000 | The Next.js application.                                                     |
| `realtime` | `ticketing-realtime` | 3001 | Standalone Socket.IO server ([realtime/socketServer.ts](realtime/socketServer.ts)) that fans out reply/notification events. |
| `db`       | `ticketing-db`       | 5432 | PostgreSQL 15.                                                              |

Docker is the supported way to run the app — it wires the three services together, prepares the database, and seeds the initial admin account automatically.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A `.env` file at the repo root (see [Environment variables](#environment-variables)). It is git-ignored, so create it before the first run.

## Environment variables

Both compose files read configuration from `.env`. The most important keys:

| Variable                              | Used by              | Notes                                                                                   |
| ------------------------------------- | -------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`                        | Prisma (host-side)   | Uses `localhost` for running the Prisma CLI from your machine. Inside the `web` container it is overridden to point at the `db` service. |
| `POSTGRES_USER` / `_PASSWORD` / `_DB` | `db` service         | Read by Postgres on first init — keep them in sync with `DATABASE_URL`.                  |
| `JWT_SECRET`                          | Auth                 | Long random string used to sign auth JWTs.                                               |
| `ADMIN_*`                             | Seed                 | Initial admin account created by [prisma/seed.ts](prisma/seed.ts). Change before seeding a real environment. |
| `SOCKET_PORT`                         | `realtime` service   | Port the Socket.IO server listens on (3001).                                            |
| `NEXT_PUBLIC_APP_URL`                 | Web / realtime CORS  | Origin the browser loads the app from; also the CORS origin the realtime server allows. |
| `NEXT_PUBLIC_SOCKET_URL`              | Browser              | Public URL of the realtime server (inlined into the client bundle).                     |
| `COMPOSE_PROFILES`                    | Compose (dev)        | `mailpit` runs [Mailpit](https://mailpit.axllent.org) with the dev stack and sends all mail to its inbox at http://localhost:8025. Empty: mail uses the `SMTP_*` settings. Production ignores it. |
| `SMTP_HOST` / `SMTP_PORT`             | Web (email)          | SMTP server for outgoing mail (any provider; presets in [.env.example](.env.example)). Port defaults to `587`. **Required in production** — without it new users can't be created. |
| `SMTP_SECURE`                         | Web (email)          | `true` for implicit TLS. Defaults to `true` on port 465, otherwise STARTTLS is used when the server offers it. |
| `SMTP_REQUIRE_TLS`                    | Web (email)          | `true` to refuse sending unless the server upgrades to STARTTLS (recommended on 587). |
| `SMTP_USER` / `SMTP_PASSWORD`         | Web (email)          | SMTP credentials. Leave unset for servers that don't require auth.                      |
| `SMTP_AUTH` / `SMTP_OAUTH_*`          | Web (email)          | `SMTP_AUTH=oauth2` signs in with OAuth2 instead of a password (`SMTP_OAUTH_CLIENT_ID`, `_CLIENT_SECRET`, `_REFRESH_TOKEN`, `_TOKEN_URL`), e.g. for Microsoft 365. |
| `SMTP_POOL_MAX`                       | Web (email)          | Pooled SMTP connections kept open (default `3`).                                      |
| `SMTP_TLS_REJECT_UNAUTHORIZED`        | Web (email)          | `false` only for an internal relay with a self-signed certificate.                    |
| `MAIL_FROM` / `MAIL_REPLY_TO`         | Web (email)          | Sender address, e.g. `Support Portal <no-reply@example.com>` (falls back to `SMTP_USER`), and an optional reply-to. |
| `MAIL_RETRY_ATTEMPTS`                 | Web (email)          | Tries per message when the server says to retry later (default `3`).                  |
| `MAIL_DEBUG`                          | Web (email)          | `true` logs the SMTP conversation, for troubleshooting.                               |
| `APP_URL`                             | Web (email)          | Public origin used for links in emails, e.g. `https://support.example.com`. Read at runtime (falls back to `NEXT_PUBLIC_APP_URL`). |
| `MAIL_NOTIFICATIONS`                  | Web (email)          | Set to `false` to stop mirroring in-app notifications by email. Account emails are always sent. |

> Container-network values (`DATABASE_URL` over the compose network and `SOCKET_INTERNAL_URL`) are set directly in [docker-compose.yml](docker-compose.yml) for the `web` service, so the `.env` values stay host-facing.

## Accounts and email

There is no public sign-up. An admin creates every account from **Dashboard → Users**; the email address is required, and the app generates a random password and emails the username and password to the new user. If the email can't be sent the account is not created, so the admin can fix the address and retry.

Every user can change their name, email, password and photo from their account settings: **Settings** in the dashboard sidebar menu (`/dashboard/settings`), or the avatar menu on the customer pages (`/profile`). Changing the email or password asks for the current password.

In-app notifications (new tickets, replies, status changes, assignments, …) are also sent by email to each recipient when SMTP is configured.

Mail goes out through any SMTP provider: Gmail or Google Workspace, Microsoft 365, Amazon SES, Brevo, or your company's relay. Copy [.env.example](.env.example) to `.env` and fill in the block for your provider. The app keeps a small pool of connections, checks the server and credentials once at startup (look for `[EmailService] SMTP ready` or `SMTP check failed` in the web container's log), and retries a message when the server says to try again later. Use a sender address on a domain you control, with SPF and DKIM set up at your provider, so the mail isn't marked as spam.

In development, `COMPOSE_PROFILES=mailpit` in `.env` catches all mail in Mailpit at http://localhost:8025 instead of delivering it; re-run `docker compose ... up -d` after changing it. Without Mailpit and without `SMTP_HOST`, development builds print outgoing emails (including generated passwords) to the server log instead of sending them; production refuses to create users until SMTP is configured.

## Branding site and demo requests

The ECM+ marketing site (the **Portico** template from [ecmplus-website-templates](https://github.com/MostafaAllam-start/ecmplus-website-templates)) is served by the portal itself:

| Route | What it is |
| ----- | ---------- |
| `/` | Redirects to the site. |
| `/site`, `/site/ar` | The site's English and Arabic pages (`/site/documents`, `/site/ar/about`, …), static files in [public/site](public/site) with their images in [public/assets](public/assets). |
| `/support/*` | The site's support links (`/support/login`, `/support/tickets`, …) redirect to the matching portal page in the visitor's language. |
| `/contact` | Receives the site's **Request a demo** form and stores it as a request. |
| `/en`, `/ar` | The portal, unchanged. |

The site's pages are generated, not hand-edited. To pick up template changes, check out the templates repository next to this one and re-run the import, which rewrites the template's relative links for the portal and copies the pages and assets:

```bash
pnpm site:import ../ecmplus-website-templates
```

A **support** team member (the **Support** option on the user form) gets the **Requests** page in their dashboard: every demo request sent from the site and every message from the landing page's contact form, each with the scope the visitor was browsing as, which they can filter by status, open for details, mark as contacted, close or reopen. When a request comes from a new client who needs a support account, **Notify admin** sends every admin an in-app notification over Socket.IO and an email (even with `MAIL_NOTIFICATIONS=false`) asking them to create the account. New requests notify the support team members, or the admins if there are none. Admins and project managers see the Requests page too. The seed adds a sample support team member, `support1`, who has no project role and so lands on the Requests page.

## Account types and access

Every account has one type (`User.role`), chosen first on the user form:

| Type | Opens | Sees |
| ---- | ----- | ---- |
| **Admin** | Dashboard | Everything: every company, users, projects, partners, the landing team. |
| **Team member** | Dashboard | What their scopes and project roles give them (below), plus the **Requests** page with the **Support** option. |
| **Client** | Customer pages | Their own tickets, complaints and suggestions, under the companies of their scopes. No dashboard. |

Team members and clients each hold one or more **scopes**: sets of companies with a name and a logo, managed by admins on **Dashboard → Scopes**. Visitors choose a scope before anything else, and the public pages follow it. The seed creates **CTC** and **ECM+** once; a user who works with both companies holds both. Admins can rename a scope, change its companies, or delete one nobody holds, but not add more. A team member also has a **main company** among their scopes' companies: the company they appear under on the landing team. A client is defined by their scopes alone, and every client must hold at least one (the seed adds a database trigger once no client is left without a scope): a client with several scopes switches between them in the header, and their new tickets go to the scope's company.

Team members hold project roles, set on the user form (or on a project's **Members**). Their most senior role decides what they see:

| Project role | Dashboard |
| ------------ | --------- |
| **Manager** | KPIs, the tickets and complaints of the projects they manage, those projects' suggestions plus their companies' company-wide ones, and the requests. Can create, edit, assign, close and delete tickets. |
| **Reviewer** | KPIs and every ticket of the companies in their scopes (ECM+ tickets have no project). Can assign, change status and reply. |
| **SAP consultant** | KPIs and every ticket of the companies in their scopes; adds diagnostic reports to the tickets assigned to them. |
| **Software engineer** | KPIs and the tickets assigned to them, in any company; adds diagnostic reports to them. |
| none yet | KPIs only. |

Only team members can manage a project or hold a project role, and only on projects of a company in their scopes. Changing a team member to another type removes their project roles. The default admin always stays an admin, and an admin can't change their own type.

## Running in production

The base [docker-compose.yml](docker-compose.yml) is a **production build**: the source is baked into the image and `next build` runs at image-build time.

```bash
docker compose up --build -d
```

This builds and starts all three services. On startup the `web` container's entrypoint ([docker-entrypoint.sh](docker-entrypoint.sh)) waits for the database, runs the one-off data upgrades in [prisma/migrations](prisma/migrations) that `db push` can't do on its own (such as moving the old role flags to the account type), applies the schema (`prisma db push`), seeds the admin account, then runs `pnpm start`.

Open [http://localhost:3000](http://localhost:3000).

> **Because the source is baked in, code changes require a rebuild.** After editing application code, re-run with `--build` (e.g. `docker compose up --build -d web`) to pick up the changes.

To stop:

```bash
docker compose down          # keep the database volume
docker compose down -v       # also drop the Postgres data volume
```

## Running in development (hot reload)

For local development, layer the [docker-compose.dev.yml](docker-compose.dev.yml) override on top of the base file:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The override swaps `web` and `realtime` to their `*.dev` images
([Dockerfile.dev](Dockerfile.dev) and [realtime/Dockerfile.dev](realtime/Dockerfile.dev)) and changes the workflow so you **don't rebuild per change**:

- The host source is bind-mounted into the containers, so edits are picked up live.
- `web` runs `next dev` (Fast Refresh / HMR); `realtime` runs `tsx watch` (auto-restart).
- The container's own `node_modules` and `.next` are masked by anonymous volumes so the Windows host's copies never clobber the Linux builds.
- File-watch polling (`WATCHPACK_POLLING` / `CHOKIDAR_USEPOLLING`) is enabled because bind-mounted filesystems on Windows don't emit inotify events.

The dev entrypoint ([docker-entrypoint.dev.sh](docker-entrypoint.dev.sh)) regenerates the Prisma client, syncs the schema, seeds, then starts the dev server.

### Windows note: webpack, not Turbopack

The dev server is started with `next dev --webpack` on purpose. Turbopack's filesystem layer fails to resolve bracket-named dynamic route segments (`[id]`, etc.) over the Windows Docker bind mount and 404s every dynamic route; webpack resolves them correctly.

### If you hit mass 404s

Stale anonymous volumes (`.next` / `node_modules`) are a common cause of widespread 404s after dependency or build changes. Recreate them:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Running outside Docker

You can run the Next.js app directly for quick UI work, but you still need a reachable Postgres and (for real-time features) the Socket.IO server. With `DATABASE_URL` pointing at a running database:

```bash
pnpm install
pnpm exec prisma generate
pnpm dev
```

The app falls back to `localhost:3001` for the realtime server when `SOCKET_INTERNAL_URL` is unset (non-Docker runs).

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
