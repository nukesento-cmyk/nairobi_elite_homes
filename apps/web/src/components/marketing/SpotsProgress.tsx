import { getLiveSite } from "@/lib/cms";

/** Shown only during founding, and only with real numbers and spots still open. */
export async function SpotsProgress() {
  const { status, memberCount, cap, spotsLeft } = (await getLiveSite()).community;
  if (status !== "founding" || memberCount === null || !cap || !spotsLeft) return null;

  const label = `${memberCount.toLocaleString("en-US")} of ${cap.toLocaleString("en-US")} founding spots taken`;

  return (
    <div className="max-w-md">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={memberCount}
        className="h-1.5 overflow-hidden rounded-full bg-forest-800"
      >
        <div
          className="h-full rounded-full bg-copper"
          style={{ width: `${(memberCount / cap) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-bone-200">{label}</p>
    </div>
  );
}
