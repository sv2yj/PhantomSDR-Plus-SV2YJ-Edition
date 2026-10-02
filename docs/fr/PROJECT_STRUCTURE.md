# Structure du projet PhantomSDR-Plus

Ce document offre une vue d'ensemble complète de la structure de répertoires de PhantomSDR-Plus, de l'organisation des fichiers et des relations entre composants.

---

## Table des matières

1. [Arborescence des répertoires](#arborescence-des-répertoires)
2. [Répertoire racine](#répertoire-racine)
3. [Code source (`src/`)](#code-source-src)
4. [Frontend (`frontend/`)](#frontend-frontend)
5. [Listes de fréquences (`frequencylist/`)](#listes-de-fréquences-frequencylist)
6. [Fichiers de configuration](#fichiers-de-configuration)
7. [Système de compilation](#système-de-compilation)

---

## Arborescence des répertoires
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
├── cf32_to_real.c             # Fobos HF : garde I du CF32 de rx_sdr, mis à l'échelle en s16 (compilé par setup-fobos.sh)
├── chat_history.txt
├── check-go.sh                # ancien : chien de garde de la chaîne go.sh
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
│   ├── A26all00.TXT           # absent du dépôt : extrait de a26allx2.zip par update-markers.sh
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
│   ├── .prettierrc.json      # règles de formatage Prettier pour les sources du frontend
│   ├── public
│   │   ├── analyze_users.py
│   │   ├── decoders
│   │   │   ├── ft8_lib.wasm
│   │   │   ├── js8_dict.bin   # dictionnaire de mots JS8, chargé seulement au besoin
│   │   │   └── js8.wasm       # décodeur JS8, compilé depuis jsdsp/js8_wasm
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
│   │   │   ├── rnnoise.js     # charge RNNoise pour la réduction de bruit par IA
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
├── go.sh                      # ancienne chaîne de lancement, remplacée par start-<radio>.sh
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
│   ├── js8_wasm               # décodeur JS8 en C, compilé en WebAssembly, avec ses tests et son banc de référence — voir son README
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
├── kill.sh                    # ancien : tue les processus du serveur, appelé par go.sh
├── kiwi_install.sh             # installe la passerelle KiwiSDR dans une arborescence existante
├── LICENSE
├── logproxy                   # copies tournantes des journaux panneau/mandataire/autorun
├── logrotate
│   └── phantomsdr             # configuration logrotate pour proxy.log + admin.log (adapter les chemins avant installation)
├── manage_admin.sh
├── markers.json
├── meson.build
├── meson_options.txt
├── phantom_fftw_wisdom
├── phantomsdr-admin.service   # unité systemd d'exemple pour le panneau (démarrage au boot, redémarrage après plantage)
├── phantomsdr-proxy.service   # unité systemd d'exemple pour le proxy, à installer avec celle du panneau
├── phantomsdr-websdr-relay.service  # unité systemd d'exemple pour le relais de diversité WebSDR
├── proxy.py
├── rade_helper.py
├── rade_loadtest.csv          # sortie de rade_loadtest.py (une ligne par palier de charge)
├── rade_loadtest.py           # test de charge RADE : combien de décodeurs simultanés la machine supporte — voir docs/RADE_README.md
├── rade.sh
├── README.md
├── recompile.sh
├── _relaunch.sh               # ancien : relance différée de la chaîne go.sh
├── request.hpp
├── setup_admin.sh
├── setup-airspyhf.sh          # chaîne de pilote Airspy HF+ : libairspyhf + SoapyAirspyHF + rx_sdr + udev
├── setup-cpufreq-perms.sh     # donne au groupe l'écriture sur scaling_max_freq pour que la protection puisse brider sans root
├── setup-firewall.sh          # garde nftables optionnelle — voir docs/CONNECTION_LIMITS.md
├── setup-fobos.sh             # chaîne de pilote Fobos : libfobos + SoapyFobosSDR + rx_sdr + cf32_to_real + udev
├── setup-hackrf.sh            # HackRF : paquet hackrf de la distribution + udev (rien de compilé)
├── setup-rsp1a.sh             # chaîne de pilote RSP1A : libmirisdr-5 + SoapyMiri + rx_sdr + liste noire msi2500 + udev
├── setup-rx888-udev.sh
├── setup-sdr-common.sh        # fonctions communes des trois scripts setup ci-dessus
├── setup_websdr_relay.sh      # installe le relais de diversité WebSDR (port, identité, systemd)
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
│   ├── kiwi_bridge.h          # passerelle du protocole KiwiSDR — voir docs/Aether_config.md
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
│   └── tci-rigctld.mjs        # serveur TCI pour postes Hamlib (IC-7300…), tourne sur le PC de l'auditeur — voir docs/RIG_CONTROL.md
├── thermal_guard.py           # Protection contre la surchauffe du processeur pour le panneau (fonctionne aussi seule)
├── thermal-guard.service      # unité systemd d'exemple pour le garde, sans panneau d'administration
├── tmpfiles
│   └── phantomsdr-logs.conf   # garde admin.log + proxy.log à l'utilisateur du panneau (adapter les chemins avant installation)
├── update.sh
├── waterfall.sh
├── websdr_relay.json.example  # modèle de configuration (port, limites, identité de la station)
├── websdr_relay.py            # le relais lui-même — voir docs/RECEIVE_DIVERSITY.md
├── websocketpp_asio_connection.hpp  # adaptateur Boost >= 1.87 : ws_post au lieu de io_service::post
├── websocketpp_asio_endpoint.hpp    # adaptateur Boost >= 1.87 : ws_work / ws_restart, max_listen_connections
├── websocketpp_asio.hpp        # adaptateur Boost >= 1.87 pour websocketpp (io_context, executor_work_guard)
└── xgo.sh                     # ancien : démarre spectrumserver, appelé par check-go.sh
```
---

## Répertoire racine

### Fichiers de configuration

| Fichier | Rôle | Quand le modifier |
|---------|------|-------------------|
| `config.toml` | Configuration par défaut | Installation initiale, tests |
| `config-rtl.toml` | Configuration propre au RTL-SDR | Utilisation d'un RTL-SDR |
| `config-rsp1a.toml` | Configuration SDRplay RSP1A | Utilisation d'un RSP1A |
| `config-airspyhf.toml` | Configuration Airspy HF+ | Utilisation d'un Airspy |
| `config-fobos-hf.toml` | RigExpert Fobos SDR, HF1/HF2 en échantillonnage direct (0-25 MHz) | Utilisation d'un Fobos en HF |
| `config-fobos.toml` | RigExpert Fobos SDR, voie RF (25-6000 MHz) | Utilisation d'un Fobos au-dessus de 25 MHz |
| `config-hackrf.toml` | Configuration HackRF One | Utilisation d'un HackRF |
| `config-rx888mk2.toml` | Configuration RX888 MK2 | Utilisation d'un RX888 |
| `config.example.hackrf.toml` | Exemple HackRF One | Utilisation d'un HackRF |

### Scripts de démarrage/arrêt et de maintenance

Chaque `start-*.sh` ci-dessous est un **lanceur autonome + chien de garde + journaliseur** : il arrête toute instance en cours, lance le récepteur + `spectrumserver`, se détache en arrière-plan, relance automatiquement la chaîne si elle s'arrête, et journalise dans `logwebsdr.txt`. Ils partagent un même script d'arrêt et un unique verrou `flock` (un seul récepteur à la fois). Ne modifiez que le bloc **RECEIVER CONFIGURATION** en tête de chacun (arguments du récepteur / configuration / nom du processus). Les six scripts de lancement issus du même modèle (`start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos.sh`, `start-fobos-hf.sh`, `start-hackrf.sh`) sont identiques sous ce bloc ; `start-rx888mk2.sh` est un script à part.

| Script | Rôle |
|--------|------|
| `install.sh` | Installation et compilation automatisées |
| `start-rtl.sh` | Lancement + chien de garde du serveur avec RTL-SDR (`rtl_sdr`) |
| `start-rsp1a.sh` | Lancement + chien de garde du serveur avec SDRplay RSP1A (`rx_sdr`) ; utilise libmirisdr-5, ou l'API SDRplay quand elle est installée (`RX_DRIVER` en impose un) |
| `start-airspyhf.sh` | Lancement + chien de garde du serveur avec Airspy HF+ (`rx_sdr`) |
| `start-fobos-hf.sh` | Lancement + chien de garde du serveur avec RigExpert Fobos SDR, HF1/HF2 en échantillonnage direct (`rx_sdr \| cf32_to_real`) |
| `start-fobos.sh` | Lancement + chien de garde du serveur avec RigExpert Fobos SDR, voie RF (`rx_sdr`) |
| `start-hackrf.sh` | Lancement + chien de garde du serveur avec HackRF One (`hackrf_transfer`) |
| `start-rx888mk2.sh` | Lancement + chien de garde du serveur avec RX888 MK2 (`rx888_stream`) |
| `stop-websdr.sh` | Arrêt du serveur et de son chien de garde — partagé par tous les récepteurs |
| `setup-rx888-udev.sh` | Installe les règles udev pour que `rx888_stream` du RX-888 tourne sans sudo |
| `setup-rsp1a.sh` / `setup-fobos.sh` / `setup-airspyhf.sh` | Installent la chaîne de pilote SoapySDR du RSP1A, du Fobos ou de l'Airspy HF+ — SoapySDR depuis la distribution, pilote et rx_tools compilés dans `sdr_drivers/`, une règle udev — sur l'une des quatre distributions prises en charge. Les options 3, 5 et 6 de l'installateur les lancent ; ils fonctionnent aussi seuls. Code commun dans `setup-sdr-common.sh` — voir le [Guide d'installation](INSTALLATION.md#récepteurs-sur-soapysdr-rsp1a-fobos-airspy-hf) |
| `setup-hackrf.sh` | Installe le paquet `hackrf` de la distribution et une règle udev pour le HackRF One, sur l'une des quatre distributions prises en charge ; l'option 7 de l'installateur le lance |
| `setup-firewall.sh` | Garde anti-afflux optionnelle au niveau du noyau : charge une table nftables avec un plafond de connexions simultanées et un débit par adresse source sur les ports du récepteur, un frein contre la force brute SSH et le partage de fichiers Windows fermé hors des plages privées. Nécessite root, ne peut pas vous enfermer dehors (policy accept, les connexions établies acceptées en premier) et `--apply` se retire de lui-même s'il n'est pas confirmé en 60 s — voir [Limites de connexion](CONNECTION_LIMITS.md) |
| `setup-cpufreq-perms.sh` | Donne à un groupe `cpufreq` le droit d'écriture sur la limite de fréquence du processeur, afin que l'étage throttle du garde fonctionne sans root. Installe une règle `tmpfiles.d` pour survivre à un redémarrage ; `--revoke` annule tout |
| `update.sh` | Mettre à jour l'installation depuis l'arborescence publiée sans toucher à votre configuration, vos marqueurs, la liste des fréquences ni vos modifications — voir le [Guide d'installation](INSTALLATION.md) |
| `recompile.sh` | Reconstruire le backend et/ou le frontend et choisir la variante servie à `/` |
| `smeter_theme.sh` | Définir le cadran par défaut du S-mètre analogique (dark / amber / vintage) pour tous les utilisateurs, et proposer la reconstruction du frontend — voir [Modifier les variantes](EDITING_VARIANTS.md) |
| `waterfall.sh` | Modifie le niveau minimal de cascade par défaut (dB) dans `waterfall.js` + `App.svelte` — voir [README](README.md) |
| `kiwi_install.sh` | Installe l'émulation des clients KiwiSDR sur une arborescence qui ne l'a pas : corrige les sources du backend, copie `src/kiwi_bridge.h` et ajoute un bloc `[kiwi_emulation]` documenté aux fichiers de configuration de la racine. Idempotent, et sauvegarde chaque fichier qu'il touche — voir [Émulation des clients KiwiSDR](Aether_config.md) |
| `tci-bridge/tci-rigctld.mjs` | Non utilisé par le récepteur. Un petit programme Node.js que l'auditeur lance à côté de son propre transceiver : il lit la fréquence, le mode et l'état d'émission dans `rigctld` de Hamlib et les sert en TCI sur le port 50001, pour que le bouton **TCI-CAT** de la page pilote un poste sans TCI, comme l'IC-7300 — voir [Pilotage du transceiver](RIG_CONTROL.md) |

**Ancienne chaîne de lancement.** `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh` et `_relaunch.sh` sont la génération précédente de scripts de lancement, de surveillance et d'arrêt. Tout ce qu'ils faisaient se trouve désormais dans chaque `start-<radio>.sh`, qui est ce qu'il faut utiliser. Ils restent sur le disque parce que des installations existantes les référencent, et ne sont plus maintenus.

### Fichiers de données

| Fichier | Rôle | Format |
|---------|------|--------|
| `markers.json` | Favoris et marqueurs de fréquence | JSON |
| `chat_history.txt` | Messages de chat des utilisateurs | Texte brut |
| `favicon.ico` | Icône du site | Image ICO |
| `fftw_wisdom` | Données d'optimisation FFT | Binaire FFTW |
| `phantom_fftw_wisdom` | Optimisation FFT supplémentaire | Binaire FFTW |

### Panneau d'administration et report de spots

| Fichier | Rôle |
|---------|------|
| `admin_server.py` | Le panneau d'administration lui-même. Outre les pages de gestion, il fait tourner l'échantillonneur de la page **Graphiques** : un thread d'arrière-plan relève toutes les 2 secondes la fréquence du processeur, la charge, la température et les utilisateurs connectés, et les conserve uniquement en mémoire — 1 heure en pleine résolution plus 24 heures de moyennes sur 30 secondes. Rien n'est écrit sur le disque : l'historique est perdu au redémarrage. |
| `admin_config.json` | Réglages du panneau d'administration (empreinte du mot de passe, ports, options, seuils de la protection thermique) |
| `thermal_guard.py` | Protection contre la surchauffe du processeur. Arrête le serveur lorsque le processeur devient trop chaud et le relance une fois refroidi, en déduisant ses seuils du seuil critique que publie votre propre processeur plutôt que d'un nombre fixe. Elle ne cherche jamais à identifier ce qui supervise le serveur : tant qu'il fait trop chaud, elle réémet l'arrêt toutes les 2 s, si bien qu'un watchdog, une unité systemd ou une tâche cron qui le relance est défait jusqu'au refroidissement de la machine. Bibliothèque standard uniquement ; importée par `admin_server.py` (cadencée par l'échantillonneur des Graphiques) et exécutable seule pour les installations sans panneau. Par défaut en journalisation seule, elle n'agit donc sur rien tant qu'elle n'est pas activée — voir [Panneau d'administration]voir le [manuel du Thermal Guard](THERMAL_GUARD.md) |
| `autorun/` | Le démon de report de spots — voir [Rapporteur de spots autorun](INSTALLATION.md#rapporteur-de-spots-autorun-ft8ft4wspr) |
| `autorun.json` | Bandes et modes à décoder, identité et destinations |
| `autorun-status.json` | État courant du démon : alimente les compteurs **de l'exécution en cours** (les tuiles par décodeur), remis à zéro par Stop/Start |
| `autorun-totals.json` | Spots téléversés **depuis toujours** par bande et mode : le nombre à côté de chaque case ; écrit par le démon afin de survivre aux redémarrages |

### Fichiers du système de compilation

| Fichier | Rôle |
|---------|------|
| `meson.build` | Configuration principale de compilation |
| `meson_options.txt` | Options de compilation configurables |
| `.gitattributes` | Attributs du dépôt Git |

---

## Code source (`src/`)

Le répertoire `src/` contient l'implémentation du backend en C++.

### Composants clés

#### 1. Application principale (`main.cpp`)
- Analyse les arguments de la ligne de commande
- Charge le fichier de configuration
- Initialise les composants du serveur
- Démarre la boucle d'événements

#### 2. Serveur de spectre (`spectrumserver.cpp`)
- Coordonne tous les composants
- Gère les connexions des utilisateurs
- Distribue les données de spectre
- Traite les requêtes des utilisateurs

#### 3. Pilotes SDR (`drivers/`)
- Interface abstraite pour le matériel SDR
- Lecture et mise en forme des données d'échantillons
- Gestion des fonctions propres à chaque appareil

#### 4. Moteur DSP (`dsp/`)
- Calcul de FFT (accéléré par CPU/GPU)
- Démodulation (AM, FM, BLU, CW, etc.)
- Filtrage et rééchantillonnage audio
- AGC et réduction de bruit

#### 5. Serveur web (`server/`)
- Communication WebSocket
- Service de fichiers statiques HTTP
- Gestion des sessions utilisateur
- Diffusion de données en temps réel

#### 6. Encodage audio (`audio/`)
- Compression FLAC
- Compression Opus
- Optimisation de la diffusion

---

## Frontend (`frontend/`)

L'interface utilisateur web construite avec Svelte et Vite.


#### 1. Application principale (`App.svelte`)
- Composant de plus haut niveau
- Structure de la mise en page
- Orchestration des composants
- **Rangée de boutons de décodeur** — un bouton par décodeur sur le panneau principal, juste sous le sélecteur de modes ; une pression démarre le décodeur et ouvre sa fenêtre, une seconde l'arrête. Elle a remplacé l'ancienne rangée de largeur de bande. RADEL/RADEU se trouvent dans `lib/ModesSelector.svelte`, à côté du sélecteur de modes et dans les fenêtres **Modes** et **Bands**.

#### 2. Affichage en cascade (`waterfall.js` + `lib/`)
- Rendu du spectre et de la cascade sur canevas, palettes de couleurs et ajustement automatique adaptatif, le tout dans `waterfall.js` (JS pur, pas un composant)
- Accord interactif via `lib/PassbandTuner.svelte`
- Superpositions du plan de bandes et des marqueurs via `lib/FrequencyMarkers.svelte`
- Le spectrogramme audio est un composant distinct : `lib/Spectrogram.svelte`

#### 3. Commandes (`App.svelte` + `lib/`)
- Saisie et affichage de la fréquence — `lib/FrequencyInput.svelte`
- Choix du mode (AM/FM/BLU/CW) — `lib/ModesSelector.svelte`, changement de bande — `lib/BandSelector.svelte`
- L'AGC, le NR, le NB et les autres commandes se trouvent dans `App.svelte` lui-même ; il n'existe pas de `Controls.svelte` distinct

#### 3a. Scanner (`scanner.js`)
- Balayage de canaux : promène le récepteur sur une plage et s'arrête au premier canal portant un signal. Du JS pur, pas un composant — `App.svelte` fournit le VFO, le mode, le plan de bandes et l'appel d'accord, et reçoit en retour l'état de l'interface par un seul rappel
- Le seuil est exprimé en dB au-dessus du bruit de fond de la bande plutôt qu'en niveau absolu, en réutilisant le bruit que `waterfall.js` suit déjà (`snrNoiseDb`) : aucun étalonnage propre n'est nécessaire
- Deux façons de parcourir la bande : accorder et écouter chaque canal, ou examiner d'abord le spectre et n'accorder que ce qu'il ne peut pas écarter. Le spectre peut sauter un canal mais jamais s'arrêter sur un — tout arrêt provient d'une écoute réelle
- La plage est soit la bande du plan de bandes, soit exactement ce que montre la cascade ; la reprise automatique, la durée de séjour maximale et la liste d'exclusion sont ici également, conservées dans `localStorage`

#### 4. Système audio (`audio.js`)
- Flux audio WebSocket
- Décodage FLAC/Opus
- Contrôle de la lecture audio
- Distribue le PCM brut (prélevé avant l'AGC, la réduction de bruit et la coupure du son) aux décodeurs de modes
- Réduction de bruit par IA : `lib/rnnoise.js` charge le module WebAssembly RNNoise (`@jitsi/rnnoise-wasm`) à la première utilisation ; `audio.js` ne l'applique qu'aux modes phonie, après la prise des décodeurs, qui ne l'entendent donc jamais

#### 4a. Décodeurs de modes et leurs workers

Chacun des décodeurs de modes lourds s'exécute dans son propre Web Worker, de sorte que le décodage ne bloque jamais la lecture audio ni la cascade. Ils suivent un schéma commun — trois fichiers par décodeur :

| Décodeur | Moteur | Worker | Proxy sur le thread principal |
|----------|--------|--------|-------------------------------|
| SSTV | `sstv.js` | `sstv.worker.js` | `sstvWorkerProxy.js` |
| FAX HF | `fax.js` | `fax.worker.js` | `faxWorkerProxy.js` |
| NAVTEX + FSK/RTTY + PSK31 + Olivia | `fsk.js`, `psk31.js`, `olivia.js` | `fsk.worker.js` | `fskWorkerProxy.js` |
| CW | `cwDecoder.js` | `cw.worker.js` | `cwWorkerProxy.js` |

- Le **moteur** est du code DSP pur qui ignore tout des workers : il peut donc aussi être exécuté directement (tests unitaires, ou repli dans le thread principal).
- Le **worker** détient une instance du moteur et retransmet ses événements tels quels.
- Le **proxy** reproduit la surface de méthodes du moteur, de sorte qu'`audio.js` l'appelle exactement comme il appellerait le décodeur. Il crée le worker paresseusement à la première activation et bascule vers une exécution dans le thread principal si les workers ne sont pas disponibles.

Deux détails sont porteurs : le PCM est **copié** dans un nouveau tampon avant d'être transféré au worker (transférer une vue sur l'accumulateur audio le détacherait et tuerait la lecture), et le message `init` du worker réapplique la configuration à un moteur déjà en cours plutôt que d'en supposer un neuf.

`fsk.js` sert à la fois NAVTEX et FSK/RTTY à partir d'un seul moteur, sélectionné par instance via un champ `role` ; chaque instance possède son propre état, de sorte que les deux peuvent tourner indépendamment.

Le rôle `fsk` héberge en outre deux décodeurs qui ne sont pas du FSK du tout. Lorsque la variante `psk31` ou `olivia` est sélectionnée, `fsk.js` transmet l'audio à `psk31.js` ou `olivia.js` au lieu de sa propre chaîne à discriminateur, tout en empruntant sa configuration, son worker et sa gestion d'événements — ainsi `fsk.worker.js`, `fskWorkerProxy.js` et `audio.js` n'ont besoin de rien savoir de ces deux modes, et l'interface consomme partout les mêmes événements `char`/`status`/`metrics`.

- `psk31.js` — BPSK31 : bande de base complexe, filtre adapté, détection différentielle et varicode, avec une acquisition spectrale grossière puis un AFC fin couvrant environ ±25 Hz.
- `olivia.js` — Olivia MFSK : un portage du récepteur MFSK de Pawel Jalocha issu de fldigi (`pj_mfsk.h`, GPL-3, comme ce projet), y compris la correction d'erreurs de Walsh/Hadamard et la recherche aveugle de synchronisation sur la phase de bloc et le décalage de fréquence.
- `broadcastSchedules.js` — les horaires UTC que les décodeurs FAX, NAVTEX et RTTY proposent en présélections, issus des programmes de fac-similé maritime de la NOAA/NWS et des listes publiées de stations NAVTEX

#### 4b. Diversité de réception (`diversity.js`)
- Associe le récepteur local à un second situé ailleurs et suit le site qui a, à cet instant, le meilleur signal. Du JS simple, pas un composant — il s'insère à un seul endroit de `audio.js`, qui lui passe le PCM local et restitue ce qu'il renvoie
- **Sélection, pas addition.** Deux sites entendent la même émission par des trajets ionosphériques différents, donc leurs formes d'onde ont des phases sans rapport ; les additionner donne un filtrage en peigne. Une combinaison cohérente exigerait une horloge commune, que deux récepteurs reliés par internet ne partagent pas. Le mélange n'a lieu que pendant un fondu de 30 ms
- L'alignement corrèle les deux **enveloppes audio** (puissance logarithmique à 100 Hz), jamais les formes d'onde — l'enveloppe survit au trajet comme à n'importe quel codec. Un verrouillage n'est retenu que si une seconde recherche indépendante concorde, ce qui écarte le décalage assuré mais faux que produiraient deux sites s'évanouissant en opposition
- Le flux distant est d'abord **verrouillé en cadence** sur le local. Deux récepteurs, ce sont deux horloges et deux chaînes de décimation : leur audio arrive jusqu'à 2% décalé même quand tous deux annoncent 12 kHz — 240 échantillons par seconde de dérive, qu'aucune corrélation ne retient. Le rapport est mesuré d'après le nombre d'échantillons réellement livré de chaque côté et appliqué par un rééchantillonneur qui conserve sa phase fractionnaire d'un bloc à l'autre, si bien qu'un rapport quelconque tient indéfiniment
- Le choix du site s'appuie sur un SNR par centiles mesuré sur des échantillons **alignés en contenu**, avec hystérésis, temporisation de maintien et une sortie rapide si le site actif s'effondre. Les niveaux sont appariés bruit à bruit, pour qu'un changement ne modifie pas le souffle de fond
- Les décodeurs conservent le flux **local** : FT8, JS8, WSPR et RADE intègrent de façon cohérente sur un intervalle, et un changement en cours d'intervalle est une discontinuité de phase qui peut coûter le décodage

#### 4c. Sources de diversité (`remoteSource.js`, `kiwiSource.js`, `uberSource.js`, `webSdrSource.js`)
- Un seul contrat — `onPcm` / `onState` / `tune` / `canReceive` — si bien que `diversity.js` ignore toujours ce qui se trouve en face. Ajouter un type de récepteur revient à ajouter un fichier
- `remoteSource.js` — un autre PhantomSDR-Plus via `/audio` (cbor + FLAC), réutilisant `createDecoder()` de `lib/wrappers.js`
- `kiwiSource.js` — un KiwiSDR : trames `SND`, PCM gros-boutiste, avec l'horodatage GPS de 10 octets qu'un paquet stéréo insère avant l'audio
- `uberSource.js` — un UberSDR via son `/ws` natif : Opus derrière un en-tête de 21 octets, réaccord sur la connexion ouverte. L'identifiant de session doit d'abord être déclaré par `POST /connection` et doit être un UUID
- `webSdrSource.js` — un WebSDR, via `websdr_relay.py` sur ce serveur : le navigateur ne peut pas se connecter directement, car WebSDR vérifie l'en-tête `Origin` et aucun script n'a le droit de le modifier. L'accord passe en trame texte sur la même connexion ; la couverture des bandes vient du relais
- `webSdrCodec.js` — le format audio de WebSDR : un flux étiqueté octet par octet dont les blocs compressés alimentent un prédicteur leaky-LMS à 20 prises. Porté depuis le client WebSDR et vérifié échantillon par échantillon
- `diversityList.js` — la liste des récepteurs enregistrés et les règles d'adresse des quatre types, partagées par le panneau de bureau et la page mobile pour qu'un seul format serve aux deux. Ainsi que le transfert — un blob compact, son code QR et un analyseur qui accepte toutes les formes que les deux pages ont jamais écrites — et `browseUrl()`, qui retransforme une adresse appelée en une adresse qu'un navigateur peut ouvrir
- `lib/DiversityPanel.svelte` — l'interface : adresse, type de source, correction de SNR et état en direct, ainsi que les récepteurs enregistrés — nommés, réordonnables, exportés et importés sous forme de fichier JSON, par type de source dans `localStorage`. Tout s'édite à l'intérieur du panneau : `prompt()` et `confirm()` bloquent le thread principal, celui-là même par lequel l'audio est poussé vers le worklet de lecture. Un bouton **▦ QR** dessine la liste en code scannable, car `localStorage` appartient à un navigateur et un téléphone démarre vide. `mobile/Mobile.svelte` reprend la même fonction dans un onglet **Div**, dans le CSS simple propre à cette page. Voir [Diversité de réception](RECEIVE_DIVERSITY.md)

#### 4d. Identificateur de mode (`modeId.js`, `modePriors.js`)
- Répond à « qu'est-ce que j'écoute ? ». Il lit la même prise PCM brute que les décodeurs et classe les modes probables, pour que l'opérateur choisisse le bon décodeur au lieu de les essayer tous les dix. Il ne décode jamais : il mesure des propriétés physiques du signal et les note face à une table de modes connus
- La largeur occupée est la largeur contiguë à −15 dB autour du pic, délibérément pas une valeur à 99 % de puissance : les clics de manipulation laissent de longues traînes sur l'intégrale de puissance et faisaient paraître tout mode étroit plusieurs fois trop large. La rapidité de modulation vient de la **fréquence instantanée** et non des énergies des tonalités, car aucune durée d'intégration ne résout à la fois un décalage de 170 Hz et un symbole de 100 Bd. La cadence de manipulation vient de l'enveloppe on/off et sert aussi d'indicateur de vitesse en CW
- `modePriors.js` apporte le seul indice que l'audio ne peut pas porter : l'endroit où vous êtes accordé. Un signal 100 Bd / 170 Hz sur 518 kHz est du NAVTEX ; le même signal sur 14,070 MHz ne l'est pas. Il ne fait que repondérer ce que le signal soutenait déjà, et n'invente jamais un candidat
- FT8, JS8 et FT2 sont annoncés comme un seul groupe à dessein : ils ne se séparent pas sur la seule largeur et le seul espacement des tonalités, et prétendre le contraire serait une réponse fausse énoncée avec assurance
- En dessous d'environ 10 dB de SNR, il se tait plutôt que de deviner
- Il tourne dans son propre Web Worker (`modeId.worker.js` + `modeIdWorkerProxy.js`), selon le même schéma moteur/worker/proxy que les décodeurs ci-dessus ; le résultat est la pastille de `lib/ModeIdChip.svelte`

#### 4e. Connexions refusées (`refused.js`, `clientVersion.js`)

- `refused.js` est le vocabulaire commun d'une connexion que le serveur éconduit : code de fermeture **4003** (au-delà d'une limite par adresse, ou page plus ancienne que `[server] min_client_version`) et **4001** (une exclusion par le sysop). Les deux sont définitifs. `audio.js`, `waterfall.js` et `events.js` importent tous `isRefusal()` de là, car tous trois ouvrent une connexion qui peut être refusée et tous trois doivent alors régler leur promesse d'initialisation — sinon la page attend indéfiniment une connexion qui ne viendra jamais
- Rien ne réessaie. Une connexion `/audio` tombée met fin à la session, délibérément : `/waterfall` et `/events` ne revenaient jamais avec une reconnexion, une session réessayée était donc de l'audio vivant sur une cascade figée, et face à une limite de débit chaque tentative prolongerait justement le refus qu'elle cherchait à contourner. La page de bureau explique un refus survenu au chargement et s'arrête simplement quand il survient en cours de session ; `/mobile` affiche une ligne invitant l'auditeur à recharger
- `clientVersion.js` contient un seul entier, `CLIENT_VERSION`, que la page ajoute à sa connexion audio sous la forme `/audio?v=N`. Le serveur éconduit tout ce qui est inférieur à `[server] min_client_version` : c'est ainsi qu'une station force les onglets exécutant encore une version antérieure à recharger — le seul levier existant, puisque le serveur n'atteint pas le JavaScript déjà en cours dans un navigateur. Incrémentez-le quand une modification du frontend ne doit plus être ignorée par les onglets ouverts
- Référence complète : [Limites de connexion](CONNECTION_LIMITS.md)

#### 5. Gestion d'état (`stores/`)
- Magasins de données réactifs
- État applicatif partagé
- Gestion des événements

---

### Fonctions clés

- Traitement audio en temps réel
- Décodage de modes numériques (FT8, RTTY, etc.)
- Filtrage audio
- Analyse spectrale

---


## Listes de fréquences (`frequencylist/`)

Les repères de fréquence sur la cascade. `mymarkers.json` est la liste que le récepteur affiche réellement ; le reste est la matière première que `update-markers.sh` transforme en elle, actualisée depuis les grilles en ligne. Le `README.md` de ce dossier explique la mise à jour dans les sept langues.

```
frequencylist/
├── mymarkers.json            # les repères affichés par le récepteur — édités à la main, survivent à une mise à jour
├── shortwavestations.json    # stations en ondes courtes, généré par generate-current-shortwave.py
├── 0.TXT                     # la grille HF mondiale A26, décompressée et analysée par update-markers.sh
├── a26allx2.zip              # archive source téléchargée par update-markers.sh
├── admin.txt · antenna.txt · broadcas.txt · fmorg.txt · language.txt · site.txt
│                             # listes annexes de la même source (sites, langues, administrateurs, antennes)
├── generate-current-shortwave.py
├── update-markers.sh         # actualise tout ce qui précède depuis les grilles en ligne
└── README.md
```

### Format (`mymarkers.json`, `shortwavestations.json`)

```json
[
    { "frequency": 77500,   "name": "DCF77", "mode": "CW" },
    { "frequency": 2485000, "name": "Vanuatu Broadcasting", "mode": "AM" }
]
```

---

## Fichiers de configuration

### Configuration du serveur (fichiers `.toml`)

Structure des fichiers de configuration :

```toml
[server]
# Web server settings
port = 9002
html_root = "frontend/dist/"
threads = 2
otherusers = 1

[limits]
# Limites par adresse — toutes désactivées ou à une valeur raisonnable par défaut,
# une configuration sans elles se comporte comme avant. Voir CONNECTION_LIMITS.md.
per_ip = 3              # auditeurs simultanés depuis une adresse
per_ip_rate = 40        # nouvelles connexions par minute depuis une adresse

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

### Informations du site (`site_information.json`)

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

## Système de compilation

### Configuration de compilation Meson

#### `meson.build` (racine)

Définit :
- Les métadonnées du projet
- Les dépendances
- Les options du compilateur
- Les listes de fichiers sources
- Les cibles de compilation

#### `meson_options.txt`

Options disponibles :
```
option('opencl', type: 'boolean', value: false, description: 'Enable OpenCL support')
option('cuda', type: 'boolean', value: false, description: 'Enable CUDA support')
option('optimization', type: 'string', value: '3', description: 'Optimization level')
```

---

## Dépendances entre fichiers

### Dépendances de compilation du backend

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

### Dépendances de compilation du frontend

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

## Flux de données

### Flux de fonctionnement du serveur

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

### Flux d'interaction utilisateur

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

## Guide de modification des fichiers

### Lorsque vous modifiez le code du backend (`src/**`) :

```bash
cd PhantomSDR-Plus
meson compile -C build
# Server restart required
```

### Lorsque vous modifiez le code du frontend (`frontend/src/**`) :

```bash
cd PhantomSDR-Plus/frontend
npm run build
cd ..
# Server restart required (for static files)
```

### Lorsque vous modifiez la configuration (`.toml`, `.json`) :

```bash
# Restart server
./stop-websdr.sh
./start-rtl.sh  # (or appropriate start script)
```

### Lorsque vous modifiez les marqueurs (`markers.json`) :

```bash
# Reload page in browser
# No server restart needed
```

---

## Chemins importants

### Chemins d'exécution

- **Configuration** : `./config-*.toml`
- **Racine HTML** : `./frontend/dist/`
- **Marqueurs** : `./markers.json`
- **Historique du chat** : `./chat_history.txt`
- **FFTW wisdom** : `./fftw_wisdom`, `./phantom_fftw_wisdom`

### Chemins de compilation

- **Binaire produit** : `./build/spectrumserver`
- **Sortie du frontend** : `./frontend/dist/`
- **Modules Node** : `./frontend/node_modules/`

### Chemins des sources

- **Sources du backend** : `./src/`
- **Sources du frontend** : `./frontend/src/`
- **Bibliothèques DSP** : `./jsdsp/`

---

## Opérations courantes sur les fichiers

### Ajouter une nouvelle configuration SDR

1. Copiez une configuration existante : `cp config-rtl.toml config-mydevice.toml`
2. Modifiez les paramètres : `nano config-mydevice.toml`
3. Créez un script de démarrage : `cp start-rtl.sh start-mydevice.sh`
4. Modifiez le script de démarrage : `nano start-mydevice.sh` — ne changez que le bloc **RECEIVER CONFIGURATION** en tête (`RX_LABEL`, `RX_COMM` = le nom du processus du récepteur, `RX_ARGS`, `CONFIG`, `FIFO`, ainsi que le hook `prestart` si l'appareil en a besoin). La logique de lancement/chien de garde/journalisation en dessous est générique et ne nécessite aucune modification.
5. Rendez-le exécutable : `chmod +x start-mydevice.sh`

> `stop-websdr.sh` arrête déjà n'importe quel `start-*.sh --watchdog` ; si votre récepteur utilise un nom de processus autre que `rx888_stream`/`rx_sdr`/`rtl_sdr`/`hackrf_transfer`/`cf32_to_real`, ajoutez-y aussi une ligne `killall -9 <nom>`.

### Personnaliser le frontend

1. Modifiez la source : `nano frontend/src/App.svelte`
2. Recompilez : `cd frontend && npm run build && cd ..`
3. Redémarrez le serveur : `./stop-websdr.sh && ./start-rtl.sh`

### Ajouter des marqueurs personnalisés

1. Modifiez le fichier de marqueurs : `nano markers.json`
2. Format :
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
3. Rechargez le navigateur (aucun redémarrage du serveur nécessaire)

---

## Gestion de versions

### Fichiers à suivre dans Git

- Code source (`src/`, `frontend/src/`, `jsdsp/`)
- Exemples de configuration (`config.example.*.toml`)
- Système de compilation (`meson.build`, `meson_options.txt`)
- Documentation (`*.md`, `docs/`)
- Scripts (`*.sh`)

### Fichiers à ignorer (`.gitignore`)

- Résultats de compilation (`build/`, `frontend/dist/`)
- Dépendances (`frontend/node_modules/`)
- Données utilisateur (`chat_history.txt`)
- Configurations personnelles (`config-rtl.toml` s'il est personnalisé)
- Données binaires (`*.o`, `*.so`)

---

**Cette documentation de la structure devrait vous aider à naviguer dans le code de PhantomSDR-Plus et à le comprendre.**

Pour les instructions d'installation, voir [INSTALLATION.md](INSTALLATION.md). Pour les informations d'utilisation, voir [USER_GUIDE.md](USER_GUIDE.md).

**73 de SV1BTL & SV2AMK**
