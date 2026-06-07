"use client";

import { Download } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type AdminDateRangeToolbarProps = {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear?: () => void;
};

export function AdminDateRangeToolbar({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear,
}: AdminDateRangeToolbarProps) {
  const { t } = useTranslations();

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="admin-date-from" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("admin.dateFrom")}
        </label>
        <Input id="admin-date-from" type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className="h-9 w-[9.5rem]" />
      </div>
      <div>
        <label htmlFor="admin-date-to" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("admin.dateTo")}
        </label>
        <Input id="admin-date-to" type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className="h-9 w-[9.5rem]" />
      </div>
      {onClear && (dateFrom || dateTo) ? (
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          {t("admin.clearDates")}
        </Button>
      ) : null}
    </div>
  );
}

type AdminExportCsvButtonProps = {
  onExport: () => Promise<void>;
  disabled?: boolean;
};

export function AdminExportCsvButton({ onExport, disabled }: AdminExportCsvButtonProps) {
  const { t } = useTranslations();

  return (
    <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void onExport()}>
      <Download className="h-4 w-4" aria-hidden />
      {t("admin.exportCsv")}
    </Button>
  );
}
