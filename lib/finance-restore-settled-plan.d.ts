declare module "../public/finance-restore-settled-plan.js" {
  const restorePlan: {
    planFinanceRestoreSettled: (snapshot: Record<string, unknown>) => any;
    RESTORE_SETTLED_CONFIRM: string;
    RESTORE_SETTLED_CUTOFF_ISO: string;
    RESTORE_SETTLED_CUTOFF_YMD: string;
    RESTORE_SETTLED_MIGRATION_TYPE: string;
    toPeriodYmd: (value: unknown) => string;
  };
  export default restorePlan;
}
