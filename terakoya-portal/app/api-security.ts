export function validateJsonMutation(request: Request): Response | null {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) return Response.json({ error: "JSON形式の送信だけ受け付けます" }, { status: 415 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 64_000) return Response.json({ error: "送信内容が大きすぎます" }, { status: 413 });
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host) {
    try { if (new URL(origin).host !== host) return Response.json({ error: "別サイトからの操作は拒否されました" }, { status: 403 }); }
    catch { return Response.json({ error: "送信元を確認できません" }, { status: 403 }); }
  }
  return null;
}
