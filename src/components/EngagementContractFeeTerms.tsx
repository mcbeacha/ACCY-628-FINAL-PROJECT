import { formatCurrency } from "@/lib/format";
import type { Matter } from "@/lib/types";

/** Default court premium when a court rate is not stored on the matter. */
export const COURT_RATE_MULTIPLIER = 1.5;

export function effectiveCourtHourlyRate(matter: Pick<Matter, "hourly_rate" | "court_hourly_rate">) {
  if (matter.court_hourly_rate != null && matter.court_hourly_rate > 0) {
    return matter.court_hourly_rate;
  }
  if (matter.hourly_rate != null && matter.hourly_rate > 0) {
    return Math.round(matter.hourly_rate * COURT_RATE_MULTIPLIER * 100) / 100;
  }
  return null;
}

type Props = {
  matter: Pick<
    Matter,
    | "billing_method"
    | "hourly_rate"
    | "court_hourly_rate"
    | "maximum_fee_amount"
    | "fixed_fee_amount"
    | "contingency_percentage"
    | "estimated_matter_value"
    | "initial_retainer_amount"
    | "retainer_replenishment_threshold"
  >;
  /** Compact layout for client portal. */
  compact?: boolean;
};

/**
 * Client-facing engagement contract fee terms aligned with ASC 606:
 * transaction price (hourly / fixed / contingency), max consideration,
 * retainer as contract liability, and court-hour premium.
 */
export function EngagementContractFeeTerms({ matter, compact = false }: Props) {
  const courtRate = effectiveCourtHourlyRate(matter);
  const courtIsStored =
    matter.court_hourly_rate != null && Number(matter.court_hourly_rate) > 0;
  const standard = matter.hourly_rate != null ? Number(matter.hourly_rate) : null;
  const isContingency = matter.billing_method === "Contingency";
  const isHourlyFamily = ["Hourly", "Retainer-Funded Hourly", "Hybrid"].includes(
    matter.billing_method || ""
  );

  return (
    <div className={`space-y-4 text-sm ${compact ? "" : ""}`}>
      {isContingency && (
        <div>
          <h3 className="font-semibold">Contingency fee (variable consideration)</h3>
          <p className="opacity-80 mt-1">
            {matter.contingency_percentage != null ? (
              <>
                The firm&apos;s fee is <strong>{matter.contingency_percentage}%</strong> of recovery.
                Under ASC 606, this is <em>variable consideration</em> and is included in the
                transaction price only to the extent it is highly probable that a significant
                revenue reversal will not occur. Contingency fees are not recognized when the
                matter opens—only when the fee becomes billable and the related invoice is
                finalized.
              </>
            ) : (
              <>
                Contingency percentage is not set. Until it is recorded, the ASC 606 transaction
                price for variable consideration cannot be determined.
              </>
            )}
          </p>
          {matter.estimated_matter_value != null && Number(matter.estimated_matter_value) > 0 && (
            <p className="opacity-80 mt-1">
              Estimated matter value (planning only, not revenue):{" "}
              <strong>{formatCurrency(Number(matter.estimated_matter_value))}</strong>.
            </p>
          )}
        </div>
      )}

      {isHourlyFamily && (
        <div>
          <h3 className="font-semibold">Hourly charge</h3>
          <p className="opacity-80 mt-1">
            {standard != null ? (
              <>
                Standard legal work (research, drafting, calls, and office time) is billed at{" "}
                <strong>{formatCurrency(standard)}</strong> per hour under the{" "}
                {matter.billing_method || "hourly"} engagement. Under ASC 606, revenue is
                recognized over time as services are transferred, measured when related invoices
                are finalized—not when cash is received.
              </>
            ) : (
              <>No standard hourly rate is set on this engagement yet.</>
            )}
          </p>
          {matter.fixed_fee_amount != null && Number(matter.fixed_fee_amount) > 0 && (
            <p className="opacity-80 mt-1">
              Fixed-fee component: <strong>{formatCurrency(Number(matter.fixed_fee_amount))}</strong>
              {matter.billing_method === "Hybrid" ? " (allocated as a separate performance obligation)." : "."}
            </p>
          )}
        </div>
      )}

      {matter.billing_method === "Fixed Fee" && (
        <div>
          <h3 className="font-semibold">Fixed fee</h3>
          <p className="opacity-80 mt-1">
            {matter.fixed_fee_amount != null && Number(matter.fixed_fee_amount) > 0 ? (
              <>
                Fixed professional fee:{" "}
                <strong>{formatCurrency(Number(matter.fixed_fee_amount))}</strong>. Recognized over
                time as legal services are performed (invoice finalize is the demo measurement).
              </>
            ) : (
              <>No fixed fee amount is set on this engagement.</>
            )}
          </p>
        </div>
      )}

      {isHourlyFamily && (
        <div>
          <h3 className="font-semibold">Court and hearing time</h3>
          <p className="opacity-80 mt-1">
            {courtRate != null && standard != null ? (
              <>
                Time spent in court, at hearings, depositions taken or defended in person, and
                comparable appearance work is billed at a higher rate of{" "}
                <strong>{formatCurrency(courtRate)}</strong> per hour
                {courtIsStored
                  ? ""
                  : ` (${COURT_RATE_MULTIPLIER}× the standard hourly rate)`}
                , because that work requires dedicated calendar time, travel, waiting, and
                appearance preparation beyond ordinary office work.
              </>
            ) : courtRate != null ? (
              <>
                Court and hearing time is billed at <strong>{formatCurrency(courtRate)}</strong> per
                hour — higher than ordinary office time.
              </>
            ) : (
              <>
                Court and hearing time is billed at a premium above the standard hourly rate (firm
                default: {COURT_RATE_MULTIPLIER}×) once an hourly rate is set.
              </>
            )}
          </p>
        </div>
      )}

      <div>
        <h3 className="font-semibold">Maximum charge</h3>
        <p className="opacity-80 mt-1">
          {matter.maximum_fee_amount != null && Number(matter.maximum_fee_amount) > 0 ? (
            <>
              Professional fees under this engagement will not exceed{" "}
              <strong>{formatCurrency(Number(matter.maximum_fee_amount))}</strong> without the
              client&apos;s prior written approval. This caps the ASC 606 transaction price for
              professional fees. Costs and disbursements may be billed separately unless the
              engagement says otherwise.
            </>
          ) : (
            <>
              No maximum fee (not-to-exceed) amount is recorded on this engagement. The firm will
              obtain client approval before exceeding any budget discussed outside this contract.
            </>
          )}
        </p>
      </div>

      <div>
        <h3 className="font-semibold">How retainers work (ASC 606 contract liability)</h3>
        <p className="opacity-80 mt-1">
          A retainer is an advance deposit held for future legal services—not revenue when
          received. Under ASC 606 it is a <strong>contract liability</strong> (and a trust
          obligation). As performance obligations are satisfied and invoices are finalized, the
          firm applies retainer funds to those invoices, reducing the liability. Unused balances
          remain available for later work or are refunded when the matter closes.
        </p>
        <ul className="mt-2 list-disc pl-5 space-y-1 opacity-80">
          <li>
            Initial retainer:{" "}
            <strong>
              {matter.initial_retainer_amount != null
                ? formatCurrency(Number(matter.initial_retainer_amount))
                : "—"}
            </strong>
          </li>
          <li>
            Replenishment threshold: when the retainer balance falls to{" "}
            <strong>
              {matter.retainer_replenishment_threshold != null
                ? formatCurrency(Number(matter.retainer_replenishment_threshold))
                : "the agreed threshold"}
            </strong>
            , the client agrees to deposit additional funds so work can continue without
            interruption.
          </li>
        </ul>
      </div>
    </div>
  );
}
