export type UpdateCheckResult =
  | { status: "up_to_date" }
  | {
      status: "update_available";
      latestVersion: string;
      htmlUrl: string;
      publishedAt: string | null;
    }
  | { status: "check_failed" };
