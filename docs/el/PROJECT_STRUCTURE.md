# Δομή του έργου PhantomSDR-Plus

Το έγγραφο αυτό παρέχει πλήρη επισκόπηση της δομής καταλόγων του PhantomSDR-Plus, της οργάνωσης των αρχείων και των σχέσεων μεταξύ των στοιχείων.

---

## Πίνακας περιεχομένων

1. [Δέντρο καταλόγων](#δέντρο-καταλόγων)
2. [Ριζικός κατάλογος](#ριζικός-κατάλογος)
3. [Πηγαίος κώδικας (`src/`)](#πηγαίος-κώδικας-src)
4. [Frontend (`frontend/`)](#frontend-frontend)
5. [Λίστες συχνοτήτων (`frequencylist/`)](#λίστες-συχνοτήτων-frequencylist)
6. [Αρχεία ρυθμίσεων](#αρχεία-ρυθμίσεων)
7. [Σύστημα μεταγλώττισης](#σύστημα-μεταγλώττισης)

---

## Δέντρο καταλόγων
```
PhantomSDR-Plus
├── admin_config.json
├── admin_server.py
├── autorun
│   ├── audiotap.js
│   ├── bandplan.js
│   ├── decodeworker.js
│   ├── index.js
│   ├── manager.js
│   ├── package.json
│   ├── pool.js
│   ├── probe-ft8.js
│   ├── probe-js8.js
│   ├── pskreporter.js
│   ├── spotparse.js
│   ├── wasm-shim.js
│   └── wsprnet.js
├── cf32_to_real.c             # Fobos HF: κρατά το I από το CF32 του rx_sdr, κλιμακωμένο σε s16 (το χτίζει το setup-fobos.sh)
├── chat_history.txt
├── check-go.sh                # παλιό: watchdog της αλυσίδας go.sh
├── config-airspyhf.toml
├── config.example.hackrf.toml
├── config.example.rtlsdr.toml
├── config-fobos-hf.toml
├── config-fobos.toml
├── config-hackrf.toml
├── config-rsp1a.toml
├── config-rtl.toml
├── config-rx888mk2.toml
├── config.toml
├── connection_impl.hpp
├── docs
│   ├── ADMIN_PANEL_SETUP.md
│   ├── Aether_config.md
│   ├── CONNECTION_LIMITS.md
│   ├── de
│   │   ├── ADMIN_PANEL_SETUP.md
│   │   ├── Aether_config.md
│   │   ├── CONNECTION_LIMITS.md
│   │   ├── DECODERS.md
│   │   ├── EDITING_VARIANTS.md
│   │   ├── INSTALLATION.md
│   │   ├── PhantomSDR-Plus-Documentation-DE.pdf
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   │   ├── RADE_README.md
│   │   ├── README.md
│   │   ├── RECEIVE_DIVERSITY.md
│   │   ├── RIG_CONTROL.md
│   │   ├── THERMAL_GUARD.md
│   │   └── USER_GUIDE.md
│   ├── DECODERS.md
│   ├── EDITING_VARIANTS.md
│   ├── el
│   │   ├── ADMIN_PANEL_SETUP.md
│   │   ├── Aether_config.md
│   │   ├── CONNECTION_LIMITS.md
│   │   ├── DECODERS.md
│   │   ├── EDITING_VARIANTS.md
│   │   ├── INSTALLATION.md
│   │   ├── PhantomSDR-Plus-Documentation-EL.pdf
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   │   ├── RADE_README.md
│   │   ├── README.md
│   │   ├── RECEIVE_DIVERSITY.md
│   │   ├── RIG_CONTROL.md
│   │   ├── THERMAL_GUARD.md
│   │   └── USER_GUIDE.md
│   ├── es
│   │   ├── ADMIN_PANEL_SETUP.md
│   │   ├── Aether_config.md
│   │   ├── CONNECTION_LIMITS.md
│   │   ├── DECODERS.md
│   │   ├── EDITING_VARIANTS.md
│   │   ├── INSTALLATION.md
│   │   ├── PhantomSDR-Plus-Documentation-ES.pdf
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   │   ├── RADE_README.md
│   │   ├── README.md
│   │   ├── RECEIVE_DIVERSITY.md
│   │   ├── RIG_CONTROL.md
│   │   ├── THERMAL_GUARD.md
│   │   └── USER_GUIDE.md
│   ├── fr
│   │   ├── ADMIN_PANEL_SETUP.md
│   │   ├── Aether_config.md
│   │   ├── CONNECTION_LIMITS.md
│   │   ├── DECODERS.md
│   │   ├── EDITING_VARIANTS.md
│   │   ├── INSTALLATION.md
│   │   ├── PhantomSDR-Plus-Documentation-FR.pdf
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   │   ├── RADE_README.md
│   │   ├── README.md
│   │   ├── RECEIVE_DIVERSITY.md
│   │   ├── RIG_CONTROL.md
│   │   ├── THERMAL_GUARD.md
│   │   └── USER_GUIDE.md
│   ├── hr
│   │   ├── ADMIN_PANEL_SETUP.md
│   │   ├── Aether_config.md
│   │   ├── CONNECTION_LIMITS.md
│   │   ├── DECODERS.md
│   │   ├── EDITING_VARIANTS.md
│   │   ├── INSTALLATION.md
│   │   ├── PhantomSDR-Plus-Documentation-HR.pdf
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   │   ├── RADE_README.md
│   │   ├── README.md
│   │   ├── RECEIVE_DIVERSITY.md
│   │   ├── RIG_CONTROL.md
│   │   ├── THERMAL_GUARD.md
│   │   └── USER_GUIDE.md
│   ├── INSTALLATION.md
│   ├── PhantomSDR-Plus-Documentation-EN.pdf
│   ├── PROJECT_STRUCTURE.md
│   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   ├── RADE_README.md
│   ├── README.md
│   ├── RECEIVE_DIVERSITY.md
│   ├── RIG_CONTROL.md
│   ├── ru
│   │   ├── ADMIN_PANEL_SETUP.md
│   │   ├── Aether_config.md
│   │   ├── CONNECTION_LIMITS.md
│   │   ├── DECODERS.md
│   │   ├── EDITING_VARIANTS.md
│   │   ├── INSTALLATION.md
│   │   ├── PhantomSDR-Plus-Documentation-RU.pdf
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── RADE_General_INSTALL_MANUAL_LINUX.md
│   │   ├── RADE_README.md
│   │   ├── README.md
│   │   ├── RECEIVE_DIVERSITY.md
│   │   ├── RIG_CONTROL.md
│   │   ├── THERMAL_GUARD.md
│   │   └── USER_GUIDE.md
│   ├── sdr-stats
│   │   ├── package.json
│   │   ├── readme_de.md
│   │   ├── readme_el.md
│   │   ├── readme_es.md
│   │   ├── readme_fr.md
│   │   ├── readme_hr.md
│   │   ├── README.md
│   │   └── readme_ru.md
│   ├── THERMAL_GUARD.md
│   ├── USER_GUIDE.md
│   ├── websdr2.png
│   ├── websdr3.png
│   └── websdr.png
├── favicon.ico
├── fftw_wisdom
├── fix_local_geo.py
├── frequencylist
│   ├── 0.TXT
│   ├── A26all00.TXT           # δεν είναι στο repo: το αποσυμπιέζει το update-markers.sh από το a26allx2.zip
│   ├── a26allx2.zip
│   ├── admin.txt
│   ├── antenna.txt
│   ├── broadcas.txt
│   ├── curl-output.txt
│   ├── currentUpdateFile.txt
│   ├── fmorg.txt
│   ├── generate-current-shortwave.py
│   ├── language.txt
│   ├── mymarkers.json
│   ├── README.md
│   ├── shortwavestations.json
│   ├── site.txt
│   └── update-markers.sh
├── frontend
│   ├── build-all.sh
│   ├── build-default.sh
│   ├── build-mobile.sh
│   ├── debug-title.sh
│   ├── favicon.ico
│   ├── fix-title-python.py
│   ├── index.html
│   ├── jsconfig.json
│   ├── LICENSE
│   ├── make-redirect-stubs.sh
│   ├── mobile
│   │   └── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── pnpm-lock.yaml
│   ├── postcss.config.cjs
│   ├── .prettierrc.json      # κανόνες μορφοποίησης Prettier για τον κώδικα του frontend
│   ├── public
│   │   ├── analyze_users.py
│   │   ├── decoders
│   │   │   ├── ft8_lib.wasm
│   │   │   ├── js8_dict.bin   # λεξικό λέξεων JS8, φορτώνεται μόνο όταν χρειαστεί
│   │   │   └── js8.wasm       # αποκωδικοποιητής JS8, από το jsdsp/js8_wasm
│   │   ├── logo.jpg
│   │   ├── stats.html
│   │   ├── users.html
│   │   └── wf-message.json
│   ├── README.md
│   ├── site_information.json
│   ├── src
│   │   ├── app.css
│   │   ├── App.svelte
│   │   ├── assets
│   │   │   ├── amateurfrequencies.json
│   │   │   ├── background.jpg
│   │   │   ├── shortwavestations.json
│   │   │   ├── SSTV.png
│   │   │   ├── SSTV.svg
│   │   │   └── svelte.png
│   │   ├── audio.js
│   │   ├── audio-stream-worklet.js
│   │   ├── bands-config.js
│   │   ├── broadcastSchedules.js
│   │   ├── clientVersion.js
│   │   ├── cwDecoder.js
│   │   ├── cw.worker.js
│   │   ├── cwWorkerProxy.js
│   │   ├── decoder.worker.js
│   │   ├── diversity.js
│   │   ├── diversityList.js
│   │   ├── eventBus.js
│   │   ├── events.js
│   │   ├── fax.js
│   │   ├── fax.worker.js
│   │   ├── faxWorkerProxy.js
│   │   ├── fft.js
│   │   ├── fsk.js
│   │   ├── fsk.worker.js
│   │   ├── fskWorkerProxy.js
│   │   ├── kiwiSource.js
│   │   ├── lib
│   │   │   ├── backend.js
│   │   │   ├── BandSelector.svelte
│   │   │   ├── catsync.js
│   │   │   ├── CheckButton.svelte
│   │   │   ├── colormaps.js
│   │   │   ├── Counter.svelte
│   │   │   ├── DiversityPanel.svelte
│   │   │   ├── fftRadix2.js
│   │   │   ├── freedv-reporter.js
│   │   │   ├── FreeDVReporter.svelte
│   │   │   ├── FrequencyInput.svelte
│   │   │   ├── FrequencyMarkers.svelte
│   │   │   ├── FtxSpectrum.svelte
│   │   │   ├── hammeractions.js
│   │   │   ├── LineThroughButton.svelte
│   │   │   ├── Logger.svelte
│   │   │   ├── MagicEyeIndicator.svelte
│   │   │   ├── ModeIdChip.svelte
│   │   │   ├── ModesSelector.svelte
│   │   │   ├── opusMlDecoder.js
│   │   │   ├── PassbandTuner.svelte
│   │   │   ├── Popover.svelte
│   │   │   ├── QrssPanel.svelte
│   │   │   ├── rnnoise.js     # φορτώνει το RNNoise για τη μείωση θορύβου AI
│   │   │   ├── SMeterAnalog.svelte
│   │   │   ├── SMeterDigital.svelte
│   │   │   ├── Spectrogram.svelte
│   │   │   ├── StatusIndicators.svelte
│   │   │   ├── storage.js
│   │   │   ├── Tooltip.svelte
│   │   │   ├── VersionSelector.svelte
│   │   │   ├── VideoAreaSelector.svelte
│   │   │   └── wrappers.js
│   │   ├── main.js
│   │   ├── mobile
│   │   │   ├── backend.js
│   │   │   ├── bookmarks.js
│   │   │   ├── main.js
│   │   │   ├── Mobile.svelte
│   │   │   └── tuning.js
│   │   ├── modeId.js
│   │   ├── modeId.worker.js
│   │   ├── modeIdWorkerProxy.js
│   │   ├── modePriors.js
│   │   ├── modules
│   │   │   ├── decode.wasm
│   │   │   ├── encode.wasm
│   │   │   ├── ft4.js
│   │   │   ├── ft8.js
│   │   │   ├── js8-decoder.js
│   │   │   ├── js8-format.js
│   │   │   ├── js8.js
│   │   │   ├── js8-reassembler.js
│   │   │   ├── js8-slots.js
│   │   │   ├── js8-tables.js
│   │   │   ├── package.json
│   │   │   ├── phantomsdrdsp_bg_fallback.js
│   │   │   ├── phantomsdrdsp_bg.js
│   │   │   ├── phantomsdrdsp_bg.wasm
│   │   │   ├── phantomsdrdsp_bg.wasm.d.ts
│   │   │   ├── phantomsdrdsp.d.ts
│   │   │   ├── phantomsdrdsp.js
│   │   │   ├── phantomsdrdsp_router.js
│   │   │   └── wspr.js
│   │   ├── olivia.js
│   │   ├── psk31.js
│   │   ├── refused.js
│   │   ├── remoteSource.js
│   │   ├── scanner.js
│   │   ├── sstv.js
│   │   ├── sstv.worker.js
│   │   ├── sstvWorkerProxy.js
│   │   ├── uberSource.js
│   │   ├── unused
│   │   │   ├── AudioProcessor.js
│   │   │   ├── decoder.js
│   │   │   ├── decoding.js
│   │   │   ├── modules-emscripten
│   │   │   │   ├── dav1d.js
│   │   │   │   ├── dav1dnoWasm.js
│   │   │   │   ├── dav1dnoWasm.js.mem
│   │   │   │   ├── dav1d.wasm
│   │   │   │   ├── decode_ft8.js
│   │   │   │   ├── decode_ft8.wasm
│   │   │   │   ├── FoxenFlac.js
│   │   │   │   ├── jsDSP.js
│   │   │   │   ├── jsDSPnoWasm.js
│   │   │   │   ├── jsDSPnoWasm.js.mem
│   │   │   │   ├── jsDSPnoWasm.wasm
│   │   │   │   ├── jsDSP.wasm
│   │   │   │   ├── libzstd.js
│   │   │   │   ├── LiquidDSP.js
│   │   │   │   ├── opus.js
│   │   │   │   ├── opusnoWasm.js
│   │   │   │   ├── opusnoWasm.js.mem
│   │   │   │   ├── opus.wasm
│   │   │   │   ├── redsea.js
│   │   │   │   └── redsea.wasm
│   │   │   ├── unused.js
│   │   │   └── wrappers.js
│   │   ├── videoRecorder.js
│   │   ├── vite-env.d.ts
│   │   ├── waterfall.js
│   │   ├── webSdrCodec.js
│   │   └── webSdrSource.js
│   ├── stats.html
│   ├── svelte.config.js
│   ├── tailwind.config.cjs
│   └── vite.config.js
├── go.sh                      # παλιά αλυσίδα εκκίνησης, αντικαταστάθηκε από τα start-<radio>.sh
├── install_arch.sh
├── install_fedora.sh
├── install_opensuse.sh
├── install_rade.sh
├── install_rade_ubuntu22.sh
├── install.sh
├── install-stats-server.sh
├── instructions-for-airspy
├── instructions-for-rsp1a
├── jsdsp
│   ├── compilejs.sh
│   ├── configureredsea.sh
│   ├── extract_EXPORTED_FUNCTIONS.js
│   ├── ft8_wasm
│   │   ├── build_ft8_wasm.sh
│   │   ├── README.md
│   │   └── wasm_wrapper.c
│   ├── include
│   │   ├── avif
│   │   │   ├── avif.h
│   │   │   └── internal.h
│   │   └── liquid
│   │       └── liquid.h
│   ├── js8_wasm               # αποκωδικοποιητής JS8 σε C, μεταγλωττισμένος σε WebAssembly, με τα τεστ και τον έλεγχο αναφοράς του — δείτε το README του
│   │   ├── build_js8_wasm.sh
│   │   ├── check_against_reference.sh
│   │   ├── extract_js8_constants.py
│   │   ├── extract_js8_varicode.py
│   │   ├── js8_ab_test.mjs
│   │   ├── js8_autorun_test.mjs
│   │   ├── js8_chain_test.mjs
│   │   ├── js8_constants.c
│   │   ├── js8_constants.h
│   │   ├── js8_decode.c
│   │   ├── js8_decode.h
│   │   ├── js8_decode_test.c
│   │   ├── js8_encode.c
│   │   ├── js8_encode.h
│   │   ├── js8_frames_test.mjs
│   │   ├── js8_osd.c
│   │   ├── js8_osd.h
│   │   ├── js8_reassembly_test.mjs
│   │   ├── js8_roundtrip.c
│   │   ├── js8_slots_test.mjs
│   │   ├── js8_subtract.c
│   │   ├── js8_subtract.h
│   │   ├── js8_wasm_test.mjs
│   │   ├── js8_wasm_wrapper.c
│   │   ├── README.md
│   │   ├── reference
│   │   │   ├── build_in_container.sh
│   │   │   ├── build_reference_decoder.sh
│   │   │   ├── build_reference_frames.sh
│   │   │   ├── Containerfile
│   │   │   ├── Containerfile.decoder
│   │   │   ├── ref_decode.f90
│   │   │   ├── ref_decode.txt
│   │   │   ├── ref_frames.cpp
│   │   │   └── ref_frames.txt
│   │   ├── ref_gen.f90
│   │   └── run_tests.sh
│   ├── lib
│   │   ├── ANR.c
│   │   ├── arm_funcs.h
│   │   ├── CMSIS_DSP
│   │   │   ├── BUILDING.txt
│   │   │   └── LICENSE.txt
│   │   ├── dav1d.cpp
│   │   ├── NB.c
│   │   ├── NR_spectral.c
│   │   └── types.h
│   ├── redsea.js
│   ├── redsea.wasm
│   └── src
│       ├── index.js
│       ├── libzstd.js
│       ├── LiquidDSP.js
│       ├── NoiseProcessing.js
│       └── wbfmpll.cpp
├── kill.sh                    # παλιό: τερματίζει τις διεργασίες, καλείται από το go.sh
├── kiwi_install.sh             # εγκαθιστά τη γέφυρα KiwiSDR σε υπάρχον δέντρο
├── LICENSE
├── logproxy                   # εναλλασσόμενα αντίγραφα των logs panel/proxy/autorun
├── logrotate
│   └── phantomsdr             # ρύθμιση logrotate για proxy.log + admin.log (διορθώστε τις διαδρομές πριν την εγκατάσταση)
├── manage_admin.sh
├── markers.json
├── meson.build
├── meson_options.txt
├── phantom_fftw_wisdom
├── phantomsdr-admin.service   # δείγμα μονάδας systemd για τον πίνακα διαχείρισης (εκκίνηση με το boot, επανεκκίνηση μετά από κατάρρευση)
├── phantomsdr-proxy.service   # δείγμα μονάδας systemd για τον διαμεσολαβητή, εγκαθίσταται μαζί με τη μονάδα του πίνακα
├── phantomsdr-websdr-relay.service  # δείγμα systemd unit για το relay diversity WebSDR
├── proxy.py
├── rade_helper.py
├── rade_loadtest.csv          # έξοδος του rade_loadtest.py (μία γραμμή ανά βήμα φόρτου)
├── rade_loadtest.py           # τεστ φόρτου RADE: πόσοι ταυτόχρονοι αποκωδικοποιητές αντέχει το μηχάνημα — δείτε docs/RADE_README.md
├── rade.sh
├── README.md
├── recompile.sh
├── _relaunch.sh               # παλιό: βοηθός καθυστερημένης επανεκκίνησης της αλυσίδας go.sh
├── request.hpp
├── setup_admin.sh
├── setup-airspyhf.sh          # αλυσίδα driver Airspy HF+: libairspyhf + SoapyAirspyHF + rx_sdr + udev
├── setup-cpufreq-perms.sh     # δίνει στην ομάδα δικαίωμα εγγραφής στο scaling_max_freq, ώστε η προστασία να περιορίζει τη συχνότητα χωρίς root
├── setup-firewall.sh          # προαιρετική προστασία nftables — δείτε docs/CONNECTION_LIMITS.md
├── setup-fobos.sh             # αλυσίδα driver Fobos: libfobos + SoapyFobosSDR + rx_sdr + cf32_to_real + udev
├── setup-hackrf.sh            # HackRF: πακέτο hackrf της διανομής + udev (τίποτα δεν χτίζεται)
├── setup-rsp1a.sh             # αλυσίδα driver RSP1A: libmirisdr-5 + SoapyMiri + rx_sdr + blacklist msi2500 + udev
├── setup-rx888-udev.sh
├── setup-sdr-common.sh        # κοινές βοηθητικές συναρτήσεις των τριών setup scripts παραπάνω
├── setup_websdr_relay.sh      # εγκαθιστά το relay diversity για WebSDR (θύρα, ταυτότητα, systemd)
├── smeter_theme.sh
├── src
│   ├── audio.cpp
│   ├── audio.h
│   ├── chat.cpp
│   ├── chat.h
│   ├── client.cpp
│   ├── client.h
│   ├── compression.cpp
│   ├── compression.h
│   ├── crash_handler.cpp
│   ├── crash_handler.h
│   ├── events.cpp
│   ├── events.h
│   ├── fft.cpp
│   ├── fft_cuda.cu
│   ├── fft.h
│   ├── fft_impl.cpp
│   ├── fft_mkl.cpp
│   ├── http.cpp
│   ├── kiwi_bridge.h          # γέφυρα πρωτοκόλλου KiwiSDR — βλ. docs/Aether_config.md
│   ├── listing
│   │   ├── software_info.cpp
│   │   └── software_info.h
│   ├── samplereader.cpp
│   ├── samplereader.h
│   ├── signal.cpp
│   ├── signal.h
│   ├── spectrumserver.cpp
│   ├── spectrumserver.h
│   ├── utils
│   │   ├── audioprocessing.cpp
│   │   ├── audioprocessing.h
│   │   ├── dsp.cpp
│   │   └── dsp.h
│   ├── utils.cpp
│   ├── utils.h
│   ├── waterfallcompression.cpp
│   ├── waterfallcompression.h
│   ├── waterfall.cpp
│   ├── waterfall.h
│   ├── websocket.cpp
│   └── websocket.h
├── start-airspyhf.sh
├── start-fobos-hf.sh
├── start-fobos.sh
├── start-hackrf.sh
├── start-rsp1a.sh
├── start-rtl.sh
├── start-rx888mk2.sh
├── stop-websdr.sh
├── subprojects
│   ├── fftw3.wrap
│   ├── flac.wrap
│   ├── glaze.wrap
│   ├── libcds.wrap
│   ├── libflac.wrap
│   ├── libvolk.wrap
│   ├── ogg.wrap
│   ├── opus.wrap
│   ├── tomlplusplus-3.4.0
│   │   ├── CHANGELOG.md
│   │   ├── cmake
│   │   │   ├── install-rules.cmake
│   │   │   ├── project-is-top-level.cmake
│   │   │   ├── tomlplusplusConfig.cmake
│   │   │   ├── tomlplusplusConfig.cmake.meson.in
│   │   │   ├── tomlplusplusConfigVersion.cmake.meson.in
│   │   │   └── variables.cmake
│   │   ├── CMakeLists.txt
│   │   ├── CODE_OF_CONDUCT.md
│   │   ├── CONTRIBUTING.md
│   │   ├── cpp.hint
│   │   ├── docs
│   │   │   ├── images
│   │   │   │   ├── badge-awesome.svg
│   │   │   │   ├── badge-C++17.svg
│   │   │   │   ├── badge-gitter.svg
│   │   │   │   ├── badge-license-MIT.svg
│   │   │   │   ├── badge-TOML.svg
│   │   │   │   ├── banner.ai
│   │   │   │   ├── banner.png
│   │   │   │   ├── banner.svg
│   │   │   │   ├── favicon.ico
│   │   │   │   ├── logo.ai
│   │   │   │   └── logo.svg
│   │   │   ├── pages
│   │   │   │   └── main_page.md
│   │   │   └── poxy.toml
│   │   ├── examples
│   │   │   ├── benchmark_data.toml
│   │   │   ├── CMakeLists.txt
│   │   │   ├── error_printer.cpp
│   │   │   ├── error_printer.vcxproj
│   │   │   ├── examples.hpp
│   │   │   ├── example.toml
│   │   │   ├── merge_base.toml
│   │   │   ├── merge_overrides.toml
│   │   │   ├── meson.build
│   │   │   ├── parse_benchmark.cpp
│   │   │   ├── parse_benchmark.vcxproj
│   │   │   ├── simple_parser.cpp
│   │   │   ├── simple_parser.vcxproj
│   │   │   ├── toml_generator.cpp
│   │   │   ├── toml_generator.vcxproj
│   │   │   ├── toml_merger.cpp
│   │   │   ├── toml_merger.vcxproj
│   │   │   ├── toml_to_json_transcoder.cpp
│   │   │   └── toml_to_json_transcoder.vcxproj
│   │   ├── include
│   │   │   ├── meson.build
│   │   │   └── toml++
│   │   │       ├── impl
│   │   │       │   ├── array.hpp
│   │   │       │   ├── array.inl
│   │   │       │   ├── at_path.hpp
│   │   │       │   ├── at_path.inl
│   │   │       │   ├── date_time.hpp
│   │   │       │   ├── formatter.hpp
│   │   │       │   ├── formatter.inl
│   │   │       │   ├── forward_declarations.hpp
│   │   │       │   ├── header_end.hpp
│   │   │       │   ├── header_start.hpp
│   │   │       │   ├── json_formatter.hpp
│   │   │       │   ├── json_formatter.inl
│   │   │       │   ├── key.hpp
│   │   │       │   ├── make_node.hpp
│   │   │       │   ├── node.hpp
│   │   │       │   ├── node.inl
│   │   │       │   ├── node_view.hpp
│   │   │       │   ├── parse_error.hpp
│   │   │       │   ├── parse_result.hpp
│   │   │       │   ├── parser.hpp
│   │   │       │   ├── parser.inl
│   │   │       │   ├── path.hpp
│   │   │       │   ├── path.inl
│   │   │       │   ├── preprocessor.hpp
│   │   │       │   ├── print_to_stream.hpp
│   │   │       │   ├── print_to_stream.inl
│   │   │       │   ├── simd.hpp
│   │   │       │   ├── source_region.hpp
│   │   │       │   ├── std_except.hpp
│   │   │       │   ├── std_initializer_list.hpp
│   │   │       │   ├── std_map.hpp
│   │   │       │   ├── std_new.hpp
│   │   │       │   ├── std_optional.hpp
│   │   │       │   ├── std_string.hpp
│   │   │       │   ├── std_string.inl
│   │   │       │   ├── std_utility.hpp
│   │   │       │   ├── std_variant.hpp
│   │   │       │   ├── std_vector.hpp
│   │   │       │   ├── table.hpp
│   │   │       │   ├── table.inl
│   │   │       │   ├── toml_formatter.hpp
│   │   │       │   ├── toml_formatter.inl
│   │   │       │   ├── unicode_autogenerated.hpp
│   │   │       │   ├── unicode.hpp
│   │   │       │   ├── unicode.inl
│   │   │       │   ├── value.hpp
│   │   │       │   ├── version.hpp
│   │   │       │   ├── yaml_formatter.hpp
│   │   │       │   └── yaml_formatter.inl
│   │   │       ├── toml.h
│   │   │       └── toml.hpp
│   │   ├── LICENSE
│   │   ├── meson.build
│   │   ├── meson_options.txt
│   │   ├── README.md
│   │   ├── src
│   │   │   ├── meson.build
│   │   │   └── toml.cpp
│   │   ├── tests
│   │   │   ├── at_path.cpp
│   │   │   ├── conformance_burntsushi_invalid.cpp
│   │   │   ├── conformance_burntsushi_valid.cpp
│   │   │   ├── conformance_iarna_invalid.cpp
│   │   │   ├── conformance_iarna_valid.cpp
│   │   │   ├── cpp.hint
│   │   │   ├── for_each.cpp
│   │   │   ├── formatters.cpp
│   │   │   ├── impl_toml.cpp
│   │   │   ├── leakproof.hpp
│   │   │   ├── lib_catch2.hpp
│   │   │   ├── main.cpp
│   │   │   ├── manipulating_arrays.cpp
│   │   │   ├── manipulating_parse_result.cpp
│   │   │   ├── manipulating_tables.cpp
│   │   │   ├── manipulating_values.cpp
│   │   │   ├── meson.build
│   │   │   ├── odr_test_1.cpp
│   │   │   ├── odr_test_2.cpp
│   │   │   ├── parsing_arrays.cpp
│   │   │   ├── parsing_booleans.cpp
│   │   │   ├── parsing_comments.cpp
│   │   │   ├── parsing_dates_and_times.cpp
│   │   │   ├── parsing_floats.cpp
│   │   │   ├── parsing_integers.cpp
│   │   │   ├── parsing_key_value_pairs.cpp
│   │   │   ├── parsing_spec_example.cpp
│   │   │   ├── parsing_strings.cpp
│   │   │   ├── parsing_tables.cpp
│   │   │   ├── path.cpp
│   │   │   ├── settings.hpp
│   │   │   ├── tests.cpp
│   │   │   ├── tests.hpp
│   │   │   ├── user_feedback.cpp
│   │   │   ├── using_iterators.cpp
│   │   │   ├── visit.cpp
│   │   │   ├── vs
│   │   │   │   ├── odr_test.vcxproj
│   │   │   │   ├── test_debug_x64_cpplatest_noexcept_unrel.vcxproj
│   │   │   │   ├── test_debug_x64_cpplatest_noexcept.vcxproj
│   │   │   │   ├── test_debug_x64_cpplatest_unrel.vcxproj
│   │   │   │   ├── test_debug_x64_cpplatest.vcxproj
│   │   │   │   ├── test_debug_x64_noexcept_unrel.vcxproj
│   │   │   │   ├── test_debug_x64_noexcept.vcxproj
│   │   │   │   ├── test_debug_x64_unrel.vcxproj
│   │   │   │   ├── test_debug_x64.vcxproj
│   │   │   │   ├── test_debug_x86_cpplatest_noexcept_unrel.vcxproj
│   │   │   │   ├── test_debug_x86_cpplatest_noexcept.vcxproj
│   │   │   │   ├── test_debug_x86_cpplatest_unrel.vcxproj
│   │   │   │   ├── test_debug_x86_cpplatest.vcxproj
│   │   │   │   ├── test_debug_x86_noexcept_unrel.vcxproj
│   │   │   │   ├── test_debug_x86_noexcept.vcxproj
│   │   │   │   ├── test_debug_x86_unrel.vcxproj
│   │   │   │   ├── test_debug_x86.vcxproj
│   │   │   │   ├── test_release_x64_cpplatest_noexcept_unrel.vcxproj
│   │   │   │   ├── test_release_x64_cpplatest_noexcept.vcxproj
│   │   │   │   ├── test_release_x64_cpplatest_unrel.vcxproj
│   │   │   │   ├── test_release_x64_cpplatest.vcxproj
│   │   │   │   ├── test_release_x64_noexcept_unrel.vcxproj
│   │   │   │   ├── test_release_x64_noexcept.vcxproj
│   │   │   │   ├── test_release_x64_unrel.vcxproj
│   │   │   │   ├── test_release_x64.vcxproj
│   │   │   │   ├── test_release_x86_cpplatest_noexcept_unrel.vcxproj
│   │   │   │   ├── test_release_x86_cpplatest_noexcept.vcxproj
│   │   │   │   ├── test_release_x86_cpplatest_unrel.vcxproj
│   │   │   │   ├── test_release_x86_cpplatest.vcxproj
│   │   │   │   ├── test_release_x86_noexcept_unrel.vcxproj
│   │   │   │   ├── test_release_x86_noexcept.vcxproj
│   │   │   │   ├── test_release_x86_unrel.vcxproj
│   │   │   │   └── test_release_x86.vcxproj
│   │   │   └── windows_compat.cpp
│   │   ├── toml++.code-workspace
│   │   ├── toml.hpp
│   │   ├── toml++.natvis
│   │   ├── toml++.props
│   │   ├── toml++.sln
│   │   ├── toml-test
│   │   │   ├── meson.build
│   │   │   ├── README.md
│   │   │   ├── tt_decoder.cpp
│   │   │   ├── tt_decoder.vcxproj
│   │   │   ├── tt_encoder.cpp
│   │   │   ├── tt_encoder.vcxproj
│   │   │   └── tt.hpp
│   │   ├── toml++.vcxproj
│   │   ├── toml++.vcxproj.filters
│   │   ├── tools
│   │   │   ├── ci_single_header_check.py
│   │   │   ├── clang_format.bat
│   │   │   ├── generate_conformance_tests.py
│   │   │   ├── generate_single_header.bat
│   │   │   ├── generate_single_header.py
│   │   │   ├── generate_windows_test_targets.py
│   │   │   ├── requirements.txt
│   │   │   ├── utils.py
│   │   │   └── version.py
│   │   └── vendor
│   │       ├── catch.hpp
│   │       ├── json.hpp
│   │       └── README.md
│   ├── tomlplusplus.wrap
│   ├── websocketpp.wrap
│   ├── zlib.wrap
│   └── zstd.wrap
├── tci-bridge
│   └── tci-rigctld.mjs        # διακομιστής TCI για πομποδέκτες Hamlib (IC-7300…), τρέχει στον υπολογιστή του ακροατή — βλ. docs/RIG_CONTROL.md
├── thermal_guard.py           # Προστασία υπερθέρμανσης CPU για τον πίνακα διαχείρισης (τρέχει και αυτόνομα)
├── thermal-guard.service      # δείγμα μονάδας systemd για την προστασία, χωρίς πίνακα διαχείρισης
├── tmpfiles
│   └── phantomsdr-logs.conf   # κρατά τα admin.log + proxy.log στην ιδιοκτησία του χρήστη του πίνακα (διορθώστε τις διαδρομές πριν την εγκατάσταση)
├── update.sh
├── waterfall.sh
├── websdr_relay.json.example  # πρότυπο ρυθμίσεων (θύρα, όρια, ταυτότητα σταθμού)
├── websdr_relay.py            # το ίδιο το relay — δείτε docs/RECEIVE_DIVERSITY.md
├── websocketpp_asio_connection.hpp  # shim για Boost >= 1.87: ws_post αντί για io_service::post
├── websocketpp_asio_endpoint.hpp    # shim για Boost >= 1.87: ws_work / ws_restart, max_listen_connections
├── websocketpp_asio.hpp        # shim για Boost >= 1.87 στο websocketpp (io_context, executor_work_guard)
└── xgo.sh                     # παλιό: ξεκινά τον spectrumserver, καλείται από το check-go.sh
```
---

## Ριζικός κατάλογος

### Αρχεία ρυθμίσεων

| Αρχείο | Σκοπός | Πότε το τροποποιείτε |
|--------|--------|-----------------------|
| `config.toml` | Προεπιλεγμένες ρυθμίσεις | Αρχική εγκατάσταση, δοκιμές |
| `config-rtl.toml` | Ρυθμίσεις ειδικά για RTL-SDR | Χρήση συσκευής RTL-SDR |
| `config-rsp1a.toml` | Ρυθμίσεις SDRplay RSP1A | Χρήση συσκευής RSP1A |
| `config-airspyhf.toml` | Ρυθμίσεις Airspy HF+ | Χρήση συσκευής Airspy |
| `config-fobos-hf.toml` | RigExpert Fobos SDR, HF1/HF2 με άμεση δειγματοληψία (0-25 MHz) | Χρήση Fobos στα HF |
| `config-fobos.toml` | RigExpert Fobos SDR, κλάδος RF (25-6000 MHz) | Χρήση Fobos πάνω από 25 MHz |
| `config-hackrf.toml` | Ρυθμίσεις HackRF One | Χρήση HackRF |
| `config-rx888mk2.toml` | Ρυθμίσεις RX888 MK2 | Χρήση συσκευής RX888 |
| `config.example.hackrf.toml` | Παράδειγμα HackRF One | Χρήση συσκευής HackRF |

### Σενάρια εκκίνησης/διακοπής και συντήρησης

Καθένα από τα παρακάτω `start-*.sh` είναι **αυτόνομος εκκινητής + watchdog + καταγραφέας**: σταματά κάθε στιγμιότυπο που εκτελείται, ανεβάζει τον δέκτη + τον `spectrumserver`, αποσυνδέεται στο παρασκήνιο, επανεκκινεί αυτόματα την αλυσίδα αν τερματιστεί και καταγράφει στο `logwebsdr.txt`. Μοιράζονται ένα κοινό σενάριο διακοπής και ένα μοναδικό κλείδωμα `flock` (εκτελείται μόνο ένας δέκτης κάθε φορά). Επεξεργαστείτε μόνο το τμήμα **RECEIVER CONFIGURATION** στην αρχή καθενός (ορίσματα δέκτη / ρυθμίσεις / όνομα διεργασίας). Τα έξι scripts εκκίνησης από το ίδιο πρότυπο (`start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos.sh`, `start-fobos-hf.sh`, `start-hackrf.sh`) είναι πανομοιότυπα κάτω από αυτό το τμήμα· το `start-rx888mk2.sh` είναι ξεχωριστό script.

| Σενάριο | Σκοπός |
|---------|--------|
| `install.sh` | Αυτοματοποιημένη εγκατάσταση και μεταγλώττιση |
| `start-rtl.sh` | Εκκίνηση + watchdog του διακομιστή με RTL-SDR (`rtl_sdr`) |
| `start-rsp1a.sh` | Εκκίνηση + watchdog του διακομιστή με SDRplay RSP1A (`rx_sdr`)· χρησιμοποιεί το libmirisdr-5, ή το API της SDRplay όταν είναι εγκατεστημένο (το `RX_DRIVER` επιβάλλει έναν) |
| `start-airspyhf.sh` | Εκκίνηση + watchdog του διακομιστή με Airspy HF+ (`rx_sdr`) |
| `start-fobos-hf.sh` | Εκκίνηση + watchdog του διακομιστή με RigExpert Fobos SDR, HF1/HF2 με άμεση δειγματοληψία (`rx_sdr \| cf32_to_real`) |
| `start-fobos.sh` | Εκκίνηση + watchdog του διακομιστή με RigExpert Fobos SDR, κλάδος RF (`rx_sdr`) |
| `start-hackrf.sh` | Εκκίνηση + watchdog του διακομιστή με HackRF One (`hackrf_transfer`) |
| `start-rx888mk2.sh` | Εκκίνηση + watchdog του διακομιστή με RX888 MK2 (`rx888_stream`) |
| `stop-websdr.sh` | Διακοπή του διακομιστή και του watchdog του — κοινό για όλους τους δέκτες |
| `setup-rx888-udev.sh` | Εγκαθιστά κανόνες udev ώστε το `rx888_stream` του RX-888 να τρέχει χωρίς sudo |
| `setup-rsp1a.sh` / `setup-fobos.sh` / `setup-airspyhf.sh` | Εγκαθιστούν την αλυσίδα driver SoapySDR για RSP1A, Fobos ή Airspy HF+ — SoapySDR από τη διανομή, driver και rx_tools χτισμένα στο `sdr_drivers/`, κανόνας udev — σε οποιαδήποτε από τις τέσσερις υποστηριζόμενες διανομές. Τα καλούν οι επιλογές 3, 5 και 6 του προγράμματος εγκατάστασης· τρέχουν και μόνα τους. Κοινός κώδικας στο `setup-sdr-common.sh` — δείτε τον [Οδηγό εγκατάστασης](INSTALLATION.md#δέκτες-μέσω-soapysdr-rsp1a-fobos-airspy-hf) |
| `setup-hackrf.sh` | Εγκαθιστά το πακέτο `hackrf` της διανομής και κανόνα udev για τον HackRF One, σε οποιαδήποτε από τις τέσσερις υποστηριζόμενες διανομές· το καλεί η επιλογή 7 του προγράμματος εγκατάστασης |
| `setup-firewall.sh` | Προαιρετική προστασία από πλημμύρα σε επίπεδο πυρήνα: φορτώνει έναν πίνακα nftables με ταβάνι ταυτόχρονων συνδέσεων και ρυθμό ανά διεύθυνση προέλευσης στις θύρες του δέκτη, φρένο για επιθέσεις στο SSH, και το Windows file sharing κλειστό εκτός ιδιωτικών περιοχών. Χρειάζεται root, δεν μπορεί να σας κλειδώσει έξω (policy accept, οι εδραιωμένες συνδέσεις γίνονται δεκτές πρώτες) και το `--apply` αναιρείται μόνο του αν δεν επιβεβαιωθεί μέσα σε 60 δευτ. — δείτε [Όρια συνδέσεων](CONNECTION_LIMITS.md) |
| `setup-cpufreq-perms.sh` | Δίνει σε μια ομάδα `cpufreq` δικαίωμα εγγραφής στο όριο συχνότητας της CPU, ώστε το στάδιο throttle της θερμικής προστασίας να δουλεύει χωρίς root. Εγκαθιστά κανόνα `tmpfiles.d` ώστε να επιβιώνει επανεκκίνησης· το `--revoke` το αναιρεί |
| `update.sh` | Ενημέρωση της εγκατάστασης από το δημοσιευμένο δέντρο, χωρίς να θιγούν η διαμόρφωση, οι σημάνσεις, η λίστα συχνοτήτων και οι δικές σας αλλαγές — δείτε τον [Οδηγό εγκατάστασης](INSTALLATION.md) |
| `recompile.sh` | Ανακατασκευή backend ή/και frontend, και επιλογή της παραλλαγής που σερβίρεται στο `/` |
| `smeter_theme.sh` | Ορισμός της προεπιλεγμένης όψης του αναλογικού S-meter (dark / amber / vintage) για όλους τους χρήστες, με προσφορά ανακατασκευής του frontend — δείτε [Επεξεργασία παραλλαγών](EDITING_VARIANTS.md) |
| `waterfall.sh` | Αλλάζει το προεπιλεγμένο ελάχιστο επίπεδο καταρράκτη (dB) σε `waterfall.js` + `App.svelte` — δείτε το [README](README.md) |
| `kiwi_install.sh` | Εγκαθιστά την εξομοίωση πελατών KiwiSDR σε δέντρο που δεν την έχει: διορθώνει τις πηγές του backend, αντιγράφει το `src/kiwi_bridge.h` και προσθέτει τεκμηριωμένο μπλοκ `[kiwi_emulation]` στα αρχεία ρυθμίσεων της ρίζας. Ταυτοδύναμο, και κρατά αντίγραφο κάθε αρχείου που αγγίζει — βλ. [Εξομοίωση πελατών KiwiSDR](Aether_config.md) |
| `tci-bridge/tci-rigctld.mjs` | Δεν χρησιμοποιείται από τον δέκτη. Ένα μικρό πρόγραμμα Node.js που τρέχει ο ακροατής δίπλα στον δικό του πομποδέκτη: διαβάζει συχνότητα, τρόπο λειτουργίας και κατάσταση εκπομπής από το `rigctld` του Hamlib και τα προσφέρει ως TCI στη θύρα 50001, ώστε το κουμπί **TCI-CAT** της σελίδας να ελέγχει πομποδέκτη χωρίς δικό του TCI, όπως το IC-7300 — βλ. [Έλεγχος πομποδέκτη](RIG_CONTROL.md) |

**Παλιά αλυσίδα εκκίνησης.** Τα `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh` και `_relaunch.sh` είναι η προηγούμενη γενιά scripts εκκίνησης, επιτήρησης και τερματισμού. Ό,τι έκαναν βρίσκεται πλέον μέσα σε κάθε `start-<radio>.sh`, και αυτό είναι που πρέπει να χρησιμοποιείτε. Παραμένουν στον δίσκο επειδή υπάρχουσες εγκαταστάσεις τα αναφέρουν, και δεν συντηρούνται.

### Αρχεία δεδομένων

| Αρχείο | Σκοπός | Μορφή |
|--------|--------|-------|
| `markers.json` | Σελιδοδείκτες και δείκτες συχνοτήτων | JSON |
| `chat_history.txt` | Μηνύματα συνομιλίας χρηστών | Απλό κείμενο |
| `favicon.ico` | Εικονίδιο ιστότοπου | Εικόνα ICO |
| `fftw_wisdom` | Δεδομένα βελτιστοποίησης FFT | Δυαδικό FFTW |
| `phantom_fftw_wisdom` | Πρόσθετη βελτιστοποίηση FFT | Δυαδικό FFTW |

### Πίνακας διαχείρισης και αναφορά spot

| Αρχείο | Σκοπός |
|--------|--------|
| `admin_server.py` | Ο ίδιος ο πίνακας διαχείρισης. Πέρα από τις σελίδες διαχείρισης εκτελεί τον δειγματολήπτη της σελίδας **Γραφήματα**: ένα νήμα παρασκηνίου καταγράφει κάθε 2 δευτερόλεπτα συχνότητα CPU, φόρτο, θερμοκρασία και συνδεδεμένους χρήστες και τα κρατά μόνο στη μνήμη — 1 ώρα σε πλήρη ανάλυση συν 24 ώρες σε μέσους όρους 30 δευτερολέπτων. Τίποτα δεν γράφεται στον δίσκο, οπότε το ιστορικό χάνεται με την επανεκκίνηση. |
| `admin_config.json` | Ρυθμίσεις του πίνακα διαχείρισης (hash κωδικού, θύρες, επιλογές, όρια θερμικής προστασίας) |
| `thermal_guard.py` | Προστασία υπερθέρμανσης της CPU. Σταματά τον διακομιστή όταν η CPU ζεσταθεί υπερβολικά και τον επανεκκινεί μόλις κρυώσει, με όρια που προκύπτουν από το κρίσιμο όριο που δημοσιεύει η ίδια σας η CPU αντί για έναν σταθερό αριθμό. Δεν προσπαθεί ποτέ να αναγνωρίσει τι επιβλέπει τον διακομιστή — όσο η CPU είναι υπερθερμασμένη επαναλαμβάνει την εντολή διακοπής κάθε 2 δευτερόλεπτα, ώστε ένας watchdog, μια μονάδα systemd ή μια εργασία cron που τον επαναφέρει να αναιρείται μέχρι να κρυώσει το μηχάνημα. Χρησιμοποιεί μόνο τη standard library· εισάγεται από το `admin_server.py` (με χρονισμό από τον δειγματολήπτη των Γραφημάτων) και τρέχει και αυτόνομα σε εγκαταστάσεις χωρίς τον πίνακα. Από προεπιλογή μόνο καταγράφει, οπότε δεν ενεργεί σε τίποτα μέχρι να ενεργοποιηθεί — δείτε [Πίνακας διαχείρισης]δείτε το [εγχειρίδιο Thermal Guard](THERMAL_GUARD.md) |
| `autorun/` | Ο δαίμονας αναφοράς spot — δείτε [Autorun Spot Reporter](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr) |
| `autorun.json` | Μπάντες/τρόποι προς αποκωδικοποίηση, στοιχεία ταυτότητας και προορισμοί |
| `autorun-status.json` | Τρέχουσα κατάσταση του δαίμονα — τροφοδοτεί τους μετρητές **της τρέχουσας εκτέλεσης** (τα πλακίδια ανά αποκωδικοποιητή), που μηδενίζονται με Stop/Start |
| `autorun-totals.json` | **Συνολικά** ανεβασμένα spot ανά μπάντα και τρόπο — ο αριθμός δίπλα σε κάθε πλαίσιο ελέγχου· γράφεται από τον δαίμονα ώστε να επιβιώνει των επανεκκινήσεων |

### Αρχεία του συστήματος μεταγλώττισης

| Αρχείο | Σκοπός |
|--------|--------|
| `meson.build` | Κύρια ρύθμιση μεταγλώττισης |
| `meson_options.txt` | Παραμετροποιήσιμες επιλογές μεταγλώττισης |
| `.gitattributes` | Ιδιότητες του αποθετηρίου Git |

---

## Πηγαίος κώδικας (`src/`)

Ο κατάλογος `src/` περιέχει την υλοποίηση του backend σε C++.

### Βασικά στοιχεία

#### 1. Κύρια εφαρμογή (`main.cpp`)
- Αναλύει τα ορίσματα της γραμμής εντολών
- Φορτώνει το αρχείο ρυθμίσεων
- Αρχικοποιεί τα στοιχεία του διακομιστή
- Ξεκινά τον βρόχο συμβάντων

#### 2. Διακομιστής φάσματος (`spectrumserver.cpp`)
- Συντονίζει όλα τα στοιχεία
- Διαχειρίζεται τις συνδέσεις χρηστών
- Διανέμει τα δεδομένα φάσματος
- Χειρίζεται τα αιτήματα χρηστών

#### 3. Οδηγοί SDR (`drivers/`)
- Αφηρημένη διεπαφή για το υλικό SDR
- Ανάγνωση και μορφοποίηση δεδομένων δειγμάτων
- Χειρισμός λειτουργιών ειδικών ανά συσκευή

#### 4. Μηχανή DSP (`dsp/`)
- Υπολογισμός FFT (με επιτάχυνση CPU/GPU)
- Αποδιαμόρφωση (AM, FM, SSB, CW κ.λπ.)
- Φιλτράρισμα και επαναδειγματοληψία ήχου
- AGC και μείωση θορύβου

#### 5. Διακομιστής web (`server/`)
- Επικοινωνία WebSocket
- Εξυπηρέτηση στατικών αρχείων HTTP
- Διαχείριση συνεδριών χρηστών
- Ροή δεδομένων σε πραγματικό χρόνο

#### 6. Κωδικοποίηση ήχου (`audio/`)
- Συμπίεση FLAC
- Συμπίεση Opus
- Βελτιστοποίηση ροής

---

## Frontend (`frontend/`)

Η διεπαφή χρήστη βασισμένη στο web, κατασκευασμένη με Svelte και Vite.


#### 1. Κύρια εφαρμογή (`App.svelte`)
- Στοιχείο ανώτατου επιπέδου
- Δομή διάταξης
- Ενορχήστρωση στοιχείων
- **Σειρά κουμπιών αποκωδικοποιητών** — ένα κουμπί ανά αποκωδικοποιητή στον κύριο πίνακα, ακριβώς κάτω από τον επιλογέα τρόπων· ένα πάτημα ξεκινά τον αποκωδικοποιητή και ανοίγει το παράθυρό του, δεύτερο πάτημα τον σταματά. Αντικατέστησε την παλιά σειρά Bandwidth. Τα RADEL/RADEU βρίσκονται στο `lib/ModesSelector.svelte`, δίπλα στον επιλογέα τρόπων και μέσα στα αναδυόμενα παράθυρα **Modes** και **Bands**.

#### 2. Οθόνη καταρράκτη (`waterfall.js` + `lib/`)
- Σχεδίαση φάσματος και καταρράκτη σε canvas, χρωματικοί χάρτες και η προσαρμοστική αυτόματη ρύθμιση, όλα στο `waterfall.js` (καθαρή JS, όχι στοιχείο)
- Διαδραστικός συντονισμός μέσω του `lib/PassbandTuner.svelte`
- Επικαλύψεις σχεδίου μπαντών και δεικτών μέσω του `lib/FrequencyMarkers.svelte`
- Το φασματογράφημα ήχου είναι ξεχωριστό στοιχείο: `lib/Spectrogram.svelte`

#### 3. Χειριστήρια (`App.svelte` + `lib/`)
- Εισαγωγή/ένδειξη συχνότητας — `lib/FrequencyInput.svelte`
- Επιλογή τρόπου (AM/FM/SSB/CW) — `lib/ModesSelector.svelte`, αλλαγή μπάντας — `lib/BandSelector.svelte`
- Τα AGC/NR/NB και τα υπόλοιπα χειριστήρια βρίσκονται στο ίδιο το `App.svelte`· δεν υπάρχει ξεχωριστό `Controls.svelte`

#### 3a. Σαρωτής (`scanner.js`)
- Σαρωτής καναλιών: μετακινεί τον δέκτη σε μια περιοχή και σταματά στο πρώτο κανάλι με σήμα. Καθαρή JS, όχι component — το `App.svelte` δίνει τον VFO, τον τρόπο λειτουργίας, το σχέδιο μπαντών και την κλήση συντονισμού, και παίρνει πίσω την κατάσταση του UI μέσω μίας συνάρτησης επιστροφής
- Το κατώφλι είναι dB πάνω από τον θόρυβο βάθους της μπάντας αντί για απόλυτη στάθμη, χρησιμοποιώντας τον θόρυβο που ήδη παρακολουθεί το `waterfall.js` (`snrNoiseDb`), οπότε δεν χρειάζεται δική του βαθμονόμηση
- Δύο τρόποι διάσχισης: συντονισμός και ακρόαση κάθε καναλιού, ή πρώτα έλεγχος του φάσματος και συντονισμός μόνο σε όσα δεν αποκλείονται. Το φάσμα μπορεί να παραλείψει κανάλι, ποτέ όμως να σταματήσει σε ένα — κάθε στάση προκύπτει από πραγματική παραμονή
- Η περιοχή είναι είτε η μπάντα του σχεδίου μπαντών είτε ακριβώς ό,τι δείχνει ο καταρράκτης· η αυτόματη συνέχιση, ο μέγιστος χρόνος παραμονής και η λίστα αποκλεισμού βρίσκονται επίσης εδώ και αποθηκεύονται στο `localStorage`

#### 4. Σύστημα ήχου (`audio.js`)
- Ροή ήχου μέσω WebSocket
- Αποκωδικοποίηση FLAC/Opus
- Έλεγχος αναπαραγωγής ήχου
- Διανέμει ακατέργαστο PCM (που λαμβάνεται πριν από AGC, μείωση θορύβου και σίγαση) στους αποκωδικοποιητές τρόπων
- Μείωση θορύβου AI: το `lib/rnnoise.js` φορτώνει τη μονάδα WebAssembly του RNNoise (`@jitsi/rnnoise-wasm`) με την πρώτη χρήση· το `audio.js` την εφαρμόζει μόνο σε φωνητικούς τρόπους, μετά το σημείο λήψης των αποκωδικοποιητών, ώστε αυτοί να μην την «ακούν» ποτέ

#### 4α. Αποκωδικοποιητές τρόπων και οι workers τους

Κάθε ένας από τους βαρείς αποκωδικοποιητές τρόπων εκτελείται σε δικό του Web Worker, ώστε η αποκωδικοποίηση να μη μπλοκάρει ποτέ την αναπαραγωγή ήχου ή τον καταρράκτη. Ακολουθούν κοινό μοτίβο — τρία αρχεία ανά αποκωδικοποιητή:

| Αποκωδικοποιητής | Μηχανή | Worker | Proxy στο κύριο νήμα |
|------------------|--------|--------|------------------------|
| SSTV | `sstv.js` | `sstv.worker.js` | `sstvWorkerProxy.js` |
| HF FAX | `fax.js` | `fax.worker.js` | `faxWorkerProxy.js` |
| NAVTEX + FSK/RTTY + PSK31 + Olivia | `fsk.js`, `psk31.js`, `olivia.js` | `fsk.worker.js` | `fskWorkerProxy.js` |
| CW | `cwDecoder.js` | `cw.worker.js` | `cwWorkerProxy.js` |

- Η **μηχανή** είναι καθαρός κώδικας DSP που αγνοεί την ύπαρξη workers, οπότε μπορεί να εκτελεστεί και απευθείας (δοκιμές μονάδας ή εφεδρική εκτέλεση στο ίδιο νήμα).
- Ο **worker** κρατά ένα στιγμιότυπο της μηχανής και προωθεί αυτούσια τα συμβάντά της.
- Το **proxy** αντικατοπτρίζει τις μεθόδους της μηχανής, ώστε το `audio.js` να το καλεί ακριβώς όπως θα καλούσε τον αποκωδικοποιητή. Δημιουργεί τον worker με καθυστέρηση, στην πρώτη ενεργοποίηση, και επιστρέφει σε εκτέλεση στο ίδιο νήμα αν οι workers δεν είναι διαθέσιμοι.

Δύο λεπτομέρειες είναι κρίσιμες: το PCM **αντιγράφεται** σε νέο ενταμιευτή πριν μεταφερθεί στον worker (η μεταφορά μιας όψης του συσσωρευτή ήχου θα τον αποσπούσε και θα σκότωνε την αναπαραγωγή), και το μήνυμα `init` του worker επανεφαρμόζει τις ρυθμίσεις σε μια ήδη εκτελούμενη μηχανή αντί να υποθέτει καινούργια.

Το `fsk.js` εξυπηρετεί τόσο το NAVTEX όσο και το FSK/RTTY από μία μηχανή, με επιλογή ανά στιγμιότυπο μέσω ενός πεδίου `role`· κάθε στιγμιότυπο έχει δική του κατάσταση, οπότε τα δύο μπορούν να τρέχουν ανεξάρτητα.

Ο ρόλος `fsk` φιλοξενεί επιπλέον δύο αποκωδικοποιητές που δεν είναι καθόλου FSK. Επιλέγοντας την παραλλαγή `psk31` ή `olivia`, το `fsk.js` παραδίδει τον ήχο στο `psk31.js` ή στο `olivia.js` αντί για τη δική του αλυσίδα διευκρινιστή, δανειζόμενο ωστόσο τη διαμόρφωση, τον worker και τη διαχείριση συμβάντων του — έτσι τα `fsk.worker.js`, `fskWorkerProxy.js` και `audio.js` δεν χρειάζεται να γνωρίζουν τίποτε για τους δύο τρόπους, και το περιβάλλον χρήστη καταναλώνει παντού τα ίδια συμβάντα `char`/`status`/`metrics`.

- `psk31.js` — BPSK31: μιγαδική βασική ζώνη, προσαρμοσμένο φίλτρο, διαφορική ανίχνευση και varicode, με φασματική χονδρική απόκτηση και λεπτό AFC εύρους περίπου ±25 Hz.
- `olivia.js` — Olivia MFSK: μεταφορά του δέκτη MFSK του Pawel Jalocha από το fldigi (`pj_mfsk.h`, GPL-3, όπως και αυτό το έργο), μαζί με τη διόρθωση σφαλμάτων Walsh/Hadamard και την τυφλή αναζήτηση συγχρονισμού σε φάση μπλοκ και μετατόπιση συχνότητας.
- `broadcastSchedules.js` — τα ωράρια UTC που προσφέρουν ως προεπιλογές οι αποκωδικοποιητές FAX, NAVTEX και RTTY, από τα προγράμματα ναυτιλιακού fax της NOAA/NWS και τους δημοσιευμένους καταλόγους σταθμών NAVTEX

#### 4β. Διαφορική λήψη (`diversity.js`)
- Συνδυάζει τον τοπικό δέκτη με έναν δεύτερο αλλού και ακολουθεί όποια τοποθεσία έχει εκείνη τη στιγμή το καλύτερο σήμα. Απλό JS, όχι component — βρίσκεται σε ένα σημείο του `audio.js`, που του δίνει το τοπικό PCM και αναπαράγει ό,τι επιστρέφει
- **Επιλογή, όχι πρόσθεση.** Δύο τοποθεσίες ακούν την ίδια εκπομπή μέσα από διαφορετικές ιονοσφαιρικές διαδρομές, άρα οι κυματομορφές τους έχουν άσχετη φάση· η πρόσθεσή τους ακούγεται «χτενισμένη». Η σύμφωνη σύνθεση θα απαιτούσε κοινό ρολόι, που δύο δέκτες μέσω internet δεν μοιράζονται. Οι δύο ροές αναμειγνύονται μόνο κατά τη διάρκεια ενός crossfade 30 ms
- Η ευθυγράμμιση συσχετίζει τις δύο **περιβάλλουσες ήχου** (λογαριθμική ισχύς στα 100 Hz), ποτέ τις κυματομορφές — η περιβάλλουσα επιβιώνει και της διαδρομής και οποιουδήποτε codec. Ένα κλείδωμα γίνεται αποδεκτό μόνο όταν μια δεύτερη, ανεξάρτητη αναζήτηση συμφωνήσει, κάτι που απορρίπτει τη «σίγουρη αλλά λάθος» καθυστέρηση που θα έδιναν δύο τοποθεσίες με fading σε αντίθετη φάση
- Ο απομακρυσμένος **κλειδώνεται σε ρυθμό** με την τοπική ροή πρώτα. Δύο δέκτες σημαίνει δύο ρολόγια και δύο αλυσίδες αποδεκατισμού, οπότε ο ήχος τους φτάνει έως και 2% διαφορετικά ακόμη κι όταν και οι δύο δηλώνουν 12 kHz — 240 δείγματα ανά δευτερόλεπτο ολίσθηση, που καμία συσχέτιση δεν συγκρατεί. Ο λόγος μετριέται από το πόσα δείγματα παραδίδει πραγματικά η κάθε πλευρά και εφαρμόζεται από resampler που μεταφέρει την κλασματική του φάση μεταξύ μπλοκ, ώστε οποιοσδήποτε λόγος να κρατά επ' αόριστον
- Η επιλογή τοποθεσίας χρησιμοποιεί SNR εκατοστημορίων μετρημένο σε **ευθυγραμμισμένα ως προς το περιεχόμενο** δείγματα, με υστέρηση, χρονικό dwell και γρήγορη διέξοδο όταν η ενεργή τοποθεσία καταρρεύσει. Οι στάθμες ταιριάζονται θόρυβο-προς-θόρυβο, ώστε η εναλλαγή να μην αλλάζει το υπόβαθρο
- Οι αποκωδικοποιητές κρατούν την **τοπική** ροή: FT8, JS8, WSPR και RADE ολοκληρώνουν σύμφωνα σε μια χρονοθυρίδα, και μια εναλλαγή στη μέση της είναι ασυνέχεια φάσης που μπορεί να στοιχίσει την αποκωδικοποίηση

#### 4γ. Πηγές diversity (`remoteSource.js`, `kiwiSource.js`, `uberSource.js`, `webSdrSource.js`)
- Ένα συμβόλαιο — `onPcm` / `onState` / `tune` / `canReceive` — ώστε το `diversity.js` να μη μαθαίνει ποτέ τι υπάρχει στην άλλη άκρη. Η προσθήκη τύπου δέκτη είναι ένα νέο αρχείο
- `remoteSource.js` — άλλος PhantomSDR-Plus μέσω `/audio` (cbor + FLAC), με επαναχρησιμοποίηση της `createDecoder()` από το `lib/wrappers.js`
- `kiwiSource.js` — KiwiSDR: πλαίσια `SND`, PCM big-endian, με τη χρονοσήμανση GPS 10 byte που εισάγει ένα στερεοφωνικό πακέτο πριν από τον ήχο
- `uberSource.js` — UberSDR μέσω του δικού του `/ws`: Opus σε κεφαλίδα 21 byte, με επανασυντονισμό πάνω στην ανοιχτή σύνδεση. Το session id πρέπει πρώτα να δηλωθεί με `POST /connection` και πρέπει να είναι UUID
- `webSdrSource.js` — WebSDR, μέσω του `websdr_relay.py` σε αυτόν τον server: ο browser δεν μπορεί να συνδεθεί απευθείας, επειδή ο WebSDR ελέγχει την κεφαλίδα `Origin` και κανένα script δεν επιτρέπεται να την αλλάξει. Ο συντονισμός γίνεται με πλαίσιο κειμένου στην ίδια σύνδεση· την κάλυψη μπαντών τη δίνει το relay
- `webSdrCodec.js` — η μορφή ήχου του WebSDR: ροή με ετικέτες ανά byte, όπου τα συμπιεσμένα μπλοκ τροφοδοτούν προβλεπτή leaky-LMS 20 λήψεων. Μεταφέρθηκε από τον client του WebSDR και επαληθεύτηκε δείγμα προς δείγμα
- `diversityList.js` — η λίστα αποθηκευμένων δεκτών και οι κανόνες διευθύνσεων για τους τέσσερις τύπους, κοινά για τον πίνακα του υπολογιστή και τη σελίδα κινητού, ώστε μία μορφή να εξυπηρετεί και τα δύο. Επίσης η μεταφορά — ένα συμπαγές blob, ο κωδικός QR του, και ένας parser που δέχεται κάθε μορφή που έχουν γράψει ποτέ οι δύο σελίδες — και η `browseUrl()`, που μετατρέπει μια διεύθυνση κλήσης πίσω σε μία που ανοίγει ο browser
- `lib/DiversityPanel.svelte` — το UI: διεύθυνση, τύπος πηγής, SNR trim και ζωντανή κατάσταση, μαζί με τους αποθηκευμένους δέκτες — με ονόματα, με ελεύθερη σειρά, και με export/import σε αρχείο JSON, ξεχωριστά ανά τύπο πηγής στο `localStorage`. Όλες οι διορθώσεις γίνονται μέσα στον πίνακα: τα `prompt()` και `confirm()` μπλοκάρουν το main thread, εκεί όπου προωθούνται τα δείγματα ήχου προς το playback worklet. Ένα κουμπί **▦ QR** σχεδιάζει τη λίστα ως κωδικό προς σάρωση, επειδή το `localStorage` ανήκει σε έναν browser και ένα κινητό ξεκινά άδειο. Το `mobile/Mobile.svelte` έχει την ίδια λειτουργία σε μια καρτέλα **Div**, με το δικό της απλό CSS. Δείτε [Διαφορική λήψη](RECEIVE_DIVERSITY.md)

#### 4δ. Αναγνώριση τρόπου εκπομπής (`modeId.js`, `modePriors.js`)
- Απαντά στο «τι ακούω;». Διαβάζει την ίδια ακατέργαστη λήψη PCM με τους αποκωδικοποιητές και κατατάσσει τους πιθανούς τρόπους, ώστε ο χειριστής να διαλέξει τον σωστό αποκωδικοποιητή αντί να δοκιμάσει και τους δέκα. Δεν αποκωδικοποιεί ποτέ: μετρά φυσικά χαρακτηριστικά του σήματος και τα βαθμολογεί σε πίνακα γνωστών τρόπων
- Το κατειλημμένο εύρος είναι το συνεχές πλάτος στα −15 dB γύρω από την κορυφή, σκόπιμα όχι τιμή 99 % ισχύος: τα κλικ χειρισμού αφήνουν μακριές ουρές στο ολοκλήρωμα ισχύος και έκαναν κάθε στενό τρόπο να φαίνεται πολλαπλάσια πλατύς. Ο ρυθμός συμβόλων προκύπτει από τη **στιγμιαία συχνότητα** και όχι από τις ενέργειες των τόνων, επειδή καμία διάρκεια ολοκλήρωσης δεν αναλύει ταυτόχρονα μετατόπιση 170 Hz και σύμβολο 100 Bd. Ο ρυθμός χειρισμού προκύπτει από την περιβάλλουσα on/off και χρησιμεύει και ως ένδειξη ταχύτητας CW
- Το `modePriors.js` προσθέτει τη μία ένδειξη που δεν μπορεί να φέρει ο ήχος: πού είστε συντονισμένοι. Σήμα 100 Bd / 170 Hz στους 518 kHz είναι NAVTEX· το ίδιο σήμα στους 14,070 MHz δεν είναι. Απλώς αναβαθμολογεί ό,τι ήδη στήριξε το σήμα και ποτέ δεν επινοεί υποψήφιο
- Τα FT8, JS8 και FT2 αναφέρονται σκόπιμα ως μία ομάδα: δεν διαχωρίζονται μόνο από εύρος και απόσταση τόνων, και το αντίθετο θα ήταν μια σίγουρη λάθος απάντηση
- Κάτω από περίπου 10 dB SNR σιωπά αντί να μαντεύει
- Τρέχει σε δικό του Web Worker (`modeId.worker.js` + `modeIdWorkerProxy.js`), με το ίδιο μοτίβο engine/worker/proxy όπως οι αποκωδικοποιητές παραπάνω· το αποτέλεσμα είναι το chip στο `lib/ModeIdChip.svelte`

#### 4ε. Απορρίψεις συνδέσεων (`refused.js`, `clientVersion.js`)

- Το `refused.js` είναι το κοινό λεξιλόγιο για μια σύνδεση που ο διακομιστής διώχνει: κωδικός κλεισίματος **4003** (πάνω από όριο ανά διεύθυνση, ή η σελίδα είναι παλαιότερη από το `[server] min_client_version`) και **4001** (αποβολή από τον διαχειριστή). Και οι δύο είναι οριστικοί. Τα `audio.js`, `waterfall.js` και `events.js` εισάγουν όλα το `isRefusal()` από εκεί, γιατί και τα τρία ανοίγουν σύνδεση που μπορεί να απορριφθεί και πρέπει να τερματίσουν την υπόσχεση αρχικοποίησής τους όταν συμβεί — αλλιώς η σελίδα περιμένει για πάντα μια σύνδεση που δεν θα έρθει ποτέ
- Τίποτα δεν ξαναδοκιμάζει. Μια πεσμένη σύνδεση `/audio` τερματίζει τη συνεδρία εκ σχεδιασμού: τα `/waterfall` και `/events` δεν επέστρεφαν ποτέ μαζί με μια επανασύνδεση, οπότε μια συνεδρία που ξαναδοκίμαζε ήταν ζωντανός ήχος πάνω σε παγωμένο καταρράκτη, και απέναντι σε όριο ρυθμού κάθε επανάληψη θα παρέτεινε ακριβώς την απόρριψη που προσπαθούσε να παρακάμψει. Η σελίδα υπολογιστή εξηγεί μια απόρριψη που συμβαίνει κατά τη φόρτωση και απλώς σταματάει όταν συμβεί στη μέση· το `/mobile` δείχνει μία γραμμή που ζητά από τον ακροατή να ανανεώσει
- Το `clientVersion.js` κρατάει έναν μόνο ακέραιο, το `CLIENT_VERSION`, που η σελίδα προσθέτει στη σύνδεση ήχου ως `/audio?v=N`. Ο διακομιστής απορρίπτει ό,τι είναι κάτω από το `[server] min_client_version`, και έτσι ένας σταθμός αναγκάζει καρτέλες που τρέχουν ακόμη παλιότερη έκδοση να ανανεώσουν — ο μόνος μοχλός που υπάρχει, αφού ο διακομιστής δεν μπορεί να φτάσει σε JavaScript που ήδη τρέχει σε browser. Αυξήστε τον όταν μια αλλαγή στο frontend δεν πρέπει να συνεχίσει να αγνοείται από ανοιχτές καρτέλες
- Πλήρης αναφορά: [Όρια συνδέσεων](CONNECTION_LIMITS.md)

#### 5. Διαχείριση κατάστασης (`stores/`)
- Αντιδραστικοί χώροι δεδομένων
- Κοινή κατάσταση εφαρμογής
- Χειρισμός συμβάντων

---

### Βασικές δυνατότητες

- Επεξεργασία ήχου σε πραγματικό χρόνο
- Αποκωδικοποίηση ψηφιακών τρόπων (FT8, RTTY κ.λπ.)
- Φιλτράρισμα ήχου
- Φασματική ανάλυση

---


## Λίστες συχνοτήτων (`frequencylist/`)

Οι δείκτες συχνοτήτων πάνω στον καταρράκτη. Το `mymarkers.json` είναι η λίστα που δείχνει πραγματικά ο δέκτης· τα υπόλοιπα είναι η πρώτη ύλη που το `update-markers.sh` μετατρέπει σε αυτήν, ανανεωμένη από τα διαδικτυακά προγράμματα. Το `README.md` σε εκείνον τον φάκελο εξηγεί την ενημέρωση και στις επτά γλώσσες.

```
frequencylist/
├── mymarkers.json            # οι δείκτες που δείχνει ο δέκτης — επεξεργάζονται με το χέρι, επιβιώνουν της ενημέρωσης
├── shortwavestations.json    # σταθμοί βραχέων, παράγεται από το generate-current-shortwave.py
├── 0.TXT                     # το παγκόσμιο πρόγραμμα HF A26, αποσυμπιέζεται και αναλύεται από το update-markers.sh
├── a26allx2.zip              # το αρχείο-πηγή που κατεβάζει το update-markers.sh
├── admin.txt · antenna.txt · broadcas.txt · fmorg.txt · language.txt · site.txt
│                             # βοηθητικές λίστες από την ίδια πηγή (τοποθεσίες, γλώσσες, διαχειριστές, κεραίες)
├── generate-current-shortwave.py
├── update-markers.sh         # ανανεώνει όλα τα παραπάνω από τα διαδικτυακά προγράμματα
└── README.md
```

### Μορφή (`mymarkers.json`, `shortwavestations.json`)

```json
[
    { "frequency": 77500,   "name": "DCF77", "mode": "CW" },
    { "frequency": 2485000, "name": "Vanuatu Broadcasting", "mode": "AM" }
]
```

---

## Αρχεία ρυθμίσεων

### Ρυθμίσεις διακομιστή (αρχεία `.toml`)

Δομή των αρχείων ρυθμίσεων:

```toml
[server]
# Web server settings
port = 9002
html_root = "frontend/dist/"
threads = 2
otherusers = 1

[limits]
# Όρια συνδέσεων ανά διεύθυνση — όλα είναι εξ ορισμού ανενεργά ή σε λογική τιμή,
# οπότε μια ρύθμιση χωρίς αυτά συμπεριφέρεται όπως πάντα. Δείτε CONNECTION_LIMITS.md.
per_ip = 3              # ταυτόχρονοι ακροατές από μία διεύθυνση
per_ip_rate = 40        # νέες συνδέσεις ανά λεπτό από μία διεύθυνση

[websdr]
# Online registration
register_online = true
name = "WebSDR Name"
antenna = "Antenna Type"
grid_locator = "AB12cd"
hostname = "domain.com"

[input]
# SDR input settings
sps = 2048000           # Sample rate
fft_size = 131072       # FFT size
frequency = 145000000   # Base frequency
signal = "iq"           # Signal type: "iq" or "real"
audio_sps = 12000       # Audio sample rate
audio_compression = "opus"  # "flac" or "opus"
accelerator = "opencl"  # "none", "cuda", "opencl"

[input.driver]
# Driver settings
name = "stdin"
format = "u8"           # Sample format

[input.defaults]
# User interface defaults
frequency = 145500000
modulation = "FM"
```

### Πληροφορίες σταθμού (`site_information.json`)

```json
{
  "siteSysop": "Operator Callsign",
  "siteSysopEmailAddress": "email@example.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Hardware specs",
  "siteSoftware": "Software version",
  "siteReceiver": "SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional notes",
  "siteIP": "http://domain.com:9002",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

---

## Σύστημα μεταγλώττισης

### Ρύθμιση μεταγλώττισης Meson

#### `meson.build` (ρίζα)

Ορίζει:
- Μεταδεδομένα του έργου
- Εξαρτήσεις
- Επιλογές μεταγλωττιστή
- Λίστες αρχείων πηγαίου κώδικα
- Στόχους μεταγλώττισης

#### `meson_options.txt`

Διαθέσιμες επιλογές:
```
option('opencl', type: 'boolean', value: false, description: 'Enable OpenCL support')
option('cuda', type: 'boolean', value: false, description: 'Enable CUDA support')
option('optimization', type: 'string', value: '3', description: 'Optimization level')
```

---

## Εξαρτήσεις αρχείων

### Εξαρτήσεις μεταγλώττισης του backend

```
spectrumserver binary depends on:
├── C++ source files (src/**/*.cpp)
├── External libraries:
│   ├── FFTW3
│   ├── WebSocket++
│   ├── FLAC
│   ├── Opus
│   ├── Liquid-DSP
│   ├── Boost
│   ├── zlib
│   ├── zstd
│   └── OpenCL/CUDA (optional)
└── Subproject headers:
    ├── nlohmann/json
    └── toml11
```

### Εξαρτήσεις μεταγλώττισης του frontend

```
frontend/dist/ depends on:
├── Source files (frontend/src/**)
├── npm packages (node_modules/):
│   ├── Svelte
│   ├── Vite
│   ├── @wasm-audio-decoders/opus-ml
│   └── ...
└── Static assets (frontend/public/)
```

---

## Ροή δεδομένων

### Ροή λειτουργίας του διακομιστή

```
1. SDR Hardware → rtl_sdr/hackrf_transfer/etc.
                ↓
2. Sample Stream → stdin → spectrumserver
                ↓
3. spectrumserver:
   - FFT calculation (waterfall)
   - Demodulation (audio)
   - Compression (FLAC/Opus)
                ↓
4. WebSocket → Browser Client
                ↓
5. Browser:
   - Render waterfall
   - Decode and play audio
   - Display controls
```

### Ροή αλληλεπίδρασης χρήστη

```
1. User clicks on waterfall
                ↓
2. JavaScript sends frequency change request
                ↓
3. WebSocket → spectrumserver
                ↓
4. spectrumserver:
   - Updates demodulator frequency
   - Sends new audio stream
                ↓
5. Browser receives and plays new audio
```

---

## Οδηγός τροποποίησης αρχείων

### Όταν τροποποιείτε κώδικα του backend (`src/**`):

```bash
cd PhantomSDR-Plus
meson compile -C build
# Server restart required
```

### Όταν τροποποιείτε κώδικα του frontend (`frontend/src/**`):

```bash
cd PhantomSDR-Plus/frontend
npm run build
cd ..
# Server restart required (for static files)
```

### Όταν τροποποιείτε ρυθμίσεις (`.toml`, `.json`):

```bash
# Restart server
./stop-websdr.sh
./start-rtl.sh  # (or appropriate start script)
```

### Όταν τροποποιείτε τους δείκτες (`markers.json`):

```bash
# Reload page in browser
# No server restart needed
```

---

## Σημαντικές διαδρομές

### Διαδρομές εκτέλεσης

- **Ρυθμίσεις**: `./config-*.toml`
- **Ριζικός κατάλογος HTML**: `./frontend/dist/`
- **Δείκτες**: `./markers.json`
- **Ιστορικό συνομιλίας**: `./chat_history.txt`
- **FFTW wisdom**: `./fftw_wisdom`, `./phantom_fftw_wisdom`

### Διαδρομές μεταγλώττισης

- **Παραγόμενο εκτελέσιμο**: `./build/spectrumserver`
- **Έξοδος του frontend**: `./frontend/dist/`
- **Node modules**: `./frontend/node_modules/`

### Διαδρομές πηγαίου κώδικα

- **Πηγαίος κώδικας backend**: `./src/`
- **Πηγαίος κώδικας frontend**: `./frontend/src/`
- **Βιβλιοθήκες DSP**: `./jsdsp/`

---

## Συνήθεις εργασίες με αρχεία

### Προσθήκη νέας ρύθμισης SDR

1. Αντιγράψτε υπάρχουσα ρύθμιση: `cp config-rtl.toml config-mydevice.toml`
2. Επεξεργαστείτε τις παραμέτρους: `nano config-mydevice.toml`
3. Δημιουργήστε σενάριο εκκίνησης: `cp start-rtl.sh start-mydevice.sh`
4. Επεξεργαστείτε το σενάριο εκκίνησης: `nano start-mydevice.sh` — αλλάξτε μόνο το τμήμα **RECEIVER CONFIGURATION** στην αρχή (`RX_LABEL`, `RX_COMM` = το όνομα διεργασίας του δέκτη, `RX_ARGS`, `CONFIG`, `FIFO` και το άγκιστρο `prestart` αν το χρειάζεται η συσκευή). Η λογική εκκινητή/watchdog/καταγραφής από κάτω είναι γενική και δεν χρειάζεται αλλαγές.
5. Κάντε το εκτελέσιμο: `chmod +x start-mydevice.sh`

> Το `stop-websdr.sh` ήδη σταματά οποιοδήποτε `start-*.sh --watchdog`· αν ο δέκτης σας χρησιμοποιεί όνομα διεργασίας διαφορετικό από `rx888_stream`/`rx_sdr`/`rtl_sdr`/`hackrf_transfer`/`cf32_to_real`, προσθέστε και εκεί μια γραμμή `killall -9 <όνομα>`.

### Προσαρμογή του frontend

1. Τροποποιήστε τον πηγαίο κώδικα: `nano frontend/src/App.svelte`
2. Μεταγλωττίστε ξανά: `cd frontend && npm run build && cd ..`
3. Επανεκκινήστε τον διακομιστή: `./stop-websdr.sh && ./start-rtl.sh`

### Προσθήκη προσαρμοσμένων δεικτών

1. Επεξεργαστείτε το αρχείο δεικτών: `nano markers.json`
2. Μορφή:
   ```json
   {
     "markers": [
       {
         "frequency": 145500000,
         "label": "2m Calling",
         "mode": "FM"
       }
     ]
   }
   ```
3. Ανανεώστε τον περιηγητή (δεν χρειάζεται επανεκκίνηση διακομιστή)

---

## Έλεγχος εκδόσεων

### Αρχεία που παρακολουθούνται στο Git

- Πηγαίος κώδικας (`src/`, `frontend/src/`, `jsdsp/`)
- Παραδείγματα ρυθμίσεων (`config.example.*.toml`)
- Σύστημα μεταγλώττισης (`meson.build`, `meson_options.txt`)
- Τεκμηρίωση (`*.md`, `docs/`)
- Σενάρια (`*.sh`)

### Αρχεία που αγνοούνται (`.gitignore`)

- Αποτελέσματα μεταγλώττισης (`build/`, `frontend/dist/`)
- Εξαρτήσεις (`frontend/node_modules/`)
- Δεδομένα χρηστών (`chat_history.txt`)
- Προσωπικές ρυθμίσεις (`config-rtl.toml` αν έχει προσαρμοστεί)
- Δυαδικά δεδομένα (`*.o`, `*.so`)

---

**Αυτή η τεκμηρίωση της δομής θα σας βοηθήσει να περιηγηθείτε και να κατανοήσετε τον κώδικα του PhantomSDR-Plus.**

Για οδηγίες εγκατάστασης, δείτε το [INSTALLATION.md](INSTALLATION.md). Για πληροφορίες χρήσης, δείτε το [USER_GUIDE.md](USER_GUIDE.md).

**73 de SV1BTL & SV2AMK**
