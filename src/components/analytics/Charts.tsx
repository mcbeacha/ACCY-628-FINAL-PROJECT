"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

const COLORS = ["#0d9488", "#0369a1", "#ca8a04", "#dc2626", "#64748b", "#ea580c", "#0f766e"];

/** Severity ramp for AR aging buckets (Current → 90+). */
const AR_BUCKET_COLORS: Record<string, string> = {
  Current: "#0d9488",
  "1–30": "#0369a1",
  "31–60": "#ca8a04",
  "61–90": "#ea580c",
  "90+": "#dc2626",
};

function formatAxisCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function formatTooltipCurrency(v: unknown): string {
  if (typeof v !== "number") return String(v ?? "");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

function Empty({ label }: { label: string }) {
  return <p className="text-sm opacity-60 py-8 text-center">{label}</p>;
}

export function MonthlyRevenueChart({
  data,
}: {
  data: { month: string; invoiced: number; collected: number }[];
}) {
  if (!data.length) return <Empty label="No monthly revenue data for current filters." />;
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAxisCurrency} width={52} />
          <Tooltip formatter={(v) => formatTooltipCurrency(v)} />
          <Legend />
          <Bar dataKey="invoiced" name="Invoiced" fill="#0d9488" radius={[4, 4, 0, 0]} />
          <Bar dataKey="collected" name="Collected" fill="#0369a1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrossProfitByPracticeChart({
  data,
}: {
  data: { practiceArea: string; grossProfit: number; grossMargin?: number | null }[];
}) {
  if (!data.length) return <Empty label="No practice-area profit data." />;
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatAxisCurrency} />
          <YAxis type="category" dataKey="practiceArea" width={100} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v, _name, item) => {
              const margin = (item?.payload as { grossMargin?: number | null } | undefined)
                ?.grossMargin;
              const money = formatTooltipCurrency(v);
              if (margin == null) return money;
              return `${money} (${margin.toFixed(1)}% margin)`;
            }}
          />
          <Bar dataKey="grossProfit" name="Gross profit" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ArAgingChart({ data }: { data: { bucket: string; amount: number }[] }) {
  if (!data.some((d) => d.amount > 0)) return <Empty label="No outstanding AR to age." />;
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAxisCurrency} width={52} />
          <Tooltip formatter={(v) => formatTooltipCurrency(v)} />
          <Bar dataKey="amount" name="AR balance" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.bucket} fill={AR_BUCKET_COLORS[d.bucket] || "#64748b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function UtilizationChart({
  data,
}: {
  data: { name: string; utilization: number }[];
}) {
  if (!data.length) return <Empty label="No utilization data." />;
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis unit="%" tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => (typeof v === "number" ? `${v.toFixed(1)}%` : v)} />
          <Bar dataKey="utilization" name="Utilization % (est.)" fill="#0f766e" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.utilization >= 70 ? "#0d9488" : d.utilization >= 50 ? "#ca8a04" : "#dc2626"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CollectionTrendChart({
  data,
}: {
  data: { month: string; rate: number }[];
}) {
  if (!data.length) return <Empty label="No collection rate trend yet." />;
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis unit="%" tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => (typeof v === "number" ? `${v.toFixed(1)}%` : v)} />
          <Legend />
          <Line
            type="monotone"
            dataKey="rate"
            name="Collection rate %"
            stroke="#0d9488"
            strokeWidth={2}
            dot
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WriteTrendChart({
  data,
}: {
  data: { month: string; writeDowns: number; writeOffs: number }[];
}) {
  if (!data.length) return <Empty label="No write-down / write-off trend." />;
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAxisCurrency} width={52} />
          <Tooltip formatter={(v) => formatTooltipCurrency(v)} />
          <Legend />
          <Bar dataKey="writeDowns" name="Write-downs" fill="#ea580c" stackId="a" />
          <Bar dataKey="writeOffs" name="Write-offs" fill="#dc2626" stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MatterProfitBarChart({
  data,
}: {
  data: { name: string; grossProfit: number }[];
}) {
  if (!data.length) return <Empty label="No matter profit data." />;
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAxisCurrency} width={52} />
          <Tooltip formatter={(v) => formatTooltipCurrency(v)} />
          <Bar dataKey="grossProfit" name="Gross profit" fill="#0369a1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MethodRevenueChart({
  data,
}: {
  data: { method: string; revenue: number }[];
}) {
  if (!data.length) return <Empty label="No billing-method revenue." />;
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="method" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAxisCurrency} width={52} />
          <Tooltip formatter={(v) => formatTooltipCurrency(v)} />
          <Bar dataKey="revenue" name="Invoiced revenue" fill="#0d9488" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
