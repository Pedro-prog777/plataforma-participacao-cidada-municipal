import { AccessibilityBar, DemoBanner, SiteFooter, SiteHeader } from "@/components/layout/site-chrome";
import { getCurrentActor } from "@/server/auth/current";
import { demoMode, env } from "@/server/lib/env";
import { unreadCount } from "@/server/modules/notifications/notifications.service";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentActor();
  const unread = actor ? await unreadCount(actor.id) : 0;
  const demo = demoMode();
  return (
    <div className="flex min-h-dvh flex-col">
      <AccessibilityBar municipio={env.municipio} uf={env.uf} />
      {demo && <DemoBanner />}
      <SiteHeader user={actor ? { name: actor.name, kind: actor.kind, unread } : null} municipio={env.municipio} />
      <div className="flex-1">{children}</div>
      <SiteFooter municipio={env.municipio} demo={demo} />
    </div>
  );
}
