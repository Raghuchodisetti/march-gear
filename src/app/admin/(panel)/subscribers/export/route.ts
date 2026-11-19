import { csvResponse } from "@/server/admin/csv";
import { exportSubscribers } from "@/server/admin/audience";

export async function GET() {
  const rows = await exportSubscribers();
  return csvResponse(
    `marchgear-subscribers-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Email", "Signed up from", "Date (UTC)"],
    rows.map((s) => [s.email, s.source, s.createdAt.toISOString().slice(0, 19).replace("T", " ")]),
  );
}
