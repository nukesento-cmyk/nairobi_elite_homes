import { estimateBread, formatBread, type RequestStats } from "@/lib/bread";

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-forest-900/40 p-5">
      <p className="text-sm text-bone-200">{label}</p>
      <p className="mt-2 font-heading text-4xl text-bone-50">{value}</p>
      {note && <p className="mt-1 text-sm text-bone-200">{note}</p>}
    </div>
  );
}

const shortDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** One series over time: a single hue, a baseline, and the numbers available on hover and in a table. */
function RequestTrend({ daily }: { daily: RequestStats["daily"] }) {
  const peak = Math.max(1, ...daily.map(({ count }) => count));
  const total = daily.reduce((sum, { count }) => sum + count, 0);
  return (
    <figure className="rounded-xl border border-border bg-forest-900/40 p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-bone-50">Requests, last 14 days</span>
        <span className="text-sm text-bone-200">{total} in total, busiest day {peak === 1 && total === 0 ? 0 : peak}</span>
      </figcaption>
      <div aria-hidden="true" className="mt-5 flex h-32 items-stretch gap-0.5 border-b border-border">
        {daily.map(({ day, count }) => (
          <div key={day} className="group relative flex flex-1 items-end">
            <div
              className="w-full rounded-t bg-copper-400 group-hover:bg-bone-50"
              style={{ height: count > 0 ? `${Math.max((count / peak) * 100, 4)}%` : "0" }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-bone-50 px-2 py-1 text-xs whitespace-nowrap text-forest-950 group-hover:block">
              {shortDay(day)}: {count}
            </span>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-2 flex justify-between text-xs text-bone-200">
        <span>{daily[0] && shortDay(daily[0].day)}</span>
        <span>{daily.at(-1) && shortDay(daily.at(-1)!.day)}</span>
      </div>
      <table className="sr-only">
        <caption>Requests per day</caption>
        <thead><tr><th>Day</th><th>Requests</th></tr></thead>
        <tbody>
          {daily.map(({ day, count }) => <tr key={day}><td>{shortDay(day)}</td><td>{count}</td></tr>)}
        </tbody>
      </table>
    </figure>
  );
}

export function AdminOverview({ stats, monthlyPrice }: { stats: RequestStats; monthlyPrice: number | null }) {
  const bread = estimateBread(stats, monthlyPrice);
  return (
    <section id="overview" aria-labelledby="overview-heading" className="mb-14 scroll-mt-6">
      <h2 id="overview-heading" className="sr-only">Overview</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-copper/50 bg-forest-900/60 p-6 lg:row-span-2 lg:flex lg:flex-col lg:justify-center">
          <p className="text-sm text-copper-400">Estimated bread, per month</p>
          {bread ? (
            <>
              <p data-bread className="mt-2 font-heading text-5xl leading-tight text-bone-50">{formatBread(bread.potential)}</p>
              <p className="mt-2 text-sm text-bone-200">
                {bread.potentialPeople} {bread.potentialPeople === 1 ? "request" : "requests"} × {formatBread(bread.price)} a month
              </p>
              <p className="mt-5 text-sm text-copper-400">From links already sent</p>
              <p className="mt-1 font-heading text-3xl text-bone-50">{formatBread(bread.linkSent)}</p>
              <p className="mt-5 text-xs text-bone-200">
                An estimate only, assuming everyone not declined pays. No payments are being collected yet.
              </p>
            </>
          ) : (
            <p className="mt-2 text-bone-200">Set a monthly price to estimate bread.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-4">
          <Tile label="Asked to join" value={stats.total.toLocaleString("en-US")} />
          <Tile label="Waiting" value={stats.pending.toLocaleString("en-US")} />
          <Tile label="Link sent" value={stats.linkSent.toLocaleString("en-US")} />
          <Tile label="Declined" value={stats.declined.toLocaleString("en-US")} />
        </div>
        <div className="lg:col-span-2">
          <RequestTrend daily={stats.daily} />
        </div>
      </div>
    </section>
  );
}
