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
   - file type
   - check method
   - rentang tanggal
   - upload CSV atau file URI
   - jumlah record
   - catatan

   Tujuan halaman ini adalah mendaftarkan satu versi dataset historis yang nanti akan dipakai untuk simulasi.
   `File type` memberi tahu engine seberapa detail data yang diupload:
   - `Monthly CSV`: satu baris adalah satu member dalam satu bulan. Paling cepat untuk simulasi dasar.
   - `Full Detail CSV`: satu CSV biasa dengan kolom `record_type`. Ini format terbaik untuk user non-teknis yang tetap ingin Source Detail lengkap.
   - `Full Detail JSON`: model detail yang sama seperti Full Detail CSV, tetapi dalam bentuk JSON.
   - `Full Detail Bundle`: paket data detail yang disiapkan dari beberapa source file.
   - `Hybrid Data`: campuran source-detail rows dan monthly aggregate rows.

   Aturan paling penting: **Monthly CSV paling mudah, tetapi Full Detail CSV adalah format CSV yang bisa membuat checklist Source Detail lengkap.**
   Kalau snapshot makin banyak, tim bisa meng-archive snapshot lama dari registry default tanpa menghapus data historisnya.
   Storage cleanup ditempatkan di bawah registry sebagai panel maintenance sekunder, supaya user membaca data bisnis aktif lebih dulu dan kandidat cleanup belakangan.

4. **Import dataset**  
   Setelah snapshot dibuat, user klik **Import**.
   Aksi ini mengirim file ke background worker, lalu worker membaca file baris per baris.

   Monthly CSV langsung diimport sebagai **member-month facts**.
   Full Detail CSV dan Full Detail JSON diimport sebagai source-detail records dulu, lalu engine menurunkan monthly simulation rows dari data detail tersebut.

   Setiap baris mewakili satu member pada satu periode waktu, dengan field seperti:
   - `pc_volume`
   - `sp_reward_basis`
   - `global_reward_usd`
   - `pool_reward_usd`
   - `cashout_usd`
   - `sink_spend_usd`
   - `active_member`

   Jadi langkah ini mengubah data CSV mentah menjadi data terstruktur yang siap dipakai untuk simulasi.
   Untuk Full Detail CSV, kolom kuncinya adalah `record_type`. Kolom ini memberi tahu engine apakah baris tersebut adalah member, alias, role history, offer, business event, PC entry, SP entry, reward obligation, pool entry, cash-out event, qualification window, atau qualification status.

5. **Clean and validate the data**  
   Masih di halaman `Snapshots`, sistem akan mengecek apakah dataset ini aman dipakai.  
   Di UI sekarang ini disebut **Data Check**. Yang dicek meliputi:

   - detail snapshot seperti rentang tanggal, source systems, dan file URI
   - kolom wajib
   - angka yang tidak valid
   - boolean yang tidak valid
   - baris duplikat
   - kelengkapan source detail untuk import detail
   - P0 data fingerprint

   Kalau ada masalah, layar akan menampilkan daftar issue. Kalau lolos, snapshot siap untuk di-approve.
   Snapshot dengan status `Data Check Missing` sebaiknya di-import ulang sebelum dipakai sebagai bukti kuat.

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
   - user monthly cap
   - group monthly cap
   - sink target
   - cash-out mode
   - cash-out minimum
   - cash-out fee
   - cash-out windows per year
   - window length
   - asumsi sink adoption
   - asumsi ALPHA dan Web3

   Ini adalah tahap desain kebijakan: user sedang menentukan “aturan ALPHA seperti apa yang ingin kita uji?”
   Mode scenario penting untuk cara membaca hasil:
   - `Imported Data Only` menjaga growth forecast tetap terkunci dan memakai periode yang memang ada di data import.
   - `Add Forecast` membuka asumsi growth, dan hasilnya harus dibaca sebagai estimasi.

   Global reward factor dan pool reward factor tetap dikunci ke baseline model. Field ini terlihat sebagai konteks, tetapi mengubahnya akan mengubah core reward math dan membuat compare antar scenario kurang reliable.
   Scenario lama juga bisa di-archive agar registry default tetap fokus pada kandidat policy yang masih aktif.

   Section `ALPHA & Web3` mengatur bahasa dan asumsi untuk Token Flow dan Whitepaper output. Di sini ALPHA bisa didefinisikan sebagai internal credit, points, off-chain token, atau future on-chain token. Section ini juga menyimpan token price basis, supply model, treasury reserve, liquidity pool, buy demand, sell pressure, burn, vesting unlock, dan decision rules.

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
   - membaca actual internal use dari `sink_spend_usd`
   - menambahkan modeled internal use hanya kalau scenario memiliki asumsi sink adoption
   - memperkirakan berapa banyak ALPHA yang dicash-out atau dihold
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

11. **Kelola histori run di `Result Ref`**
    Completed run juga dikumpulkan di halaman `Result Ref`.
    Halaman ini dipakai untuk:
    - melihat daftar ref hasil run yang sudah tersimpan
    - menandai ref penting dengan `Pin` supaya mudah ditemukan dan aman untuk kebijakan cleanup di masa depan
    - meng-archive ref lama dari tampilan default tanpa menghapus output dasarnya

    Urutan baca `Result Ref` saat ini menaruh ref yang dipin lebih dulu, lalu ref lain berdasarkan recency.

12. **Review supporting views**
   Dari halaman run, user bisa membuka:
   - `Distribution`: perilaku ALPHA, konsentrasi issued share, total per fase, dan split per source system
   - `Token Flow`: opening balance, issued, used, cash-out, held, ending balance, dan token price basis
   - `Treasury`: company cashflow lens lebih dulu, lalu runway, payout pressure, internal use, dan risk flags
   - `Decision Pack`: output rekomendasi untuk founder dengan scenario basis, blockers, dan export actions

    Ini adalah lapisan keputusan, di mana metrik mentah diterjemahkan menjadi makna bisnis.

13. **Decision Pack**
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

14. **Compare scenarios di `Compare`**
    Terakhir, tim masuk ke halaman `Compare`.  
    Halaman ini menampilkan completed runs terpilih secara side by side, sehingga stakeholder bisa membandingkan shape skenario dan outcome bisnis antar scenario.

    Alur compare saat ini adalah:
    - pilih 2 sampai 5 run
    - gunakan radar hanya sebagai quick scan
    - baca business cashflow comparison lebih dulu
    - lalu baca ALPHA policy comparison, treasury risk, distribution, strategic goals, dan milestones

## Versi Singkat Untuk Meeting

“Pertama kita upload dan approve historical data di `Snapshots`. Setelah itu kita definisikan policy rules di `Scenarios`. Lalu model dijalankan, hasil risiko dan rekomendasi direview di halaman run, dan akhirnya semua scenario dibandingkan side by side sebelum memilih pilot policy.”
