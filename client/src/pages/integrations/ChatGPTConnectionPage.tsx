import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Connection = { id: string; clientName: string; scopes: string[]; createdAt: string };
type ConnectionRequest = { clientName: string; scopes: string[]; expiresAt: string };
const staffRoles = ["SUPER_ADMIN", "BOOKING_MANAGER", "BOOKING_ADMIN"];
const permissionLabel = (scope: string) => scope === "bookings:write" ? "Create, reschedule, confirm and cancel bookings" : "Read bookings, availability and prices; create calendar images and staff screenshots";

export function ChatGPTConnectionPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const requestId = params.get("request");
  const [request, setRequest] = useState<ConnectionRequest | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [status, setStatus] = useState<{ enabled: boolean; mcpUrl: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const staff = !!user && staffRoles.includes(user.role);

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    setLoading(true); setError("");
    const load = async () => {
      try {
        const setup = await api.get<{ enabled: boolean; mcpUrl: string }>("/integrations/bookings/status");
        if (cancelled) return;
        setStatus(setup);
        if (!setup.enabled) return;
        if (requestId) {
          const pending = await api.get<ConnectionRequest>(`/integrations/bookings/requests/${encodeURIComponent(requestId)}`);
          if (!cancelled) setRequest(pending);
        } else {
          const linked = await api.get<{ connections: Connection[] }>("/integrations/bookings/connections");
          if (!cancelled) setConnections(linked.connections);
        }
      } catch (failure) { if (!cancelled) setError(failure instanceof Error ? failure.message : "Could not load connections"); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [staff, requestId, user?.id]);

  async function consent(approve: boolean) {
    setBusy(true); setError("");
    try {
      const result = await api.post<{ redirectUrl: string }>(`/integrations/bookings/requests/${encodeURIComponent(requestId!)}/consent`, { approve });
      window.location.assign(result.redirectUrl);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not connect"); setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError("");
    try { await api.post(`/integrations/bookings/connections/${encodeURIComponent(id)}/revoke`, {}); setConnections(current => current.filter(connection => connection.id !== id)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not disconnect"); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-2xl px-4 py-12">
    <Card><CardHeader><CardTitle>{requestId ? "Connect your booking account" : "ChatGPT booking assistant"}</CardTitle></CardHeader><CardContent className="space-y-5">
      {isLoading ? <p>Checking your account…</p> : !user ? <><p>Sign in with your Fusion Turf booking staff account to connect ChatGPT.</p><Button onClick={() => navigate("/auth", { state: { from: location.pathname + location.search } })}>Sign in</Button></> : !staff ? <p>Your account needs booking staff permissions to use this connection.</p> : <>
        <p className="text-sm text-muted-foreground">Signed in as {user.firstName} {user.lastName}. ChatGPT will use your booking permissions.</p>
        {loading && <p>Loading connection…</p>}
        {status && !status.enabled && <p>The booking assistant has not been enabled on this website yet.</p>}
        {request && status?.enabled && <>
          <p><strong>{request.clientName}</strong> is requesting access to your Fusion Turf bookings:</p>
          <ul className="list-disc space-y-2 pl-5">{request.scopes.map(scope => <li key={scope}>{permissionLabel(scope)}</li>)}</ul>
          <p className="text-sm text-muted-foreground">Your password and authentication codes stay on Fusion Turf. You can revoke this connection here at any time.</p>
          <div className="flex gap-3"><Button disabled={busy} onClick={() => consent(true)}>{busy ? "Please wait…" : "Allow connection"}</Button><Button variant="outline" disabled={busy} onClick={() => consent(false)}>Decline</Button></div>
        </>}
        {!requestId && status?.enabled && <>
          <p>Install your private Fusion Bookings plugin in ChatGPT, then link this staff account.</p>
          <p className="text-sm">In ChatGPT, open Plugins, choose <strong>Add custom MCP server</strong>, use the address below, and select <strong>OAuth</strong>. Leave the client ID and secret blank to use automatic registration.</p>
          <div className="break-all rounded-lg border bg-muted/40 p-3 font-mono text-sm">{status.mcpUrl}</div>
          <a className="inline-block font-medium text-primary underline" href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer">Open ChatGPT Plugins</a>
          <p className="text-sm text-muted-foreground">After installing, start a Work chat and select @Fusion Bookings. Ask for live bookings or a calendar image.</p>
          <h2 className="font-semibold">Your active connections</h2>
          {connections.length === 0 ? <p className="text-sm text-muted-foreground">No linked accounts yet.</p> : connections.map(connection => <div key={connection.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{connection.clientName}</p><p className="text-xs text-muted-foreground">Connected {new Date(connection.createdAt).toLocaleDateString()} · {connection.scopes.includes("bookings:write") ? "Read and manage bookings" : "Read bookings"}</p></div><Button variant="outline" disabled={busy} onClick={() => revoke(connection.id)}>Disconnect</Button></div>)}
        </>}
      </>}
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Link className="block text-sm text-primary underline" to="/admin?tab=bookings">Return to bookings</Link>
    </CardContent></Card>
  </div>;
}
