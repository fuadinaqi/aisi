import { GroupLevel, ICCategory, ICType } from '@prisma/client';

export type ICSeedItem = {
  level: GroupLevel;
  category: ICCategory;
  type: ICType;
  number: number;
  title: string;
  materi: string | null;
  sortOrder: number;
};

type RawIC = {
  category: ICCategory;
  title: string;
  /** Nama Bidang Studi dari kurikulum */
  materi: string;
};

function build(level: GroupLevel, items: RawIC[]): ICSeedItem[] {
  const counters: Partial<Record<ICCategory, number>> = {};
  return items.map((item, idx) => {
    const number = (counters[item.category] = (counters[item.category] ?? 0) + 1);
    return {
      level,
      category: item.category,
      type: ICType.PRIMER,
      number,
      title: item.title,
      materi: item.materi,
      sortOrder: idx + 1,
    };
  });
}

const K = ICCategory.KEAGAMAAN;
const B = ICCategory.KEBANGSAAN;
const M = ICCategory.KEMASYARAKATAN;
const O = ICCategory.KEORGANISASIAN;
const L = ICCategory.KEPEMIMPINAN_KEWIRAUSAHAAN;

/** Marhalah Muhib (M1) — Level Muda */
const MUDA: RawIC[] = [
  // A. Ma'na Asy-Syahadah
  { category: K, materi: "Ma'na Asy-Syahadah", title: 'Mengagungkan syariat serta mencintai kebaikan dan menjauhi keburukan dan syubhat' },
  { category: K, materi: "Ma'na Asy-Syahadah", title: 'Mencintai kaum beriman dan menjalankan tolong-menolong dalam kebaikan' },
  // B. Ma'rifatullah
  { category: K, materi: "Ma'rifatullah", title: 'Mengenal aqidah dan urgensi ilmu' },
  { category: K, materi: "Ma'rifatullah", title: 'Menumbuhkan kecintaan kepada Allah dan Rasul' },
  { category: K, materi: "Ma'rifatullah", title: 'Mencintai ilmu dan mengagungkan syiar Allah' },
  { category: K, materi: "Ma'rifatullah", title: 'Menghadirkan niat dan ikhlas' },
  { category: K, materi: "Ma'rifatullah", title: 'Membiasakan dzikir, doa, taubat dan tazkiyah' },
  // C. Ma'rifatur Rasul
  { category: K, materi: "Ma'rifatur Rasul", title: 'Mengetahui kondisi sebelum Islam dan pengertian sirah' },
  { category: K, materi: "Ma'rifatur Rasul", title: 'Mengetahui perjalanan hidup dan akhlak Nabi' },
  { category: K, materi: "Ma'rifatur Rasul", title: 'Mencintai Rasulullah, memahami dan mengambil pelajaran dari hadits pilihan' },
  // D. Ma'rifatul Islam
  { category: O, materi: "Ma'rifatul Islam", title: "Memahami hakikat bid'ah dan mencintai persatuan" },
  { category: O, materi: "Ma'rifatul Islam", title: 'Memiliki kebanggaan berdakwah dan orientasi terhadap jamaah' },
  { category: O, materi: "Ma'rifatul Islam", title: 'Mengenal gerakan Islam dan risalah dakwah' },
  { category: O, materi: "Ma'rifatul Islam", title: 'Berpartisipasi dalam aktivitas sosial dan dakwah' },
  // E. Ma'rifatul Insan
  { category: M, materi: "Ma'rifatul Insan", title: 'Memahami tujuan penciptaan dan peran khalifah' },
  { category: M, materi: "Ma'rifatul Insan", title: 'Membiasakan akhlak kepada keluarga dan masyarakat' },
  { category: M, materi: "Ma'rifatul Insan", title: 'Membiasakan ibadah sunnah rawatib dan dhuha' },
  // F. Ma'rifatul Qur'an
  { category: K, materi: "Ma'rifatul Qur'an", title: 'Mengamalkan adab tilawah' },
  { category: K, materi: "Ma'rifatul Qur'an", title: "Membaca, menghafal dan mengambil pelajaran dari ayat Al-Qur'an surat Adh-Dhuha hingga An-Naas" },
  { category: K, materi: "Ma'rifatul Qur'an", title: "Mencintai, mengagungkan, dan mengamalkan Al-Qur'an" },
  // G. Fiqih dan Ushul Fiqih
  { category: K, materi: 'Fiqih dan Ushul Fiqih', title: 'Memahami dasar ushul fiqih' },
  { category: K, materi: 'Fiqih dan Ushul Fiqih', title: 'Memahami dan menerapkan thaharah' },
  { category: K, materi: 'Fiqih dan Ushul Fiqih', title: 'Memahami dan melaksanakan ibadah wajib' },
  // H. Ketatanegaraan
  { category: B, materi: 'Ketatanegaraan', title: 'Memahami masyarakat dan negara' },
  { category: B, materi: 'Ketatanegaraan', title: 'Memahami dinamika politik dan sejarah Islam' },
  { category: B, materi: 'Ketatanegaraan', title: 'Memahami kondisi umat Islam global, khususnya Palestina' },
  // I. Lifeskills
  { category: L, materi: 'Lifeskills', title: 'Memahami dan mencintai bahasa Arab' },
  { category: L, materi: 'Lifeskills', title: 'Mengembangkan kreativitas' },
  { category: L, materi: 'Lifeskills', title: 'Mengembangkan keterampilan komunikasi' },
];

/** Marhalah Muayyid (M2) — Level Pratama */
const PRATAMA: RawIC[] = [
  // A. Al-Qur'an dan Ulumul Qur'an
  { category: K, materi: "Al-Qur'an dan Ulumul Qur'an", title: "Menerapkan adab interaksi dengan Al-Qur'an dalam aktivitas tilawah" },
  { category: K, materi: "Al-Qur'an dan Ulumul Qur'an", title: "Membaca, menghafal, dan memperbaiki bacaan Al-Qur'an sesuai kaidah tajwid" },
  { category: K, materi: "Al-Qur'an dan Ulumul Qur'an", title: "Melaksanakan tilawah, tadabbur, dan pengamalan Al-Qur'an secara rutin" },
  { category: K, materi: "Al-Qur'an dan Ulumul Qur'an", title: "Menunjukkan sikap penghormatan terhadap Al-Qur'an dan ulama tafsir dalam perilaku sehari-hari" },
  // B. Hadits dan Ulumul Hadits
  { category: K, materi: 'Hadits dan Ulumul Hadits', title: 'Membaca dan menghafal hadits dengan benar' },
  { category: K, materi: 'Hadits dan Ulumul Hadits', title: 'Menjelaskan dan menyimpulkan kandungan hadits' },
  { category: K, materi: 'Hadits dan Ulumul Hadits', title: 'Menerapkan sunnah dalam kehidupan sehari-hari' },
  // C. Aqidah dan Akhlak
  { category: K, materi: 'Aqidah dan Akhlak', title: 'Menjelaskan konsep dasar aqidah' },
  { category: K, materi: 'Aqidah dan Akhlak', title: 'Menjelaskan karakteristik dan peran Aqidah dalam kehidupan' },
  { category: K, materi: 'Aqidah dan Akhlak', title: 'Menunjukkan pengaruh Aqidah dalam sikap dan perilaku' },
  { category: K, materi: 'Aqidah dan Akhlak', title: 'Melaksanakan ketaatan dalam kehidupan sehari-hari secara konsisten' },
  { category: K, materi: 'Aqidah dan Akhlak', title: 'Menunjukkan perilaku jujur dalam berbagai situasi' },
  { category: K, materi: 'Aqidah dan Akhlak', title: 'Menjaga lisan dari ghibah dan namimah' },
  { category: K, materi: 'Aqidah dan Akhlak', title: 'Menjaga kesucian diri dalam perilaku sehari-hari' },
  { category: K, materi: 'Aqidah dan Akhlak', title: 'Membiasakan sedekah dan bersilaturahmi' },
  // D. Fiqih dan Ushul Fiqih
  { category: K, materi: 'Fiqih dan Ushul Fiqih', title: 'Mengenal hukum-hukum taklifi' },
  { category: K, materi: 'Fiqih dan Ushul Fiqih', title: 'Memahami macam-macam fiqh shalat' },
  { category: K, materi: 'Fiqih dan Ushul Fiqih', title: 'Membiasakan shalat berjamaah dan shalat sunnah' },
  { category: K, materi: 'Fiqih dan Ushul Fiqih', title: 'Melaksanakan puasa sesuai ketentuan syariat' },
  { category: K, materi: 'Fiqih dan Ushul Fiqih', title: 'Menjelaskan tata cara dan hikmah ibadah haji' },
  // E. Al-Haq wal-Bathil
  { category: K, materi: 'Al-Haq wal-Bathil', title: "Menjaga batasan syar'i dalam pergaulan sehari-hari" },
  { category: K, materi: 'Al-Haq wal-Bathil', title: 'Menerapkan syariat dalam berpakaian, muamalah, dan sikap hidup' },
  { category: K, materi: 'Al-Haq wal-Bathil', title: 'Menunjukkan perilaku baik terhadap sesama mukmin' },
  // F. Qadhaya dan Takwinul Ummah
  { category: M, materi: 'Qadhaya dan Takwinul Ummah', title: 'Memahami sejarah dan dinamika peradaban Islam' },
  { category: M, materi: 'Qadhaya dan Takwinul Ummah', title: 'Memahami kondisi dan problematika umat Islam' },
  { category: M, materi: 'Qadhaya dan Takwinul Ummah', title: 'Memahami isu strategis umat Islam di Palestina' },
  { category: M, materi: 'Qadhaya dan Takwinul Ummah', title: 'Memahami faktor kebangkitan umat dan pemikiran dakwah' },
  // G. Dakwah dan Fikrah
  { category: O, materi: 'Dakwah dan Fikrah', title: 'Mengenal dakwah jahriyah dan peran pemuda di dalamnya' },
  { category: O, materi: 'Dakwah dan Fikrah', title: 'Memahami manhaj dakwah Nabi' },
  { category: O, materi: 'Dakwah dan Fikrah', title: 'Mengenal fikrah dan profil jamaah dakwah' },
  { category: O, materi: 'Dakwah dan Fikrah', title: "Berkomitmen dalam amal jama'i dan fikrah Islam" },
  // H. Ketatanegaraan
  { category: B, materi: 'Ketatanegaraan', title: 'Menunjukkan sikap positif terhadap kebangsaan dan kewarganegaraan' },
  { category: B, materi: 'Ketatanegaraan', title: 'Berpartisipasi dalam kegiatan sosial masyarakat' },
  { category: B, materi: 'Ketatanegaraan', title: 'Memahami problematika sosial' },
  { category: B, materi: 'Ketatanegaraan', title: 'Memahami sistem ketatanegaraan dan prinsip-prinsipnya' },
  // I. Lifeskills
  { category: L, materi: 'Lifeskills', title: 'Menggunakan bahasa Arab dasar dalam membaca, menulis, dan berbicara' },
  { category: L, materi: 'Lifeskills', title: 'Menerapkan keterampilan berpikir dan pengembangan diri' },
  { category: L, materi: 'Lifeskills', title: 'Menerapkan keterampilan komunikasi, manajemen diri, dan teknologi' },
];

export const IC_SEED_DATA: ICSeedItem[] = [
  ...build(GroupLevel.LEVEL_1, MUDA),
  ...build(GroupLevel.LEVEL_2, PRATAMA),
];
