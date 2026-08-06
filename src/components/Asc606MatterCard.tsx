import { ASC606_STEPS, type Asc606Assessment } from "@/lib/asc606";
import Link from "next/link";

export function Asc606MatterCard({
  assessment,
  matterHref,
}: {
  assessment: Asc606Assessment;
  matterHref?: string;
}) {
  const badge =
    assessment.status === "Compliant"
      ? "badge-success"
      : assessment.status === "Needs Attention"
        ? "badge-warning"
        : "badge-error";

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body space-y-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="card-title text-base">ASC 606 compliance</h2>
            <p className="text-xs opacity-60 mt-1">
              Five-step revenue recognition model for this engagement (educational demo).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${badge}`}>{assessment.status}</span>
            <span className="badge badge-ghost">Score {assessment.score}</span>
          </div>
        </div>

        <ol className="space-y-2">
          {ASC606_STEPS.map((s) => {
            const stepGaps = assessment.gaps.filter((g) => g.step === s.step);
            return (
              <li key={s.step} className="rounded-box border border-base-200 p-3">
                <p className="font-medium">
                  Step {s.step}. {s.title}
                </p>
                <p className="text-xs opacity-70 mt-0.5">{s.lawFirmMeaning}</p>
                {stepGaps.length === 0 ? (
                  <p className="text-xs text-success mt-1">No gaps flagged for this step.</p>
                ) : (
                  <ul className="mt-1 list-disc pl-4 text-xs space-y-0.5">
                    {stepGaps.map((g) => (
                      <li key={g.code}>
                        <span className="opacity-60 uppercase">{g.severity}</span> — {g.message}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <h3 className="font-semibold">Performance obligations</h3>
            <ul className="mt-1 space-y-2">
              {assessment.performanceObligations.map((po) => (
                <li key={po.id} className="rounded-box bg-base-200/50 p-2">
                  <p className="font-medium">{po.label}</p>
                  <p className="text-xs opacity-70">
                    Satisfaction: {po.satisfaction}. {po.recognitionTrigger}
                  </p>
                  <p className="text-xs opacity-60">Allocation: {po.allocationBasis}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <div>
              <h3 className="font-semibold">Transaction price</h3>
              <p className="opacity-80 mt-0.5">{assessment.transactionPriceSummary}</p>
            </div>
            <div>
              <h3 className="font-semibold">Variable consideration</h3>
              <p className="opacity-80 mt-0.5">{assessment.variableConsideration}</p>
            </div>
            <div>
              <h3 className="font-semibold">Recognition</h3>
              <p className="opacity-80 mt-0.5">{assessment.recognitionPattern}</p>
            </div>
            <div>
              <h3 className="font-semibold">Contract liability (retainers)</h3>
              <p className="opacity-80 mt-0.5">{assessment.contractLiabilityNote}</p>
            </div>
          </div>
        </div>

        {matterHref && (
          <Link href={matterHref} className="btn btn-outline btn-sm w-fit">
            Open matter
          </Link>
        )}
      </div>
    </div>
  );
}
