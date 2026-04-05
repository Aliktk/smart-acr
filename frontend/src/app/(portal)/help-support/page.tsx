import Link from "next/link";
import { LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import { PortalPageHeader, PortalSurface } from "@/components/portal/PortalPrimitives";

export default function HelpSupportPage() {
  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-6 py-8">
      <PortalPageHeader
        eyebrow="Support"
        title="Help & Support"
        description="Get help with account access, workflow questions, and system issues for the FIA Smart ACR/PER portal."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <PortalSurface title="Need assistance?" subtitle="Use the channels below when you need help with the portal or your account.">
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-[22px] border border-[var(--fia-gray-100)] bg-[var(--fia-gray-50)] p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--fia-navy-100)] text-[var(--fia-navy)]">
                <Mail size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--fia-gray-900)]">Technical Support Desk</p>
                <p className="mt-1 text-sm leading-6 text-[var(--fia-gray-500)]">
                  For login issues, profile problems, or workflow errors, contact the IT operations team.
                </p>
                <a href="mailto:it.ops@fia.gov.pk" className="mt-2 inline-block text-sm font-medium text-[var(--fia-cyan)]">
                  it.ops@fia.gov.pk
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-[22px] border border-[var(--fia-gray-100)] bg-[var(--fia-gray-50)] p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--fia-success-bg)] text-[var(--fia-success)]">
                <ShieldCheck size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--fia-gray-900)]">Workflow Guidance</p>
                <p className="mt-1 text-sm leading-6 text-[var(--fia-gray-500)]">
                  For procedural questions about initiating, reviewing, or archiving ACRs, contact your office admin lead.
                </p>
              </div>
            </div>
          </div>
        </PortalSurface>

        <PortalSurface title="Quick links" subtitle="Jump back into the areas most commonly used after support.">
          <div className="space-y-3">
            <Link href="/profile" className="flex items-center gap-3 rounded-[18px] border border-[var(--fia-gray-200)] px-4 py-3 text-sm font-medium text-[var(--fia-gray-700)] transition-colors hover:bg-[var(--fia-gray-50)]">
              <LifeBuoy size={16} className="text-[var(--fia-cyan)]" />
              My Profile
            </Link>
            <Link href="/settings" className="flex items-center gap-3 rounded-[18px] border border-[var(--fia-gray-200)] px-4 py-3 text-sm font-medium text-[var(--fia-gray-700)] transition-colors hover:bg-[var(--fia-gray-50)]">
              <LifeBuoy size={16} className="text-[var(--fia-cyan)]" />
              Settings
            </Link>
          </div>
        </PortalSurface>
      </div>
    </div>
  );
}
