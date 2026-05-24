# Requirements Document

## Introduction

Dokumen ini mendefinisikan kebutuhan peningkatan UI/UX untuk aplikasi OkeMitra (Driver Deposit App). Aplikasi ini adalah Next.js + Capacitor (Android) yang digunakan untuk mengelola setoran driver. Peningkatan difokuskan pada pengalaman pengguna mobile, aksesibilitas, feedback interaksi, dan konsistensi visual di seluruh halaman aplikasi.

## Glossary

- **Aplikasi**: Aplikasi OkeMitra yang berjalan di platform Android melalui Capacitor dan browser mobile
- **Driver**: Pengguna dengan role supir yang melakukan input orderan dan setoran
- **Admin**: Pengguna dengan role administrator yang mengelola semua data driver dan orderan
- **Halaman_Deposit**: Halaman utama untuk input orderan dan konfirmasi setoran
- **Halaman_Dashboard**: Halaman beranda yang menampilkan ringkasan pendapatan dan statistik
- **Halaman_Riwayat**: Halaman yang menampilkan daftar transaksi yang sudah selesai
- **Bottom_Navigation**: Komponen navigasi tetap di bagian bawah layar
- **Toast_Notification**: Pesan singkat yang muncul sementara untuk memberikan feedback ke pengguna
- **Skeleton_Loading**: Placeholder animasi yang ditampilkan saat data sedang dimuat
- **Pull_To_Refresh**: Gesture menarik layar ke bawah untuk memuat ulang data
- **Form_Validation**: Proses pengecekan input pengguna sebelum data dikirim

## Requirements

### Requirement 1: Loading State dan Feedback Visual

**User Story:** Sebagai Driver, saya ingin melihat indikator loading yang jelas saat data sedang dimuat, sehingga saya tahu aplikasi sedang bekerja dan tidak hang.

#### Acceptance Criteria

1. WHILE data sedang dimuat dari server, THE Halaman_Deposit SHALL menampilkan Skeleton_Loading pada area daftar orderan dalam waktu kurang dari 100ms setelah request dimulai
2. WHEN pengguna menekan tombol "Simpan Orderan" atau "Konfirmasi Setoran", THE Halaman_Deposit SHALL menampilkan spinner pada tombol dan menonaktifkan tombol tersebut hingga server merespons (sukses atau error) atau hingga batas waktu 30 detik tercapai
3. WHEN proses submit berhasil, THE Aplikasi SHALL menampilkan Toast_Notification sukses selama 3 detik dengan animasi slide-in dari atas
4. IF proses submit gagal karena error jaringan, THEN THE Aplikasi SHALL menampilkan Toast_Notification error yang berisi pesan penyebab kegagalan (misalnya koneksi terputus) dan tombol "Coba Lagi", dan Toast_Notification tersebut tetap ditampilkan hingga pengguna menekan tombol "Coba Lagi" atau menutupnya secara manual
5. WHEN pengguna melakukan Pull_To_Refresh pada Halaman_Deposit tab setoran, THE Aplikasi SHALL menampilkan indikator refresh di bagian atas daftar dan memuat ulang data orderan dari server, kemudian menyembunyikan indikator setelah data berhasil dimuat atau setelah batas waktu 30 detik
6. IF proses submit tidak mendapat respons dari server dalam waktu 30 detik, THEN THE Aplikasi SHALL menghentikan loading pada tombol, mengaktifkan kembali tombol, dan menampilkan Toast_Notification error yang menginformasikan bahwa waktu permintaan habis beserta tombol "Coba Lagi"

### Requirement 2: Form Validation dan Error Handling

**User Story:** Sebagai Driver, saya ingin mendapat peringatan langsung saat mengisi form dengan data yang tidak valid, sehingga saya bisa memperbaiki kesalahan sebelum submit.

#### Acceptance Criteria

1. WHEN pengguna meninggalkan field "Lokasi Muat" dalam keadaan kosong setelah menyentuhnya (on blur), THE Halaman_Deposit SHALL menampilkan pesan error "Lokasi muat wajib diisi" di bawah field tersebut dalam waktu 1 detik
2. WHEN pengguna meninggalkan field "Lokasi Bongkar" dalam keadaan kosong setelah menyentuhnya (on blur), THE Halaman_Deposit SHALL menampilkan pesan error "Lokasi bongkar wajib diisi" di bawah field tersebut dalam waktu 1 detik
3. WHEN pengguna memasukkan nilai argo kurang dari 1000 atau lebih dari 999.999.999, THE Halaman_Deposit SHALL menampilkan pesan peringatan "Nilai argo tidak valid (minimum Rp 1.000)" di bawah field argo
4. WHEN pengguna mencoba upload file dengan ukuran lebih dari 5MB, THE Halaman_Deposit SHALL menampilkan pesan error "Ukuran file maksimal 5MB", menolak file tersebut, dan tidak mengubah state file upload sebelumnya
5. WHEN pengguna mencoba upload file dengan format selain JPG atau PNG, THE Halaman_Deposit SHALL menampilkan pesan error "Format file harus JPG atau PNG" dan menolak file tersebut
6. WHILE field "Lokasi Muat", "Lokasi Bongkar", atau "Argo" belum terisi dengan data valid, THE Halaman_Deposit SHALL menonaktifkan tombol submit orderan (tombol tidak dapat diklik dan ditampilkan dalam keadaan disabled secara visual)
7. WHILE belum ada file bukti transfer yang berhasil diupload, THE Halaman_Deposit SHALL menonaktifkan tombol konfirmasi setoran (tombol tidak dapat diklik dan ditampilkan dalam keadaan disabled secara visual)
8. IF pengguna memperbaiki data yang sebelumnya tidak valid sehingga memenuhi kriteria validasi, THEN THE Halaman_Deposit SHALL menghilangkan pesan error terkait field tersebut dalam waktu 1 detik

### Requirement 3: Animasi dan Transisi Halaman

**User Story:** Sebagai pengguna, saya ingin perpindahan antar halaman dan perubahan state terasa halus, sehingga aplikasi terasa responsif dan profesional.

#### Acceptance Criteria

1. WHEN pengguna berpindah dari tab "Input Orderan" ke tab "Setoran", THE Halaman_Deposit SHALL menampilkan animasi slide konten dari kanan ke kiri dengan durasi 200ms dan easing ease-in-out, dan WHEN pengguna berpindah dari tab "Setoran" ke tab "Input Orderan", THE Halaman_Deposit SHALL menampilkan animasi slide konten dari kiri ke kanan dengan durasi 200ms dan easing ease-in-out
2. WHEN pengguna memilih orderan untuk konfirmasi setoran, THE Halaman_Deposit SHALL menampilkan halaman detail dengan animasi slide-in dari kanan (translateX 100% ke 0%) dengan durasi 250ms dan easing ease-out
3. WHEN pengguna menekan tombol kembali dari halaman detail, THE Halaman_Deposit SHALL menampilkan animasi slide-out ke kanan (translateX 0% ke 100%) dengan durasi 200ms dan easing ease-in
4. WHEN kartu orderan muncul di daftar setoran, THE Halaman_Deposit SHALL menampilkan animasi stagger fade-in (opacity 0 ke 1) pada setiap kartu dengan durasi 300ms per kartu dan delay 50ms antar kartu, hingga maksimal 20 kartu pertama yang dianimasikan
5. WHEN pengguna mengetuk kartu orderan, THE Aplikasi SHALL menampilkan efek scale-down ke 0.98 selama 100ms dengan easing ease-out sebagai feedback sentuhan, lalu kembali ke scale 1.0 selama 100ms
6. IF animasi transisi halaman sedang berlangsung dan pengguna melakukan navigasi baru, THEN THE Halaman_Deposit SHALL membatalkan animasi yang sedang berjalan dan langsung memulai animasi transisi baru tanpa menunggu animasi sebelumnya selesai

### Requirement 4: Peningkatan Navigasi dan Orientasi

**User Story:** Sebagai pengguna, saya ingin selalu tahu di halaman mana saya berada dan bisa kembali dengan mudah, sehingga saya tidak tersesat dalam aplikasi.

#### Acceptance Criteria

1. THE Bottom_Navigation SHALL menampilkan indikator aktif pada item menu yang sedang dipilih berupa warna primary pada ikon dan label, efek scale 1.1 pada ikon, dan background highlight pada area item aktif yang membedakannya dari item tidak aktif
2. WHILE pengguna berada di halaman detail setoran, THE Halaman_Deposit SHALL menampilkan indikator step yang menunjukkan alur "Daftar Orderan → Detail Setoran → Konfirmasi" dengan step aktif saat ini ditandai secara visual
3. WHILE pengguna berada di halaman batch payment, THE Halaman_Deposit SHALL menampilkan indikator step yang menunjukkan alur "Daftar Orderan → Pilih Orderan → Pembayaran Batch → Konfirmasi" dengan step aktif saat ini ditandai secara visual
4. WHEN pengguna melakukan swipe horizontal dari area 20px tepi kiri layar dengan jarak minimal 50px ke kanan pada halaman detail atau batch payment, THE Aplikasi SHALL menavigasi kembali ke halaman sebelumnya dalam stack navigasi
5. IF pengguna melakukan gesture swipe back pada halaman utama (Dashboard, Deposit daftar, Riwayat, Profil), THEN THE Aplikasi SHALL tidak melakukan navigasi back dan tetap di halaman tersebut
6. IF ada orderan yang belum disetor lebih dari 3 hari, THEN THE Halaman_Dashboard SHALL menampilkan badge berupa angka jumlah orderan tertunggak pada ikon lonceng di header

### Requirement 5: Optimasi Input Mobile

**User Story:** Sebagai Driver yang menggunakan aplikasi di lapangan, saya ingin proses input data secepat dan semudah mungkin, sehingga saya tidak perlu banyak mengetik.

#### Acceptance Criteria

1. WHEN pengguna mengetik minimal 2 karakter di field "Lokasi Muat" atau "Lokasi Bongkar", THE Halaman_Deposit SHALL menampilkan maksimal 5 saran lokasi berdasarkan riwayat lokasi yang pernah diinput sebelumnya oleh pengguna tersebut, diurutkan dari yang paling sering digunakan
2. IF pengguna belum memiliki riwayat lokasi yang cocok dengan input, THEN THE Halaman_Deposit SHALL menyembunyikan daftar saran dan membiarkan pengguna mengetik lokasi secara manual
3. WHEN pengguna memilih tipe orderan, THE Halaman_Deposit SHALL menyimpan pilihan tersebut di penyimpanan lokal perangkat dan menggunakannya sebagai default untuk input berikutnya; jika belum ada riwayat pilihan, default tipe orderan adalah "online"
4. WHEN pengguna mengetik nilai argo, THE Halaman_Deposit SHALL memformat angka secara otomatis dengan pemisah ribuan (titik) saat pengguna mengetik, menerima hanya digit numerik, dan membatasi nilai maksimal hingga 99.999.999
5. WHEN keyboard muncul pada perangkat mobile, THE Halaman_Deposit SHALL menggeser konten ke atas dalam waktu tidak lebih dari 300ms sehingga field yang aktif tidak tertutup oleh keyboard dan tetap berada dalam area viewport yang terlihat
6. WHEN pengguna berhasil submit orderan, THE Halaman_Deposit SHALL mengosongkan field Lokasi Muat, Lokasi Bongkar, Nilai Argo, dan Tipe Orderan (dikembalikan ke default tersimpan), sementara field Driver dan Tanggal tetap mempertahankan nilai sebelumnya

### Requirement 6: Peningkatan Tampilan Daftar Orderan

**User Story:** Sebagai Admin, saya ingin melihat daftar orderan dengan informasi yang terorganisir dan mudah di-scan, sehingga saya bisa cepat menemukan orderan yang perlu ditindaklanjuti.

#### Acceptance Criteria

1. THE Halaman_Deposit tab setoran SHALL menampilkan total sisa setoran (dalam format Rupiah) dari semua orderan yang ditampilkan, ditempatkan di atas daftar orderan pertama dan tetap terlihat saat daftar di-scroll
2. IF daftar orderan memiliki lebih dari 10 item, THEN THE Halaman_Deposit SHALL menampilkan input pencarian yang memfilter orderan berdasarkan kecocokan parsial (minimal 1 karakter) pada nama driver, lokasi muat, lokasi bongkar, atau ID orderan secara case-insensitive
3. THE Halaman_Deposit SHALL mengelompokkan orderan berdasarkan tanggal (terbaru di atas) dengan header tanggal dalam format "DD MMM YYYY" yang tetap terlihat (sticky) di bagian atas layar saat pengguna men-scroll melewati grup tersebut
4. WHEN pengguna mengaktifkan mode batch, THE Halaman_Deposit SHALL menampilkan tombol "Pilih Semua" yang memilih seluruh orderan yang terlihat dan tombol "Hapus Pilihan" yang membatalkan semua pilihan, keduanya ditempatkan di atas daftar orderan
5. IF tanggal orderan sudah melewati 7 hari kalender dari tanggal pembuatan orderan, THEN THE Halaman_Deposit SHALL menampilkan border merah (seluruh sisi kartu) pada kartu orderan tersebut sebagai indikator keterlambatan setoran

### Requirement 7: Dark Mode dan Konsistensi Tema

**User Story:** Sebagai pengguna yang sering menggunakan aplikasi di malam hari, saya ingin tampilan dark mode yang konsisten dan nyaman di mata, sehingga saya bisa menggunakan aplikasi tanpa silau.

#### Acceptance Criteria

1. THE Aplikasi SHALL menerapkan dark mode pada semua halaman termasuk modal, dialog, dan bottom sheet, di mana seluruh komponen UI menggunakan CSS variable dari tema aktif tanpa warna hardcoded
2. WHEN pengguna mengubah tema dari pengaturan profil, THE Aplikasi SHALL menerapkan perubahan tema pada seluruh elemen yang terlihat dalam waktu maksimal 100ms tanpa reload halaman
3. THE Aplikasi SHALL menggunakan kontras warna minimal 4.5:1 untuk teks normal (di bawah 18pt regular atau 14pt bold) dan 3:1 untuk teks besar (18pt regular atau 14pt bold ke atas) sesuai standar WCAG 2.1 AA pada kedua mode tema
4. WHILE dark mode aktif, THE Halaman_Deposit SHALL menampilkan input field dengan border yang memiliki rasio kontras minimal 3:1 terhadap warna background yang berdekatan
5. THE Aplikasi SHALL menyimpan preferensi tema pengguna di localStorage dengan key "theme" dan menerapkan tema tersimpan saat aplikasi dibuka kembali sebelum konten halaman ditampilkan sehingga tidak terjadi flash tema yang salah
6. IF localStorage tidak tersedia atau tidak berisi preferensi tema, THEN THE Aplikasi SHALL menerapkan tema light sebagai default
7. WHEN halaman pertama kali dimuat dan preferensi tema tersimpan adalah dark, THE Aplikasi SHALL menampilkan dark mode tanpa menampilkan light mode terlebih dahulu (tanpa flash of unstyled content)

### Requirement 8: Peningkatan Halaman Sukses dan Konfirmasi

**User Story:** Sebagai Driver, saya ingin konfirmasi yang jelas setelah melakukan setoran, sehingga saya yakin transaksi berhasil dan bisa melanjutkan pekerjaan.

#### Acceptance Criteria

1. WHEN setoran berhasil dikonfirmasi, THE Halaman_Deposit SHALL menampilkan halaman sukses dengan animasi checkmark (zoom-in, durasi maksimal 300ms), nama driver, jumlah yang dibayarkan dalam format Rupiah, rute (lokasi muat → lokasi bongkar), dan tombol "Kembali ke Daftar"
2. WHEN pengguna menekan tombol "Konfirmasi Setoran", THE Aplikasi SHALL menampilkan dialog konfirmasi yang berisi jumlah yang akan dibayar dalam format Rupiah, jumlah orderan (jika batch), dan tombol "Ya, Lanjutkan" serta "Batal" sebelum memproses setoran
3. WHILE dialog konfirmasi ditampilkan, THE Aplikasi SHALL memblokir interaksi dengan elemen di belakang dialog menggunakan overlay dan menutup dialog hanya jika pengguna menekan tombol "Ya, Lanjutkan" atau "Batal"
4. WHEN setoran batch berhasil, THE Halaman_Deposit SHALL menampilkan jumlah orderan yang berhasil diproses (angka numerik) dan total nominal yang dibayarkan dalam format Rupiah
5. IF pengguna menekan tombol back pada halaman sukses, THEN THE Aplikasi SHALL menavigasi ke daftar setoran dan memuat ulang data terbaru dalam waktu maksimal 3 detik
6. IF setoran gagal setelah pengguna mengkonfirmasi melalui dialog, THEN THE Aplikasi SHALL menampilkan pesan error yang menjelaskan kegagalan dan mempertahankan data yang telah diisi pengguna (bukti transfer dan jumlah bayar) tanpa mengosongkan formulir
