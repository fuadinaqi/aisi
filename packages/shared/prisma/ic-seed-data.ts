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
      materi: null,
      sortOrder: idx + 1,
    };
  });
}

/** Marhalah Muhib (M1) — Level Muda */
const MUDA: RawIC[] = [
  { category: ICCategory.MANA_ASY_SYAHADAH, title: 'Mengagungkan syariat serta mencintai kebaikan dan menjauhi keburukan dan syubhat' },
  { category: ICCategory.MANA_ASY_SYAHADAH, title: 'Mencintai kaum beriman dan menjalankan tolong-menolong dalam kebaikan' },
  { category: ICCategory.MARIFATULLAH, title: 'Mengenal aqidah dan urgensi ilmu' },
  { category: ICCategory.MARIFATULLAH, title: 'Menumbuhkan kecintaan kepada Allah dan Rasul' },
  { category: ICCategory.MARIFATULLAH, title: 'Mencintai ilmu dan mengagungkan syiar Allah' },
  { category: ICCategory.MARIFATULLAH, title: 'Menghadirkan niat dan ikhlas' },
  { category: ICCategory.MARIFATULLAH, title: 'Membiasakan dzikir, doa, taubat dan tazkiyah' },
  { category: ICCategory.MARIFATUR_RASUL, title: 'Mengetahui kondisi sebelum Islam dan pengertian sirah' },
  { category: ICCategory.MARIFATUR_RASUL, title: 'Mengetahui perjalanan hidup dan akhlak Nabi' },
  { category: ICCategory.MARIFATUR_RASUL, title: 'Mencintai Rasulullah, memahami dan mengambil pelajaran dari hadits pilihan' },
  { category: ICCategory.MARIFATUL_ISLAM, title: "Memahami hakikat bid'ah dan mencintai persatuan" },
  { category: ICCategory.MARIFATUL_ISLAM, title: 'Memiliki kebanggaan berdakwah dan orientasi terhadap jamaah' },
  { category: ICCategory.MARIFATUL_ISLAM, title: 'Mengenal gerakan Islam dan risalah dakwah' },
  { category: ICCategory.MARIFATUL_ISLAM, title: 'Berpartisipasi dalam aktivitas sosial dan dakwah' },
  { category: ICCategory.MARIFATUL_INSAN, title: 'Memahami tujuan penciptaan dan peran khalifah' },
  { category: ICCategory.MARIFATUL_INSAN, title: 'Membiasakan akhlak kepada keluarga dan masyarakat' },
  { category: ICCategory.MARIFATUL_INSAN, title: 'Membiasakan ibadah sunnah rawatib dan dhuha' },
  { category: ICCategory.MARIFATUL_QURAN, title: 'Mengamalkan adab tilawah' },
  { category: ICCategory.MARIFATUL_QURAN, title: "Membaca, menghafal dan mengambil pelajaran dari ayat Al-Qur'an surat Adh-Dhuha hingga An-Naas" },
  { category: ICCategory.MARIFATUL_QURAN, title: "Mencintai, mengagungkan, dan mengamalkan Al-Qur'an" },
  { category: ICCategory.FIQIH_USHUL_FIQIH, title: 'Memahami dasar ushul fiqih' },
  { category: ICCategory.FIQIH_USHUL_FIQIH, title: 'Memahami dan menerapkan thaharah' },
  { category: ICCategory.FIQIH_USHUL_FIQIH, title: 'Memahami dan melaksanakan ibadah wajib' },
  { category: ICCategory.KETATANEGARAAN, title: 'Memahami masyarakat dan negara' },
  { category: ICCategory.KETATANEGARAAN, title: 'Memahami dinamika politik dan sejarah Islam' },
  { category: ICCategory.KETATANEGARAAN, title: 'Memahami kondisi umat Islam global, khususnya Palestina' },
  { category: ICCategory.LIFESKILLS, title: 'Memahami dan mencintai bahasa Arab' },
  { category: ICCategory.LIFESKILLS, title: 'Mengembangkan kreativitas' },
  { category: ICCategory.LIFESKILLS, title: 'Mengembangkan keterampilan komunikasi' },
];

/** Marhalah Muayyid (M2) — Level Pratama */
const PRATAMA: RawIC[] = [
  { category: ICCategory.ALQURAN_ULUMUL_QURAN, title: "Menerapkan adab interaksi dengan Al-Qur'an dalam aktivitas tilawah" },
  { category: ICCategory.ALQURAN_ULUMUL_QURAN, title: "Membaca, menghafal, dan memperbaiki bacaan Al-Qur'an sesuai kaidah tajwid" },
  { category: ICCategory.ALQURAN_ULUMUL_QURAN, title: "Melaksanakan tilawah, tadabbur, dan pengamalan Al-Qur'an secara rutin" },
  { category: ICCategory.ALQURAN_ULUMUL_QURAN, title: "Menunjukkan sikap penghormatan terhadap Al-Qur'an dan ulama tafsir dalam perilaku sehari-hari" },
  { category: ICCategory.HADITS_ULUMUL_HADITS, title: 'Membaca dan menghafal hadits dengan benar' },
  { category: ICCategory.HADITS_ULUMUL_HADITS, title: 'Menjelaskan dan menyimpulkan kandungan hadits' },
  { category: ICCategory.HADITS_ULUMUL_HADITS, title: 'Menerapkan sunnah dalam kehidupan sehari-hari' },
  { category: ICCategory.AQIDAH_AKHLAK, title: 'Menjelaskan konsep dasar aqidah' },
  { category: ICCategory.AQIDAH_AKHLAK, title: 'Menjelaskan karakteristik dan peran Aqidah dalam kehidupan' },
  { category: ICCategory.AQIDAH_AKHLAK, title: 'Menunjukkan pengaruh Aqidah dalam sikap dan perilaku' },
  { category: ICCategory.AQIDAH_AKHLAK, title: 'Melaksanakan ketaatan dalam kehidupan sehari-hari secara konsisten' },
  { category: ICCategory.AQIDAH_AKHLAK, title: 'Menunjukkan perilaku jujur dalam berbagai situasi' },
  { category: ICCategory.AQIDAH_AKHLAK, title: 'Menjaga lisan dari ghibah dan namimah' },
  { category: ICCategory.AQIDAH_AKHLAK, title: 'Menjaga kesucian diri dalam perilaku sehari-hari' },
  { category: ICCategory.AQIDAH_AKHLAK, title: 'Membiasakan sedekah dan bersilaturahmi' },
  { category: ICCategory.FIQIH_USHUL_FIQIH, title: 'Mengenal hukum-hukum taklifi' },
  { category: ICCategory.FIQIH_USHUL_FIQIH, title: 'Memahami macam-macam fiqh shalat' },
  { category: ICCategory.FIQIH_USHUL_FIQIH, title: 'Membiasakan shalat berjamaah dan shalat sunnah' },
  { category: ICCategory.FIQIH_USHUL_FIQIH, title: 'Melaksanakan puasa sesuai ketentuan syariat' },
  { category: ICCategory.FIQIH_USHUL_FIQIH, title: 'Menjelaskan tata cara dan hikmah ibadah haji' },
  { category: ICCategory.AL_HAQ_WAL_BATHIL, title: "Menjaga batasan syar'i dalam pergaulan sehari-hari" },
  { category: ICCategory.AL_HAQ_WAL_BATHIL, title: 'Menerapkan syariat dalam berpakaian, muamalah, dan sikap hidup' },
  { category: ICCategory.AL_HAQ_WAL_BATHIL, title: 'Menunjukkan perilaku baik terhadap sesama mukmin' },
  { category: ICCategory.QADHAYA_TAKWINUL_UMMAH, title: 'Memahami sejarah dan dinamika peradaban Islam' },
  { category: ICCategory.QADHAYA_TAKWINUL_UMMAH, title: 'Memahami kondisi dan problematika umat Islam' },
  { category: ICCategory.QADHAYA_TAKWINUL_UMMAH, title: 'Memahami isu strategis umat Islam di Palestina' },
  { category: ICCategory.QADHAYA_TAKWINUL_UMMAH, title: 'Memahami faktor kebangkitan umat dan pemikiran dakwah' },
  { category: ICCategory.DAKWAH_FIKRAH, title: 'Mengenal dakwah jahriyah dan peran pemuda di dalamnya' },
  { category: ICCategory.DAKWAH_FIKRAH, title: 'Memahami manhaj dakwah Nabi' },
  { category: ICCategory.DAKWAH_FIKRAH, title: 'Mengenal fikrah dan profil jamaah dakwah' },
  { category: ICCategory.DAKWAH_FIKRAH, title: "Berkomitmen dalam amal jama'i dan fikrah Islam" },
  { category: ICCategory.KETATANEGARAAN, title: 'Menunjukkan sikap positif terhadap kebangsaan dan kewarganegaraan' },
  { category: ICCategory.KETATANEGARAAN, title: 'Berpartisipasi dalam kegiatan sosial masyarakat' },
  { category: ICCategory.KETATANEGARAAN, title: 'Memahami problematika sosial' },
  { category: ICCategory.KETATANEGARAAN, title: 'Memahami sistem ketatanegaraan dan prinsip-prinsipnya' },
  { category: ICCategory.LIFESKILLS, title: 'Menggunakan bahasa Arab dasar dalam membaca, menulis, dan berbicara' },
  { category: ICCategory.LIFESKILLS, title: 'Menerapkan keterampilan berpikir dan pengembangan diri' },
  { category: ICCategory.LIFESKILLS, title: 'Menerapkan keterampilan komunikasi, manajemen diri, dan teknologi' },
];

export const IC_SEED_DATA: ICSeedItem[] = [
  ...build(GroupLevel.LEVEL_1, MUDA),
  ...build(GroupLevel.LEVEL_2, PRATAMA),
];
