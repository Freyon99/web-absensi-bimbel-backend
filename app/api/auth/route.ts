import { responError, responJson } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { comparePassword, hashPassword } from "@/lib/hash";
import { signToken } from "@/lib/jwt";
import { cekRateLimiter } from "@/lib/rate-limit";
import {
  setCookieToken,
  headerHapusCookieToken,
  wajibAdmin,
  responGuard,
} from "@/lib/api-guard";
import { bentukUserPublik } from "@/lib/user";
import { ambilIpClient } from "@/lib/ip";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const registerSchema = z.object({
  nama: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
  peran: z.enum(["ADMIN", "GURU"]),
});

// POST /api/auth?action=login
async function handleLogin(req: Request) {
  try {
    const body = await req.json();
    const data = loginSchema.parse(body);

    const ip = ambilIpClient(req);
    const emailKecil = data.email.toLowerCase();

    const batasEmail = await cekRateLimiter(`login-email:${emailKecil}`);
    if (!batasEmail.ok) {
      return responJson(
        { message: "Terlalu banyak percobaan login. Silakan coba lagi nanti." },
        {
          status: 429,
          headers: { "Retry-After": String(batasEmail.cobaLagiDalamDetik) },
        },
      );
    }

    const batasIp = await cekRateLimiter(`login-ip:${ip}:${emailKecil}`);
    if (!batasIp.ok) {
      return responJson(
        { message: "Terlalu banyak percobaan login. Silakan coba lagi nanti." },
        {
          status: 429,
          headers: { "Retry-After": String(batasIp.cobaLagiDalamDetik) },
        },
      );
    }

    const user = await prisma.pengguna.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return responJson(
        { message: "Email atau password salah" },
        { status: 401 },
      );
    }

    const isValidPassword = await comparePassword(data.password, user.password);
    if (!isValidPassword) {
      return responJson(
        { message: "Email atau password salah" },
        { status: 401 },
      );
    }

    const token = signToken({ id: user.id, role: user.peran });
    const safeUser = bentukUserPublik(user);
    const res = responJson({ token, user: safeUser });
    setCookieToken(req, res, token);
    return res;
  } catch (error) {
    console.error("DETAIL ERROR LOGIN:", error);
    if (error instanceof z.ZodError) {
      return responJson(
        { message: "Format data tidak valid", errors: error.issues },
        { status: 400 },
      );
    }
    return responError(500, "Terjadi kesalahan");
  }
}

// POST /api/auth?action=register
async function handleRegister(req: Request) {
  try {
    await wajibAdmin(req);
    const body = await req.json();
    const data = registerSchema.parse(body);

    const existingUser = await prisma.pengguna.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      return responError(400, "Email sudah digunakan");
    }

    const hashedPassword = await hashPassword(data.password);
    const user = await prisma.pengguna.create({
      data: {
        nama: data.nama,
        email: data.email,
        password: hashedPassword,
        peran: data.peran,
      },
    });

    const token = signToken({ id: user.id, role: user.peran });
    const safeUser = bentukUserPublik(user);
    return responJson({ token, user: safeUser });
  } catch (error) {
    const guard = responGuard(error);
    if (guard) return guard;
    console.error("DETAIL ERROR REGISTER:", error);
    if (error instanceof z.ZodError) {
      return responJson(
        { message: "Format data tidak valid", errors: error.issues },
        { status: 400 },
      );
    }
    return responError(500, "Terjadi kesalahan");
  }
}

// POST /api/auth?action=logout
async function handleLogout(req: Request) {
  const res = responJson({ message: "Berhasil keluar" });
  res.headers.append("Set-Cookie", headerHapusCookieToken(req));
  return res;
}

export async function POST(req: Request) {
  const action = new URL(req.url).searchParams.get("action");
  switch (action) {
    case "login":
      return handleLogin(req);
    case "register":
      return handleRegister(req);
    case "logout":
      return handleLogout(req);
    default:
      return responError(
        400,
        "Action tidak valid. Gunakan ?action=login|register|logout",
      );
  }
}
