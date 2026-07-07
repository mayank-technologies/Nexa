/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
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
  Search,
  Trash2,
  Filter,
  Check,
  Eye,
  Globe,
  Laptop,
  Calendar,
  AlertCircle,
  Sparkles,
  Image as ImageIcon,
  X
} from "lucide-react";
import { AdminMetrics, NexaFeedback } from "../types";
import { playUiSound } from "../utils/sounds";

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

  // Real Feedback Portal States
  const [realFeedback, setRealFeedback] = useState<NexaFeedback[]>([]);
  const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const fetchFeedback = async () => {
    setIsFetchingFeedback(true);
    try {
      const response = await fetch("/api/feedback");
      const data = await response.json();
      if (response.ok && data.success) {
        setRealFeedback(data.feedback);
      }
    } catch (e) {
      console.error("Failed to fetch feedback submissions:", e);
    } finally {
      setIsFetchingFeedback(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [activeTab]); // Refetch when changing tab or on refresh

  const handleDeleteFeedback = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this feedback?")) return;
    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: "DELETE"
      });
      if (response.ok) {
        setRealFeedback(prev => prev.filter(item => item.id !== id));
      } else {
        alert("Failed to delete feedback");
      }
    } catch (e) {
      console.error("Delete feedback error:", e);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: "reviewed" | "resolved" | "pending") => {
    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        setRealFeedback(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
      } else {
        alert("Failed to update status");
      }
    } catch (e) {
      console.error("Update status error:", e);
    }
  };

  const handleExportCSV = () => {
    const feedbackList = realFeedback.length > 0 ? realFeedback : [];
    if (feedbackList.length === 0) {
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

    const headers = [
      "ID",
      "Type",
      "Message",
      "Submitter Email",
      "User Email (Logged In)",
      "User Name",
      "Status",
      "Browser",
      "OS",
      "Device",
      "Timestamp"
    ];
    
    const rows = feedbackList.map(feedback => [
      escapeCSV(feedback.id),
      escapeCSV(feedback.feedbackType),
      escapeCSV(feedback.message),
      escapeCSV(feedback.email),
      escapeCSV(feedback.userEmail),
      escapeCSV(feedback.userName),
      escapeCSV(feedback.status),
      escapeCSV(feedback.browser),
      escapeCSV(feedback.operatingSystem),
      escapeCSV(feedback.deviceType),
      escapeCSV(feedback.timestamp)
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
    playUiSound("download_completed");
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedComment.trim()) return;

    onSimulateFeedback(feedRating, feedComment);
    setFeedComment("");
    playUiSound("success");
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
          <div className="space-y-6 animate-fadeIn text-xs">
            {/* 1. Summary Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-slate-50/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Submissions</span>
                <span className="text-2xl font-extrabold text-[#14213D] dark:text-white mt-1 block font-mono">
                  {realFeedback.length}
                </span>
              </div>
              <div className="p-4 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-100/40 dark:border-rose-950/40 rounded-2xl">
                <span className="text-[10px] text-rose-500 dark:text-rose-400 font-bold uppercase tracking-wider block flex items-center gap-1">🐞 Bugs</span>
                <span className="text-2xl font-extrabold text-[#14213D] dark:text-rose-450 mt-1 block font-mono">
                  {realFeedback.filter(item => item.feedbackType === "bug").length}
                </span>
              </div>
              <div className="p-4 bg-purple-500/5 dark:bg-purple-500/10 border border-purple-100/40 dark:border-purple-950/40 rounded-2xl">
                <span className="text-[10px] text-purple-500 dark:text-purple-400 font-bold uppercase tracking-wider block flex items-center gap-1">✨ Features</span>
                <span className="text-2xl font-extrabold text-[#14213D] dark:text-purple-400 mt-1 block font-mono">
                  {realFeedback.filter(item => item.feedbackType === "feature").length}
                </span>
              </div>
              <div className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-100/40 dark:border-amber-950/40 rounded-2xl">
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider block flex items-center gap-1">💡 Improvements</span>
                <span className="text-2xl font-extrabold text-[#14213D] dark:text-amber-450 mt-1 block font-mono">
                  {realFeedback.filter(item => item.feedbackType === "improvement").length}
                </span>
              </div>
              <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-100/40 dark:border-indigo-950/40 rounded-2xl">
                <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider block">💬 General & Other</span>
                <span className="text-2xl font-extrabold text-[#14213D] dark:text-indigo-400 mt-1 block font-mono">
                  {realFeedback.filter(item => item.feedbackType === "general" || item.feedbackType === "other").length}
                </span>
              </div>
            </div>

            {/* 2. Controls & Filter Row */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search feedback content, submitter, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none text-[#14213D] dark:text-white focus:border-indigo-500 transition-colors placeholder-slate-400 font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filters list */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Type Filter */}
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none text-slate-700 dark:text-slate-200 focus:border-indigo-500 font-medium"
                  >
                    <option value="all">All Types</option>
                    <option value="bug">🐞 Bug Reports</option>
                    <option value="feature">✨ Feature Requests</option>
                    <option value="improvement">💡 Improvements</option>
                    <option value="general">💬 General Feedback</option>
                    <option value="other">📝 Others</option>
                  </select>
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none text-slate-700 dark:text-slate-200 focus:border-indigo-500 font-medium"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="reviewed">👀 Reviewed</option>
                  <option value="resolved">✅ Resolved</option>
                </select>

                {/* Sort dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none text-slate-700 dark:text-slate-200 focus:border-indigo-500 font-medium"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>

                {/* Export CSV button */}
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/45 dark:border-indigo-900/30 dark:text-indigo-400 font-bold px-3 py-2 rounded-xl transition-all active:scale-95 cursor-pointer"
                  title="Export active feedbacks to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                {/* Manual Refetch feedback */}
                <button
                  onClick={fetchFeedback}
                  disabled={isFetchingFeedback}
                  className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Refresh lists"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingFeedback ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* 3. Feedback Cards Feed */}
            {isFetchingFeedback ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="font-semibold text-xs uppercase tracking-widest">Loading submissions...</span>
              </div>
            ) : (() => {
              const query = searchQuery.toLowerCase().trim();
              const filtered = realFeedback.filter(item => {
                const matchesSearch = !query || 
                  item.message.toLowerCase().includes(query) ||
                  (item.email && item.email.toLowerCase().includes(query)) ||
                  (item.userEmail && item.userEmail.toLowerCase().includes(query)) ||
                  (item.userName && item.userName.toLowerCase().includes(query)) ||
                  item.id.toLowerCase().includes(query);

                const matchesType = typeFilter === "all" || item.feedbackType === typeFilter;
                const matchesStatus = statusFilter === "all" || item.status === statusFilter;

                return matchesSearch && matchesType && matchesStatus;
              }).sort((a, b) => {
                const dateA = new Date(a.timestamp).getTime();
                const dateB = new Date(b.timestamp).getTime();
                return sortBy === "newest" ? dateB - dateA : dateA - dateB;
              });

              if (filtered.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/30 dark:bg-slate-900/10 text-center space-y-3">
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full border border-slate-200/50 dark:border-slate-850">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-700 dark:text-slate-300">No Feedback Found</h5>
                      <p className="text-slate-400 text-[11px] mt-0.5 max-w-sm">
                        No submissions match your current search, type, or status filter combination.
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 font-sans">
                  {filtered.map((feedback) => {
                    // Category styling
                    const typeColors: Record<string, { label: string; bg: string; text: string; border: string }> = {
                      bug: { label: "Bug Report 🐞", bg: "bg-rose-500/10", text: "text-rose-500", border: "border-rose-500/10" },
                      feature: { label: "Feature Request ✨", bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/10" },
                      improvement: { label: "Improvement 💡", bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/10" },
                      general: { label: "General Feedback 💬", bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/10" },
                      other: { label: "Other 📝", bg: "bg-slate-500/10", text: "text-slate-500", border: "border-slate-500/10" }
                    };

                    const typeMeta = typeColors[feedback.feedbackType] || { label: feedback.feedbackType, bg: "bg-indigo-500/10", text: "text-indigo-500", border: "border-indigo-500/10" };

                    // Status styling
                    const statusStyles = {
                      pending: "bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400",
                      reviewed: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-950/40",
                      resolved: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-950/40"
                    };

                    return (
                      <div
                        key={feedback.id}
                        className="p-5 bg-white dark:bg-[#15203b]/50 border border-slate-150 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs relative overflow-hidden text-left"
                      >
                        {/* Header metadata row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 dark:border-slate-800 pb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Type badge */}
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${typeMeta.bg} ${typeMeta.text} border ${typeMeta.border}`}>
                              {typeMeta.label}
                            </span>
                            {/* Status badge */}
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${statusStyles[feedback.status]}`}>
                              {feedback.status}
                            </span>
                            {/* Submitter identities */}
                            <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px]">
                              ID: {feedback.id}
                            </span>
                          </div>
                          {/* Time */}
                          <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{new Date(feedback.timestamp).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Middle Message Body section */}
                        <div className="py-3.5 space-y-3">
                          <p className="text-[#14213D] dark:text-slate-100 leading-relaxed text-xs font-normal whitespace-pre-wrap">
                            {feedback.message}
                          </p>

                          {/* Screenshot preview if uploaded */}
                          {feedback.screenshotUrl && (
                            <div className="pt-1.5">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                                <ImageIcon className="w-3.5 h-3.5" /> Screenshot Attached
                              </span>
                              <div
                                onClick={() => setZoomedImage(feedback.screenshotUrl || null)}
                                className="relative w-40 h-24 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden cursor-zoom-in group shadow-xs hover:border-indigo-400 transition-colors"
                              >
                                <img src={feedback.screenshotUrl} alt="Attached screenshot" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                  <Eye className="w-5 h-5" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Footer Submitter identity & client details */}
                        <div className="border-t border-slate-50 dark:border-slate-800 pt-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          {/* Person identities */}
                          <div className="space-y-0.5 text-left">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-350 font-semibold">
                              <span className="truncate max-w-[200px]">{feedback.email || "Anonymous"}</span>
                              {feedback.userEmail && feedback.userEmail !== feedback.email && (
                                <span className="text-[10px] font-medium text-slate-400 block sm:inline">
                                  (Logged: {feedback.userEmail})
                                </span>
                              )}
                            </div>
                            {feedback.userName && (
                              <p className="text-[10px] text-slate-400 font-medium">
                                Submitter name: {feedback.userName}
                              </p>
                            )}
                          </div>

                          {/* Action Controls & Device Pills */}
                          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                            {/* Device Environment Pills */}
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400/90 tracking-wide uppercase">
                              <span className="flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                                <Laptop className="w-3 h-3 text-slate-400" /> {feedback.operatingSystem}
                              </span>
                              <span className="flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                                <Globe className="w-3 h-3 text-slate-400" /> {feedback.browser}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {feedback.status !== "reviewed" && feedback.status !== "resolved" && (
                                <button
                                  onClick={() => handleUpdateStatus(feedback.id, "reviewed")}
                                  className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer"
                                  title="Mark as Reviewed"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Review</span>
                                </button>
                              )}

                              {feedback.status !== "resolved" && (
                                <button
                                  onClick={() => handleUpdateStatus(feedback.id, "resolved")}
                                  className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer"
                                  title="Mark as Resolved"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Resolve</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteFeedback(feedback.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-500 border border-rose-100 dark:border-rose-500/20 rounded-lg transition-all cursor-pointer"
                                title="Delete submission"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* 4. Full-Size Screenshot Overlay Zoom Modal */}
            {zoomedImage && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div
                  onClick={() => setZoomedImage(null)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />
                <div className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl z-10 p-2 text-center animate-scaleIn flex items-center justify-center">
                  <button
                    onClick={() => setZoomedImage(null)}
                    className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-colors cursor-pointer"
                    title="Close preview"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <img src={zoomedImage} alt="Full screenshot view" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
                </div>
              </div>
            )}

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
