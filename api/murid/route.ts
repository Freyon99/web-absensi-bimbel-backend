import { responError, responJson } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Kelas, Prisma } from "@prisma/client";
import { responGuard, wajibAdmin, wajibAuth } from "@/lib/api-guard";
import { KELAS_OPTIONS } from "@/lib/kelas";
import {
  BARIS_CONTOH,
  HEADER_EKSPOR,
  buatWorkbookXlsx,
  keCsv,
  workbookKeXlsx,
  parseFileMurid,
  normalisasiKelas,
  normalisasiPembayaran,
  labelKolom,
  terjemahHeader,
  jumlahHeaderDikenali,
  BARIS_MAKS_FILE,
  UKURAN_MAKS_FILE,
  FileImportError,
} from "@/lib/murid-import-export";

const muridSchema = z.object({
  namaLengkap: z.string(),
  namaPanggilan: z.string(),
  kelas: z.nativeEnum(Kelas),
  sekolahAsal: z.string(),
  namaOrangTuaWali: z.string(),
  pekerjaanAyah: z.string().optional(),
  pekerjaanIbu: z.string().optional(),
  alamatDomisili: z.string(),
  noHpOrangTua: z.string(),
  hari: z.string(),
  jam: z.string(),
  pembayaran: z.string(),
  mapel: z.string(),
  catatanAnak: z.string().optional().nullable(),
});

function formatTanggalEkspor(tanggal: Date): string {
  const hari = String(tanggal.getDate()).padStart(2, "0");
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
  return `${hari}/${bulan}/${tanggal.getFullYear()}`;
}

function normalisasiKunci(teks: string): string {
  return teks.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// POST /api/murid - tambah murid
export async function POST(req: Request) {
  try {
    const action = new URL(req.url).searchParams.get("action");

    if (action === "import") {
      return handleImport(req);
    }

    const payload = await wajibAdmin(req);
    const body = await req.json();
    const data = muridSchema.parse(body);

    const muridBaru = await prisma.murid.create({
      data: {
        namaLengkap: data.namaLengkap,
        namaPanggilan: data.namaPanggilan,
        kelas: data.kelas,
        sekolahAsal: data.sekolahAsal,
        namaOrangTuaWali: data.namaOrangTuaWali,
        pekerjaanAyah: data.pekerjaanAyah || "",
        pekerjaanIbu: data.pekerjaanIbu || "",
        alamatDomisili: data.alamatDomisili,
        noHpOrangTua: data.noHpOrangTua,
        hari: data.hari,
        jam: data.jam,
        pembayaran: data.pembayaran,
        mapel: data.mapel,
        catatanAnak: data.catatanAnak || null,
        guruId: payload.id as string,
      },
    });

    return responJson(
      { message: "Murid berhasil ditambahkan", data: muridBaru },
      { status: 201 },
    );
  } catch (error) {
    const guard = responGuard(error);
    if (guard) return guard;
    console.error("DETAIL ERROR DATABASE:", error);
    if (error instanceof z.ZodError) {
      return responJson(
        { message: "Format data tidak valid", errors: error.issues },
        { status: 400 },
      );
    }
    return responError(500, "Gagal menambahkan murid");
  }
}

// GET /api/murid - list murid, ringkasan, export
export async function GET(req: Request) {
  try {
    await wajibAuth(req);

    const params = new URL(req.url).searchParams;
    const action = params.get("action");

    if (action === "ringkasan") {
      return handleRingkasan(params);
    }
    if (action === "export") {
      return handleExport(params, req);
    }

    return handleList(params);
  } catch (error) {
    const guard = responGuard(error);
    if (guard) return guard;
    console.error("DETAIL ERROR GET MURID:", error);
    return responJson(
      { message: "Gagal mengambil data murid" },
      { status: 500 },
    );
  }
}

// --- Handler terpisah ---

async function handleList(params: URLSearchParams) {
  const where: Prisma.MuridWhereInput = {};

  const kelas = params.get("kelas");
  if (kelas && (KELAS_OPTIONS as readonly string[]).includes(kelas)) {
    where.kelas = kelas as Kelas;
  }

  const cari = params.get("cari");
  if (cari) {
    where.namaLengkap = { contains: cari, mode: "insensitive" };
  }

  const pembayaran = params.get("pembayaran");
  if (pembayaran) where.pembayaran = pembayaran;

  const batas = Math.min(Math.max(Number(params.get("batas")) || 50, 1), 500);
  const mulai = Math.max(Number(params.get("mulai")) || 0, 0);

  const semuaMurid = await prisma.murid.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { tanggalMasuk: "desc" },
    skip: mulai,
    take: batas,
  });

  return responJson(semuaMurid);
}

async function handleRingkasan(params: URLSearchParams) {
  const where: Prisma.MuridWhereInput = {};

  const kelas = params.get("kelas");
  if (kelas && (KELAS_OPTIONS as readonly string[]).includes(kelas)) {
    where.kelas = kelas as Kelas;
  }

  const pembayaran = params.get("pembayaran");
  if (pembayaran) where.pembayaran = pembayaran;

  const cari = params.get("cari");
  if (cari) where.namaLengkap = { contains: cari, mode: "insensitive" };

  const banding = Object.keys(where).length > 0 ? where : undefined;

  const [total, daftarKelas, daftarPembayaran] = await Promise.all([
    prisma.murid.count({ where: banding }),
    prisma.murid.groupBy({
      by: ["kelas"],
      where: banding,
      _count: { _all: true },
    }),
    prisma.murid.groupBy({
      by: ["pembayaran"],
      where: banding,
      _count: { _all: true },
    }),
  ]);

  const perKelas: Record<string, number> = {};
  for (const item of daftarKelas) perKelas[item.kelas] = item._count._all;

  const perPembayaran: Record<string, number> = {};
  for (const item of daftarPembayaran)
    perPembayaran[item.pembayaran] = item._count._all;

  return responJson({
    total,
    perKelas,
    perPembayaran,
    lunas: perPembayaran["LUNAS"] ?? 0,
    belumLunas: perPembayaran["BELUM LUNAS"] ?? 0,
  });
}

async function handleExport(params: URLSearchParams, req: Request) {
  const adminGuard = await wajibAdmin(req);
  if (adminGuard instanceof Response) return adminGuard;

  const template = params.get("template") === "1";
  const format = params.get("format") === "xlsx" ? "xlsx" : "csv";
  const tanggalHariIni = new Date().toISOString().slice(0, 10);

  let baris: string[][];

  if (template) {
    baris = [HEADER_EKSPOR, ...BARIS_CONTOH];
  } else {
    const semuaMurid = await prisma.murid.findMany({
      include: { guru: { select: { nama: true } } },
      orderBy: [{ kelas: "asc" }, { namaLengkap: "asc" }],
    });

    baris = [
      HEADER_EKSPOR,
      ...semuaMurid.map((murid: (typeof semuaMurid)[0]) => [
        murid.namaLengkap,
        murid.namaPanggilan,
        murid.kelas,
        murid.sekolahAsal,
        murid.namaOrangTuaWali,
        murid.pekerjaanAyah || "",
        murid.pekerjaanIbu || "",
        murid.alamatDomisili,
        murid.noHpOrangTua,
        murid.hari,
        murid.jam,
        murid.mapel,
        murid.pembayaran,
        murid.catatanAnak || "",
        murid.guru?.nama || "",
        formatTanggalEkspor(new Date(murid.tanggalMasuk)),
      ]),
    ];
  }

  const namaFile = template
    ? "template-import-murid.csv"
    : `data-murid-${tanggalHariIni}.${format}`;

  const headerDasar = {
    "Content-Disposition": `attachment; filename="${namaFile}"`,
    "Cache-Control": "no-store",
  };

  if (format === "xlsx") {
    const workbook = buatWorkbookXlsx(
      baris,
      template ? "Template" : "Data Murid",
    );
    const isi = workbookKeXlsx(workbook);
    return new Response(isi as unknown as BodyInit, {
      headers: {
        ...headerDasar,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  }

  return new Response(keCsv(baris), {
    headers: { ...headerDasar, "Content-Type": "text/csv; charset=utf-8" },
  });
}

async function handleImport(req: Request) {
  try {
    const payload = await wajibAdmin(req);
    const idAdmin = payload.id as string | undefined;

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return responJson(
        {
          message:
            "File tidak ditemukan. Kirim file pada kolom 'file' dengan multipart/form-data.",
        },
        { status: 400 },
      );
    }

    const entri = formData.get("file");
    if (!entri || typeof entri === "string") {
      return responJson(
        { message: "File tidak ditemukan. Unggah file pada kolom 'file'." },
        { status: 400 },
      );
    }

    const file = entri as File;
    if (file.size === 0) return responError(400, "File yang diunggah kosong.");
    if (file.size > UKURAN_MAKS_FILE)
      return responError(400, "Ukuran file maksimal 5 MB.");

    let baris: string[][];
    try {
      baris = parseFileMurid(
        file.name,
        new Uint8Array(await file.arrayBuffer()),
      );
    } catch (error) {
      const pesan =
        error instanceof FileImportError
          ? error.message
          : "File tidak dapat dibaca. Pastikan file tidak rusak.";
      return responError(400, pesan);
    }

    if (baris.length < 2) {
      return responJson(
        {
          message:
            "File tidak memiliki baris data. Baris pertama harus berisi header kolom.",
        },
        { status: 400 },
      );
    }

    if (baris.length - 1 > BARIS_MAKS_FILE) {
      return responJson(
        {
          message: `Jumlah baris melewati batas maksimal ${BARIS_MAKS_FILE} baris.`,
        },
        { status: 400 },
      );
    }

    const kunciHeader = terjemahHeader(baris[0]);
    if (jumlahHeaderDikenali(baris[0]) === 0) {
      return responJson(
        {
          message:
            "Header kolom tidak dikenali. Unduh template import untuk format yang benar.",
        },
        { status: 400 },
      );
    }

    const [semuaPengguna, muridLama] = await Promise.all([
      prisma.pengguna.findMany({
        select: { id: true, nama: true, email: true },
      }),
      prisma.murid.findMany({
        select: { namaLengkap: true, noHpOrangTua: true },
      }),
    ]);

    const petaPengguna = new Map<string, string>();
    for (const pengguna of semuaPengguna) {
      petaPengguna.set(normalisasiKunci(pengguna.nama), pengguna.id);
      if (pengguna.email)
        petaPengguna.set(normalisasiKunci(pengguna.email), pengguna.id);
    }

    const kunciMuridLama = new Set(
      muridLama
        .filter(
          (item: (typeof muridLama)[0]) => item.noHpOrangTua.trim() !== "",
        )
        .map(
          (item: (typeof muridLama)[0]) =>
            `${normalisasiKunci(item.namaLengkap)}|${normalisasiKunci(item.noHpOrangTua)}`,
        ),
    );

    const KOLOM_WAJIB = [
      "namaLengkap",
      "namaPanggilan",
      "kelas",
      "sekolahAsal",
      "namaOrangTuaWali",
      "alamatDomisili",
      "noHpOrangTua",
      "hari",
      "jam",
      "mapel",
    ];

    const dataValid: { row: number; data: any }[] = [];
    const kendala: { row: number; message: string }[] = [];
    let totalBaris = 0;
    let dilewatiDuplikat = 0;

    for (let indeks = 1; indeks < baris.length; indeks++) {
      const nomorBaris = indeks + 1;
      const nilai: Record<string, string> = {};

      kunciHeader.forEach((kunci, kolom) => {
        if (kunci) nilai[kunci] = baris[indeks][kolom] ?? "";
      });

      if (Object.values(nilai).every((value) => value.trim() === "")) continue;
      totalBaris++;

      const kolomKosong = KOLOM_WAJIB.filter((kunci) => !nilai[kunci]?.trim());
      if (kolomKosong.length > 0) {
        kendala.push({
          row: nomorBaris,
          message: `Kolom wajib belum diisi: ${kolomKosong.map(labelKolom).join(", ")}.`,
        });
        continue;
      }

      const kelas = normalisasiKelas(nilai.kelas);
      if (!kelas.ok) {
        kendala.push({
          row: nomorBaris,
          message: kelas.pesan || "Kelas tidak valid.",
        });
        continue;
      }

      const pembayaran = normalisasiPembayaran(nilai.pembayaran);
      if (!pembayaran.ok) {
        kendala.push({
          row: nomorBaris,
          message: pembayaran.pesan || "Status pembayaran tidak valid.",
        });
        continue;
      }

      let guruId: string | null = idAdmin ?? null;
      const teksGuru = nilai.guru?.trim();
      if (teksGuru) {
        const cocok = petaPengguna.get(normalisasiKunci(teksGuru));
        if (!cocok) {
          kendala.push({
            row: nomorBaris,
            message: `Guru "${teksGuru}" tidak ditemukan di database. Isikan nama/email pengguna yang terdaftar.`,
          });
          continue;
        }
        guruId = cocok;
      }

      const kunciDuplikat = `${normalisasiKunci(nilai.namaLengkap)}|${normalisasiKunci(nilai.noHpOrangTua)}`;
      if (kunciMuridLama.has(kunciDuplikat)) {
        dilewatiDuplikat++;
        kendala.push({
          row: nomorBaris,
          message:
            "Duplikat: data dengan nama dan No HP yang sama sudah ada di database.",
        });
        continue;
      }
      kunciMuridLama.add(kunciDuplikat);

      dataValid.push({
        row: nomorBaris,
        data: {
          namaLengkap: nilai.namaLengkap.trim(),
          namaPanggilan: nilai.namaPanggilan.trim(),
          kelas: kelas.value as Kelas,
          sekolahAsal: nilai.sekolahAsal.trim(),
          namaOrangTuaWali: nilai.namaOrangTuaWali.trim(),
          pekerjaanAyah: nilai.pekerjaanAyah?.trim() || "",
          pekerjaanIbu: nilai.pekerjaanIbu?.trim() || "",
          alamatDomisili: nilai.alamatDomisili.trim(),
          noHpOrangTua: nilai.noHpOrangTua.trim(),
          hari: nilai.hari.trim(),
          jam: nilai.jam.trim(),
          pembayaran: pembayaran.value,
          mapel: nilai.mapel.trim(),
          catatanAnak: nilai.catatanAnak?.trim()
            ? nilai.catatanAnak.trim()
            : null,
          guruId,
        },
      });
    }

    const gagal = kendala.filter(
      (item) => !item.message.startsWith("Duplikat:"),
    ).length;

    if (dataValid.length === 0) {
      return responJson(
        {
          message: "Tidak ada baris data yang valid untuk diimpor.",
          summary: {
            total: totalBaris,
            success: 0,
            skipped: dilewatiDuplikat,
            failed: gagal,
          },
          errors: kendala.slice(0, 50),
        },
        { status: 400 },
      );
    }

    let berhasil = 0;
    try {
      const hasil = await prisma.murid.createMany({
        data: dataValid.map((item) => item.data),
      });
      berhasil = hasil.count;
    } catch (error) {
      console.error("IMPORT createMany GAGAL, coba per baris:", error);
      for (const item of dataValid) {
        try {
          await prisma.murid.create({ data: item.data });
          berhasil++;
        } catch (kesalahanBaris) {
          kendala.push({
            row: item.row,
            message:
              kesalahanBaris instanceof Error
                ? kesalahanBaris.message
                : "Gagal menyimpan baris data.",
          });
        }
      }
    }

    kendala.sort((a, b) => a.row - b.row);
    const gagalAkhir = kendala.filter(
      (item) => !item.message.startsWith("Duplikat:"),
    ).length;

    return responJson({
      message:
        berhasil > 0
          ? `Import selesai: ${berhasil} data murid baru berhasil ditambahkan.`
          : "Import selesai, tetapi tidak ada data baru yang tersimpan.",
      summary: {
        total: totalBaris,
        success: berhasil,
        skipped: dilewatiDuplikat,
        failed: gagalAkhir,
      },
      errors: kendala.slice(0, 50),
    });
  } catch (error) {
    const guard = responGuard(error);
    if (guard) return guard;
    console.error("DETAIL ERROR IMPORT MURID:", error);
    return responError(500, "Gagal mengimpor data murid");
  }
}
