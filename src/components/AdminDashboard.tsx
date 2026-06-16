/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Users,
  Activity,
  MessageSquare,
  AlertOctagon,
  CheckCircle,
  ThumbsUp,
  Sliders,
  Cpu,
  RefreshCw,
  Server,
  Star,
  Flame,
  LogOut,
  Download,
} from "lucide-react";
import { AdminMetrics } from "../types";

interface AdminDashboardProps {
  metrics: AdminMetrics;
  onRefresh: () => void;
  onSimulateError: () => void;
  onSimulateFeedback: (rating: number, comment: string) => void;
  onSignOutAdmin?: () => void;
}

export function AdminDashboard({
  metrics,
  onRefresh,
  onSimulateError,
  onSimulateFeedback,
  onSignOutAdmin,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "feedback" | "errors" | "systems">("overview");
  const [feedComment, setFeedComment] = useState("");
  const [feedRating, setFeedRating] = useState(5);

  const handleExportCSV = () => {
    const feedbackList = metrics.feedbackSubmissions;
    if (!feedbackList || feedbackList.length === 0) {
      alert("No feedback submissions to export.");
      return;
    }

    const escapeCSV = (val: any) => {
      if (val === undefined || val === null) return "";
      const stringified = String(val);
      if (stringified.includes(",") || stringified.includes('"') || stringified.includes("\n") || stringified.includes("\r")) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    const headers = ["ID", "User Email", "Rating", "Comment"];
    const rows = feedbackList.map(feedback => [
      escapeCSV(feedback.id),
      escapeCSV(feedback.userEmail),
      escapeCSV(feedback.rating),
      escapeCSV(feedback.comment)
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `feedback_submissions_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedComment.trim()) return;

    onSimulateFeedback(feedRating, feedComment);
    setFeedComment("");
    alert("Feedback received! Successfully synced metrics to Admin Monitoring streams.");
  };

  // Calculating SVG path coordinate for engine query chart
  const totalQueriesArr = Object.values(metrics.engineRoutingStats);
  const maxQueries = Math.max(...totalQueriesArr, 1);

  const chartEngines = [
    { id: "core", name: "Core Engine", count: metrics.engineRoutingStats.core, color: "bg-blue-500", fill: "#3b82f6" },
    { id: "reasoning", name: "Reasoning", count: metrics.engineRoutingStats.reasoning, color: "bg-indigo-500", fill: "#6366f1" },
    { id: "vision", name: "Vision", count: metrics.engineRoutingStats.vision, color: "bg-violet-500", fill: "#8b5cf6" },
    { id: "language", name: "Language", count: metrics.engineRoutingStats.language, color: "bg-emerald-500", fill: "#10b981" },
    { id: "learning", name: "Learning", count: metrics.engineRoutingStats.learning, color: "bg-[#C96A3D]", fill: "#C96A3D" },
  ];

  return (
    <div
      className="border border-slate-150 dark:border-slate-800 rounded-3xl bg-white dark:bg-[#11192e] p-6 md:p-8 space-y-8 text-left my-6 hover:shadow-lg transition-all duration-300 relative overflow-hidden"
      id="nexa-admin-dashboard"
    >
      {/* Decorative vertical ribbon */}
      <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#14213D] dark:bg-indigo-500" />

      {/* Title Header with action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-[#14213D] dark:text-indigo-400">
            <Sliders className="w-5 h-5 animate-spin" style={{ animationDuration: "12s" }} />
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full inline-block animate-pulse">
              ● SYSTEM ONLINE
            </span>
            <h3 className="text-xl font-bold text-[#14213D] dark:text-white mt-1 leading-none font-sans">
              Nexa Ops Intelligence Dashboard
            </h3>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onSimulateError}
            className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-500 border border-rose-200 dark:border-rose-950/40 font-bold px-3 py-1.5 text-[10px] rounded-xl transition-colors"
          >
            <Flame className="w-3.5 h-3.5" />
            Simulate Error
          </button>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 border border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 font-bold px-3 py-1.5 text-[10px] rounded-xl transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Metrics
          </button>
          {onSignOutAdmin && (
            <button
              onClick={onSignOutAdmin}
              className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 dark:border-amber-900/30 dark:text-amber-400 font-bold px-3 py-1.5 text-[10px] rounded-xl transition-colors shrink-0"
              title="Sign out of Admin Role"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out Admin
            </button>
          )}
        </div>
      </div>

      {/* KPI Quad Grid Card Columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Users */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl relative">
          <Users className="absolute top-4 right-4 w-4 h-4 text-slate-400" />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
            Active Sessions
          </span>
          <div className="text-2xl font-extrabold text-[#14213D] dark:text-white mt-1 font-mono">
            {metrics.activeUsersCount}
          </div>
          <span className="text-[9px] font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm inline-block mt-1">
            +12% live scale
          </span>
        </div>

        {/* KPI 2: Total Chats */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl relative">
          <MessageSquare className="absolute top-4 right-4 w-4 h-4 text-slate-400" />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
            Stored Chats
          </span>
          <div className="text-2xl font-extrabold text-[#14213D] dark:text-white mt-1 font-mono">
            {metrics.totalChatsCount}
          </div>
          <span className="text-[9px] text-[#C96A3D] font-bold bg-[#C96A3D]/10 px-1.5 py-0.5 rounded-sm inline-block mt-1">
            Local Cache Active
          </span>
        </div>

        {/* KPI 3: Latency */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl relative">
          <Activity className="absolute top-4 right-4 w-4 h-4 text-slate-400" />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
            Response Speed
          </span>
          <div className="text-2xl font-extrabold text-[#14213D] dark:text-white mt-1 font-mono">
            {metrics.averageResponseTimeMs} <span className="text-xs text-slate-400 font-normal">ms</span>
          </div>
          <span className="text-[9px] font-bold text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded-sm inline-block mt-1">
            Gemini 3.5 Core
          </span>
        </div>

        {/* KPI 4: Queries count */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl relative">
          <Server className="absolute top-4 right-4 w-4 h-4 text-slate-400" />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
            Invocations Today
          </span>
          <div className="text-2xl font-extrabold text-[#14213D] dark:text-white mt-1 font-mono">
            {metrics.totalQueriesToday}
          </div>
          <span className="text-[9px] font-bold text-violet-500 bg-violet-500/10 px-1.5 py-0.5 rounded-sm inline-block mt-1">
            Smart Routed
          </span>
        </div>
      </div>

      {/* Internal Tabs Select */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 gap-6 select-none text-xs">
        {[
          { id: "overview", name: "Overview & Routing" },
          { id: "feedback", name: "Feedback Portal" },
          { id: "errors", name: "System Logs & Errors" },
          { id: "systems", name: "Server Metrics" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 font-semibold transition-colors relative ${
              activeTab === tab.id
                ? "text-[#C96A3D]"
                : "text-slate-400 hover:text-slate-650 dark:hover:text-slate-305"
            }`}
          >
            {tab.name}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C96A3D]" />}
          </button>
        ))}
      </div>

      {/* Tab content body */}
      <div className="min-h-[220px]">
        {/* A: Overview and Route Chart */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            
            {/* Chart: Engine routed weights */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Engine Routing Breakdown
                </h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-normal">
                  Identifies automated query classifications from Nexa's proprietary smart task router.
                </p>
              </div>

              {/* Chart Visual rendering lists */}
              <div className="space-y-3.5">
                {chartEngines.map((item) => {
                  const pct = Math.round((item.count / maxQueries) * 100) || 5;
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex justify-between items-baseline text-xs font-semibold">
                        <span className="text-slate-600 dark:text-slate-300">{item.name}</span>
                        <span className="font-mono text-slate-450">{item.count} queries</span>
                      </div>
                      <div className="w-full bg-slate-50 dark:bg-slate-800/60 rounded-full h-2 overflow-hidden border border-slate-100/30">
                        <div
                          className={`${item.color} h-full rounded-full transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Simulated Live User Table */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Live Server Sessions status
              </h4>
              <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-2xs font-sans text-xs">
                <table className="w-full">
                  <thead className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-450 block sm:table-header-group">
                    <tr className="block sm:table-row font-semibold">
                      <th className="p-3 text-left block sm:table-cell">Client ID</th>
                      <th className="p-3 text-left block sm:table-cell">Identity</th>
                      <th className="p-3 text-left block sm:table-cell">Inbound Engine</th>
                      <th className="p-3 text-left block sm:table-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[
                      { id: "nex-82ca", user: "Guest User", engine: "Core Engine", status: "Active", col: "text-emerald-500" },
                      { id: "nex-091a", user: "bittomaurya0@gmail.com", engine: "Reasoning Engine", status: "Active", col: "text-emerald-500" },
                      { id: "nex-f81d", user: "Guest User", engine: "Learning Engine", status: "Idle", col: "text-slate-400" },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-900/20 font-medium">
                        <td className="p-3 font-mono text-slate-500">{row.id}</td>
                        <td className="p-3 text-slate-650 dark:text-slate-300 truncate max-w-[120px]">{row.user}</td>
                        <td className="p-3 text-slate-500">{row.engine}</td>
                        <td className={`p-3 font-bold ${row.col}`}>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* B: Feedback portal log list */}
        {activeTab === "feedback" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            
            {/* Feed submissions tracker */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Historic User Feedback Submissions
                </h4>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/45 dark:border-indigo-900/30 dark:text-indigo-400 font-bold px-2.5 py-1 text-[10px] rounded-lg transition-all active:scale-95 cursor-pointer shrink-0"
                  title="Export Feedback as CSV"
                >
                  <Download className="w-3 h-3" />
                  Export CSV
                </button>
              </div>
              <div className="space-y-3.5 max-h-[200px] overflow-y-auto pr-2">
                {metrics.feedbackSubmissions.map((feedback) => (
                  <div
                    key={feedback.id}
                    className="p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-xl space-y-1 text-xs"
                  >
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                      <span className="text-indigo-400 font-mono truncate max-w-[125px]">
                        {feedback.userEmail}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>{feedback.rating}/5</span>
                      </div>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                      &quot;{feedback.comment}&quot;
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Feedback submissions sandbox */}
            <form onSubmit={handleFeedbackSubmit} className="space-y-4 bg-slate-50/30 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/80 p-5 rounded-2xl relative">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#14213D] dark:text-slate-200">
                Submit Client Sandbox Feedback
              </h4>
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 font-bold">RATING (1-5 STARS)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedRating(star)}
                      className={`p-1 rounded-md transition-colors ${
                        feedRating >= star ? "text-amber-400" : "text-slate-300"
                      }`}
                    >
                      <Star className="w-5 h-5 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-bold">COMMENTS</label>
                <textarea
                  value={feedComment}
                  onChange={(e) => setFeedComment(e.target.value)}
                  placeholder="Tell us what you think of Nexa's multi-engine routing features..."
                  rows={2}
                  required
                  className="w-full text-xs p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-[#C96A3D] outline-none text-[#14213D] dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#14213D] hover:bg-[#C96A3D] text-white font-bold py-2 rounded-xl text-xs transition-colors"
              >
                Simulate Feedback Submission
              </button>
            </form>

          </div>
        )}

        {/* C: Severe system errors */}
        {activeTab === "errors" && (
          <div className="space-y-4 animate-fadeIn">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Recent System Alert Logs
            </h4>
            <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-2xs font-sans text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-905/50 text-slate-450">
                  <tr className="font-semibold">
                    <th className="p-3">Error ID</th>
                    <th className="p-3">Component / Engine</th>
                    <th className="p-3">Alert Details</th>
                    <th className="p-3">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {metrics.recentErrors.map((err) => (
                    <tr key={err.id} className="hover:bg-slate-50/10 dark:hover:bg-slate-900/10 font-medium">
                      <td className="p-3 font-mono text-slate-450">{err.id}</td>
                      <td className="p-3 text-[#14213D] dark:text-slate-200 py-3 font-bold">{err.engine}</td>
                      <td className="p-3 text-slate-650 dark:text-slate-400">{err.message}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 font-semibold rounded-md uppercase text-[9px] ${
                            err.severity === "high"
                              ? "bg-rose-500/10 text-rose-500"
                              : err.severity === "medium"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-slate-500/10 text-slate-400"
                          }`}
                        >
                          {err.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* D: Server CPU Memory dials */}
        {activeTab === "systems" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn text-xs">
            
            {/* CPU Performance Speed check list */}
            <div className="space-y-4 flex flex-col justify-center">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Server Resource Allocation
              </h4>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline font-semibold leading-none">
                    <span className="text-slate-650 dark:text-slate-300">Server Thread Load</span>
                    <span className="font-mono text-slate-450">{metrics.serverLoadPct}% allocated</span>
                  </div>
                  <div className="w-full bg-slate-50 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-150/10">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all"
                      style={{ width: `${metrics.serverLoadPct}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-baseline font-semibold leading-none">
                    <span className="text-slate-650 dark:text-slate-300">Client Memory foot-print</span>
                    <span className="font-mono text-slate-450">{metrics.memoryUsageMb} MB / 512MB RAM</span>
                  </div>
                  <div className="w-full bg-slate-50 dark:bg-slate-850 h-2.5 rounded-full overflow-hidden border border-slate-150/10">
                    <div
                      className="bg-[#C96A3D] h-full rounded-full transition-all"
                      style={{ width: `${(metrics.memoryUsageMb / 512) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Cluster deployment specifications */}
            <div className="p-5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/80 rounded-2xl flex items-center gap-4">
              <div className="p-3.5 bg-indigo-500/10 text-indigo-505 rounded-xl shrink-0">
                <Cpu className="w-6 h-6 shrink-0" />
              </div>
              <div className="space-y-1 text-left leading-normal">
                <h5 className="font-bold text-slate-700 dark:text-slate-200">Cluster: Nexa-Asia-SE1</h5>
                <p className="text-[10px] text-slate-450 leading-relaxed font-normal">
                  Serving micro-nodes via sandboxed docker containers.
                  <br />
                  Ingress routing: Nginx reverse-proxy on Port 3000.
                  <br />
                  Engine Host: models/gemini-3.5-flash (Google GenAI)
                </p>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Footer system diagnostics */}
      <div className="text-[10px] text-slate-400 font-bold border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-between tracking-wide uppercase select-none">
        <span>Diagnostics: SSL ACTIVE</span>
        <span>Version: Nexa-V1.0.4-CloudRun</span>
      </div>

    </div>
  );
}
