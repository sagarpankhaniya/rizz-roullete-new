import { Request } from 'express';

/** Best-effort client IP (supports proxies via X-Forwarded-For). */
export function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || null;
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim() || null;
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return req.ip || req.socket?.remoteAddress || null;
}

export function getUserAgent(req: Request): string | null {
  const ua = req.headers['user-agent'];
  if (typeof ua === 'string' && ua.trim()) {
    return ua.trim().slice(0, 512);
  }
  return null;
}
