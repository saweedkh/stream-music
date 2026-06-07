"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Gift, Users } from "lucide-react";
import { AdminBillingTrends } from "@/features/admin/components/admin-billing-trends";
import { AdminDateRangeToolbar, AdminExportCsvButton } from "@/features/admin/components/admin-list-toolbar";
import { AdminStatCard } from "@/features/admin/components/admin-stat-card";
import { AdminDataTable, AdminTableShell } from "@/features/admin/components/admin-table-shell";
import { useAdminPaginatedList } from "@/features/admin/hooks/use-admin-paginated-list";
import {
  exportAdminBillingReferralSignups,
  exportAdminBillingStripePurchases,
  getAdminBillingOverview,
  listAdminBillingPremiumUsers,
  listAdminBillingReferralSignups,
  listAdminBillingStripePurchases,
  patchAdminUser,
} from "@/lib/api/admin";
import type { AdminBillingOverview } from "@/lib/api/types/admin";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { useToast } from "@/shared/ui/toast-provider";

type BillingTab = "stripe" | "premium" | "referrals";

export function AdminBillingSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [tab, setTab] = useState<BillingTab>("stripe");
  const [overview, setOverview] = useState<AdminBillingOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [overviewDateFrom, setOverviewDateFrom] = useState("");
  const [overviewDateTo, setOverviewDateTo] = useState("");
  const [appliedOverviewFrom, setAppliedOverviewFrom] = useState("");
  const [appliedOverviewTo, setAppliedOverviewTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const stripeFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number; dateFrom?: string; dateTo?: string }) =>
      listAdminBillingStripePurchases(opts),
    [],
  );
  const premiumFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminBillingPremiumUsers(opts),
    [],
  );
  const referralsFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number; dateFrom?: string; dateTo?: string }) =>
      listAdminBillingReferralSignups(opts),
    [],
  );

  const stripe = useAdminPaginatedList(stripeFetcher, { withDateRange: true });
  const premium = useAdminPaginatedList(premiumFetcher);
  const referrals = useAdminPaginatedList(referralsFetcher, { withDateRange: true });

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const data = await getAdminBillingOverview({
        dateFrom: appliedOverviewFrom || undefined,
        dateTo: appliedOverviewTo || undefined,
      });
      setOverview(data);
    } catch {
      showToast(t("admin.loadFailed"), "error");
    } finally {
      setLoadingOverview(false);
    }
  }, [appliedOverviewFrom, appliedOverviewTo, showToast, t]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const stripeRows = useMemo(
    () =>
      stripe.rows.map((row) => ({
        user: `@${row.username}`,
        session: <code className="text-xs">{row.stripe_session_id.slice(0, 20)}…</code>,
        amount:
          row.amount_total != null
            ? `${(row.amount_total / 100).toFixed(2)} ${(row.currency || "usd").toUpperCase()}`
            : "—",
        date: row.created_at ? new Date(row.created_at).toLocaleString() : "—",
      })),
    [stripe.rows],
  );

  const premiumRows = useMemo(
    () =>
      premium.rows.map((row) => ({
        user: (
          <div>
            <p className="font-medium">@{row.username}</p>
            <p className="text-xs text-muted-foreground">{row.email || "—"}</p>
          </div>
        ),
        source: <Badge variant="secondary">{row.source}</Badge>,
        meta: `${row.stripe_purchases} Stripe · ${row.code_redemptions} code`,
        actions: (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busyUserId === row.user_id}
            onClick={async () => {
              setBusyUserId(row.user_id);
              try {
                await patchAdminUser(row.user_id, { is_premium: false });
                await premium.reload();
                showToast(t("admin.billing.premiumRevoked"), "success");
              } catch (e) {
                showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
              } finally {
                setBusyUserId(null);
              }
            }}
          >
            {t("admin.billing.revokePremium")}
          </Button>
        ),
      })),
    [busyUserId, premium, showToast, t],
  );

  async function handleExport(kind: "stripe" | "referrals") {
    setExporting(true);
    try {
      if (kind === "stripe") {
        await exportAdminBillingStripePurchases({
          search: stripe.appliedSearch || undefined,
          dateFrom: stripe.queryDateFrom || undefined,
          dateTo: stripe.queryDateTo || undefined,
        });
      } else {
        await exportAdminBillingReferralSignups({
          search: referrals.appliedSearch || undefined,
          dateFrom: referrals.queryDateFrom || undefined,
          dateTo: referrals.queryDateTo || undefined,
        });
      }
      showToast(t("admin.exportStarted"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
    } finally {
      setExporting(false);
    }
  }

  if (loadingOverview && !overview) return <Skeleton className="h-80 w-full rounded-2xl" />;

  const revenue =
    overview && overview.stripe_revenue_cents > 0
      ? `${(overview.stripe_revenue_cents / 100).toFixed(2)} USD`
      : "—";

  const dateToolbar = (list: typeof stripe) => (
    <div className="flex flex-wrap items-end gap-2">
      <AdminDateRangeToolbar
        dateFrom={list.dateFrom}
        dateTo={list.dateTo}
        onDateFromChange={list.setDateFrom}
        onDateToChange={list.setDateTo}
        onClear={list.clearDateRange}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t("admin.billing.dashboardFilter")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <AdminDateRangeToolbar
            dateFrom={overviewDateFrom}
            dateTo={overviewDateTo}
            onDateFromChange={setOverviewDateFrom}
            onDateToChange={setOverviewDateTo}
            onClear={() => {
              setOverviewDateFrom("");
              setOverviewDateTo("");
              setAppliedOverviewFrom("");
              setAppliedOverviewTo("");
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setAppliedOverviewFrom(overviewDateFrom);
              setAppliedOverviewTo(overviewDateTo);
            }}
          >
            {t("admin.applyFilters")}
          </Button>
        </CardContent>
      </Card>

      {overview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              label={t("admin.billing.premiumUsers")}
              value={overview.premium_users}
              icon={Users}
              accent="amber"
            />
            <AdminStatCard
              label={t("admin.billing.stripePurchases")}
              value={overview.stripe_purchases}
              sub={overview.stripe_configured ? t("admin.billing.stripeOn") : t("admin.billing.stripeOff")}
              icon={CreditCard}
              accent="brand"
            />
            <AdminStatCard
              label={t("admin.billing.stripeRevenue")}
              value={revenue}
              icon={CreditCard}
              accent="emerald"
            />
            <AdminStatCard
              label={t("admin.billing.referralSignups")}
              value={overview.referral_signups}
              sub={t("admin.billing.codeRedemptions", { count: overview.code_redemptions })}
              icon={Gift}
              accent="violet"
            />
          </div>
          <AdminBillingTrends
            stripePurchases={overview.trends.stripe_purchases}
            referralSignups={overview.trends.referral_signups}
          />
        </>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "stripe" as const, label: t("admin.billing.tab.stripe") },
            { id: "premium" as const, label: t("admin.billing.tab.premium") },
            { id: "referrals" as const, label: t("admin.billing.tab.referrals") },
          ] as const
        ).map((item) => (
          <Button key={item.id} type="button" size="sm" variant={tab === item.id ? "default" : "outline"} onClick={() => setTab(item.id)}>
            {item.label}
          </Button>
        ))}
      </div>

      {tab === "stripe" ? (
        <AdminTableShell
          title={t("admin.billing.stripeTitle")}
          searchPlaceholder={t("admin.searchBilling")}
          search={stripe.search}
          onSearchChange={stripe.setSearch}
          onSearchSubmit={stripe.submitSearch}
          onRefresh={() => void stripe.reload()}
          loading={stripe.loading}
          total={stripe.total}
          page={stripe.page}
          pageCount={stripe.pageCount}
          onPrevPage={stripe.prevPage}
          onNextPage={stripe.nextPage}
          toolbarExtra={
            <div className="flex flex-wrap items-end gap-2">
              {dateToolbar(stripe)}
              <AdminExportCsvButton disabled={exporting} onExport={() => handleExport("stripe")} />
            </div>
          }
        >
          <AdminDataTable
            loading={stripe.loading}
            emptyMessage={t("admin.billing.emptyStripe")}
            columns={[
              { key: "user", header: t("admin.col.user") },
              { key: "session", header: t("admin.billing.session") },
              { key: "amount", header: t("admin.billing.amount") },
              { key: "date", header: t("admin.col.date") },
            ]}
            rows={stripeRows}
          />
        </AdminTableShell>
      ) : null}

      {tab === "premium" ? (
        <AdminTableShell
          title={t("admin.billing.premiumTitle")}
          searchPlaceholder={t("admin.searchUsers")}
          search={premium.search}
          onSearchChange={premium.setSearch}
          onSearchSubmit={premium.submitSearch}
          onRefresh={() => void premium.reload()}
          loading={premium.loading}
          total={premium.total}
          page={premium.page}
          pageCount={premium.pageCount}
          onPrevPage={premium.prevPage}
          onNextPage={premium.nextPage}
        >
          <AdminDataTable
            loading={premium.loading}
            emptyMessage={t("admin.empty")}
            columns={[
              { key: "user", header: t("admin.col.user") },
              { key: "source", header: t("admin.col.source") },
              { key: "meta", header: t("admin.col.meta") },
              { key: "actions", header: "" },
            ]}
            rows={premiumRows}
          />
        </AdminTableShell>
      ) : null}

      {tab === "referrals" ? (
        <AdminTableShell
          title={t("admin.billing.referralsTitle")}
          searchPlaceholder={t("admin.searchReferrals")}
          search={referrals.search}
          onSearchChange={referrals.setSearch}
          onSearchSubmit={referrals.submitSearch}
          onRefresh={() => void referrals.reload()}
          loading={referrals.loading}
          total={referrals.total}
          page={referrals.page}
          pageCount={referrals.pageCount}
          onPrevPage={referrals.prevPage}
          onNextPage={referrals.nextPage}
          toolbarExtra={
            <div className="flex flex-wrap items-end gap-2">
              {dateToolbar(referrals)}
              <AdminExportCsvButton disabled={exporting} onExport={() => handleExport("referrals")} />
            </div>
          }
        >
          <AdminDataTable
            loading={referrals.loading}
            emptyMessage={t("admin.billing.emptyReferrals")}
            columns={[
              { key: "code", header: t("admin.col.code") },
              { key: "referrer", header: t("admin.billing.referrer") },
              { key: "referred", header: t("admin.billing.referred") },
              { key: "date", header: t("admin.col.date") },
            ]}
            rows={referrals.rows.map((row) => ({
              code: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.code}</code>,
              referrer: `@${row.referrer_username}`,
              referred: `@${row.referred_username}`,
              date: row.created_at ? new Date(row.created_at).toLocaleString() : "—",
            }))}
          />
        </AdminTableShell>
      ) : null}
    </div>
  );
}
