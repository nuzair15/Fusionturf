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
for (const required of ["list_venues", "search_bookings", "create_booking", "reschedule_booking", "cancel_booking", "get_calendar", "get_booking_invoice", "generate_calendar_image", "screenshot_bookings"]) if (!names.includes(required)) throw new Error(`Missing tool: ${required}`);
for (const name of ["get_calendar", "generate_calendar_image", "screenshot_bookings"]) {
  const tool = payload.result.tools.find(tool => tool.name === name);
  if (tool._meta?.ui?.resourceUri !== "ui://fusion-bookings/image-v1.html") throw new Error(`Missing image viewer: ${name}`);
  if (!tool.outputSchema?.properties?.image?.required?.includes("downloadUrl") || !tool.outputSchema.properties.image.required.includes("sha256")) throw new Error(`Missing verified file output schema: ${name}`);
  if (!tool.description.includes("Never invent sandbox:/mnt/data links")) throw new Error(`Missing file delivery instructions: ${name}`);
}
const viewerResponse = await fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "resources/read", params: { uri: "ui://fusion-bookings/image-v1.html" } }), signal: AbortSignal.timeout(15000) });
const viewer = (await viewerResponse.json()).result?.contents?.[0];
if (viewer?.mimeType !== "text/html;profile=mcp-app" || !viewer.text.includes("ui/notifications/tool-result") || !viewer._meta?.ui?.csp?.resourceDomains.includes(origin)) throw new Error("Booking image viewer or image origin policy is missing");
const denied = await fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_venues", arguments: {} } }), signal: AbortSignal.timeout(15000) });
const deniedPayload = await denied.json();
if (!deniedPayload.result?.isError || !deniedPayload.result?._meta?.["mcp/www_authenticate"]) throw new Error("Anonymous booking access was not rejected correctly");
const calendarDenied = await fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_calendar", arguments: { venueId: "authentication-check" } } }), signal: AbortSignal.timeout(15000) });
const calendarDeniedPayload = await calendarDenied.json();
if (!calendarDeniedPayload.result?.isError || !calendarDeniedPayload.result?._meta?.["mcp/www_authenticate"]) throw new Error("Anonymous calendar access was not rejected correctly");
const invoiceDenied = await fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_booking_invoice", arguments: { bookingIdOrNumber: "authentication-check" } } }), signal: AbortSignal.timeout(15000) });
const invoiceDeniedPayload = await invoiceDenied.json();
if (!invoiceDeniedPayload.result?.isError || !invoiceDeniedPayload.result?._meta?.["mcp/www_authenticate"]) throw new Error("Anonymous invoice access was not rejected correctly");
console.log(`PASS: enabled, OAuth discovery, ${names.length} tools, anonymous booking access blocked.`);

// Optional authenticated pre-presentation check. Keep tokens in environment
// variables; never print bearer tokens or signed download capabilities.
const accessToken = process.env.BOOKINGS_MCP_ACCESS_TOKEN;
if (accessToken) {
  const { createHash } = await import("node:crypto");
  let nextId = 10;
  const rpc = async (method, params) => {
    const response = await fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }), signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`Authenticated MCP: HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload.result || payload.result.isError) throw new Error("Authenticated read-only MCP check failed; verify the connection and retry.");
    return payload.result;
  };
  const venues = JSON.parse((await rpc("tools/call", { name: "list_venues", arguments: {} })).content[0].text).venues;
  const venueId = process.env.BOOKINGS_MCP_VENUE_ID || (venues.length === 1 ? venues[0].id : undefined);
  if (!venueId) throw new Error("Set BOOKINGS_MCP_VENUE_ID for the presentation venue.");
  const arguments_ = { venueId, audience: "public", ...(process.env.BOOKINGS_MCP_START_DATE ? { startDate: process.env.BOOKINGS_MCP_START_DATE } : {}), ...(process.env.BOOKINGS_MCP_END_DATE ? { endDate: process.env.BOOKINGS_MCP_END_DATE } : {}) };
  const verifyFile = async file => {
    const response = await fetch(file.downloadUrl, { signal: AbortSignal.timeout(15000), redirect: "error" });
    if (!response.ok || !response.headers.get("content-disposition")?.startsWith("attachment;") || response.headers.get("content-type") !== file.mimeType) throw new Error("Export did not deliver a downloadable file.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== file.size || createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw new Error("Export bytes do not match the tool result.");
    const resource = await rpc("resources/read", { uri: file.downloadUrl });
    if (!Buffer.from(resource.contents[0].blob, "base64").equals(bytes)) throw new Error("MCP file resource differs from HTTPS download.");
  };
  // Exercise concurrent calls against the real rendering queue.
  const calendars = await Promise.all([rpc("tools/call", { name: "get_calendar", arguments: arguments_ }), rpc("tools/call", { name: "get_calendar", arguments: arguments_ })]);
  for (const calendar of calendars) await verifyFile(calendar.structuredContent.image);
  if (process.env.BOOKINGS_MCP_BOOKING_ID) {
    const invoice = await rpc("tools/call", { name: "get_booking_invoice", arguments: { bookingIdOrNumber: process.env.BOOKINGS_MCP_BOOKING_ID } });
    await verifyFile(invoice.structuredContent.file);
  }
  console.log("PASS: authenticated concurrent calendars, HTTPS byte/checksum verification and MCP file reads; optional invoice checked when supplied. No bookings or payments changed.");
}
