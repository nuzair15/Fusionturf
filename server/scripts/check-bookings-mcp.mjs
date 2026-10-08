// Read-only deployment check. Never creates bookings or needs staff credentials.
const origin = (process.argv[2] || process.env.BOOKINGS_MCP_PUBLIC_URL || "https://fusionturf.in").replace(/\/$/, "");
const base = `${origin}/api/integrations/bookings`;
const get = async path => {
  const response = await fetch(path, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};
const status = await get(`${base}/status`);
if (!status.enabled) throw new Error("Booking MCP is disabled");
const auth = await get(`${origin}/.well-known/oauth-authorization-server`);
const resource = await get(`${base}/resource-metadata`);
if (auth.issuer !== origin || resource.resource !== `${base}/mcp` || !auth.code_challenge_methods_supported.includes("S256")) throw new Error("OAuth discovery metadata mismatch");
const response = await fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }), signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`MCP tools/list: HTTP ${response.status}`);
const payload = await response.json();
const names = payload.result?.tools?.map(tool => tool.name) || [];
for (const required of ["list_venues", "search_bookings", "create_booking", "reschedule_booking", "cancel_booking", "get_calendar", "generate_calendar_image", "screenshot_bookings"]) if (!names.includes(required)) throw new Error(`Missing tool: ${required}`);
const denied = await fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_venues", arguments: {} } }), signal: AbortSignal.timeout(15000) });
const deniedPayload = await denied.json();
if (!deniedPayload.result?.isError || !deniedPayload.result?._meta?.["mcp/www_authenticate"]) throw new Error("Anonymous booking access was not rejected correctly");
const calendarDenied = await fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_calendar", arguments: { venueId: "authentication-check" } } }), signal: AbortSignal.timeout(15000) });
const calendarDeniedPayload = await calendarDenied.json();
if (!calendarDeniedPayload.result?.isError || !calendarDeniedPayload.result?._meta?.["mcp/www_authenticate"]) throw new Error("Anonymous calendar access was not rejected correctly");
console.log(`PASS: enabled, OAuth discovery, ${names.length} tools, anonymous booking access blocked.`);
