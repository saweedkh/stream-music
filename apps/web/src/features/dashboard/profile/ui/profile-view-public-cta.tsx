"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";

type ProfileViewPublicLinkProps = {
  username: string;
};

export function ProfileViewPublicLink({ username }: ProfileViewPublicLinkProps) {
  const { t } = useTranslations();

  return (
    <Button variant="outline" size="sm" className="mt-4 w-full gap-2 sm:w-auto" asChild>
      <Link href={`/users/${username}`} target="_blank" rel="noopener noreferrer">
        {t("profile.viewPublicPage")}
        <ArrowUpRight className="size-3.5 opacity-70" aria-hidden />
      </Link>
    </Button>
  );
}
