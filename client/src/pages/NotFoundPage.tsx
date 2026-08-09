import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const navigate = useNavigate();
  return <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center"><p className="text-6xl font-black text-primary">404</p><h1 className="mt-4 text-2xl font-bold">Page not found</h1><p className="mt-2 text-muted-foreground">That football page does not exist or may have moved.</p><Button className="mt-6" onClick={() => navigate("/")}>Back to home</Button></div>;
}
