# Alur BGC Alpha Simulator (Bahasa Indonesia)

Dokumen ini menjelaskan alur kerja produk secara ringkas dan mudah dipresentasikan, per layar.

## Konteks Baseline Simulator

Sebelum masuk ke flow, ada beberapa istilah utama yang penting dipahami:

- `PC` adalah kredit internal yang terkait aktivitas produk fisik BGC.
- Anggap `PC` sebagai nilai dari sisi aktivitas bisnis/produk.
- Dalam baseline simulator: `100 PC = $1`.
- `SP` adalah nilai reward internal atau hak reward dari sistem reward yang sudah ada.
- Anggap `SP` sebagai nilai insentif atau entitlement.
- Dalam baseline simulator: `1 SP = $1 reward basis`.

Perbedaan sederhananya:

- `PC` lebih dekat ke aktivitas bisnis/produk
- `SP` lebih dekat ke hak reward/insentif

Parameter utama yang sering dibahas:

- `k_pc` = seberapa besar `PC` dikonversi menjadi ALPHA
- `k_sp` = seberapa besar `SP` dikonversi menjadi ALPHA
- `reward_global_factor` = pengali untuk tekanan reward global
- `reward_pool_factor` = pengali untuk tekanan reward berbasis pool
- `sink_target` = target seberapa banyak ALPHA diserap untuk dipakai di ekosistem

Cara paling gampang memahaminya:

- `PC + SP` = sumber pembentukan ALPHA
- `k_pc + k_sp` = knob untuk mengatur seberapa besar ALPHA diterbitkan
- `reward_global_factor + reward_pool_factor` = knob untuk mengatur tekanan/beban reward
- `sink_target` = knob untuk mengatur seberapa banyak ALPHA dipakai di dalam ekosistem

## Flow Utama

1. **Sign in**  
   Product ini adalah web console internal, jadi user harus login dulu dengan akun internal.  
   Aksesnya berbasis role, artinya founder lebih banyak melihat dan memberi approval, sedangkan analyst atau product user bisa membuat snapshot, scenario, dan run.

2. **Overview**  
   Halaman `Overview` adalah layar ringkasan. Di sini terlihat berapa banyak snapshot, scenario, dan run yang sudah ada, sehingga tim bisa cepat tahu apakah data sudah siap dan apakah simulasi sudah pernah dijalankan.

3. **Load historical data di `Snapshots`**  
   Di sinilah proses dimulai.  
   User membuat snapshot dengan mengisi:
   - nama snapshot
   - source systems
   - rentang tanggal
   - upload CSV atau file URI
   - jumlah record
   - catatan

   Tujuan halaman ini adalah mendaftarkan satu versi dataset historis yang nanti akan dipakai untuk simulasi.

4. **Import dataset**  
   Setelah snapshot dibuat, user klik **Import facts**.  
   Aksi ini mengirim CSV ke background worker, lalu worker membaca file baris per baris dan mengubahnya ke format internal standar yang disebut **member-month fact**.

   Setiap baris mewakili satu member pada satu periode waktu, dengan field seperti:
   - `pc_volume`
   - `sp_reward_basis`
   - `global_reward_usd`
   - `pool_reward_usd`
   - `cashout_usd`
   - `sink_spend_usd`
   - `active_member`

   Jadi langkah ini mengubah data CSV mentah menjadi data terstruktur yang siap dipakai untuk simulasi.

5. **Clean and validate the data**  
   Masih di halaman `Snapshots`, sistem akan mengecek apakah dataset ini aman dipakai.  
   Ada 2 lapisan pengecekan:

   - **Metadata validation**  
     Mengecek rentang tanggal, jumlah record, source systems, format file URI, dan apakah snapshot mencakup histori yang cukup panjang.
   - **CSV/import validation**  
     Mengecek apakah kolom wajib ada, apakah angka valid, apakah boolean valid, dan apakah ada baris duplikat.

   Kalau ada masalah, layar akan menampilkan daftar issue. Kalau lolos, snapshot akan dianggap valid.

6. **Approve the snapshot**  
   Setelah dataset bersih, user klik **Approve**.  
   Ini adalah gerbang sebelum simulasi. Product ini tidak mengizinkan run jika snapshot belum berstatus `APPROVED`.  
   Jadi approval berarti: “dataset historis ini sudah dipercaya sebagai input untuk pengujian kebijakan.”

7. **Define policy rules di `Scenarios`**  
   Setelah data disetujui, user pindah ke halaman `Scenarios`.  
   Di sini user membuat scenario yang bisa dipakai ulang dengan memilih:
   - template: `Baseline`, `Conservative`, `Growth`, atau `Stress`
   - versi baseline model
   - default snapshot opsional
   - parameter kebijakan

   Parameter utama yang bisa diatur adalah:
   - `k_pc`
   - `k_sp`
   - reward global factor
   - reward pool factor
   - user monthly cap
   - group monthly cap
   - sink target
   - cash-out mode
   - cash-out minimum
   - cash-out fee
   - cash-out windows per year
   - window length

   Ini adalah tahap desain kebijakan: user sedang menentukan “aturan ALPHA seperti apa yang ingin kita uji?”

8. **Run the simulation**  
   Saat user klik **Run**, aplikasi akan:
   - mengecek bahwa scenario memang ada
   - mengecek bahwa snapshot ada dan sudah approved
   - membuat run record
   - membuat seed hash dari snapshot + model + parameters
   - mengirim run ke worker queue

   Ini membuat run menjadi reproducible dan auditable.

9. **Simulation engine memproses run**  
   Di background, worker akan memuat:
   - historical facts yang sudah approved
   - baseline model yang dipilih
   - parameter scenario

   Lalu engine akan:
   - mengonversi `PC` dan `SP` menjadi ALPHA
   - menyesuaikan berdasarkan aktivitas member
   - menerapkan user cap dan group cap
   - memperkirakan berapa banyak ALPHA yang dibelanjakan, dicash-out, atau dihold
   - menghitung treasury liability dan inflow

   Jadi di sinilah aturan kebijakan diterapkan ke perilaku historis yang nyata.

10. **Review results di `Run Detail`**  
    Setelah proses selesai, halaman run akan menampilkan:
    - status run
    - scenario, snapshot, dan model yang digunakan
    - summary metrics
    - warning flags
    - status rekomendasi

    Output pentingnya meliputi:
    - company gross cash in
    - retained revenue
    - net treasury delta
    - actual payout out
    - total ALPHA issued
    - total spent
    - total held
    - payout/inflow ratio
    - reserve runway
    - reward concentration

11. **Review supporting views**  
    Dari halaman run, user bisa membuka:
    - `Distribution`: perilaku ALPHA, konsentrasi issued share, total per fase, dan split per source system
    - `Treasury`: company cashflow lens lebih dulu, lalu runway, payout pressure, internal use, dan risk flags
    - `Decision Pack`: output rekomendasi untuk founder dengan scenario basis, blockers, dan export actions

    Ini adalah lapisan keputusan, di mana metrik mentah diterjemahkan menjadi makna bisnis.

12. **Decision Pack**  
    Sistem akan mengklasifikasikan scenario secara internal sebagai:
    - `candidate`
    - `risky`
    - `rejected`

    Di surface founder-facing, labelnya tampil sebagai:
    - `Ready`
    - `Needs Review`
    - `Do Not Use`

    Lalu sistem membuat decision pack yang berisi:
    - policy verdict
    - context scenario
    - evaluated scenario basis
    - blockers atau rejection reasons
    - unresolved questions
    - evidence strategic goals
    - milestone gates
    - pilihan export full simulation report

    Ini adalah artefak yang memang ditujukan untuk diskusi founder.

13. **Compare scenarios di `Compare`**  
    Terakhir, tim masuk ke halaman `Compare`.  
    Halaman ini menampilkan completed runs terpilih secara side by side, sehingga stakeholder bisa membandingkan shape skenario dan outcome bisnis antar scenario.

    Alur compare saat ini adalah:
    - pilih 2 sampai 5 run
    - gunakan radar hanya sebagai quick scan
    - baca business cashflow comparison lebih dulu
    - lalu baca ALPHA policy comparison, treasury risk, distribution, strategic goals, dan milestones

## Versi Singkat Untuk Meeting

“Pertama kita upload dan approve historical data di `Snapshots`. Setelah itu kita definisikan policy rules di `Scenarios`. Lalu model dijalankan, hasil risiko dan rekomendasi direview di halaman run, dan akhirnya semua scenario dibandingkan side by side sebelum memilih pilot policy.”
