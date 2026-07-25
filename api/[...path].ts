export default function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  return res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method || "GET"} ${req.url || "/api"}`,
  });
}
