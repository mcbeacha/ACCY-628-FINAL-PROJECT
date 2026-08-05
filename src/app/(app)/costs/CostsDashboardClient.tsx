"use client";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import {
  budgetBadgeClass,
  budgetFlag,
  summarizeMatterCosts,
} from "@/lib/cost-calc";
import type { UnifiedCostRow } from "@/lib/cost-types";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MatterBudget = {
  id: string;
  matter_number: string;
  matter_name: string;
  matter_budget: number | null;
};

const PIE_COLORS = ["#0d9488", "#64748b"];

export function CostsDashboardClient() {
  const [costs, setCosts] = useState<UnifiedCostRow[]>([]);
  const [matters, setMatters] = useState<MatterBudget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: unified }, { data: m }] = await Promise.all([
        supabase.from("matter_costs_unified").select("*"),
        supabase
          .from("matters")
          .select("id, matter_number, matter_name, matter_budget")
          .not("matter_status", "in", '("Canceled")'),
      ]);
      setCosts((unified || []) as UnifiedCostRow[]);
      setMatters((m || []) as MatterBudget[]);
      setLoading(false);
    })();
  }, []);

  const approved = useMemo(
    () => costs.filter((c) => c.approval_status === "Approved"),
    [costs]
  );

  const summary = useMemo(() => summarizeMatterCosts(approved), [approved]);

  const pendingCount = costs.filter((c) => c.approval_status === "Submitted").length;

  const totalBudget = matters.reduce((s, m) => s + (Number(m.matter_budget) || 0), 0);
  const budgetFlagOverall = budgetFlag(summary.totalMatterCost, totalBudget || null);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of approved) {
      const key = c.category_name || "Uncategorized";
      map.set(key, (map.get(key) || 0) + Number(c.total_cost));
    }
    return [...map.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [approved]);

  const budgetVsActual = useMemo(() => {
    const costByMatter = new Map<string, number>();
    for (const c of approved) {
      costByMatter.set(c.matter_id, (costByMatter.get(c.matter_id) || 0) + Number(c.total_cost));
    }
    return matters
      .map((m) => ({
        name: m.matter_number,
        budget: Number(m.matter_budget) || 0,
        actual: costByMatter.get(m.id) || 0,
      }))
      .filter((r) => r.budget > 0 || r.actual > 0)
      .sort((a, b) => b.actual - a.actual)
      .slice(0, 12);
  }, [approved, matters]);

  const reimbursableSplit = useMemo(
    () => [
      { name: "Reimbursable", value: summary.reimbursableExpenses },
      { name: "Non-reimbursable", value: summary.nonreimbursableExpenses },
    ],
    [summary]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Cost & Resources"
        description="Firm-wide cost summary, budgets, and allocation overview."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/costs/review" className="btn btn-ghost btn-sm">
              Cost approval
              {pendingCount > 0 && (
                <span className="badge badge-warning badge-sm ml-1">{pendingCount}</span>
              )}
            </Link>
            <Link href="/vendors" className="btn btn-ghost btn-sm">
              Vendors
            </Link>
            <Link href="/costs/allocations" className="btn btn-ghost btn-sm">
              Allocations
            </Link>
            <Link href="/costs/new" className="btn btn-primary btn-sm">
              New cost
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Labor cost</div>
          <div className="stat-value text-xl">{formatCurrency(summary.laborCost)}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Vendor cost</div>
          <div className="stat-value text-xl">{formatCurrency(summary.vendorCost)}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Direct expenses</div>
          <div className="stat-value text-xl">{formatCurrency(summary.directExpenses)}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Allocated cost</div>
          <div className="stat-value text-xl">{formatCurrency(summary.allocatedCost)}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Reimbursable</div>
          <div className="stat-value text-xl">{formatCurrency(summary.reimbursableExpenses)}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Non-reimbursable</div>
          <div className="stat-value text-xl">{formatCurrency(summary.nonreimbursableExpenses)}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Total matter cost</div>
          <div className="stat-value text-xl">{formatCurrency(summary.totalMatterCost)}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Costs awaiting approval</div>
          <div className="stat-value text-xl">
            <Link href="/costs/review" className="link link-hover">
              {pendingCount}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Expected client charges</div>
          <div className="stat-value text-xl">{formatCurrency(summary.expectedClientCharge)}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Budget status (firm)</div>
          <div className="stat-value text-lg">
            <span className={`badge ${budgetBadgeClass(budgetFlagOverall)}`}>{budgetFlagOverall}</span>
          </div>
          <div className="stat-desc">
            {formatCurrency(summary.totalMatterCost)} of {formatCurrency(totalBudget || 0)} budgeted
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Cost by category</h2>
            {byCategory.length === 0 ? (
              <EmptyState title="No approved costs yet." />
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCategory} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => (typeof v === "number" ? formatCurrency(v) : v)} />
                    <Bar dataKey="amount" name="Cost" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Reimbursable vs non-reimbursable</h2>
            {reimbursableSplit.every((d) => d.value <= 0) ? (
              <EmptyState title="No expense split data yet." />
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reimbursableSplit.filter((d) => d.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                    >
                      {reimbursableSplit.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => (typeof v === "number" ? formatCurrency(v) : v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 shadow-sm lg:col-span-2">
          <div className="card-body">
            <h2 className="card-title text-base">Budget vs actual by matter</h2>
            {budgetVsActual.length === 0 ? (
              <EmptyState title="No budget or cost data for matters." />
            ) : (
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetVsActual} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => (typeof v === "number" ? formatCurrency(v) : v)} />
                    <Legend />
                    <Bar dataKey="budget" name="Budget" fill="#64748b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actual" name="Actual cost" fill="#0369a1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 text-sm">
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body py-4">
            <p className="opacity-60">Labor</p>
            <p className="font-semibold text-lg">{formatCurrency(summary.laborCost)}</p>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body py-4">
            <p className="opacity-60">Vendor</p>
            <p className="font-semibold text-lg">{formatCurrency(summary.vendorCost)}</p>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body py-4">
            <p className="opacity-60">Allocated</p>
            <p className="font-semibold text-lg">{formatCurrency(summary.allocatedCost)}</p>
          </div>
        </div>
      </div>
    </>
  );
}
