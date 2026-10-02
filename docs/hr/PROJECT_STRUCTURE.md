# Struktura projekta PhantomSDR-Plus

Ovaj dokument daje sveobuhvatan pregled strukture direktorija PhantomSDR-Plusa, organizacije datoteka i odnosa među komponentama.

---

## Sadržaj

1. [Stablo direktorija](#stablo-direktorija)
2. [Korijenski direktorij](#korijenski-direktorij)
3. [Izvorni kod (`src/`)](#izvorni-kod-src)
4. [Sučelje (`frontend/`)](#sučelje-frontend)
5. [Popisi frekvencija (`frequencylist/`)](#popisi-frekvencija-frequencylist)
6. [Konfiguracijske datoteke](#konfiguracijske-datoteke)
7. [Sustav izgradnje](#sustav-izgradnje)

---

## Stablo direktorija
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
├── cf32_to_real.c             # Fobos HF: zadržava I iz CF32 od rx_sdr, skaliran na s16 (gradi ga setup-fobos.sh)
├── chat_history.txt
├── check-go.sh                # staro: nadzornik lanca go.sh
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
│   ├── A26all00.TXT           # nije u repozitoriju: update-markers.sh ga raspakira iz a26allx2.zip
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
│   ├── .prettierrc.json      # Prettier pravila oblikovanja za izvor frontenda
│   ├── public
│   │   ├── analyze_users.py
│   │   ├── decoders
│   │   │   ├── ft8_lib.wasm
│   │   │   ├── js8_dict.bin   # JS8 rječnik riječi, učitava se tek kad zatreba
│   │   │   └── js8.wasm       # JS8 dekoder, izgrađen iz jsdsp/js8_wasm
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
│   │   │   ├── rnnoise.js     # učitava RNNoise za smanjenje šuma umjetnom inteligencijom
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
├── go.sh                      # stari lanac pokretanja, zamijenjen s start-<radio>.sh
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
│   ├── js8_wasm               # JS8 dekoder u C-u, preveden u WebAssembly, s testovima i referentnom provjerom — vidi njegov README
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
├── kill.sh                    # staro: gasi procese poslužitelja, poziva ga go.sh
├── kiwi_install.sh             # instalira KiwiSDR most u postojeće stablo
├── LICENSE
├── logproxy                   # rotirane kopije zapisnika ploče/posrednika/autoruna
├── logrotate
│   └── phantomsdr             # logrotate konfiguracija za proxy.log + admin.log (prije instalacije prilagodite putanje)
├── manage_admin.sh
├── markers.json
├── meson.build
├── meson_options.txt
├── phantom_fftw_wisdom
├── phantomsdr-admin.service   # ogledna systemd jedinica za ploču (pokreće se pri dizanju sustava, ponovno nakon pada)
├── phantomsdr-proxy.service   # ogledna systemd jedinica za proxy, instalira se zajedno s jedinicom ploče
├── phantomsdr-websdr-relay.service  # primjer systemd unita za WebSDR diverziti relej
├── proxy.py
├── rade_helper.py
├── rade_loadtest.csv          # izlaz rade_loadtest.py (jedan redak po koraku opterećenja)
├── rade_loadtest.py           # RADE test opterećenja: koliko istodobnih dekodera stroj podnosi — vidi docs/RADE_README.md
├── rade.sh
├── README.md
├── recompile.sh
├── _relaunch.sh               # staro: pomoćnik odgođenog ponovnog pokretanja lanca go.sh
├── request.hpp
├── setup_admin.sh
├── setup-airspyhf.sh          # lanac upravljačkog programa Airspy HF+: libairspyhf + SoapyAirspyHF + rx_sdr + udev
├── setup-cpufreq-perms.sh     # daje grupi pravo pisanja u scaling_max_freq kako bi zaštita mogla usporiti bez roota
├── setup-firewall.sh          # neobvezna nftables zaštita — vidi docs/CONNECTION_LIMITS.md
├── setup-fobos.sh             # lanac upravljačkog programa Fobos: libfobos + SoapyFobosSDR + rx_sdr + cf32_to_real + udev
├── setup-hackrf.sh            # HackRF: paket hackrf iz distribucije + udev (ništa se ne gradi)
├── setup-rsp1a.sh             # lanac upravljačkog programa RSP1A: libmirisdr-5 + SoapyMiri + rx_sdr + crna lista msi2500 + udev
├── setup-rx888-udev.sh
├── setup-sdr-common.sh        # zajedničke pomoćne funkcije triju setup skripti iznad
├── setup_websdr_relay.sh      # instalira WebSDR diverziti relej (port, identitet, systemd)
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
│   ├── kiwi_bridge.h          # most KiwiSDR protokola — vidi docs/Aether_config.md
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
│   └── tci-rigctld.mjs        # TCI poslužitelj za Hamlib uređaje (IC-7300…), radi na računalu slušatelja — vidi docs/RIG_CONTROL.md
├── thermal_guard.py           # Zaštita od pregrijavanja procesora za administratorsku ploču (radi i samostalno)
├── thermal-guard.service      # primjer systemd jedinice za čuvara, bez administratorske ploče
├── tmpfiles
│   └── phantomsdr-logs.conf   # drži admin.log + proxy.log u vlasništvu korisnika ploče (prije instalacije prilagodite putanje)
├── update.sh
├── waterfall.sh
├── websdr_relay.json.example  # predložak konfiguracije (port, ograničenja, identitet stanice)
├── websdr_relay.py            # sam relej — vidi docs/RECEIVE_DIVERSITY.md
├── websocketpp_asio_connection.hpp  # Boost >= 1.87 sloj: ws_post umjesto io_service::post
├── websocketpp_asio_endpoint.hpp    # Boost >= 1.87 sloj: ws_work / ws_restart, max_listen_connections
├── websocketpp_asio.hpp        # Boost >= 1.87 sloj za websocketpp (io_context, executor_work_guard)
└── xgo.sh                     # staro: pokreće spectrumserver, poziva ga check-go.sh
```
---

## Korijenski direktorij

### Konfiguracijske datoteke

| Datoteka | Svrha | Kada je mijenjati |
|----------|-------|-------------------|
| `config.toml` | Zadana konfiguracija | Početno postavljanje, testiranje |
| `config-rtl.toml` | Konfiguracija specifična za RTL-SDR | Pri korištenju RTL-SDR uređaja |
| `config-rsp1a.toml` | Konfiguracija za SDRplay RSP1A | Pri korištenju RSP1A |
| `config-airspyhf.toml` | Konfiguracija za Airspy HF+ | Pri korištenju Airspyja |
| `config-fobos-hf.toml` | RigExpert Fobos SDR, HF1/HF2 izravno uzorkovanje (0-25 MHz) | Pri korištenju Fobosa na KV |
| `config-fobos.toml` | RigExpert Fobos SDR, RF grana (25-6000 MHz) | Pri korištenju Fobosa iznad 25 MHz |
| `config-hackrf.toml` | Konfiguracija za HackRF One | Pri korištenju HackRF-a |
| `config-rx888mk2.toml` | Konfiguracija za RX888 MK2 | Pri korištenju RX888 |
| `config.example.hackrf.toml` | Primjer za HackRF One | Pri korištenju HackRF-a |

### Skripte za pokretanje/zaustavljanje i održavanje

Svaka od donjih `start-*.sh` skripti samostalan je **pokretač + watchdog + zapisivač**: zaustavlja svaku pokrenutu instancu, podiže prijamnik + `spectrumserver`, odvaja se u pozadinu, automatski ponovno pokreće lanac ako se ugasi i zapisuje u `logwebsdr.txt`. Dijele jednu skriptu za zaustavljanje i jedno `flock` zaključavanje (istodobno radi samo jedan prijamnik). Uredite samo blok **RECEIVER CONFIGURATION** na vrhu svake (argumenti prijamnika / konfiguracija / naziv procesa). Šest skripti za pokretanje izrađenih iz istog predloška (`start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos.sh`, `start-fobos-hf.sh`, `start-hackrf.sh`) identične su ispod tog bloka; `start-rx888mk2.sh` je zasebna skripta.

| Skripta | Svrha |
|---------|-------|
| `install.sh` | Automatizirana instalacija i izgradnja |
| `start-rtl.sh` | Pokretanje + watchdog poslužitelja s RTL-SDR-om (`rtl_sdr`) |
| `start-rsp1a.sh` | Pokretanje + watchdog poslužitelja sa SDRplay RSP1A (`rx_sdr`); koristi libmirisdr-5, ili SDRplay API kad je instaliran (`RX_DRIVER` nameće jedan) |
| `start-airspyhf.sh` | Pokretanje + watchdog poslužitelja s Airspy HF+ (`rx_sdr`) |
| `start-fobos-hf.sh` | Pokretanje + watchdog poslužitelja s RigExpert Fobos SDR, HF1/HF2 izravno uzorkovanje (`rx_sdr \| cf32_to_real`) |
| `start-fobos.sh` | Pokretanje + watchdog poslužitelja s RigExpert Fobos SDR, RF grana (`rx_sdr`) |
| `start-hackrf.sh` | Pokretanje + watchdog poslužitelja s HackRF One (`hackrf_transfer`) |
| `start-rx888mk2.sh` | Pokretanje + watchdog poslužitelja s RX888 MK2 (`rx888_stream`) |
| `stop-websdr.sh` | Zaustavlja poslužitelj i njegov watchdog — zajedničko za sve prijamnike |
| `setup-rx888-udev.sh` | Instalira udev pravila da `rx888_stream` za RX-888 radi bez sudo |
| `setup-rsp1a.sh` / `setup-fobos.sh` / `setup-airspyhf.sh` | Instaliraju SoapySDR lanac upravljačkog programa za RSP1A, Fobos ili Airspy HF+ — SoapySDR iz distribucije, upravljački program i rx_tools izgrađeni u `sdr_drivers/`, udev pravilo — na bilo kojoj od četiri podržane distribucije. Pokreću ih opcije 3, 5 i 6 instalacije; rade i samostalno. Zajednički kod u `setup-sdr-common.sh` — vidi [Vodič za instalaciju](INSTALLATION.md#prijamnici-preko-soapysdr-a-rsp1a-fobos-airspy-hf) |
| `setup-hackrf.sh` | Instalira paket `hackrf` iz distribucije i udev pravilo za HackRF One, na bilo kojoj od četiri podržane distribucije; pokreće ga opcija 7 instalacije |
| `setup-firewall.sh` | Neobvezna zaštita od poplave na razini jezgre: učitava nftables tablicu s gornjom granicom istodobnih veza i brzinom po izvorišnoj adresi na priključcima prijemnika, kočnicom za grubo pogađanje SSH lozinki i Windows dijeljenjem datoteka zatvorenim izvan privatnih raspona. Treba root, ne može vas zaključati vani (policy accept, uspostavljene veze prihvaćaju se prve), a `--apply` se sam poništi ako se ne potvrdi unutar 60 s — vidi [Ograničenja veza](CONNECTION_LIMITS.md) |
| `setup-cpufreq-perms.sh` | Daje grupi `cpufreq` pravo pisanja na ograničenje frekvencije procesora, kako bi throttle faza čuvara radila bez roota. Instalira `tmpfiles.d` pravilo da preživi ponovno pokretanje; `--revoke` sve poništava |
| `update.sh` | Ažuriranje instalacije iz objavljenog stabla, bez diranja vaše konfiguracije, oznaka, popisa frekvencija i vlastitih izmjena — vidi [Vodič za instalaciju](INSTALLATION.md) |
| `recompile.sh` | Ponovna izgradnja backenda i/ili frontenda te odabir varijante koja se poslužuje na `/` |
| `smeter_theme.sh` | Postavi zadani izgled analognog S-metra (dark / amber / vintage) za sve korisnike i ponudi ponovnu izgradnju frontenda — vidi [Uređivanje varijanti](EDITING_VARIANTS.md) |
| `waterfall.sh` | Mijenja zadanu minimalnu razinu slapa (dB) u `waterfall.js` + `App.svelte` — vidi [README](README.md) |
| `kiwi_install.sh` | Instalira emulaciju KiwiSDR klijenata na stablo koje je nema: zakrpava izvorni kod pozadinskog dijela, kopira `src/kiwi_bridge.h` i dodaje dokumentirani `[kiwi_emulation]` blok u konfiguracijske datoteke u korijenu. Idempotentan je i sprema kopiju svake datoteke koje se dotakne — vidi [Emulacija KiwiSDR klijenata](Aether_config.md) |
| `tci-bridge/tci-rigctld.mjs` | Prijemnik ga ne koristi. Mali Node.js program koji slušatelj pokreće uz vlastiti primopredajnik: čita frekvenciju, način rada i stanje odašiljanja iz Hamlibova `rigctld` i nudi ih kao TCI na portu 50001, pa gumb **TCI-CAT** na stranici može upravljati uređajem bez vlastitog TCI-ja, poput IC-7300 — vidi [Upravljanje primopredajnikom](RIG_CONTROL.md) |

**Stari lanac pokretanja.** `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh` i `_relaunch.sh` prethodni su naraštaj skripti za pokretanje, nadzor i zaustavljanje. Sve što su radile sada je unutar svakog `start-<radio>.sh`, i to je ono što treba koristiti. Ostaju na disku jer ih postojeće instalacije referenciraju i više se ne održavaju.

### Podatkovne datoteke

| Datoteka | Svrha | Format |
|----------|-------|--------|
| `markers.json` | Frekvencijske oznake i markeri | JSON |
| `chat_history.txt` | Poruke korisničkog razgovora | Običan tekst |
| `favicon.ico` | Ikona web-mjesta | ICO slika |
| `fftw_wisdom` | Podaci za optimizaciju FFT-a | FFTW binarno |
| `phantom_fftw_wisdom` | Dodatna optimizacija FFT-a | FFTW binarno |

### Administratorska ploča i prijavljivanje spotova

| Datoteka | Svrha |
|----------|-------|
| `admin_server.py` | Sama administratorska ploča. Uz stranice za upravljanje pokreće i uzorkivač stranice **Grafikoni**: pozadinska dretva svake 2 sekunde bilježi frekvenciju procesora, opterećenje, temperaturu i broj korisnika te ih drži samo u memoriji — 1 sat u punoj razlučivosti plus 24 sata prosjeka po 30 sekundi. Ništa se ne zapisuje na disk pa se povijest gubi pri ponovnom pokretanju. |
| `admin_config.json` | Postavke administratorske ploče (hash lozinke, portovi, opcije, pragovi toplinske zaštite) |
| `thermal_guard.py` | Zaštita od pregrijavanja procesora. Zaustavlja poslužitelj kada procesor postane prevruć i ponovno ga pokreće kad se ohladi, izvodeći pragove iz kritičnog praga koji objavljuje vaš vlastiti procesor umjesto iz fiksnog broja. Nikada ne pokušava prepoznati što nadzire poslužitelj — dok je pregrijan, ponavlja zaustavljanje svake 2 s, pa je watchdog, systemd jedinica ili cron zadatak koji ga oživi poništen dok se stroj ne ohladi. Samo standardna biblioteka; uvozi ga `admin_server.py` (takt daje uzorkivač Grafikona), a radi i samostalno za instalacije bez ploče. Zadano samo zapisuje, pa ni na što ne djeluje dok se ne uključi — vidi [Administratorska ploča]vidi [priručnik Thermal Guard](THERMAL_GUARD.md) |
| `autorun/` | Daemon za prijavljivanje spotova — vidi [Autorun Spot Reporter](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr) |
| `autorun.json` | Pojasevi/načini rada za dekodiranje, identitet i odredišta |
| `autorun-status.json` | Trenutačno stanje daemona — puni brojače **tekućeg rada** (pločice po dekoderu), koje Stop/Start vraća na nulu |
| `autorun-totals.json` | **Ukupno** poslani spotovi po pojasu i načinu rada — broj uz svaki potvrdni okvir; zapisuje ga daemon pa preživljava ponovna pokretanja |

### Datoteke sustava izgradnje

| Datoteka | Svrha |
|----------|-------|
| `meson.build` | Glavna konfiguracija izgradnje |
| `meson_options.txt` | Podesive opcije izgradnje |
| `.gitattributes` | Atributi Git repozitorija |

---

## Izvorni kod (`src/`)

Direktorij `src/` sadrži implementaciju pozadinskog dijela u C++-u.

### Ključne komponente

#### 1. Glavna aplikacija (`main.cpp`)
- Raščlanjuje argumente naredbenog retka
- Učitava konfiguracijsku datoteku
- Inicijalizira komponente poslužitelja
- Pokreće petlju događaja

#### 2. Poslužitelj spektra (`spectrumserver.cpp`)
- Koordinira sve komponente
- Upravlja korisničkim vezama
- Distribuira podatke spektra
- Obrađuje korisničke zahtjeve

#### 3. Upravljački programi za SDR (`drivers/`)
- Apstraktno sučelje za SDR hardver
- Čitanje i oblikovanje podataka uzoraka
- Rukovanje značajkama specifičnima za uređaj

#### 4. DSP mehanizam (`dsp/`)
- Izračun FFT-a (ubrzan CPU-om/GPU-om)
- Demodulacija (AM, FM, SSB, CW itd.)
- Filtriranje i ponovno uzorkovanje zvuka
- AGC i smanjenje šuma

#### 5. Web-poslužitelj (`server/`)
- Komunikacija putem WebSocketa
- Posluživanje statičkih HTTP datoteka
- Upravljanje korisničkim sesijama
- Prijenos podataka u stvarnom vremenu

#### 6. Kodiranje zvuka (`audio/`)
- FLAC kompresija
- Opus kompresija
- Optimizacija emitiranja

---

## Sučelje (`frontend/`)

Web-sučelje izgrađeno pomoću Sveltea i Vitea.


#### 1. Glavna aplikacija (`App.svelte`)
- Komponenta najviše razine
- Struktura rasporeda
- Usklađivanje komponenti
- **Red gumba dekodera** — po jedan gumb za svaki dekoder na glavnoj ploči, odmah ispod izbornika načina rada; jedan pritisak pokreće dekoder i otvara njegov prozor, drugi ga zaustavlja. Zamijenio je dotadašnji red za širinu pojasa. RADEL/RADEU su u `lib/ModesSelector.svelte`, uz izbornik načina rada te u skočnim prozorima **Modes** i **Bands**.

#### 2. Prikaz slapa (`waterfall.js` + `lib/`)
- Iscrtavanje spektra i slapa na platnu (canvas), palete boja i prilagodljivo automatsko podešavanje — sve u `waterfall.js` (čisti JS, nije komponenta)
- Interaktivno ugađanje putem `lib/PassbandTuner.svelte`
- Preklopi plana pojaseva i oznaka putem `lib/FrequencyMarkers.svelte`
- Audio spektrogram zasebna je komponenta: `lib/Spectrogram.svelte`

#### 3. Kontrole (`App.svelte` + `lib/`)
- Unos i prikaz frekvencije — `lib/FrequencyInput.svelte`
- Odabir načina rada (AM/FM/SSB/CW) — `lib/ModesSelector.svelte`, promjena pojasa — `lib/BandSelector.svelte`
- AGC/NR/NB i ostale kontrole nalaze se u samom `App.svelte`; zasebna `Controls.svelte` ne postoji

#### 3a. Skener (`scanner.js`)
- Pretraga kanala: vodi prijemnik preko raspona i zaustavlja se na prvom kanalu sa signalom. Čisti JS, ne komponenta — `App.svelte` daje VFO, način rada, plan pojaseva i poziv za ugađanje, a natrag prima stanje sučelja kroz jedan povratni poziv
- Prag je u dB iznad šuma pojasa umjesto apsolutne razine i koristi šum koji `waterfall.js` ionako prati (`snrNoiseDb`), pa mu ne treba vlastita kalibracija
- Dva načina prelaska pojasa: ugoditi i poslušati svaki kanal, ili najprije pregledati spektar i ugoditi samo ono što se ne može isključiti. Spektar smije preskočiti kanal, ali nikada stati na njemu — svako zaustavljanje dolazi iz stvarnog slušanja
- Raspon je ili pojas iz plana pojaseva ili točno ono što slap prikazuje; automatski nastavak, najdulje zadržavanje i popis isključenih kanala također su ovdje i čuvaju se u `localStorage`

#### 4. Audiosustav (`audio.js`)
- Audiotok putem WebSocketa
- Dekodiranje FLAC-a/Opusa
- Upravljanje reprodukcijom zvuka
- Distribuira sirovi PCM (uzet prije AGC-a, smanjenja šuma i utišavanja) dekoderima načina rada
- Smanjenje šuma umjetnom inteligencijom: `lib/rnnoise.js` učitava RNNoise WebAssembly modul (`@jitsi/rnnoise-wasm`) pri prvoj uporabi; `audio.js` ga primjenjuje samo u govornim načinima, iza odvojka za dekodere, pa ga oni nikad ne čuju

#### 4a. Dekoderi načina rada i njihovi workeri

Svaki od zahtjevnih dekodera načina rada izvodi se u vlastitom Web Workeru, pa dekodiranje nikada ne blokira reprodukciju zvuka ni slap. Slijede jedan zajednički obrazac — tri datoteke po dekoderu:

| Dekoder | Mehanizam | Worker | Proxy na glavnoj dretvi |
|---------|-----------|--------|--------------------------|
| SSTV | `sstv.js` | `sstv.worker.js` | `sstvWorkerProxy.js` |
| HF FAX | `fax.js` | `fax.worker.js` | `faxWorkerProxy.js` |
| NAVTEX + FSK/RTTY + PSK31 + Olivia | `fsk.js`, `psk31.js`, `olivia.js` | `fsk.worker.js` | `fskWorkerProxy.js` |
| CW | `cwDecoder.js` | `cw.worker.js` | `cwWorkerProxy.js` |

- **Mehanizam** je čisti DSP kod koji ništa ne zna o workerima, pa se može pokrenuti i izravno (jedinični testovi ili rezervni rad u istoj dretvi).
- **Worker** drži jednu instancu mehanizma i doslovno prosljeđuje njegove događaje.
- **Proxy** zrcali skup metoda mehanizma, pa ga `audio.js` poziva jednako kao što bi pozvao sam dekoder. Worker stvara odgođeno, pri prvom uključivanju, i prelazi na rad u istoj dretvi ako workeri nisu dostupni.

Dvije su pojedinosti ključne: PCM se **kopira** u novi međuspremnik prije prijenosa workeru (prijenos pogleda na audioakumulator odvojio bi ga i prekinuo reprodukciju), a workerova poruka `init` ponovno primjenjuje konfiguraciju na već pokrenuti mehanizam umjesto da pretpostavlja novi.

`fsk.js` iz jednog mehanizma poslužuje i NAVTEX i FSK/RTTY, uz odabir po instanci pomoću polja `role`; svaka instanca ima vlastito stanje, pa oba mogu raditi neovisno.

Uloga `fsk` dodatno ugošćuje dva dekodera koji uopće nisu FSK. Odabirom inačice `psk31` ili `olivia`, `fsk.js` predaje zvuk modulu `psk31.js` odnosno `olivia.js` umjesto vlastitom diskriminatorskom lancu, ali i dalje posuđuje njegovu konfiguraciju, worker i sustav događaja — pa `fsk.worker.js`, `fskWorkerProxy.js` i `audio.js` ne moraju znati ništa ni o jednom od ta dva načina rada, a sučelje posvuda prima iste događaje `char`/`status`/`metrics`.

- `psk31.js` — BPSK31: kompleksni osnovni pojas, prilagođeni filtar, diferencijalna detekcija i varicode, uz spektralno grubo hvatanje i fini AFC raspona približno ±25 Hz.
- `olivia.js` — Olivia MFSK: prijenos MFSK prijamnika Pawela Jaloche iz fldigija (`pj_mfsk.h`, GPL-3, kao i ovaj projekt), uključujući Walsh/Hadamard korekciju pogrešaka i slijepo traženje sinkronizacije po fazi bloka i frekvencijskom pomaku.
- `broadcastSchedules.js` — UTC rasporedi koje FAX, NAVTEX i RTTY dekoderi nude kao pripremljene postavke, iz NOAA/NWS rasporeda pomorskog faksimila i objavljenih popisa NAVTEX postaja

#### 4b. Diverziti prijam (`diversity.js`)
- Povezuje lokalni prijamnik s drugim na drugoj lokaciji i prati onu koja trenutačno ima bolji signal. Običan JS, ne komponenta — oslanja se na jedno mjesto u `audio.js`, koje mu predaje lokalni PCM i reproducira ono što vrati
- **Odabir, ne zbrajanje.** Dvije lokacije čuju isti prijenos preko različitih ionosferskih putova, pa im valni oblici imaju nepovezanu fazu; zbrajanje zvuči češljasto filtrirano. Koherentno spajanje tražilo bi zajednički takt, koji dva prijamnika preko interneta ne dijele. Miješa se samo tijekom preklapanja od 30 ms
- Poravnanje korelira dvije **zvučne ovojnice** (logaritamska snaga na 100 Hz), nikad valne oblike — ovojnica preživljava i put i bilo koji kodek. Zaključavanje se prihvaća tek kad se druga, neovisna pretraga složi, čime se odbacuje uvjerljivo ali pogrešno kašnjenje koje bi dale dvije lokacije koje blijede u protufazi
- Udaljeni tok se najprije **zaključava po brzini** na lokalni. Dva prijamnika znače dva takta i dva lanca decimacije, pa im zvuk stiže i do 2% razmaknuto čak i kad oba prijavljuju 12 kHz — 240 uzoraka u sekundi klizanja, što nijedna korelacija ne zadržava. Omjer se mjeri iz toga koliko uzoraka svaka strana stvarno isporuči, a primjenjuje ga preuzorkivač koji nosi svoju razlomljenu fazu preko granica blokova, pa proizvoljan omjer drži neograničeno
- Odabir lokacije koristi percentilni SNR mjeren na **sadržajno poravnatim** uzorcima, uz histerezu, mjerač zadržavanja i brzi izlaz ako aktivna lokacija propadne. Razine se usklađuju šum na šum, pa promjena ne mijenja pozadinski šum
- Dekoderi zadržavaju **lokalni** tok: FT8, JS8, WSPR i RADE integriraju koherentno kroz odsječak, a promjena usred njega prekid je faze koji može stajati dekodiranja

#### 4c. Izvori diverzitija (`remoteSource.js`, `kiwiSource.js`, `uberSource.js`, `webSdrSource.js`)
- Jedan ugovor — `onPcm` / `onState` / `tune` / `canReceive` — tako da `diversity.js` nikad ne saznaje što je s druge strane. Dodavanje vrste prijamnika je jedna nova datoteka
- `remoteSource.js` — još jedan PhantomSDR-Plus preko `/audio` (cbor + FLAC), uz ponovnu upotrebu `createDecoder()` iz `lib/wrappers.js`
- `kiwiSource.js` — KiwiSDR: `SND` okviri, big-endian PCM, s 10-bajtnim GPS vremenskim žigom koji stereo paket umeće ispred zvuka
- `uberSource.js` — UberSDR preko vlastitog `/ws`: Opus iza 21-bajtnog zaglavlja, ugađanje preko otvorene veze. Identifikator sesije mora se prije prijaviti s `POST /connection` i mora biti UUID
- `webSdrSource.js` — WebSDR, kroz `websdr_relay.py` na ovom poslužitelju: preglednik se ne može spojiti izravno jer WebSDR provjerava zaglavlje `Origin`, a nijedna skripta ga ne smije mijenjati. Ugađanje ide kao tekstni okvir istom vezom; pokrivenost opsega daje relej
- `webSdrCodec.js` — WebSDR-ov audio format: bajtno označen tok čiji komprimirani blokovi pogone leaky-LMS prediktor s 20 odvoda. Prenesen iz WebSDR klijenta i provjeren uzorak po uzorak
- `diversityList.js` — popis spremljenih prijamnika i pravila adresa za četiri vrste, zajednički stolnoj ploči i mobilnoj stranici, tako da jedan format služi objema. Uz to i prijenos — kompaktan blob, njegov QR kod i parser koji prihvaća svaki oblik koji su dvije stranice ikad zapisale — te `browseUrl()`, koja pozvanu adresu vraća u onu koju preglednik može otvoriti
- `lib/DiversityPanel.svelte` — sučelje: adresa, vrsta izvora, SNR trim i stanje uživo, uz spremljene prijamnike — imenovane, slobodnog redoslijeda, s izvozom i uvozom u JSON datoteku, po vrsti izvora u `localStorage`. Sve se uređuje unutar ploče: `prompt()` i `confirm()` blokiraju glavnu dretvu, a upravo se preko nje zvuk gura u playback worklet. Gumb **▦ QR** crta popis kao kod za skeniranje, jer `localStorage` pripada jednom pregledniku, a mobitel počinje prazan. `mobile/Mobile.svelte` nosi istu funkciju u kartici **Div**, u vlastitom jednostavnom CSS-u te stranice. Vidi [Diverziti prijam](RECEIVE_DIVERSITY.md)

#### 4d. Prepoznavanje načina rada (`modeId.js`, `modePriors.js`)
- Odgovara na pitanje „što slušam?". Čita isti sirovi PCM odvod kao i dekoderi te rangira vjerojatne načine rada, kako bi operator odabrao pravi dekoder umjesto da isproba svih deset. Nikada ne dekodira: mjeri fizikalna svojstva signala i boduje ih prema tablici poznatih načina
- Zauzeta širina je povezana širina na −15 dB oko vrha, namjerno ne vrijednost od 99 % snage: klikovi manipulacije ostavljaju duge repove na integralu snage i činili su da svaki uski način izgleda višestruko preširok. Brzina simbola dolazi iz **trenutne frekvencije**, a ne iz energija tonova, jer nijedno vrijeme integracije ne razlučuje istodobno pomak od 170 Hz i simbol od 100 Bd. Brzina manipulacije dolazi iz on/off ovojnice i ujedno služi kao očitanje brzine CW-a
- `modePriors.js` dodaje jedini trag koji zvuk ne može nositi: gdje ste ugođeni. Signal 100 Bd / 170 Hz na 518 kHz je NAVTEX; isti signal na 14,070 MHz nije. Samo preteže ono što je signal već podupirao i nikada ne izmišlja kandidata
- FT8, JS8 i FT2 namjerno se prijavljuju kao jedna skupina: ne razdvajaju se samo po širini i razmaku tonova, a tvrditi suprotno bilo bi samouvjereno pogrešan odgovor
- Ispod otprilike 10 dB SNR-a šuti umjesto da nagađa
- Radi u vlastitom Web Workeru (`modeId.worker.js` + `modeIdWorkerProxy.js`), po istom obrascu engine/worker/proxy kao i dekoderi iznad; rezultat je oznaka u `lib/ModeIdChip.svelte`

#### 4e. Odbijene veze (`refused.js`, `clientVersion.js`)

- `refused.js` je zajednički rječnik za vezu koju poslužitelj odbija: kôd zatvaranja **4003** (iznad ograničenja po adresi, ili je stranica starija od `[server] min_client_version`) i **4001** (sysopovo izbacivanje). Oba su konačna. `audio.js`, `waterfall.js` i `events.js` svi uvoze `isRefusal()` odande, jer sva tri otvaraju vezu koja može biti odbijena i sva tri tada moraju razriješiti svoje inicijalizacijsko obećanje — inače stranica zauvijek čeka vezu koja nikad neće doći
- Ništa ne pokušava ponovno. Pala `/audio` veza namjerno završava sesiju: `/waterfall` i `/events` nikad se nisu vraćali s ponovnim spajanjem, pa je ponovljena sesija bila živi zvuk na zamrznutom slapu, a pred ograničenjem brzine svaki bi pokušaj produljio upravo ono odbijanje koje je htio zaobići. Stolna stranica objašnjava odbijanje koje se dogodi pri učitavanju i jednostavno stane kad se dogodi usred sesije; `/mobile` prikazuje jedan redak koji slušatelju kaže da osvježi
- `clientVersion.js` sadrži jedan jedini cijeli broj, `CLIENT_VERSION`, koji stranica dodaje svojoj zvučnoj vezi kao `/audio?v=N`. Poslužitelj odbija sve ispod `[server] min_client_version`, i tako stanica prisiljava kartice koje još rade na starijoj inačici da se osvježe — jedina poluga koja postoji, jer poslužitelj ne doseže JavaScript koji već radi u pregledniku. Povećajte ga kad promjenu u frontendu otvorene kartice više ne smiju ignorirati
- Potpuna referenca: [Ograničenja veza](CONNECTION_LIMITS.md)

#### 5. Upravljanje stanjem (`stores/`)
- Reaktivne pohrane podataka
- Zajedničko stanje aplikacije
- Rukovanje događajima

---

### Ključne značajke

- Obrada zvuka u stvarnom vremenu
- Dekodiranje digitalnih načina rada (FT8, RTTY itd.)
- Filtriranje zvuka
- Analiza spektra

---


## Popisi frekvencija (`frequencylist/`)

Oznake frekvencija na slapu. `mymarkers.json` je popis koji prijamnik doista prikazuje; ostalo je sirovina koju `update-markers.sh` pretvara u njega, osvježena iz mrežnih rasporeda.
`README.md` u toj mapi objašnjava ažuriranje na svih sedam jezika.

```
frequencylist/
├── mymarkers.json            # oznake koje prijamnik prikazuje — ručno uređivane, preživljavaju ažuriranje
├── shortwavestations.json    # kratkovalne postaje, generira ih generate-current-shortwave.py
├── 0.TXT                     # globalni A26 HF raspored, raspakira ga i obrađuje update-markers.sh
├── a26allx2.zip              # izvorna arhiva koju preuzima update-markers.sh
├── admin.txt · antenna.txt · broadcas.txt · fmorg.txt · language.txt · site.txt
│                             # pomoćni popisi iz istog izvora (lokacije, jezici, administratori, antene)
├── generate-current-shortwave.py
├── update-markers.sh         # osvježava sve navedeno iz mrežnih rasporeda
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

## Konfiguracijske datoteke

### Konfiguracija poslužitelja (datoteke `.toml`)

Struktura konfiguracijskih datoteka:

```toml
[server]
# Web server settings
port = 9002
html_root = "frontend/dist/"
threads = 2
otherusers = 1

[limits]
# Ograničenja po adresi — sva su zadano isključena ili na razumnoj vrijednosti,
# pa se postava bez njih ponaša kao i prije. Vidi CONNECTION_LIMITS.md.
per_ip = 3              # istodobni slušatelji s jedne adrese
per_ip_rate = 40        # nove veze u minuti s jedne adrese

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

### Podaci o lokaciji (`site_information.json`)

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

## Sustav izgradnje

### Konfiguracija izgradnje u Mesonu

#### `meson.build` (korijen)

Definira:
- Metapodatke projekta
- Ovisnosti
- Opcije prevoditelja
- Popise izvornih datoteka
- Ciljeve izgradnje

#### `meson_options.txt`

Dostupne opcije:
```
option('opencl', type: 'boolean', value: false, description: 'Enable OpenCL support')
option('cuda', type: 'boolean', value: false, description: 'Enable CUDA support')
option('optimization', type: 'string', value: '3', description: 'Optimization level')
```

---

## Ovisnosti datoteka

### Ovisnosti izgradnje pozadinskog dijela

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

### Ovisnosti izgradnje sučelja

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

## Tok podataka

### Tok rada poslužitelja

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

### Tok korisničke interakcije

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

## Vodič za izmjenu datoteka

### Kada mijenjate kod pozadinskog dijela (`src/**`):

```bash
cd PhantomSDR-Plus
meson compile -C build
# Server restart required
```

### Kada mijenjate kod sučelja (`frontend/src/**`):

```bash
cd PhantomSDR-Plus/frontend
npm run build
cd ..
# Server restart required (for static files)
```

### Kada mijenjate konfiguraciju (`.toml`, `.json`):

```bash
# Restart server
./stop-websdr.sh
./start-rtl.sh  # (or appropriate start script)
```

### Kada mijenjate oznake (`markers.json`):

```bash
# Reload page in browser
# No server restart needed
```

---

## Važne putanje

### Putanje u izvođenju

- **Konfiguracija**: `./config-*.toml`
- **HTML korijen**: `./frontend/dist/`
- **Oznake**: `./markers.json`
- **Povijest razgovora**: `./chat_history.txt`
- **FFTW wisdom**: `./fftw_wisdom`, `./phantom_fftw_wisdom`

### Putanje izgradnje

- **Izlazna binarna datoteka**: `./build/spectrumserver`
- **Izlaz sučelja**: `./frontend/dist/`
- **Node moduli**: `./frontend/node_modules/`

### Putanje izvornog koda

- **Izvorni kod pozadinskog dijela**: `./src/`
- **Izvorni kod sučelja**: `./frontend/src/`
- **DSP biblioteke**: `./jsdsp/`

---

## Uobičajene radnje s datotekama

### Dodavanje nove SDR konfiguracije

1. Kopirajte postojeću konfiguraciju: `cp config-rtl.toml config-mydevice.toml`
2. Uredite parametre: `nano config-mydevice.toml`
3. Stvorite početnu skriptu: `cp start-rtl.sh start-mydevice.sh`
4. Uredite početnu skriptu: `nano start-mydevice.sh` — mijenjajte samo blok **RECEIVER CONFIGURATION** na vrhu (`RX_LABEL`, `RX_COMM` = naziv procesa prijamnika, `RX_ARGS`, `CONFIG`, `FIFO` te kuku `prestart` ako je uređaju potrebna). Logika pokretača/watchdoga/zapisivanja ispod toga je općenita i ne treba je mijenjati.
5. Postavite je kao izvršnu: `chmod +x start-mydevice.sh`

> `stop-websdr.sh` već zaustavlja bilo koji `start-*.sh --watchdog`; ako vaš prijamnik koristi naziv procesa različit od `rx888_stream`/`rx_sdr`/`rtl_sdr`/`hackrf_transfer`/`cf32_to_real`, dodajte i ondje redak `killall -9 <naziv>`.

### Prilagodba sučelja

1. Izmijenite izvorni kod: `nano frontend/src/App.svelte`
2. Ponovno izgradite: `cd frontend && npm run build && cd ..`
3. Ponovno pokrenite poslužitelj: `./stop-websdr.sh && ./start-rtl.sh`

### Dodavanje vlastitih oznaka

1. Uredite datoteku oznaka: `nano markers.json`
2. Format:
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
3. Ponovno učitajte preglednik (ponovno pokretanje poslužitelja nije potrebno)

---

## Upravljanje verzijama

### Datoteke koje treba pratiti u Gitu

- Izvorni kod (`src/`, `frontend/src/`, `jsdsp/`)
- Primjeri konfiguracije (`config.example.*.toml`)
- Sustav izgradnje (`meson.build`, `meson_options.txt`)
- Dokumentacija (`*.md`, `docs/`)
- Skripte (`*.sh`)

### Datoteke koje treba zanemariti (`.gitignore`)

- Rezultati izgradnje (`build/`, `frontend/dist/`)
- Ovisnosti (`frontend/node_modules/`)
- Korisnički podaci (`chat_history.txt`)
- Osobne konfiguracije (`config-rtl.toml` ako je prilagođena)
- Binarni podaci (`*.o`, `*.so`)

---

**Ova dokumentacija strukture trebala bi vam pomoći da se snađete u kodu PhantomSDR-Plusa i razumijete ga.**

Za upute o postavljanju pogledajte [INSTALLATION.md](INSTALLATION.md). Za informacije o korištenju pogledajte [USER_GUIDE.md](USER_GUIDE.md).

**73 de SV1BTL & SV2AMK**
