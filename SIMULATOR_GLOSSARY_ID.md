# Glosarium BGC Alpha Simulator (Bahasa Indonesia)

Dokumen ini menjelaskan istilah-istilah utama yang digunakan di codebase simulator saat ini.

Dokumen ini mencerminkan implementasi yang sudah ada sekarang, bukan model bisnis final yang lengkap di masa depan.

## Tujuan

Simulator ini adalah konsol keputusan internal untuk menguji pengaturan kebijakan `ALPHA` sebelum pilot dijalankan.

Saat ini, codebase memodelkan:

- pendaftaran, validasi, dan approval snapshot
- import snapshot dan canonical member-month facts
- baseline model yang bisa dieksekusi
- konfigurasi scenario
- simulation run berbasis queue
- simulasi berbasis dataset pada granularitas `member-month`
- penyimpanan hasil
- decision pack untuk founder

Saat ini, codebase belum memodelkan:

- replay data snapshot mentah per baris secara penuh
- perilaku onchain yang nyata
- tokenomics produksi yang lengkap
- threshold terkalibrasi level produksi dan regression fixtures

## Objek Inti

### Snapshot

`snapshot` adalah referensi dataset yang terdaftar beserta canonical dataset hasil import yang dipakai sebagai konteks input untuk sebuah run.

Di codebase saat ini, snapshot menyimpan:

- nama
- source systems
- rentang tanggal
- file URI
- jumlah record
- catatan
- status validasi
- import runs
- canonical `SnapshotMemberMonthFact` rows yang sudah diimport

Penting: sebuah run tetap membutuhkan snapshot dengan status `APPROVED`, dan engine sekarang menghitung hasil dari canonical rows yang terhubung ke snapshot tersebut.

### Snapshot Import Run

`snapshot import run` adalah satu job worker dalam queue yang membaca file CSV dan mencoba mengubahnya menjadi canonical facts.

Objek ini menyimpan:

- status import
- jumlah baris mentah
- jumlah baris yang berhasil diimport
- import issues
- waktu mulai dan selesai
- catatan

### Snapshot Member-Month Fact

`snapshot member-month fact` adalah baris input simulasi kanonik untuk MVP.

Objek ini menyimpan satu observasi member-bulan dengan field seperti:

- `periodKey`
- `memberKey`
- `sourceSystem`
- `memberTier`
- `groupKey`
- `pcVolume`
- `spRewardBasis`
- `globalRewardUsd`
- `poolRewardUsd`
- `cashoutUsd`
- `sinkSpendUsd`
- `activeMember`

### Baseline Model

`baseline model` adalah versi model bernama yang dihubungkan ke scenario dan run.

Di codebase saat ini, baseline model terutama berfungsi sebagai:

- metadata versi
- default dan threshold yang bisa dieksekusi
- konfigurasi rule conversion, cap, sink, cash-out, dan treasury

Penting: engine saat ini me-resolve ruleset JSON dari model dan memakainya saat simulasi serta evaluasi rekomendasi.

### Scenario

`scenario` adalah konfigurasi kebijakan yang bisa dipakai ulang.

Scenario berisi:

- nama
- template type
- deskripsi
- default snapshot
- baseline model version
- parameter JSON

Scenario adalah objek yang dibangun user di layar Scenario Builder.

### Simulation Run

`simulation run` adalah satu eksekusi dari satu scenario terhadap satu approved snapshot.

Run menyimpan:

- referensi scenario
- referensi snapshot
- referensi baseline model
- status run
- summary metrics
- time-series metrics
- segment metrics
- flags
- decision packs
- metadata eksekusi seperti engine version dan seed hash

Penting: engine saat ini bersifat deterministik pada granularitas imported `member-month` fact. Ini bukan engine replay event mentah.

### Decision Pack

`decision pack` adalah artefak rekomendasi untuk founder yang dihasilkan setelah sebuah run selesai.

Objek ini berisi:

- policy status
- label verdict founder-facing seperti `Ready`, `Needs Review`, atau `Do Not Use`
- ringkasan rekomendasi
- evaluated scenario basis
- blockers atau rejection reasons
- strategic goals
- milestone gates
- unresolved questions
- aksi export full simulation report

## Layar Utama

### Snapshots

Layar `Snapshots` adalah tempat user:

- mendaftarkan metadata dataset
- me-queue snapshot imports
- menjalankan validasi
- menyetujui snapshot untuk dipakai dalam simulasi

### Scenarios

Layar `Scenarios` adalah tempat user:

- membuat policy setup yang bisa dipakai ulang
- menghubungkan baseline model
- menetapkan default snapshot
- menjalankan run

### Runs

Layar `Runs` menampilkan:

- status run
- summary metrics
- flags
- decision links

### Distribution

Layar `Distribution` menampilkan perilaku ALPHA, konsentrasi issued share, total per fase skenario, dan split per source system dari run yang sudah selesai.

### Treasury

Layar `Treasury` menampilkan company cashflow truth lebih dulu, lalu treasury health signals.

Isinya saat ini meliputi:

- gross cash in
- retained revenue
- partner payout out
- direct reward obligations
- pool funding obligations
- actual payout out
- product fulfillment out
- net treasury delta
- treasury pressure
- reserve runway
- internal use rate
- concentration risk

### Compare

Layar `Compare` menampilkan sekumpulan completed runs terpilih secara side-by-side dengan struktur cashflow-first.

Isinya saat ini meliputi:

- selected scenario bar dan manage panel
- radar quick-scan
- compare decision snapshot
- business cashflow comparison
- ALPHA policy comparison
- treasury risk comparison
- distribution comparison
- strategic-goal comparison
- milestone comparison
- run context dan audit trail

### Decision Pack

Layar `Decision Pack` menampilkan rekomendasi untuk founder yang dihasilkan dari completed run.

Fokus utamanya saat ini adalah:

- policy verdict
- context scenario
- evaluated scenario basis
- blockers atau rejection reasons
- unresolved questions
- evidence strategic goals
- milestone gates
- export full simulation report

## Roles

### Founder

Bisa membaca output tingkat tinggi dan mengekspor full simulation report yang founder-facing, tetapi dalam mapping role saat ini tidak bisa membuat scenario atau menjalankan run.

### Analyst

Bisa mendaftarkan snapshot, memvalidasi snapshot, membuat scenario, dan menjalankan run.

### Product

Bisa membuat dan mengedit scenario, tetapi dalam mapping role saat ini tidak bisa menjalankan run.

### Engineering

Memiliki akses yang lebih berorientasi baca untuk memahami sistem, tetapi dalam mapping role saat ini tidak bisa membuat scenario atau menjalankan run.

### Admin

Memiliki akses penuh.

## Istilah Status

### User Status

- `ACTIVE`: user bisa login dan bertindak di aplikasi
- `INACTIVE`: user dinonaktifkan

### Snapshot Status

- `DRAFT`: snapshot sudah dibuat tetapi belum divalidasi
- `VALIDATING`: validasi sedang berjalan
- `INVALID`: validasi menemukan minimal satu error
- `VALID`: validasi lolos tanpa error
- `APPROVED`: snapshot disetujui untuk peluncuran run
- `ARCHIVED`: snapshot tidak lagi dimaksudkan untuk penggunaan aktif

Penting: sebuah run hanya bisa dijalankan terhadap snapshot dengan status `APPROVED`.

### Snapshot Import Status

- `QUEUED`: import job sudah dibuat dan sedang menunggu worker
- `RUNNING`: worker sedang parsing dan memvalidasi CSV
- `COMPLETED`: canonical facts berhasil ditulis
- `FAILED`: import gagal dan issues disimpan

### Baseline Model Status

- `DRAFT`: versi model ada tetapi belum menjadi versi aktif
- `ACTIVE`: versi model yang sedang dipilih/aktif
- `ARCHIVED`: versi model lama yang disimpan untuk histori

### Run Status

- `QUEUED`: run sudah dibuat dan sedang menunggu worker
- `RUNNING`: worker sudah mulai memproses run
- `COMPLETED`: output berhasil dipersist
- `FAILED`: eksekusi gagal

### Decision Pack Export Status

- `DRAFT`: pack sudah ada tetapi export belum ditandai siap
- `READY`: export siap
- `FAILED`: pembuatan export gagal

## Istilah Template Scenario

Template yang ada saat ini adalah:

- `Baseline`
- `Conservative`
- `Growth`
- `Stress`

Di codebase saat ini, template terutama hanyalah preset nilai parameter default. Run akan memakai angka final yang disimpan, bukan label template itu sendiri.

## Istilah Bisnis Yang Direferensikan Di Simulator

### `ALPHA`

Unit internal yang dimodelkan oleh simulator.

Dalam arah produk saat ini, ALPHA diperlakukan sebagai unit kebijakan dan utilitas internal, bukan token publik yang bisa diperdagangkan.

### `PC`

Nilai internal sisi bisnis yang digunakan di ekosistem BGC dan direferensikan dalam logika konversi ALPHA.

Di engine saat ini, fakta `pcVolume` yang diimport dikonversi menjadi issuance base lalu diskalakan dengan `k_pc`.

### `SP`

Nilai reward atau entitlement internal sisi bisnis yang direferensikan dalam logika konversi ALPHA.

Di engine saat ini, fakta `spRewardBasis` yang diimport dikonversi menjadi issuance base lalu diskalakan dengan `k_sp`.

Penjelasan sederhana dalam baseline simulator:

- `PC` adalah kredit internal yang terkait aktivitas produk fisik BGC.
- Anggap `PC` sebagai nilai dari sisi aktivitas bisnis/produk.
- Asumsi baseline: `100 PC = $1`.
- `SP` adalah nilai reward internal atau hak reward dari sistem reward yang sudah ada.
- Anggap `SP` sebagai nilai insentif atau entitlement.
- Asumsi baseline: `1 SP = $1 reward basis`.
- Perbedaan paling sederhananya: `PC` lebih dekat ke aktivitas bisnis/produk, sedangkan `SP` lebih dekat ke hak reward dan insentif.

### `Sink`

`sink` adalah mekanisme apa pun yang menyerap ALPHA keluar dari perilaku issuance-and-holding murni.

Dalam istilah bisnis, contohnya bisa berupa spend, utility use, access use, atau perilaku konsumsi lain yang sengaja dirancang.

Di engine saat ini, perilaku sink direpresentasikan oleh `sink_target`.

### `Cash-out`

`cash-out` berarti mengizinkan user mengubah nilai ALPHA yang dimodelkan menjadi outcome setara kas.

Engine saat ini memakai fakta `cashoutUsd` yang diimport bersama dengan `cashout_mode`, `cashout_min_usd`, `cashout_fee_bps`, `cashout_windows_per_year`, dan `cashout_window_days`.

### `Windowed Cash-out`

Mode cash-out di mana exit hanya tersedia pada window tertentu, bukan terus-menerus.

### `BPS`

`BPS` berarti `basis points`.

- `100 bps` = `1%`
- `150 bps` = `1.5%`
- `250 bps` = `2.5%`

### `Source System`

`source system` adalah sistem bisnis yang menyumbang data ke sebuah snapshot.

Contoh nilai di repo ini adalah `bgc` dan `iblooming`.

### `File URI`

`file URI` adalah string lokasi penyimpanan yang terhubung ke snapshot, misalnya:

- `s3://...`
- `https://...`
- `file://...`

### `Seed Hash`

`seed hash` adalah fingerprint deterministik dari input utama run.

Ini membantu mengidentifikasi bahwa sebuah run berasal dari kombinasi tertentu dari:

- scenario
- snapshot
- baseline model version
- parameters

## Glosarium Parameter Scenario

Setiap parameter punya makna bisnis dan makna engine saat ini.

Ringkasan sederhana dari knob utama di baseline simulator:

- `k_pc` = seberapa besar `PC` dikonversi menjadi ALPHA. Semakin tinggi nilainya, semakin besar kontribusi PC ke issuance ALPHA. Contoh: `k_pc = 1.2` berarti kontribusi PC naik 20% dari baseline.
- `k_sp` = seberapa besar `SP` dikonversi menjadi ALPHA. Semakin tinggi nilainya, semakin besar kontribusi SP ke issuance ALPHA. Contoh: `k_sp = 0.8` berarti kontribusi SP turun 20% dari baseline.
- `reward_global_factor` = pengali untuk tekanan reward global. Semakin tinggi nilainya, semakin besar modeled liability dari global reward.
- `reward_pool_factor` = pengali untuk tekanan reward berbasis pool. Semakin tinggi nilainya, semakin besar modeled liability dari pool reward.
- `sink_target` = target seberapa banyak ALPHA diserap untuk dipakai di ekosistem, misalnya untuk spend, utility, atau akses, bukan hanya di-hold atau di-cash out.

Cara paling gampang memahaminya: `PC + SP` = sumber pembentukan ALPHA; `k_pc + k_sp` = knob untuk mengatur seberapa besar ALPHA diterbitkan; `reward_global_factor + reward_pool_factor` = knob untuk mengatur tekanan/beban reward; `sink_target` = knob untuk mengatur seberapa banyak ALPHA dipakai di dalam ekosistem.

### `k_pc`

- Makna bisnis: intensitas konversi dari `PC` ke ALPHA issuance
- Makna engine saat ini: menskalakan issuance base yang berasal dari `pcVolume` untuk setiap imported fact row

### `k_sp`

- Makna bisnis: intensitas konversi dari `SP` ke ALPHA issuance
- Makna engine saat ini: menskalakan issuance base yang berasal dari `spRewardBasis` untuk setiap imported fact row

### `reward_global_factor`

- Makna bisnis: pengali tekanan reward secara sistem
- Makna engine saat ini: menskalakan modeled liability dari nilai `globalRewardUsd` yang diimport

### `reward_pool_factor`

- Makna bisnis: pengali tekanan reward berbasis pool
- Makna engine saat ini: menskalakan modeled liability dari nilai `poolRewardUsd` yang diimport

### `cap_user_monthly`

- Makna bisnis: batas reward bulanan per user
- Makna engine saat ini: membatasi issued ALPHA pada level per-member per-month sebelum group caps diterapkan

### `cap_group_monthly`

- Makna bisnis: batas reward bulanan per group
- Makna engine saat ini: membatasi issued ALPHA pada level `groupKey` per-month setelah user caps diterapkan

### `sink_target`

- Makna bisnis: target porsi issued ALPHA yang diserap oleh ecosystem sinks seperti spend atau utility
- Makna engine saat ini: menskalakan perilaku `sinkSpendUsd` yang diimport terhadap baseline sink target untuk menentukan modeled spend

### `cashout_mode`

- Makna bisnis: apakah cash-out selalu terbuka atau hanya tersedia dalam window
- Makna engine saat ini:
  - `ALWAYS_OPEN` memakai baseline always-open release factor
  - `WINDOWS` memakai baseline windowed release factor yang disesuaikan dengan modeled window coverage

### `cashout_min_usd`

- Makna bisnis: ambang minimum setara USD sebelum cash-out diperbolehkan
- Makna engine saat ini: baris `cashoutUsd` yang diimport di bawah ambang ini tidak dihitung dalam modeled cash-out

### `cashout_fee_bps`

- Makna bisnis: biaya cash-out dalam basis points
- Makna engine saat ini: mengurangi modeled cash-out melalui fee retention factor

### `cashout_windows_per_year`

- Makna bisnis: berapa kali cash-out window dibuka setiap tahun
- Makna engine saat ini: berkontribusi ke normalized window coverage ketika `cashout_mode = WINDOWS`

### `cashout_window_days`

- Makna bisnis: berapa hari setiap cash-out window tetap terbuka
- Makna engine saat ini: berkontribusi ke normalized window coverage ketika `cashout_mode = WINDOWS`

## Glosarium Metrik Output

Ini adalah summary metrics utama yang dipersist untuk completed run.

### `alpha_issued_total`

Total issued ALPHA yang dimodelkan dalam run.

### `alpha_spent_total`

Total ALPHA yang dimodelkan terserap oleh sink seperti spend atau utility.

### `alpha_held_total`

Total ALPHA yang dimodelkan tidak dibelanjakan dalam output run.

### `alpha_cashout_equivalent_total`

Jumlah cash-out equivalent yang dimodelkan, diturunkan dari fakta `cashoutUsd` yang diimport dan pengaturan cash-out yang aktif.

### `sink_utilization_rate`

Porsi issued ALPHA yang diserap oleh perilaku spend yang dimodelkan.

### `payout_inflow_ratio`

Indikator tekanan yang membandingkan modeled payout pressure terhadap modeled inflow support.

Nilai yang lebih tinggi menunjukkan risiko treasury yang lebih besar.

### `reserve_runway_months`

Perkiraan bulan cadangan runway yang tersisa berdasarkan parameter saat ini.

Nilai yang lebih rendah menunjukkan risiko treasury yang lebih besar.

### `reward_concentration_top10_pct`

Porsi issued ALPHA yang dimodelkan terkonsentrasi pada 10% member teratas berdasarkan jumlah issuance.

Nilai yang lebih tinggi menunjukkan risiko fairness dan concentration yang lebih besar.

## Istilah Output Segment

Engine saat ini mengeluarkan segment metrics dalam tiga jenis segment.

### `member_tier`

Distribusi berdasarkan nilai `memberTier` yang diimport seperti `starter`, `builder`, atau `unknown`.

### `source_system`

Distribusi berdasarkan source system yang diimport seperti `bgc` atau `iblooming`.

### `alpha_behavior`

Breakdown perilaku yang disederhanakan:

- `hold`
- `spend`
- `cashout`

## Istilah Flag

Flag dihasilkan ketika completed run melewati threshold rules.

Flag bawaan yang ada saat ini adalah:

### `reserve_runway_below_threshold`

Dipicu ketika reserve runway turun di bawah batas minimum yang diinginkan.

### `payout_pressure_exceeds_inflow`

Dipicu ketika payout pressure melebihi modeled inflow.

### `reward_concentration_high`

Dipicu ketika reward terlalu terkonsentrasi pada cohort teratas.

## Istilah Severity

- `info`: severity paling rendah
- `warning`: perlu perhatian
- `critical`: pelanggaran threshold yang serius

## Policy Status Pada Decision Pack

Engine saat ini menghasilkan satu dari tiga status rekomendasi secara internal.

Di surface founder-facing, mapping label-nya adalah:

- `candidate` -> `Ready`
- `risky` -> `Needs Review`
- `rejected` -> `Do Not Use`

### `candidate`

Run masih berada di dalam threshold baseline model saat ini.

### `risky`

Run tidak menyentuh hard rejection thresholds, tetapi satu atau lebih flag terpicu.

### `rejected`

Run melanggar threshold keselamatan inti.

Di codebase saat ini, rejection terjadi ketika:

- `reserve_runway_months < 3`, atau
- `payout_inflow_ratio > 1.15`

## Aturan Validasi

Validasi metadata snapshot saat ini memeriksa:

- tanggal akhir harus sama dengan atau setelah tanggal mulai
- record count harus lebih besar dari nol
- minimal harus ada satu source system
- duplicate source systems menghasilkan warning
- file URI sebaiknya memakai skema eksplisit seperti `s3://`, `https://`, atau `file://`
- coverage window yang terlalu pendek menghasilkan warning
- coverage window yang terlalu besar secara tidak biasa menghasilkan warning

Validasi snapshot import saat ini memeriksa:

- required CSV columns tersedia
- numeric fields bisa diparse dan tetap non-negative
- `period_key` sesuai format `YYYY-MM`
- `active_member` bisa diparse sebagai nilai boolean yang didukung
- duplicate `period/member/source` rows ditolak
- import issues disimpan pada import run

## Keterbatasan Saat Ini

Simulator saat ini sudah dataset-driven pada granularitas `member-month`, tetapi masih memiliki keterbatasan penting di level MVP:

- belum ada replay event mentah
- beberapa rule understanding doc yang exact masih butuh canonical JSON, bukan compatibility CSV
- belum ada sinkronisasi langsung ke production
- belum ada suite regression fixture yang terkalibrasi
- approval dan metadata validation masih terpisah dari logika penyelesaian import-run

Jadi simulator saat ini sebaiknya dipahami sebagai:

`simulator internal yang sudah berjalan, dengan workflow nyata, canonical imports, baseline rules yang bisa dieksekusi, dan perhitungan berbasis dataset pada granularitas member-month`

## Urutan Bacaan Yang Direkomendasikan

Kalau seseorang baru mengenal simulator, urutan tercepat adalah:

1. `Snapshot`
2. `Scenario`
3. `Simulation Run`
4. `Summary Metrics`
5. `Flags`
6. `Decision Pack`
