'use client';

import { useState, useMemo } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Search, MessageCircle, Phone, Mail, HelpCircle, ChevronRight } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   TARKAM IDM — FAQ / PUSAT BANTUAN
   Comprehensive help center with search, category tabs,
   accordion-style FAQ items, and contact section.
   All content in Bahasa Indonesia.
   ═══════════════════════════════════════════════════════════════ */

/* ─── Category Types ─── */
type FaqCategory = 'umum' | 'turnamen' | 'poin' | 'hadiah' | 'akun';

interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
}

/* ─── Category Config ─── */
const CATEGORIES: { key: FaqCategory; label: string; emoji: string }[] = [
  { key: 'umum', label: 'Umum', emoji: '💡' },
  { key: 'turnamen', label: 'Turnamen', emoji: '⚔️' },
  { key: 'poin', label: 'Poin & Peringkat', emoji: '📊' },
  { key: 'hadiah', label: 'Hadiah', emoji: '🎁' },
  { key: 'akun', label: 'Akun', emoji: '👤' },
];

/* ─── FAQ Data — 22 items in Bahasa Indonesia ─── */
const FAQ_ITEMS: FaqItem[] = [
  // ═══ UMUM (General) ═══
  {
    id: 'umum-1',
    category: 'umum',
    question: 'Apa itu Tarkam IDM?',
    answer: `Tarkam IDM (Idol Meta) adalah platform turnamen dance online mingguan berbasis komunitas. Pemain bertanding dalam format bracket elimination untuk meraih poin, peringkat, dan hadiah. Tarkam IDM adalah <strong>Fan Made Edition</strong> — dibuat oleh fans untuk fans, bukan produk resmi dari Idol Meta.

Di sini kamu bisa:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li>Mendaftar turnamen mingguan divisi Cowo atau Cewe</li>
<li>Bertanding dan naik peringkat berdasarkan performa</li>
<li>Mendapatkan hadiah dari juara dan sponsor</li>
<li>Bergabung dengan klub dan bersaing bersama tim</li>
</ul>`,
  },
  {
    id: 'umum-2',
    category: 'umum',
    question: 'Siapa yang bisa berpartisipasi?',
    answer: `Semua orang bisa berpartisipasi di Tarkam IDM! Syarat utamanya:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li>Memiliki akun yang terdaftar di platform Tarkam IDM</li>
<li>Memilih divisi: <strong>♂ Cowo</strong> (untuk pemain laki-laki) atau <strong>♀ Cewe</strong> (untuk pemain perempuan)</li>
<li>Bersedia mengikuti aturan dan jadwal turnamen</li>
</ul>

Tidak ada batasan usia atau lokasi — selama kamu bisa mengikuti pertandingan secara online, kamu bisa ikut!`,
  },
  {
    id: 'umum-3',
    category: 'umum',
    question: 'Apa perbedaan divisi Cowo dan Cewe?',
    answer: `Tarkam IDM membagi turnamen menjadi dua divisi:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li><strong>♂ Divisi Cowo</strong> — Turnamen khusus pemain laki-laki</li>
<li><strong>♀ Divisi Cewe</strong> — Turnamen khusus pemain perempuan</li>
</ul>

Setiap divisi memiliki bracket, peringkat, dan hadiah masing-masing. Pemain hanya bisa mendaftar di divisi yang sesuai dengan gender mereka. Sistem poin dan tier juga terpisah per divisi.`,
  },
  {
    id: 'umum-4',
    category: 'umum',
    question: 'Bagaimana cara mendaftar?',
    answer: `Cara mendaftar turnamen Tarkam IDM:
<ol class="list-decimal pl-5 mt-2 space-y-1">
<li>Klik tombol <strong>"Daftar"</strong> di halaman utama atau halaman turnamen</li>
<li>Isi form pendaftaran dengan data diri kamu (nama, gamertag, divisi)</li>
<li>Centang opsi "Buat akun" jika belum punya akun, lalu buat password</li>
<li>Setelah terdaftar, kamu akan masuk ke bracket turnamen</li>
</ol>

Pastikan mendaftar sebelum batas waktu pendaftaran ditutup! Status pendaftaran bisa dilihat di halaman Kalender Turnamen.`,
  },
  {
    id: 'umum-5',
    category: 'umum',
    question: 'Apakah gratis?',
    answer: `Ya, berpartisipasi di turnamen Tarkam IDM <strong>100% gratis!</strong> Kamu tidak perlu membayar biaya pendaftaran apapun.

Namun, ada fitur opsional seperti:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li><strong>Sawer / Donasi</strong> — Kamu bisa menyumbang untuk menambah hadiah turnamen dan mendapatkan badge eksklusif</li>
<li><strong>Sponsor</strong> — Sponsor bisa memberikan hadiah tambahan untuk turnamen</li>
</ul>

Donasi bersifat sukarela dan tidak mempengaruhi hasil pertandingan.`,
  },

  // ═══ TURNAMEN (Tournament) ═══
  {
    id: 'turnamen-1',
    category: 'turnamen',
    question: 'Kapan turnamen dimulai?',
    answer: `Turnamen Tarkam IDM berjalan dalam format <strong>musim (season)</strong> yang terdiri dari beberapa minggu. Setiap minggu ada turnamen baru.

Jadwal umum:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li>Pendaftaran biasanya dibuka beberapa hari sebelum pertandingan</li>
<li>Pertandingan berlangsung sesuai jadwal yang ditentukan admin</li>
<li>Hasil diumumkan setelah semua pertandingan selesai</li>
</ul>

Untuk jadwal terbaru, cek halaman <strong>Kalender Turnamen</strong> di navigasi atas.`,
  },
  {
    id: 'turnamen-2',
    category: 'turnamen',
    question: 'Bagaimana format turnamen?',
    answer: `Turnamen Tarkam IDM menggunakan format <strong>bracket elimination</strong> (gugur):

<ul class="list-disc pl-5 mt-2 space-y-1">
<li><strong>Single Elimination</strong> — Kalah satu kali langsung gugur</li>
<li>Pemain dipasangkan secara acak atau berdasarkan seeding</li>
<li>Setiap pertandingan menghasilkan pemenang yang maju ke ronde berikutnya</li>
<li>Babak final menentukan juara 1, 2, dan 3</li>
</ul>

Format detail bisa berubah per turnamen — selalu cek info di halaman bracket.`,
  },
  {
    id: 'turnamen-3',
    category: 'turnamen',
    question: 'Apa itu bracket elimination?',
    answer: `<strong>Bracket elimination</strong> adalah sistem pertandingan di mana pemain/tim yang kalah langsung tersingkir dari turnamen.

Contoh alurnya:
<ol class="list-decimal pl-5 mt-2 space-y-1">
<li><strong>Round of 16</strong> — 16 pemain bertanding, 8 pemenang maju</li>
<li><strong>Quarter Final</strong> — 8 pemain bertanding, 4 pemenang maju</li>
<li><strong>Semi Final</strong> — 4 pemain bertanding, 2 pemenang maju</li>
<li><strong>Grand Final</strong> — 2 pemain terakhir memperebutkan juara 1</li>
<li><strong>3rd Place</strong> — 2 yang kalah di semi final memperebutkan juara 3</li>
</ol>

Kamu bisa melihat bracket lengkap di halaman <strong>Bracket</strong>.`,
  },
  {
    id: 'turnamen-4',
    category: 'turnamen',
    question: 'Berapa lama satu musim?',
    answer: `Satu musim (season) Tarkam IDM biasanya berlangsung selama <strong>8–10 minggu</strong>, tergantung jumlah peserta dan jadwal yang ditentukan admin.

Setiap musim memiliki:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li>Turnamen mingguan dengan poin yang terakumulasi</li>
<li>Peringkat musiman berdasarkan total poin</li>
<li>Hadiah akhir musim untuk pemain terbaik</li>
</ul>

Progres musim bisa dilihat di sidebar (desktop) atau halaman Kalender.`,
  },
  {
    id: 'turnamen-5',
    category: 'turnamen',
    question: 'Bagaimana cara melihat jadwal?',
    answer: `Ada beberapa cara untuk melihat jadwal turnamen:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li><strong>Kalender Turnamen</strong> — Klik menu "Kalender" di navigasi untuk melihat jadwal dalam format kalender bulanan</li>
<li><strong>Halaman Utama</strong> — Info turnamen aktif dan status pendaftaran ditampilkan di halaman Beranda</li>
<li><strong>Notifikasi</strong> — Aktifkan notifikasi push untuk mendapat pengingat jadwal</li>
</ul>

Kamu juga bisa melihat status turnamen (pendaftaran dibuka/ditutup, sedang berlangsung, atau selesai) langsung dari halaman utama.`,
  },

  // ═══ POIN & PERINGKAT (Points & Ranking) ═══
  {
    id: 'poin-1',
    category: 'poin',
    question: 'Bagaimana sistem poin bekerja?',
    answer: `Sistem poin Tarkam IDM memberikan poin berdasarkan performa di setiap turnamen:

<ul class="list-disc pl-5 mt-2 space-y-1">
<li><strong>Menang pertandingan</strong> — Mendapat poin sesuai ronde (semakin jauh, poin semakin besar)</li>
<li><strong>Juara 1</strong> — Poin terbanyak</li>
<li><strong>Juara 2 & 3</strong> — Poin tambahan</li>
<li><strong>MVP</strong> — Bonus poin untuk pemain terbaik pertandingan</li>
<li><strong>Streak</strong> — Bonus poin untuk kemenangan berturut-turut</li>
</ul>

Poin terakumulasi sepanjang musim dan menentukan peringkat musiman kamu.`,
  },
  {
    id: 'poin-2',
    category: 'poin',
    question: 'Apa itu tier (S/A/B)?',
    answer: `Tier adalah klasifikasi level pemain berdasarkan performa dan poin:

<ul class="list-disc pl-5 mt-2 space-y-1">
<li><strong>Tier S</strong> — Pemain top, performa konsisten tinggi, poin terbanyak</li>
<li><strong>Tier A</strong> — Pemain berpengalaman dengan performa baik</li>
<li><strong>Tier B</strong> — Pemain baru atau yang masih mengembangkan skill</li>
</ul>

Tier ditampilkan di profil pemain dan badge di bracket. Tier bisa berubah seiring musim berdasarkan akumulasi poin dan performa.`,
  },
  {
    id: 'poin-3',
    category: 'poin',
    question: 'Bagaimana naik tier?',
    answer: `Untuk naik tier, kamu perlu meningkatkan performa secara konsisten:

<ul class="list-disc pl-5 mt-2 space-y-1">
<li><strong>Kumpulkan poin</strong> — Menangkan pertandingan dan raih posisi tinggi di turnamen</li>
<li><strong>Raih MVP</strong> — Performa terbaik di pertandingan memberikan bonus poin</li>
<li><strong>Jaga streak</strong> — Kemenangan berturut-turut memberikan bonus tambahan</li>
<li><strong>Ikut turnamen rutin</strong> — Semakin sering berpartisipasi, semakin banyak kesempatan meraih poin</li>
</ul>

Tier diperbarui secara otomatis berdasarkan total poin musiman dan statistik performa.`,
  },
  {
    id: 'poin-4',
    category: 'poin',
    question: 'Apa itu MVP?',
    answer: `<strong>MVP (Most Valuable Player)</strong> adalah penghargaan untuk pemain yang tampil paling outstanding di sebuah pertandingan.

Ciri-ciri MVP:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li>Dipilih berdasarkan performa terbaik dalam pertandingan</li>
<li>Mendapat badge MVP di profil</li>
<li>Mendapat bonus poin tambahan</li>
<li>Total MVP ditampilkan di statistik pemain</li>
</ul>

MVP bisa didapatkan di setiap pertandingan, bukan hanya di final. Jumlah MVP kumulatif mempengaruhi peringkat dan tier.`,
  },
  {
    id: 'poin-5',
    category: 'poin',
    question: 'Bagaimana peringkat dihitung?',
    answer: `Peringkat musiman dihitung berdasarkan beberapa faktor:

<ol class="list-decimal pl-5 mt-2 space-y-1">
<li><strong>Total poin musiman</strong> — Faktor utama, semakin banyak poin semakin tinggi peringkat</li>
<li><strong>Total kemenangan</strong> — Jika poin sama, pemain dengan kemenangan lebih banyak unggul</li>
<li><strong>Total MVP</strong> — Tiebreaker kedua</li>
<li><strong>Streak</strong> — Streak kemenangan aktif sebagai pertimbangan tambahan</li>
</ol>

Peringkat diperbarui secara real-time setelah setiap pertandingan selesai. Kamu bisa melihat peringkat lengkap di halaman <strong>Peringkat</strong>.`,
  },

  // ═══ HADIAH (Prizes) ═══
  {
    id: 'hadiah-1',
    category: 'hadiah',
    question: 'Apa hadiah yang tersedia?',
    answer: `Hadiah di Tarkam IDM berasal dari dua sumber:

<ul class="list-disc pl-5 mt-2 space-y-1">
<li><strong>Hadiah Turnamen</strong> — Disediakan untuk juara 1, 2, dan 3 setiap turnamen mingguan</li>
<li><strong>Hadiah Sponsor</strong> — Hadiah tambahan dari sponsor/donatur yang menambah prize pool</li>
</ul>

Jenis hadiah bisa berupa:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li>Saldo e-wallet (GoPay, OVO, Dana, dll.)</li>
<li>Voucher gaming atau digital</li>
<li>Produk fisik dari sponsor</li>
<li>Badge eksklusif di platform</li>
</ul>

Jumlah hadiah bervariasi per turnamen — cek halaman turnamen untuk detailnya.`,
  },
  {
    id: 'hadiah-2',
    category: 'hadiah',
    question: 'Bagaimana cara klaim hadiah?',
    answer: `Untuk klaim hadiah, ikuti langkah berikut:

<ol class="list-decimal pl-5 mt-2 space-y-1">
<li>Pergi ke halaman turnamen di mana kamu menang</li>
<li>Klik tombol <strong>"Klaim"</strong> di samping hadiah yang tersedia</li>
<li>Pilih metode klaim: <strong>WhatsApp</strong> atau <strong>Manual</strong></li>
<li>Isi informasi kontak yang diperlukan</li>
<li>Tunggu verifikasi dari admin</li>
</ol>

Status klaim bisa dilacak melalui timeline:
<em>Pending → Verified → Processing → Shipped → Completed</em>

Jika klaim ditolak, admin akan memberikan alasan dan kamu bisa mengajukan kembali.`,
  },
  {
    id: 'hadiah-3',
    category: 'hadiah',
    question: 'Kapan hadiah dibagikan?',
    answer: `Proses distribusi hadiah mengikuti timeline berikut:

<ul class="list-disc pl-5 mt-2 space-y-1">
<li><strong>Verifikasi</strong> — Admin memverifikasi klaim dalam 1–3 hari kerja</li>
<li><strong>Proses</strong> — Hadiah diproses setelah verifikasi</li>
<li><strong>Pengiriman</strong> — Hadiah digital biasanya dalam 1–7 hari kerja, hadiah fisik bisa lebih lama</li>
</ul>

Kamu bisa mengecek status klaim kapan saja di halaman turnamen. Jika sudah lewat 7 hari kerja dan belum diterima, hubungi admin melalui Discord atau WhatsApp.`,
  },
  {
    id: 'hadiah-4',
    category: 'hadiah',
    question: 'Apakah hadiah bisa ditransfer?',
    answer: `Tidak, hadiah <strong>tidak bisa ditransfer</strong> ke pemain lain. Hadiah diberikan kepada pemain yang berhak berdasarkan hasil pertandingan.

Alasannya:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li>Keamanan — memastikan hadiah sampai ke pemenang yang benar</li>
<li>Fairness — hadiah adalah hak pemenang, bukan komoditas yang diperjualbelikan</li>
<li>Akuntabilitas — admin perlu memverifikasi identitas penerima</li>
</ul>

Jika kamu tidak bisa menerima hadiah, hubungi admin untuk diskusi lebih lanjut.`,
  },

  // ═══ AKUN (Account) ═══
  {
    id: 'akun-1',
    category: 'akun',
    question: 'Bagaimana cara login?',
    answer: `Untuk login ke akun Tarkam IDM:

<ol class="list-decimal pl-5 mt-2 space-y-1">
<li>Klik tombol <strong>"Login"</strong> di kanan atas halaman</li>
<li>Pilih tab <strong>"Peserta"</strong> untuk login pemain</li>
<li>Masukkan username/email dan password kamu</li>
<li>Klik "Masuk"</li>
</ol>

Setelah login, kamu bisa:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li>Melihat profil dan statistik</li>
<li>Mendaftar turnamen</li>
<li>Mengklaim hadiah</li>
<li>Melihat status turnamen</li>
</ul>

Untuk admin, pilih tab "Admin" dan masukkan kredensial admin.`,
  },
  {
    id: 'akun-2',
    category: 'akun',
    question: 'Saya lupa password, apa yang harus dilakukan?',
    answer: `Jika kamu lupa password, ada beberapa opsi:

<ol class="list-decimal pl-5 mt-2 space-y-1">
<li><strong>Hubungi admin</strong> — Cara tercepat, hubungi admin melalui Discord atau WhatsApp untuk reset password</li>
<li><strong>Gunakan fitur reset</strong> — Jika tersedia, klik "Lupa Password" di halaman login</li>
</ol>

Tips mencegah lupa password:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li>Gunakan password yang mudah diingat tapi sulit ditebak</li>
<li>Simpan password di password manager</li>
<li>Catat di tempat yang aman</li>
</ul>

<em>Penting: Jangan berbagi password dengan siapapun untuk keamanan akun kamu.</em>`,
  },
  {
    id: 'akun-3',
    category: 'akun',
    question: 'Bagaimana cara mengubah profil?',
    answer: `Untuk mengubah profil di Tarkam IDM:

<ol class="list-decimal pl-5 mt-2 space-y-1">
<li><strong>Login</strong> ke akun kamu</li>
<li>Klik avatar/nama kamu di kanan atas</li>
<li>Pilih <strong>"Lihat Profil"</strong> dari dropdown menu</li>
<li>Di halaman profil, kamu bisa mengubah:</li>
</ol>

<ul class="list-disc pl-5 mt-2 space-y-1">
<li>Gamertag (nama tampilan)</li>
<li>Avatar (foto profil)</li>
<li>Kota/lokasi</li>
</ul>

Perhatikan:
<ul class="list-disc pl-5 mt-2 space-y-1">
<li>Divisi (Cowo/Cewe) tidak bisa diubah setelah pendaftaran</li>
<li>Perubahan gamertag mungkin memerlukan persetujuan admin</li>
<li>Avatar harus sesuai dengan ketentuan komunitas</li>
</ul>`,
  },
];

/* ─── FAQ Page Component ─── */
export function FaqPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FaqCategory | 'semua'>('semua');

  /* Filter FAQ items based on search + category */
  const filteredItems = useMemo(() => {
    let items = FAQ_ITEMS;

    // Category filter
    if (activeCategory !== 'semua') {
      items = items.filter(item => item.category === activeCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      items = items.filter(
        item =>
          item.question.toLowerCase().includes(query) ||
          item.answer.toLowerCase().includes(query)
      );
    }

    return items;
  }, [searchQuery, activeCategory]);

  /* Count items per category */
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { semua: FAQ_ITEMS.length };
    for (const cat of CATEGORIES) {
      counts[cat.key] = FAQ_ITEMS.filter(item => item.category === cat.key).length;
    }
    return counts;
  }, []);

  /* Search result count for filtered view */
  const filteredCount = filteredItems.length;
  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-8">
      {/* ═══ Page Header ═══ */}
      <div className="relative rounded-2xl overflow-hidden mb-6 sm:mb-8">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-idm-gold-warm/10 via-idm-gold-warm/5 to-transparent" />
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(239,249,35,0.15) 0%, transparent 60%)' }} />

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-idm-gold-warm/15 border border-idm-gold-warm/25 flex items-center justify-center shadow-[0_0_20px_rgba(239,249,35,0.15)]">
              <span className="text-2xl sm:text-3xl">❓</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Pusat Bantuan
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
                Panduan lengkap tentang Tarkam IDM
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mt-5 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari pertanyaan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-background/80 border-idm-gold-warm/20 focus:border-idm-gold-warm/40 focus:ring-idm-gold-warm/20 rounded-xl text-sm"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                {filteredCount} hasil
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Category Tabs ═══ */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {/* "Semua" tab */}
        <button
          onClick={() => setActiveCategory('semua')}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer border ${
            activeCategory === 'semua'
              ? 'bg-idm-gold-warm/15 border-idm-gold-warm/30 text-idm-gold-warm shadow-[0_0_10px_rgba(239,249,35,0.1)]'
              : 'bg-card/50 border-border/40 text-muted-foreground hover:text-foreground hover:bg-card/80'
          }`}
        >
          <span>Semua</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            activeCategory === 'semua'
              ? 'bg-idm-gold-warm/20 text-idm-gold-warm'
              : 'bg-muted text-muted-foreground'
          }`}>
            {categoryCounts.semua}
          </span>
        </button>

        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer border ${
              activeCategory === cat.key
                ? 'bg-idm-gold-warm/15 border-idm-gold-warm/30 text-idm-gold-warm shadow-[0_0_10px_rgba(239,249,35,0.1)]'
                : 'bg-card/50 border-border/40 text-muted-foreground hover:text-foreground hover:bg-card/80'
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeCategory === cat.key
                ? 'bg-idm-gold-warm/20 text-idm-gold-warm'
                : 'bg-muted text-muted-foreground'
            }`}>
              {categoryCounts[cat.key]}
            </span>
          </button>
        ))}
      </div>

      {/* ═══ FAQ Items ═══ */}
      {filteredItems.length > 0 ? (
        <div className="space-y-3">
          {filteredItems.map((item, index) => (
            <div
              key={item.id}
              className="casino-card rounded-xl border border-border/40 bg-card/60 overflow-hidden transition-all duration-200 hover:border-idm-gold-warm/20"
            >
              <Accordion type="single" collapsible>
                <AccordionItem value={item.id} className="border-0">
                  <AccordionTrigger className="px-4 sm:px-5 py-3.5 hover:no-underline hover:bg-idm-gold-warm/[0.03] transition-colors group">
                    <div className="flex items-start gap-3 text-left">
                      {/* Question number badge */}
                      <span className="shrink-0 w-6 h-6 rounded-lg bg-idm-gold-warm/10 border border-idm-gold-warm/20 flex items-center justify-center text-[10px] font-bold text-idm-gold-warm mt-0.5">
                        {index + 1}
                      </span>
                      <span className="text-sm sm:text-[15px] font-medium text-foreground group-hover:text-idm-gold-warm/90 transition-colors">
                        {item.question}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 sm:px-5 pb-4">
                    <div className="pl-9 text-sm text-muted-foreground leading-relaxed space-y-2 [&_strong]:text-foreground [&_strong]:font-semibold [&_ul]:mt-2 [&_ol]:mt-2 [&_li]:mb-1 [&_em]:text-muted-foreground/70 [&_em]:text-xs">
                      <div dangerouslySetInnerHTML={{ __html: item.answer }} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <HelpCircle className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Tidak ditemukan
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Tidak ada pertanyaan yang cocok dengan &quot;{searchQuery}&quot;. Coba kata kunci lain atau lihat semua kategori.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setActiveCategory('semua'); }}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-idm-gold-warm/10 border border-idm-gold-warm/25 text-idm-gold-warm hover:bg-idm-gold-warm/20 transition-colors cursor-pointer"
          >
            Lihat semua FAQ
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ═══ Contact Section ═══ */}
      <div className="mt-10 sm:mt-12">
        <div className="casino-card relative rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(239,249,35,0.1) 0%, transparent 60%)' }} />

          <div className="relative p-6 sm:p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-idm-gold-warm/10 border border-idm-gold-warm/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(239,249,35,0.1)]">
              <MessageCircle className="w-7 h-7 text-idm-gold-warm" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
              Masih punya pertanyaan?
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Jika kamu tidak menemukan jawaban di atas, jangan ragu untuk menghubungi kami melalui channel berikut:
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              {/* Discord */}
              <a
                href="https://discord.gg/tarkamidm"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/25 text-[#5865F2] hover:bg-[#5865F2]/20 hover:border-[#5865F2]/40 transition-all duration-200 w-full sm:w-auto"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
                <span className="text-sm font-semibold">Discord Server</span>
              </a>

              {/* WhatsApp */}
              <a
                href="https://wa.me/6281234567890"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-green-500/10 border border-green-500/25 text-green-500 hover:bg-green-500/20 hover:border-green-500/40 transition-all duration-200 w-full sm:w-auto"
              >
                <Phone className="w-5 h-5 shrink-0" />
                <span className="text-sm font-semibold">WhatsApp</span>
              </a>

              {/* Email */}
              <a
                href="mailto:qhairulalamsyah@gmail.com"
                className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-idm-gold-warm/10 border border-idm-gold-warm/25 text-idm-gold-warm hover:bg-idm-gold-warm/20 hover:border-idm-gold-warm/40 transition-all duration-200 w-full sm:w-auto"
              >
                <Mail className="w-5 h-5 shrink-0" />
                <span className="text-sm font-semibold">Email Admin</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
