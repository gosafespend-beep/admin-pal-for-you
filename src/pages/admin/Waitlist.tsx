import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export default function Waitlist() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Waitlist</h1>
        <p className="text-muted-foreground">
          Manage waitlist entries and invitations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Waitlist Management
          </CardTitle>
          <CardDescription>
            Coming soon: View, approve, and manage waitlist entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The waitlist management interface will be implemented in the next phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
