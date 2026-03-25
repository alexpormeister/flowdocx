import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

const ADMIN_EMAILS = ["pormeisteralex@gmail.com"];

export default function AdminCreateUserDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return null;
  }

  const handleCreate = async () => {
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email, password, display_name: displayName || undefined },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`User ${email} created successfully`);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setOpen(false);
    } catch (err) {
      toast.error("Failed to create user: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User (Admin)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
            />
          </div>
          <div className="space-y-2">
            <Label>Display Name (optional)</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? "Creating..." : "Create User"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
