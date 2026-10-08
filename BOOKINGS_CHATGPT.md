# Fusion Bookings in ChatGPT Work

Fusion Bookings connects the live booking service to ChatGPT using an authenticated MCP server. It uses the ChatGPT plan for the conversation; the website does not call the OpenAI API. ChatGPT usage limits and website hosting costs still apply.

## Connect your account

1. Open https://chatgpt.com/plugins and choose **Add custom MCP server** (or **Create custom MCP server**, depending on the interface).
2. Name it **Fusion Bookings**. Set the server URL to `https://fusionturf.in/api/integrations/bookings/mcp`.
3. Select **OAuth**. Leave the client ID and secret blank; the server supports automatic registration with PKCE using the `none` client authentication method. If the interface asks for a client registration mode, use **Dynamic Client Registration / DCR**.
4. Create and install the personal plugin. Link your Fusion Turf booking staff account when prompted, sign in on Fusion Turf, and approve the displayed booking permissions.
5. Start a new Work chat and select **@Fusion Bookings**. Ask it to list venues or show tomorrow's bookings.

The remaining installation and account consent happen in your ChatGPT account. This repository does not contain your ChatGPT login or a fabricated plugin ID. Custom server access depends on your account and workspace settings.

Manage or revoke linked accounts at https://fusionturf.in/connect/chatgpt. Revocation, staff deactivation and removal of booking permissions take effect immediately on subsequent requests.

## Example prompts

- “Use Fusion Bookings to show tomorrow's bookings at [venue], in that venue's local time.”
- “Check Turf 1 Friday from 8–9 PM and quote the price. Create the booking for Ahmed, phone [number].”
- “Find booking [number] and move it to Saturday, 9–10 PM.”
- “Cancel booking [number] because the customer cancelled.”
- “Create a public calendar PNG for [venue] for the next seven days.”
- “Screenshot the staff calendar for [venue] for October 2026.”
- “Send the booking details and invoice PDF for booking [number].”

Calendar, schedule and booking-overview requests automatically use `get_calendar`. This tool fetches the live details once and returns a readable PNG plus matching booking details and a booking/hour summary. Staff copies include names, references and colour-coded status; public copies hide customer information. “Fetch the calendar” defaults to the next seven days in the venue's timezone; day/month views and explicit date ranges are supported. After this tool update, refresh Fusion Bookings in ChatGPT Plugins and start a new Work chat so the new tool descriptions and instructions are loaded.

Creation reserves the slot with status **PENDING** and payment **PENDING**. Ask to confirm the booking if appropriate. Confirming a booking does not mark its payment paid, and cancelling does not refund a payment.

Calendar PNGs are rendered from live booking data. The default public copy omits customer names; a staff copy includes names. Website screenshots show the actual admin interface and can contain customer details. Image exports cover at most 31 days and 200 active bookings. Screenshots capture the current viewport of the booking list or the complete requested calendar component.

## Tools

`list_venues`, `check_availability`, `quote_booking`, `search_bookings`, `get_booking`, `get_booking_invoice`, `create_booking`, `reschedule_booking`, `cancel_booking`, `set_booking_status`, `get_calendar`, `generate_calendar_image`, `screenshot_bookings`.

Invoice requests use `get_booking_invoice`, which returns a real A4 PDF, matching booking/payment details, a file resource, and a clickable download link in the chat. ChatGPT Work can download the exact file and attach it when its environment supports that; the plugin does not invent ChatGPT file IDs or guarantee a native attachment in every client. The PDF follows the website's invoice layout and current business settings, terms, charges, services and discounts. Captures/refunds use the payment ledger when present, with a legacy-payment fallback. Cancelled bookings show their cancelled status and no new payment due. Exporting never changes a booking or payment.

Invoice links expire after 15 minutes and check the originating connection and staff permissions on each download. Revoking the connection or removing the staff role invalidates access. The signing key is separate from website login credentials. PDF files are stored outside the public web root under `server/.cache/bookings-invoices`, with expired-file cleanup on subsequent exports; download URLs are excluded from request logs. Request the invoice again for a fresh link. Refresh Fusion Bookings and start a new Work chat after installing this tool update.

The production Nginx configuration uses a dedicated `location ^~ /api/integrations/bookings/files/` proxy with `access_log off` so the expiring download capabilities are not recorded in its access log. The API also omits these URLs from its request logger.

All data tools require an active individual staff account with `SUPER_ADMIN`, `BOOKING_MANAGER` or `BOOKING_ADMIN` role. OAuth scopes separate reads from writes. Staff permissions are checked for every invocation. Tokens and authorization codes are hashed in PostgreSQL. Refresh tokens rotate, and authorization codes are short-lived and single-use. Bookings and audit logs stay in the existing database.

Write tools require an operation key and use stored operation results on retries. A key cannot be reused with different inputs. An interrupted operation with an uncertain outcome is held for inspection instead of automatically running a second write. Booking creation also uses the existing booking idempotency key and transaction-level overlap protection.

## Deployment configuration

Set these in the API environment, preserving all other production settings:

```dotenv
BOOKINGS_MCP_ENABLED=true
BOOKINGS_MCP_PUBLIC_URL=https://fusionturf.in
FRONTEND_URL=https://fusionturf.in
```

Install API dependencies, generate Prisma, build the API, back up the database, and apply migration `20261007000000_add_bookings_mcp`. Install the browser on the API host as the same user that runs PM2:

```bash
cd /opt/fusionturf/server
npm ci --include=dev
npx prisma generate
npm run build
npx playwright install --with-deps chromium --only-shell
```

The existing PM2 deployment uses Playwright's browser cache. Alpine Docker uses the system Chromium installed by `server/Dockerfile`; the executable can also be specified with `BOOKINGS_CHROMIUM_EXECUTABLE`. Image rendering is limited to one browser at a time per API process.

Nginx must proxy OAuth discovery to the API. Add this inside the HTTPS server block, ahead of the generic dot-file deny rule:

```nginx
location ^~ /.well-known/oauth- {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Publish the updated frontend, restart `fusionturf-api` with `--update-env`, validate Nginx with `sudo nginx -t`, then reload it. The MCP endpoint uses JSON responses over Streamable HTTP and does not require an SSE stream.

## Verification

```bash
cd /opt/fusionturf/server
npm run mcp:smoke -- https://fusionturf.in
```

This read-only check verifies discovery, tool listing, and rejection of anonymous booking access. It never creates production bookings. Security unit tests cover redirects, expiry, scope escalation, staff revocation, code replay, public-image privacy and escaped labels. Local end-to-end testing exercises browser login/consent, booking creation/retry/conflicts, confirmation, rescheduling, cancellation, PNG rendering, website capture, refresh rotation and disconnect using an isolated test database.

Official references: [MCP plugin setup](https://developers.openai.com/plugins/quickstart), [authentication](https://developers.openai.com/plugins/build/auth).

## Production release — October 8, 2026

Deployed to the existing PM2 service on `13.51.121.254`. The database migration, OAuth discovery proxy, browser installation, updated frontend and enabled MCP configuration are live. Production checks passed for all 11 tool definitions, rejection of anonymous booking access, the connection page and its assets, database health, existing tournament routes, and a public calendar PNG rendered from production venue data. No production bookings were created by the checks.

Rollback artifacts are stored on the EC2 host in `/home/ubuntu/fusion-bookings-backup-20261008`: the verified database dump, original environment file, original Nginx configuration, original source/build archive and prior server dependency tree. Database restoration is not needed to disable this integration: set `BOOKINGS_MCP_ENABLED=false` and restart the API with the updated environment. Do not restore the database dump over newer bookings or payments.

The 1 GB host exhausted Node's default compiler heap during staging. This release was built and checked locally, and its portable compiled JavaScript and frontend assets were transferred to the server; dependencies and the native Prisma client were installed/generated on Linux. For future builds on this host, provide a sufficient compiler heap (for example, `NODE_OPTIONS=--max-old-space-size=768 npm run build`) or build locally and transfer the compiled assets. Preserve the production frontend API URL and server environment.

Validation: 72 server unit tests and 18 client tests passed, as did schema/migration comparison, frontend asset budgets and browser end-to-end booking/OAuth/image checks. Existing dependency audit findings remain in the baseline: five server findings and nine client findings. The affected server package versions are unchanged by this integration; resolving unrelated dependency upgrades requires a separate change.

The subsequent calendar update adds a twelfth tool, `get_calendar`, and changes the server instructions to include a generated image automatically with calendar/schedule overviews. Its image and structured booking details share one live data fetch. Default dates use the venue timezone; staff/public privacy, overnight times, booking totals and matching image/data output are covered by nine additional tests (81 server tests now pass). No database migration, new API key, package installation or frontend rebuild is required for this update.

The invoice update adds a thirteenth tool, `get_booking_invoice`, and a scoped PDF download endpoint. Booking, payment ledger and invoice settings are read in a consistent database snapshot before rendering. Validation includes 90 server tests, actual PDF generation/download and MCP resource retrieval, malformed-link rejection, staff demotion/connection revocation, and inspection of the generated A4 PDF's text and layout. No new database migration or package installation is required.
