# PhantomSDR-Plus Project Structure

This document provides a comprehensive overview of the PhantomSDR-Plus directory structure, file organization, and component relationships.

---

## Table of Contents

1. [Directory Tree](#directory-tree)
2. [Root Directory](#root-directory)
3. [Source Code (`src/`)](#source-code-src)
4. [Frontend (`frontend/`)](#frontend-frontend)
5. [Frequency Lists (`frequencylist/`)](#frequency-lists-frequencylist)
6. [Configuration Files](#configuration-files)
7. [Build System](#build-system)

---

## Directory Tree
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
├── cf32_to_real.c             # Fobos HF: keeps I from rx_sdr's CF32, scaled to s16 (built by setup-fobos.sh)
├── chat_history.txt
├── check-go.sh                # legacy: watchdog for the go.sh chain
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
│   ├── A26all00.TXT           # not in the repo: unzipped from a26allx2.zip by update-markers.sh
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
│   ├── .prettierrc.json      # Prettier formatting rules for the frontend sources
│   ├── public
│   │   ├── analyze_users.py
│   │   ├── decoders
│   │   │   ├── ft8_lib.wasm
│   │   │   ├── js8_dict.bin   # JS8 word dictionary, fetched only when needed
│   │   │   └── js8.wasm       # JS8 decoder, built from jsdsp/js8_wasm
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
│   │   │   ├── rnnoise.js     # loads RNNoise for the AI noise reduction
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
├── go.sh                      # legacy launcher chain, superseded by start-<radio>.sh
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
│   ├── js8_wasm               # JS8 decoder in C, built to WebAssembly, with its tests and reference harness — see its README
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
├── kill.sh                    # legacy: kills the server processes, called by go.sh
├── kiwi_install.sh             # installs the KiwiSDR bridge into an existing tree
├── LICENSE
├── logproxy                   # rotated copies of the panel / proxy / autorun logs
├── logrotate
│   └── phantomsdr             # logrotate config for proxy.log + admin.log (edit paths before installing)
├── manage_admin.sh
├── markers.json
├── meson.build
├── meson_options.txt
├── phantom_fftw_wisdom
├── phantomsdr-admin.service   # sample systemd unit for the admin panel (starts at boot, restarts after a crash)
├── phantomsdr-proxy.service   # sample systemd unit for the proxy, installed alongside the panel unit
├── phantomsdr-websdr-relay.service  # sample systemd unit for the WebSDR diversity relay
├── proxy.py
├── rade_helper.py
├── rade_loadtest.csv          # output of rade_loadtest.py (one row per ramp step)
├── rade_loadtest.py           # RADE concurrency knee test — see docs/RADE_README.md
├── rade.sh
├── README.md
├── recompile.sh
├── _relaunch.sh               # legacy: delayed re-launch helper for the go.sh chain
├── request.hpp
├── setup_admin.sh
├── setup-airspyhf.sh          # Airspy HF+ driver chain: libairspyhf + SoapyAirspyHF + rx_sdr + udev
├── setup-cpufreq-perms.sh     # grants group write on scaling_max_freq so the guard can throttle without root
├── setup-firewall.sh          # optional nftables flood guard — see docs/CONNECTION_LIMITS.md
├── setup-fobos.sh             # Fobos driver chain: libfobos + SoapyFobosSDR + rx_sdr + cf32_to_real + udev
├── setup-hackrf.sh            # HackRF: the distribution's hackrf package + udev (nothing built)
├── setup-rsp1a.sh             # RSP1A driver chain: libmirisdr-5 + SoapyMiri + rx_sdr + msi2500 blacklist + udev
├── setup-rx888-udev.sh
├── setup-sdr-common.sh        # shared helpers sourced by the three setup scripts above
├── setup_websdr_relay.sh      # installs the WebSDR diversity relay (port, identity, systemd)
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
│   ├── kiwi_bridge.h          # KiwiSDR protocol bridge — see docs/Aether_config.md
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
│   └── tci-rigctld.mjs        # TCI server for Hamlib rigs (IC-7300…), run on the listener's PC — see docs/RIG_CONTROL.md
├── thermal_guard.py           # CPU over-temperature guard used by the admin panel (also runs standalone)
├── thermal-guard.service      # sample systemd unit for the guard, for installs without the admin panel
├── tmpfiles
│   └── phantomsdr-logs.conf   # keeps admin.log + proxy.log owned by the panel's user (edit paths before installing)
├── update.sh
├── waterfall.sh
├── websdr_relay.json.example  # its config template (port, caps, station identity)
├── websdr_relay.py            # the relay itself — see docs/RECEIVE_DIVERSITY.md
├── websocketpp_asio_connection.hpp  # Boost >= 1.87 shim: ws_post instead of io_service::post
├── websocketpp_asio_endpoint.hpp    # Boost >= 1.87 shim: ws_work / ws_restart, max_listen_connections
├── websocketpp_asio.hpp        # Boost >= 1.87 shim for websocketpp (io_context, executor_work_guard)
└── xgo.sh                     # legacy: starts spectrumserver, called by check-go.sh
```
---

## Root Directory

### Configuration Files

| File | Purpose | When to Modify |
|------|---------|----------------|
| `config.toml` | Default configuration | Initial setup, testing |
| `config-rtl.toml` | RTL-SDR specific config | Using RTL-SDR device |
| `config-rsp1a.toml` | SDRplay RSP1A config | Using RSP1A device |
| `config-airspyhf.toml` | Airspy HF+ config | Using Airspy device |
| `config-fobos-hf.toml` | RigExpert Fobos SDR, HF1/HF2 direct sampling (0-25 MHz) | Using a Fobos on HF |
| `config-fobos.toml` | RigExpert Fobos SDR, RF path (25-6000 MHz) | Using a Fobos above 25 MHz |
| `config-hackrf.toml` | HackRF One config | Using a HackRF |
| `config-rx888mk2.toml` | RX888 MK2 config | Using RX888 device |
| `config.example.hackrf.toml` | HackRF One example | Using HackRF device |

### Start/Stop and Maintenance Scripts

Each `start-*.sh` below is a **self-contained launcher + watchdog + logger**: it stops any running instance, brings up the receiver + `spectrumserver`, detaches into the background, auto-restarts the chain if it dies, and logs to `logwebsdr.txt`. They share one stop script and a single `flock` lock (only one receiver runs at a time). Edit only the **RECEIVER CONFIGURATION** block at the top of each (receiver args / config / process name). The six launchers built from the same template (`start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos.sh`, `start-fobos-hf.sh`, `start-hackrf.sh`) are identical below that block; `start-rx888mk2.sh` is a script of its own.

| Script | Purpose |
|--------|---------|
| `install.sh` | Automated installation and build |
| `start-rtl.sh` | Launch + watchdog server with RTL-SDR (`rtl_sdr`) |
| `start-rsp1a.sh` | Launch + watchdog server with SDRplay RSP1A (`rx_sdr`); uses libmirisdr-5, or SDRplay's API when that is installed (`RX_DRIVER` forces one) |
| `start-airspyhf.sh` | Launch + watchdog server with Airspy HF+ (`rx_sdr`) |
| `start-fobos-hf.sh` | Launch + watchdog server with RigExpert Fobos SDR, HF1/HF2 direct sampling (`rx_sdr \| cf32_to_real`) |
| `start-fobos.sh` | Launch + watchdog server with RigExpert Fobos SDR, RF path (`rx_sdr`) |
| `start-hackrf.sh` | Launch + watchdog server with HackRF One (`hackrf_transfer`) |
| `start-rx888mk2.sh` | Launch + watchdog server with RX888 MK2 (`rx888_stream`) |
| `stop-websdr.sh` | Stop the server + its watchdog — shared by all receivers |
| `setup-rx888-udev.sh` | Install udev rules so RX-888 `rx888_stream` runs without sudo |
| `setup-rsp1a.sh` / `setup-fobos.sh` / `setup-airspyhf.sh` | Install the SoapySDR driver chain for the RSP1A, Fobos or Airspy HF+ — SoapySDR from the distribution, the driver and rx_tools built into `sdr_drivers/`, a udev rule — on any of the four supported distributions. Installer options 3, 5 and 6 run them; they also run on their own. Shared code in `setup-sdr-common.sh` — see [Installation Guide](INSTALLATION.md#receivers-on-soapysdr-rsp1a-fobos-airspy-hf) |
| `setup-hackrf.sh` | Installs the distribution's `hackrf` package and a udev rule for the HackRF One, on any of the four supported distributions; installer option 7 runs it |
| `setup-firewall.sh` | Optional kernel-level flood guard: loads an nftables table with a per-source connection ceiling and rate on the receiver ports, an SSH brute-force brake, and Windows file sharing closed outside private ranges. Needs root, cannot lock you out (policy accept, established accepted first) and `--apply` rolls itself back unless confirmed within 60 s — see [Connection Limits](CONNECTION_LIMITS.md) |
| `setup-cpufreq-perms.sh` | Grants a `cpufreq` group write access to the per-CPU frequency limit, so the thermal guard's throttle stage works without running the panel as root. Installs a `tmpfiles.d` rule so it survives a reboot; `--revoke` undoes it |
| `update.sh` | Update the installation from the published tree, leaving your configuration, markers, frequency list and local edits alone — see [Installation Guide](INSTALLATION.md) |
| `recompile.sh` | Rebuild the backend and/or the frontend, and pick the variant served at `/` |
| `smeter_theme.sh` | Set the default analog S-meter face (dark / amber / vintage) for all users, and offer the frontend rebuild — see [Editing Variants](EDITING_VARIANTS.md) |
| `waterfall.sh` | Change the default minimum waterfall level (dB) in `waterfall.js` + `App.svelte` — see [README](README.md) |
| `kiwi_install.sh` | Install the KiwiSDR client-emulation bridge into a tree that has not got it: patches the backend sources, copies `src/kiwi_bridge.h`, and adds a documented `[kiwi_emulation]` block to the config files in the repository root. Idempotent, and backs up every file it touches — see [KiwiSDR Client Emulation](Aether_config.md) |
| `tci-bridge/tci-rigctld.mjs` | Not used by the receiver. A small Node.js program a listener runs next to their own transceiver: it reads frequency, mode and transmit state from Hamlib's `rigctld` and serves them as TCI on port 50001, so the page's **TCI-CAT** button can drive a rig with no TCI of its own, such as the IC-7300 — see [Rig Control](RIG_CONTROL.md) |

**Legacy launcher chain.** `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh` and `_relaunch.sh` are the previous generation of launcher, watchdog and stop scripts. Everything they did is now inside each `start-<radio>.sh`, which is what you should use. They are kept on disk because existing installations still reference them, and are not maintained.

### Data Files

| File | Purpose | Format |
|------|---------|--------|
| `markers.json` | Frequency bookmarks and markers | JSON |
| `chat_history.txt` | User chat messages | Plain text |
| `favicon.ico` | Website icon | ICO image |
| `fftw_wisdom` | FFT optimization data | FFTW binary |
| `phantom_fftw_wisdom` | Additional FFT optimization | FFTW binary |

### Admin Panel and Spot Reporting

| File | Purpose |
|------|---------|
| `admin_server.py` | The admin panel itself. Besides the management pages it runs the **Graphs** sampler: a background thread takes CPU frequency, load, temperature and users online every 2 seconds and keeps them in memory only — 1 hour at full resolution plus 24 hours of 30-second averages. Nothing is written to disk, so the history is lost on restart. |
| `admin_config.json` | Admin panel settings (password hash, ports, options, thermal guard thresholds) |
| `thermal_guard.py` | CPU over-temperature guard. Stops the server when the CPU gets too hot and restarts it once cool, deriving its thresholds from the critical trip point your own CPU publishes instead of a fixed number. It never identifies what supervises the server — while over-temp it re-issues the stop every 2 s, so a watchdog, systemd unit or cron job that revives it is undone until the machine cools. Stdlib-only; imported by `admin_server.py` (ticked from the Graphs sampler) and also runnable standalone for installations without the panel. Defaults to log-only, so it acts on nothing until enabled — see the [Thermal Guard manual](THERMAL_GUARD.md) |
| `autorun/` | The spot-reporting daemon — see [Autorun Spot Reporter](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr) |
| `autorun.json` | Which bands/modes to decode, identity and destinations |
| `autorun-status.json` | Live state of the running daemon — feeds the **per-run** spot counters (the per-decoder tiles), which reset on Stop/Start |
| `autorun-totals.json` | **All-time** uploaded spots per band+mode — the number beside each checkbox; written by the daemon so the counts survive restarts |

### Build System Files

| File | Purpose |
|------|---------|
| `meson.build` | Main build configuration |
| `meson_options.txt` | Configurable build options |
| `.gitattributes` | Git repository attributes |

---

## Source Code (`src/`)

The `src/` directory contains the C++ backend implementation.

### Key Components

#### 1. Main Application (`main.cpp`)
- Parses command-line arguments
- Loads configuration file
- Initializes server components
- Starts event loop

#### 2. Spectrum Server (`spectrumserver.cpp`)
- Coordinates all components
- Manages user connections
- Distributes spectrum data
- Handles user requests

#### 3. SDR Drivers (`drivers/`)
- Abstract interface for SDR hardware
- Read and format sample data
- Handle device-specific features

#### 4. DSP Engine (`dsp/`)
- FFT calculation (CPU/GPU accelerated)
- Demodulation (AM, FM, SSB, CW, etc.)
- Audio filtering and resampling
- AGC and noise reduction

#### 5. Web Server (`server/`)
- WebSocket communication
- HTTP static file serving
- User session management
- Real-time data streaming

#### 6. Audio Encoding (`audio/`)
- FLAC compression
- Opus compression
- Streaming optimization

---

## Frontend (`frontend/`)

The web-based user interface built with Svelte and Vite.


#### 1. Main App (`App.svelte`)
- Top-level component
- Layout structure
- Component orchestration
- **Decoders button row** — one button per decoder, on the main panel directly under the Modes selector; press to start the decoder and open its window, press again to stop. It replaced the former Bandwidth row. RADEL/RADEU live in `lib/ModesSelector.svelte` instead, beside the Modes selector and inside the Modes and Bands pop-ups.

#### 2. Waterfall Display (`waterfall.js` + `lib/`)
- Canvas-based spectrum and waterfall rendering, colormaps and the adaptive auto-adjust, all in `waterfall.js` (plain JS, not a component)
- Interactive tuning through `lib/PassbandTuner.svelte`
- Band plan and marker overlays through `lib/FrequencyMarkers.svelte`
- The audio spectrogram is a separate component, `lib/Spectrogram.svelte`

#### 3. Controls (`App.svelte` + `lib/`)
- Frequency input/display — `lib/FrequencyInput.svelte`
- Mode selection (AM/FM/SSB/CW) — `lib/ModesSelector.svelte`, band switching — `lib/BandSelector.svelte`
- AGC/NR/NB and the remaining controls live in `App.svelte` itself; there is no separate `Controls.svelte`

#### 3a. Scanner (`scanner.js`)
- Channel scanner: walks the receiver across a range and stops on the first channel carrying a signal. Plain JS, not a component — `App.svelte` supplies the VFO, the mode, the band plan and the tuning call, and receives the UI state back through one callback
- Threshold is dB over the band noise floor rather than an absolute level, reusing the floor `waterfall.js` already tracks (`snrNoiseDb`), so it needs no calibration of its own
- Two ways to cross the band: tune and listen to every channel, or screen the spectrum first and only tune to what it cannot rule out. The spectrum may skip a channel but never stop on one — every stop comes from a real dwell
- Range is either the band plan's band or exactly what the waterfall shows; auto-resume, a max-stay timeout and a lockout list live here too, persisted in `localStorage`

#### 4. Audio System (`audio.js`)
- WebSocket audio stream
- FLAC/Opus decoding
- Audio playback control
- Distributes raw PCM (taken before AGC, noise reduction and mute) to the mode decoders
- AI noise reduction: `lib/rnnoise.js` loads the RNNoise WebAssembly module (`@jitsi/rnnoise-wasm`) on first use; `audio.js` runs it on voice modes only, after the decoder tap, so the decoders never hear it

#### 4a. Mode decoders and their workers

Each of the heavy mode decoders runs in its own Web Worker so that decoding never blocks audio playback or the waterfall. They follow one common pattern — three files per decoder:

| Decoder | Engine | Worker | Main-thread proxy |
|---------|--------|--------|-------------------|
| SSTV | `sstv.js` | `sstv.worker.js` | `sstvWorkerProxy.js` |
| HF FAX | `fax.js` | `fax.worker.js` | `faxWorkerProxy.js` |
| NAVTEX + FSK/RTTY + PSK31 + Olivia | `fsk.js`, `psk31.js`, `olivia.js` | `fsk.worker.js` | `fskWorkerProxy.js` |
| CW | `cwDecoder.js` | `cw.worker.js` | `cwWorkerProxy.js` |

- The **engine** is plain DSP code with no knowledge of workers, so it can also be run directly (unit tests, or the in-thread fallback).
- The **worker** holds one engine instance and forwards its events verbatim.
- The **proxy** mirrors the engine's method surface, so `audio.js` calls it exactly as it would call the decoder. It creates the worker lazily on first enable and falls back to running in-thread if workers are unavailable.

Two details are load-bearing: PCM is **copied** into a fresh buffer before being transferred to the worker (transferring a view into the audio accumulator would detach it and kill playback), and the worker's `init` message re-applies configuration to an already-running engine rather than assuming a fresh one.

`fsk.js` serves both NAVTEX and FSK/RTTY from one engine, selected per instance by a `role` field; each instance owns its own state, so the two can run independently.

The `fsk` role additionally hosts two decoders that are not FSK at all. Selecting the `psk31` or `olivia` variant makes `fsk.js` hand the audio to `psk31.js` or `olivia.js` instead of its own discriminator chain, while still borrowing its configuration, worker and event plumbing — so `fsk.worker.js`, `fskWorkerProxy.js` and `audio.js` need no knowledge of either mode, and the UI consumes the same `char`/`status`/`metrics` events throughout.

- `psk31.js` — BPSK31: complex baseband, matched filter, differential detection and varicode, with a spectral coarse acquisition plus a fine AFC covering about ±25 Hz.
- `olivia.js` — Olivia MFSK: a port of Pawel Jalocha's MFSK receiver from fldigi (`pj_mfsk.h`, GPL-3, as is this project), including the Walsh/Hadamard FEC and the blind synchronisation search over block phase and frequency offset.
- `broadcastSchedules.js` — the UTC timetables the FAX, NAVTEX and RTTY decoders offer as presets, taken from the NOAA/NWS marine radiofacsimile schedules and the published NAVTEX station lists

#### 4b. Receive Diversity (`diversity.js`)
- Combines the local receiver with a second one elsewhere and follows whichever site currently has the better signal. Plain JS, not a component — it sits on one seam in `audio.js`, which hands it the local PCM and plays back what it returns
- **Selection, not summing.** Two sites hear the same transmission over different ionospheric paths, so their waveforms have unrelated phase; adding them sounds comb-filtered. Coherent combining would need a common clock, which two receivers over the internet cannot share. The two streams are only ever mixed during a 30 ms crossfade
- Alignment correlates the two **audio envelopes** (log power at 100 Hz), never the waveforms — the envelope survives both the path and any codec. A lock is only trusted once a second, independent search agrees with it, which rejects the confident-but-wrong delay two antiphase-fading sites would otherwise produce
- The remote is **rate-locked** to the local stream first. Two receivers are two clocks and two decimation chains, so their audio arrives up to 2% apart even when both declare 12 kHz — 240 samples a second of creep, which no correlation can hold. The ratio is measured from how many samples each side actually delivers and applied by a resampler that carries its fractional phase across blocks, so an arbitrary ratio holds indefinitely
- Site choice uses a percentile SNR measured on **content-aligned** samples, with hysteresis, a dwell timer and a fast escape hatch for a collapsed incumbent. Levels are matched noise-to-noise, so a switch does not change the background hiss
- Decoders keep the **local** stream: FT8, JS8, WSPR and RADE integrate coherently across a slot, and a mid-slot switch is a phase discontinuity that can cost the decode

#### 4c. Diversity sources (`remoteSource.js`, `kiwiSource.js`, `uberSource.js`, `webSdrSource.js`)
- One contract — `onPcm` / `onState` / `tune` / `canReceive` — so `diversity.js` never learns what is on the other end. Adding a receiver type is one new file
- `remoteSource.js` — another PhantomSDR-Plus over `/audio` (cbor + FLAC), reusing `createDecoder()` from `lib/wrappers.js`
- `kiwiSource.js` — a KiwiSDR: `SND` frames, big-endian PCM, with the 10-byte GPS timestamp a stereo packet inserts before the audio
- `uberSource.js` — an UberSDR over its native `/ws`: Opus in a 21-byte header, retuning over the open socket. The session id must be registered with `POST /connection` first and must be a UUID
- `webSdrSource.js` — a WebSDR, through `websdr_relay.py` on this server: the browser cannot connect directly, because WebSDR checks the `Origin` header and no script may change it. Tuning is a text frame on the same socket; band coverage comes from the relay
- `webSdrCodec.js` — the WebSDR audio format: a tagged byte stream whose compressed blocks drive a 20-tap leaky-LMS predictor. Ported from the WebSDR client and verified sample-for-sample against it
- `diversityList.js` — the saved-receiver list and the address rules for the four types, shared by the desktop panel and the mobile page so one format serves both. Also the transfer — a compact blob, its QR code, and a parser that accepts every shape the two pages have ever written — and `browseUrl()`, which walks a dialled address back into one a browser can open
- `lib/DiversityPanel.svelte` — the UI: endpoint, source type, SNR trim and live status, plus the saved receivers — named, reorderable, and exported to and imported from a JSON file, kept per source type in `localStorage`. Everything is edited inside the panel: `prompt()` and `confirm()` block the main thread, which is where audio frames are pushed into the playback worklet. A **▦ QR** button draws the list as a scannable code, because `localStorage` is per browser and a phone starts empty. `mobile/Mobile.svelte` carries the same feature in a **Div** tab, in that page's own plain CSS. See [Receive Diversity](RECEIVE_DIVERSITY.md)

#### 4d. Mode identifier (`modeId.js`, `modePriors.js`)
- Answers "what am I listening to?". It reads the same raw PCM tap as the decoders and ranks the likely modes, so the operator can pick the right decoder instead of trying all ten. It never decodes anything: it measures physical properties of the signal and scores them against a table of known modes
- Occupied bandwidth is the contiguous −15 dB width around the peak, deliberately not a 99 %-power figure: keying splatter puts long tails on the power integral and made every narrow mode read several times too wide. Symbol rate comes from the **instantaneous frequency** rather than tone energies, because no integration length can both resolve a 170 Hz shift and a 100 Bd symbol. Keying rate comes from the on/off envelope, and doubles as a CW speed readout
- `modePriors.js` adds the one clue the audio cannot carry — where you are tuned. A 100 Bd / 170 Hz signal on 518 kHz is NAVTEX; the identical signal on 14.070 MHz is not. It only reweights what the signal already supported, and never invents a candidate
- FT8, JS8 and FT2 are reported as one group on purpose: they are not separable on bandwidth and tone spacing alone, and pretending otherwise would be a confident wrong answer
- Below roughly 10 dB SNR it stays quiet rather than guessing
- Runs in its own Web Worker (`modeId.worker.js` + `modeIdWorkerProxy.js`), following the same engine/worker/proxy pattern as the decoders above; the result is the chip in `lib/ModeIdChip.svelte`

#### 4e. Connection refusals (`refused.js`, `clientVersion.js`)

- `refused.js` is the shared vocabulary for a connection the server turns away: close code **4003** (over a per-IP limit, or the page is older than `[server] min_client_version`) and **4001** (a sysop kick). Both are final. `audio.js`, `waterfall.js` and `events.js` all import `isRefusal()` from it, because all three open a socket that can be refused and all three must settle their init promise when it is — otherwise the page waits forever on a connection that is never coming
- Nothing retries. A dropped `/audio` socket ends the session by design: `/waterfall` and `/events` never came back with a reconnect, so a retried session was live audio attached to a frozen waterfall, and against a rate limit each retry would extend the very refusal it was working around. The desktop page explains a refusal that happens at page load and simply stops when one happens mid-session; `/mobile` shows one line asking the listener to reload
- `clientVersion.js` holds a single integer, `CLIENT_VERSION`, which the page appends to its audio socket as `/audio?v=N`. The server refuses anything below `[server] min_client_version`, which is how a station forces tabs still running an older build to reload — the only lever there is, since the server cannot reach JavaScript already running in a browser. Bump it when a frontend change must not keep being ignored by open tabs
- Full reference: [Connection Limits](CONNECTION_LIMITS.md)

#### 5. State Management (`stores/`)
- Reactive data stores
- Shared application state
- Event handling

---

### Key Features

- Real-time audio processing
- Digital mode decoding (FT8, RTTY, etc.)
- Audio filtering
- Spectrum analysis

---


## Frequency Lists (`frequencylist/`)

The on-waterfall frequency markers. `mymarkers.json` is the list the receiver actually shows; the rest is the raw material `update-markers.sh` turns into it, refreshed from the online schedules. `README.md` in that directory explains the update in all seven languages.

```
frequencylist/
├── mymarkers.json            # the markers the receiver shows — hand-edited, survives an update
├── shortwavestations.json    # shortwave broadcasters, generated by generate-current-shortwave.py
├── 0.TXT                     # the A26 global HF schedule, unpacked and parsed by update-markers.sh
├── a26allx2.zip              # source archive downloaded by update-markers.sh
├── admin.txt · antenna.txt · broadcas.txt · fmorg.txt · language.txt · site.txt
│                             # supporting lists from the same source (sites, languages, admins, antennas)
├── generate-current-shortwave.py
├── update-markers.sh         # refreshes everything above from the online schedules
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

## Configuration Files

### Server Configuration (`.toml` files)

Structure of configuration files:

```toml
[server]
# Web server settings
port = 9002
html_root = "frontend/dist/"
threads = 2
otherusers = 1

[limits]
# Per-IP connection limits — all default to off or to a sensible value, so a
# config without them behaves as it always did. See CONNECTION_LIMITS.md.
per_ip = 3              # simultaneous listeners from one address
per_ip_rate = 40        # new sockets per minute from one address

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

### Site Information (`site_information.json`)

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

## Build System

### Meson Build Configuration

#### `meson.build` (Root)

Defines:
- Project metadata
- Dependencies
- Compiler options
- Source file lists
- Build targets

#### `meson_options.txt`

Available options:
```
option('opencl', type: 'boolean', value: false, description: 'Enable OpenCL support')
option('cuda', type: 'boolean', value: false, description: 'Enable CUDA support')
option('optimization', type: 'string', value: '3', description: 'Optimization level')
```

---

## File Dependencies

### Backend Build Dependencies

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

### Frontend Build Dependencies

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

## Data Flow

### Server Operation Flow

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

### User Interaction Flow

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

## File Modification Guide

### When you modify backend code (`src/**`):

```bash
cd PhantomSDR-Plus
meson compile -C build
# Server restart required
```

### When you modify frontend code (`frontend/src/**`):

```bash
cd PhantomSDR-Plus/frontend
npm run build
cd ..
# Server restart required (for static files)
```

### When you modify configuration (`.toml`, `.json`):

```bash
# Restart server
./stop-websdr.sh
./start-rtl.sh  # (or appropriate start script)
```

### When you modify markers (`markers.json`):

```bash
# Reload page in browser
# No server restart needed
```

---

## Important Paths

### Runtime Paths

- **Configuration**: `./config-*.toml`
- **HTML Root**: `./frontend/dist/`
- **Markers**: `./markers.json`
- **Chat History**: `./chat_history.txt`
- **FFTW Wisdom**: `./fftw_wisdom`, `./phantom_fftw_wisdom`

### Build Paths

- **Binary Output**: `./build/spectrumserver`
- **Frontend Output**: `./frontend/dist/`
- **Node Modules**: `./frontend/node_modules/`

### Source Paths

- **Backend Source**: `./src/`
- **Frontend Source**: `./frontend/src/`
- **DSP Libraries**: `./jsdsp/`

---

## Common File Operations

### Adding a New SDR Configuration

1. Copy existing config: `cp config-rtl.toml config-mydevice.toml`
2. Edit parameters: `nano config-mydevice.toml`
3. Create start script: `cp start-rtl.sh start-mydevice.sh`
4. Edit start script: `nano start-mydevice.sh` — change only the **RECEIVER CONFIGURATION** block at the top (`RX_LABEL`, `RX_COMM` = the receiver's process name, `RX_ARGS`, `CONFIG`, `FIFO`, and the `prestart` hook if the device needs one). The launcher/watchdog/logging logic below it is generic and needs no changes.
5. Make executable: `chmod +x start-mydevice.sh`

> `stop-websdr.sh` already stops any `start-*.sh --watchdog`; if your receiver uses a process name other than `rx888_stream`/`rx_sdr`/`rtl_sdr`/`hackrf_transfer`/`cf32_to_real`, add a `killall -9 <name>` line for it there too.

### Customizing the Frontend

1. Modify source: `nano frontend/src/App.svelte`
2. Rebuild: `cd frontend && npm run build && cd ..`
3. Restart server: `./stop-websdr.sh && ./start-rtl.sh`

### Adding Custom Markers

1. Edit markers file: `nano markers.json`
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
3. Reload browser (no server restart needed)

---

## Version Control

### Files to Track in Git

- Source code (`src/`, `frontend/src/`, `jsdsp/`)
- Configuration examples (`config.example.*.toml`)
- Build system (`meson.build`, `meson_options.txt`)
- Documentation (`*.md`, `docs/`)
- Scripts (`*.sh`)

### Files to Ignore (`.gitignore`)

- Build output (`build/`, `frontend/dist/`)
- Dependencies (`frontend/node_modules/`)
- User data (`chat_history.txt`)
- Personal configs (`config-rtl.toml` if customized)
- Binary data (`*.o`, `*.so`)

---

**This structure documentation should help you navigate and understand the PhantomSDR-Plus codebase.**

For setup instructions, see [INSTALLATION.md](INSTALLATION.md). For usage information, see [USER_GUIDE.md](USER_GUIDE.md). For the KiwiSDR client bridge, see [Aether_config.md](Aether_config.md).

**73 de SV1BTL & SV2AMK**
