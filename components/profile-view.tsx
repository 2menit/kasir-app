import { User as UserIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/kpi-card";
import { ChangePasswordForm } from "@/components/forms/change-password-form";

export function ProfileView({
  name,
  username,
  role,
}: {
  name: string;
  username: string;
  role: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Profil Saya" description="Informasi akun dan keamanan." />

      <Card>
        <CardContent className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-strong text-ink">
            <UserIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-display">
              {name}
            </p>
            <p className="font-mono text-sm text-body">@{username}</p>
          </div>
          <Badge
            className={
              role === "SUPERADMIN"
                ? "ml-auto bg-primary/10 text-primary"
                : "ml-auto bg-surface-strong text-body"
            }
          >
            {role === "SUPERADMIN" ? "Superadmin" : "Crew"}
          </Badge>
        </CardContent>
      </Card>

      <ChangePasswordForm />
    </div>
  );
}
