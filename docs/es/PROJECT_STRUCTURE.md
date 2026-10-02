# Estructura del proyecto PhantomSDR-Plus

Este documento ofrece una visión general completa de la estructura de directorios de PhantomSDR-Plus, la organización de los archivos y las relaciones entre componentes.

---

## Índice

1. [Árbol de directorios](#árbol-de-directorios)
2. [Directorio raíz](#directorio-raíz)
3. [Código fuente (`src/`)](#código-fuente-src)
4. [Frontend (`frontend/`)](#frontend-frontend)
5. [Listas de frecuencias (`frequencylist/`)](#listas-de-frecuencias-frequencylist)
6. [Archivos de configuración](#archivos-de-configuración)
7. [Sistema de compilación](#sistema-de-compilación)

---

## Árbol de directorios
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
├── cf32_to_real.c             # Fobos HF: conserva I del CF32 de rx_sdr, escalado a s16 (lo compila setup-fobos.sh)
├── chat_history.txt
├── check-go.sh                # antiguo: watchdog de la cadena go.sh
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
│   ├── A26all00.TXT           # no está en el repo: lo extrae update-markers.sh de a26allx2.zip
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
│   ├── .prettierrc.json      # reglas de formato Prettier para las fuentes del frontend
│   ├── public
│   │   ├── analyze_users.py
│   │   ├── decoders
│   │   │   ├── ft8_lib.wasm
│   │   │   ├── js8_dict.bin   # diccionario de palabras JS8, se descarga solo cuando hace falta
│   │   │   └── js8.wasm       # decodificador JS8, compilado desde jsdsp/js8_wasm
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
│   │   │   ├── rnnoise.js     # carga RNNoise para la reducción de ruido por IA
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
├── go.sh                      # cadena de arranque antigua, sustituida por start-<radio>.sh
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
│   ├── js8_wasm               # decodificador JS8 en C, compilado a WebAssembly, con sus pruebas y banco de referencia — véase su README
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
├── kill.sh                    # antiguo: mata los procesos del servidor, lo llama go.sh
├── kiwi_install.sh             # instala el puente KiwiSDR en un árbol existente
├── LICENSE
├── logproxy                   # copias rotadas de los registros del panel/proxy/autorun
├── logrotate
│   └── phantomsdr             # configuración de logrotate para proxy.log + admin.log (ajuste las rutas antes de instalar)
├── manage_admin.sh
├── markers.json
├── meson.build
├── meson_options.txt
├── phantom_fftw_wisdom
├── phantomsdr-admin.service   # unidad systemd de ejemplo para el panel (arranca al inicio, se reinicia tras un fallo)
├── phantomsdr-proxy.service   # unidad systemd de ejemplo para el proxy, se instala junto con la del panel
├── phantomsdr-websdr-relay.service  # unidad systemd de ejemplo para el relé de diversidad WebSDR
├── proxy.py
├── rade_helper.py
├── rade_loadtest.csv          # salida de rade_loadtest.py (una fila por escalón de carga)
├── rade_loadtest.py           # prueba de carga de RADE: cuántos decodificadores simultáneos soporta la máquina — véase docs/RADE_README.md
├── rade.sh
├── README.md
├── recompile.sh
├── _relaunch.sh               # antiguo: ayudante de relanzamiento diferido de la cadena go.sh
├── request.hpp
├── setup_admin.sh
├── setup-airspyhf.sh          # cadena de driver Airspy HF+: libairspyhf + SoapyAirspyHF + rx_sdr + udev
├── setup-cpufreq-perms.sh     # da al grupo permiso de escritura en scaling_max_freq para que el guardián pueda limitar sin root
├── setup-firewall.sh          # guardia nftables opcional — vea docs/CONNECTION_LIMITS.md
├── setup-fobos.sh             # cadena de driver Fobos: libfobos + SoapyFobosSDR + rx_sdr + cf32_to_real + udev
├── setup-hackrf.sh            # HackRF: paquete hackrf de la distribución + udev (nada compilado)
├── setup-rsp1a.sh             # cadena de driver RSP1A: libmirisdr-5 + SoapyMiri + rx_sdr + lista negra msi2500 + udev
├── setup-rx888-udev.sh
├── setup-sdr-common.sh        # funciones comunes de los tres scripts setup de arriba
├── setup_websdr_relay.sh      # instala el relé de diversidad WebSDR (puerto, identidad, systemd)
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
│   ├── kiwi_bridge.h          # puente del protocolo KiwiSDR — véase docs/Aether_config.md
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
│   └── tci-rigctld.mjs        # servidor TCI para equipos Hamlib (IC-7300…), se ejecuta en el PC del oyente — ver docs/RIG_CONTROL.md
├── thermal_guard.py           # Protección contra sobrecalentamiento de la CPU para el panel (también funciona sola)
├── thermal-guard.service      # unidad systemd de ejemplo para el guardián, sin panel de administración
├── tmpfiles
│   └── phantomsdr-logs.conf   # mantiene admin.log + proxy.log a nombre del usuario del panel (ajuste las rutas antes de instalar)
├── update.sh
├── waterfall.sh
├── websdr_relay.json.example  # plantilla de configuración (puerto, límites, identidad de la estación)
├── websdr_relay.py            # el relé en sí — véase docs/RECEIVE_DIVERSITY.md
├── websocketpp_asio_connection.hpp  # adaptador Boost >= 1.87: ws_post en lugar de io_service::post
├── websocketpp_asio_endpoint.hpp    # adaptador Boost >= 1.87: ws_work / ws_restart, max_listen_connections
├── websocketpp_asio.hpp        # adaptador Boost >= 1.87 para websocketpp (io_context, executor_work_guard)
└── xgo.sh                     # antiguo: arranca spectrumserver, lo llama check-go.sh
```
---

## Directorio raíz

### Archivos de configuración

| Archivo | Finalidad | Cuándo modificarlo |
|---------|-----------|--------------------|
| `config.toml` | Configuración por defecto | Configuración inicial, pruebas |
| `config-rtl.toml` | Configuración específica de RTL-SDR | Al usar un RTL-SDR |
| `config-rsp1a.toml` | Configuración de SDRplay RSP1A | Al usar un RSP1A |
| `config-airspyhf.toml` | Configuración de Airspy HF+ | Al usar un Airspy |
| `config-fobos-hf.toml` | RigExpert Fobos SDR, HF1/HF2 en muestreo directo (0-25 MHz) | Al usar un Fobos en HF |
| `config-fobos.toml` | RigExpert Fobos SDR, rama RF (25-6000 MHz) | Al usar un Fobos por encima de 25 MHz |
| `config-hackrf.toml` | Configuración de HackRF One | Al usar un HackRF |
| `config-rx888mk2.toml` | Configuración de RX888 MK2 | Al usar un RX888 |
| `config.example.hackrf.toml` | Ejemplo para HackRF One | Al usar un HackRF |

### Scripts de arranque, parada y mantenimiento

Cada `start-*.sh` de los siguientes es un **lanzador autónomo + watchdog + registrador**: detiene cualquier instancia en marcha, levanta el receptor y `spectrumserver`, pasa a segundo plano, reinicia automáticamente la cadena si se cae y registra en `logwebsdr.txt`. Comparten un único script de parada y un solo bloqueo `flock` (solo funciona un receptor a la vez). Edite únicamente el bloque **RECEIVER CONFIGURATION** de la parte superior de cada uno (argumentos del receptor / configuración / nombre del proceso). Los seis scripts de arranque hechos con la misma plantilla (`start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos.sh`, `start-fobos-hf.sh`, `start-hackrf.sh`) son idénticos por debajo de ese bloque; `start-rx888mk2.sh` es un script propio.

| Script | Finalidad |
|--------|-----------|
| `install.sh` | Instalación y compilación automatizadas |
| `start-rtl.sh` | Arranque + watchdog del servidor con RTL-SDR (`rtl_sdr`) |
| `start-rsp1a.sh` | Arranque + watchdog del servidor con SDRplay RSP1A (`rx_sdr`); usa libmirisdr-5, o la API de SDRplay cuando está instalada (`RX_DRIVER` fuerza uno) |
| `start-airspyhf.sh` | Arranque + watchdog del servidor con Airspy HF+ (`rx_sdr`) |
| `start-fobos-hf.sh` | Arranque + watchdog del servidor con RigExpert Fobos SDR, HF1/HF2 en muestreo directo (`rx_sdr \| cf32_to_real`) |
| `start-fobos.sh` | Arranque + watchdog del servidor con RigExpert Fobos SDR, rama RF (`rx_sdr`) |
| `start-hackrf.sh` | Arranque + watchdog del servidor con HackRF One (`hackrf_transfer`) |
| `start-rx888mk2.sh` | Arranque + watchdog del servidor con RX888 MK2 (`rx888_stream`) |
| `stop-websdr.sh` | Detiene el servidor y su watchdog: compartido por todos los receptores |
| `setup-rx888-udev.sh` | Instala reglas udev para que `rx888_stream` del RX-888 funcione sin sudo |
| `setup-rsp1a.sh` / `setup-fobos.sh` / `setup-airspyhf.sh` | Instalan la cadena de driver SoapySDR del RSP1A, el Fobos o el Airspy HF+ — SoapySDR desde la distribución, driver y rx_tools compilados en `sdr_drivers/`, una regla udev — en cualquiera de las cuatro distribuciones admitidas. Las opciones 3, 5 y 6 del instalador los ejecutan; también funcionan solos. Código común en `setup-sdr-common.sh` — vea la [Guía de instalación](INSTALLATION.md#receptores-sobre-soapysdr-rsp1a-fobos-airspy-hf) |
| `setup-hackrf.sh` | Instala el paquete `hackrf` de la distribución y una regla udev para el HackRF One, en cualquiera de las cuatro distribuciones admitidas; la opción 7 del instalador lo ejecuta |
| `setup-firewall.sh` | Guardia de avalanchas opcional en el núcleo: carga una tabla nftables con un tope de conexiones simultáneas y una tasa por dirección de origen en los puertos del receptor, un freno contra fuerza bruta en SSH y la compartición de archivos de Windows cerrada fuera de los rangos privados. Necesita root, no puede dejarle fuera (policy accept, las conexiones establecidas se aceptan primero) y `--apply` se revierte solo si no se confirma en 60 s — vea [Límites de conexión](CONNECTION_LIMITS.md) |
| `setup-cpufreq-perms.sh` | Concede a un grupo `cpufreq` permiso de escritura sobre el límite de frecuencia de la CPU, para que la fase throttle del guardián funcione sin root. Instala una regla `tmpfiles.d` para que sobreviva a un reinicio; `--revoke` lo deshace |
| `update.sh` | Actualizar la instalación desde el árbol publicado sin tocar su configuración, marcadores, lista de frecuencias ni cambios locales — véase la [Guía de instalación](INSTALLATION.md) |
| `recompile.sh` | Reconstruir el backend o el frontend y elegir la variante servida en `/` |
| `smeter_theme.sh` | Fijar la esfera por defecto del S-meter analógico (dark / amber / vintage) para todos los usuarios y ofrecer la reconstrucción del frontend — véase [Editar variantes](EDITING_VARIANTS.md) |
| `waterfall.sh` | Cambia el nivel mínimo de cascada predeterminado (dB) en `waterfall.js` + `App.svelte` — véase [README](README.md) |
| `kiwi_install.sh` | Instala la emulación de clientes KiwiSDR en un árbol que no la tiene: parchea las fuentes del backend, copia `src/kiwi_bridge.h` y añade un bloque `[kiwi_emulation]` documentado a los archivos de configuración de la raíz. Idempotente, y respalda cada archivo que toca — véase [Emulación de clientes KiwiSDR](Aether_config.md) |
| `tci-bridge/tci-rigctld.mjs` | El receptor no lo usa. Un pequeño programa Node.js que el oyente ejecuta junto a su propio transceptor: lee frecuencia, modo y estado de transmisión del `rigctld` de Hamlib y los ofrece como TCI en el puerto 50001, para que el botón **TCI-CAT** de la página controle un equipo sin TCI propio, como el IC-7300 — ver [Control del transceptor](RIG_CONTROL.md) |

**Cadena de arranque antigua.** `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh` y `_relaunch.sh` son la generación anterior de scripts de arranque, vigilancia y parada. Todo lo que hacían está ahora dentro de cada `start-<radio>.sh`, que es lo que debe usar. Se conservan en disco porque las instalaciones existentes los referencian, y no reciben mantenimiento.

### Archivos de datos

| Archivo | Finalidad | Formato |
|---------|-----------|---------|
| `markers.json` | Marcadores de frecuencia | JSON |
| `chat_history.txt` | Mensajes de chat de los usuarios | Texto plano |
| `favicon.ico` | Icono del sitio web | Imagen ICO |
| `fftw_wisdom` | Datos de optimización de la FFT | Binario FFTW |
| `phantom_fftw_wisdom` | Optimización adicional de la FFT | Binario FFTW |

### Panel de administración y reporte de spots

| Archivo | Finalidad |
|---------|-----------|
| `admin_server.py` | El propio panel de administración. Además de las páginas de gestión ejecuta el muestreador de la página **Gráficos**: un hilo en segundo plano toma cada 2 segundos la frecuencia de CPU, la carga, la temperatura y los usuarios conectados, y los guarda solo en memoria: 1 hora a resolución completa más 24 horas de promedios de 30 segundos. No se escribe nada en disco, así que el historial se pierde al reiniciar. |
| `admin_config.json` | Ajustes del panel de administración (hash de contraseña, puertos, opciones, umbrales de la protección térmica) |
| `thermal_guard.py` | Protección contra sobrecalentamiento de la CPU. Detiene el servidor cuando la CPU se calienta demasiado y lo reinicia una vez fría, derivando sus umbrales del límite crítico que publica su propia CPU en lugar de una cifra fija. Nunca intenta identificar qué supervisa el servidor: mientras hay exceso de temperatura repite la parada cada 2 s, de modo que un watchdog, una unidad de systemd o una tarea cron que lo reviva queda deshecha hasta que la máquina se enfríe. Solo biblioteca estándar; lo importa `admin_server.py` (temporizado por el muestreador de Gráficos) y también se ejecuta por su cuenta en instalaciones sin panel. Por defecto solo registra, así que no actúa sobre nada hasta que se active — véase [Panel de administración]véase el [manual del Thermal Guard](THERMAL_GUARD.md) |
| `autorun/` | El demonio de reporte de spots — véase [Autorun Spot Reporter](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr) |
| `autorun.json` | Bandas y modos a decodificar, identidad y destinos |
| `autorun-status.json` | Estado en vivo del demonio: alimenta los contadores **de la ejecución actual** (los paneles por decodificador), que se ponen a cero con Stop/Start |
| `autorun-totals.json` | Spots subidos **históricos** por banda y modo: el número junto a cada casilla; lo escribe el demonio para que sobreviva a los reinicios |

### Archivos del sistema de compilación

| Archivo | Finalidad |
|---------|-----------|
| `meson.build` | Configuración principal de compilación |
| `meson_options.txt` | Opciones de compilación configurables |
| `.gitattributes` | Atributos del repositorio Git |

---

## Código fuente (`src/`)

El directorio `src/` contiene la implementación del backend en C++.

### Componentes clave

#### 1. Aplicación principal (`main.cpp`)
- Analiza los argumentos de la línea de órdenes
- Carga el archivo de configuración
- Inicializa los componentes del servidor
- Arranca el bucle de eventos

#### 2. Servidor de espectro (`spectrumserver.cpp`)
- Coordina todos los componentes
- Gestiona las conexiones de los usuarios
- Distribuye los datos de espectro
- Atiende las peticiones de los usuarios

#### 3. Controladores de SDR (`drivers/`)
- Interfaz abstracta para el hardware SDR
- Lectura y formateo de los datos de muestras
- Manejo de las funciones propias de cada dispositivo

#### 4. Motor de DSP (`dsp/`)
- Cálculo de la FFT (acelerado por CPU/GPU)
- Demodulación (AM, FM, SSB, CW, etc.)
- Filtrado y remuestreo de audio
- AGC y reducción de ruido

#### 5. Servidor web (`server/`)
- Comunicación por WebSocket
- Servicio de archivos estáticos por HTTP
- Gestión de sesiones de usuario
- Transmisión de datos en tiempo real

#### 6. Codificación de audio (`audio/`)
- Compresión FLAC
- Compresión Opus
- Optimización de la transmisión

---

## Frontend (`frontend/`)

La interfaz de usuario web construida con Svelte y Vite.


#### 1. Aplicación principal (`App.svelte`)
- Componente de nivel superior
- Estructura del diseño
- Orquestación de componentes
- **Fila de botones de decodificador** — un botón por decodificador en el panel principal, justo debajo del selector de modos; una pulsación inicia el decodificador y abre su ventana, una segunda lo detiene. Sustituyó a la antigua fila de ancho de banda. RADEL/RADEU están en `lib/ModesSelector.svelte`, junto al selector de modos y dentro de las ventanas emergentes **Modes** y **Bands**.

#### 2. Cascada (`waterfall.js` + `lib/`)
- Representación del espectro y de la cascada en canvas, mapas de color y el ajuste automático adaptativo, todo en `waterfall.js` (JS puro, no un componente)
- Sintonía interactiva mediante `lib/PassbandTuner.svelte`
- Superposiciones del plan de bandas y de los marcadores mediante `lib/FrequencyMarkers.svelte`
- El espectrograma de audio es un componente aparte: `lib/Spectrogram.svelte`

#### 3. Controles (`App.svelte` + `lib/`)
- Entrada e indicación de frecuencia — `lib/FrequencyInput.svelte`
- Selección de modo (AM/FM/SSB/CW) — `lib/ModesSelector.svelte`, cambio de banda — `lib/BandSelector.svelte`
- AGC/NR/NB y el resto de controles están en el propio `App.svelte`; no existe un `Controls.svelte` aparte

#### 3a. Escáner (`scanner.js`)
- Explorador de canales: recorre el receptor por un margen y se detiene en el primer canal con señal. JS puro, no un componente — `App.svelte` aporta el VFO, el modo, el plan de bandas y la llamada de sintonía, y recibe de vuelta el estado de la interfaz por una sola función de retorno
- El umbral es en dB sobre el ruido de fondo de la banda en vez de un nivel absoluto, reutilizando el ruido que `waterfall.js` ya sigue (`snrNoiseDb`), así que no necesita calibración propia
- Dos maneras de recorrer la banda: sintonizar y escuchar cada canal, o examinar antes el espectro y sintonizar sólo lo que no pueda descartarse. El espectro puede saltarse un canal pero nunca detenerse en uno — toda parada procede de una escucha real
- El margen es la banda del plan de bandas o exactamente lo que muestra la cascada; la reanudación automática, el tiempo máximo de permanencia y la lista de exclusión también viven aquí, guardados en `localStorage`

#### 4. Sistema de audio (`audio.js`)
- Flujo de audio por WebSocket
- Decodificación FLAC/Opus
- Control de la reproducción de audio
- Distribuye el PCM en bruto (tomado antes del AGC, la reducción de ruido y el silenciado) a los decodificadores de modo
- Reducción de ruido por IA: `lib/rnnoise.js` carga el módulo WebAssembly de RNNoise (`@jitsi/rnnoise-wasm`) en el primer uso; `audio.js` lo aplica solo en modos de voz, después de la toma de los decodificadores, así que estos nunca lo oyen

#### 4a. Decodificadores de modo y sus workers

Cada uno de los decodificadores de modo más pesados se ejecuta en su propio Web Worker, de modo que la decodificación nunca bloquea la reproducción de audio ni la cascada. Todos siguen un mismo patrón: tres archivos por decodificador.

| Decodificador | Motor | Worker | Proxy en el hilo principal |
|---------------|-------|--------|-----------------------------|
| SSTV | `sstv.js` | `sstv.worker.js` | `sstvWorkerProxy.js` |
| FAX de HF | `fax.js` | `fax.worker.js` | `faxWorkerProxy.js` |
| NAVTEX + FSK/RTTY + PSK31 + Olivia | `fsk.js`, `psk31.js`, `olivia.js` | `fsk.worker.js` | `fskWorkerProxy.js` |
| CW | `cwDecoder.js` | `cw.worker.js` | `cwWorkerProxy.js` |

- El **motor** es código de DSP puro que desconoce por completo los workers, así que también puede ejecutarse directamente (pruebas unitarias o el modo alternativo en el mismo hilo).
- El **worker** mantiene una instancia del motor y reenvía sus eventos tal cual.
- El **proxy** replica la superficie de métodos del motor, de modo que `audio.js` lo llama exactamente igual que llamaría al decodificador. Crea el worker de forma perezosa al activarlo por primera vez y recurre a la ejecución en el hilo principal si no hay workers disponibles.

Dos detalles son fundamentales: el PCM se **copia** en un búfer nuevo antes de transferirlo al worker (transferir una vista del acumulador de audio lo desvincularía y detendría la reproducción), y el mensaje `init` del worker vuelve a aplicar la configuración a un motor ya en marcha en lugar de suponer que es nuevo.

`fsk.js` atiende tanto NAVTEX como FSK/RTTY desde un único motor, seleccionado por instancia mediante un campo `role`; cada instancia tiene su propio estado, así que ambos pueden funcionar de forma independiente.

El rol `fsk` alberga además dos decodificadores que no son FSK en absoluto. Al seleccionar la variante `psk31` u `olivia`, `fsk.js` entrega el audio a `psk31.js` o a `olivia.js` en lugar de a su propia cadena discriminadora, pero sigue aprovechando su configuración, su worker y su gestión de eventos — de modo que `fsk.worker.js`, `fskWorkerProxy.js` y `audio.js` no necesitan saber nada de ninguno de los dos modos, y la interfaz consume en todo momento los mismos eventos `char`/`status`/`metrics`.

- `psk31.js` — BPSK31: banda base compleja, filtro adaptado, detección diferencial y varicode, con una adquisición espectral gruesa más un AFC fino que cubre unos ±25 Hz.
- `olivia.js` — Olivia MFSK: una adaptación del receptor MFSK de Pawel Jalocha procedente de fldigi (`pj_mfsk.h`, GPL-3, igual que este proyecto), incluida la corrección de errores Walsh/Hadamard y la búsqueda ciega de sincronización sobre la fase de bloque y el desplazamiento de frecuencia.
- `broadcastSchedules.js` — los horarios UTC que los decodificadores de FAX, NAVTEX y RTTY ofrecen como preajustes, tomados de los programas de facsímil marino de NOAA/NWS y de las listas publicadas de estaciones NAVTEX

#### 4b. Diversidad de recepción (`diversity.js`)
- Combina el receptor local con un segundo receptor en otro lugar y sigue al emplazamiento que en cada momento tiene mejor señal. JS puro, no un componente — se apoya en una única costura de `audio.js`, que le entrega el PCM local y reproduce lo que devuelve
- **Selección, no suma.** Dos emplazamientos oyen la misma emisión por caminos ionosféricos distintos, así que sus formas de onda tienen fase no relacionada; sumarlas suena a filtro de peine. La combinación coherente exigiría un reloj común, que dos receptores por internet no comparten. Solo se mezclan durante un fundido de 30 ms
- La alineación correla las dos **envolventes de audio** (potencia logarítmica a 100 Hz), nunca las formas de onda — la envolvente sobrevive al camino y a cualquier códec. Un enganche solo se acepta cuando una segunda búsqueda independiente coincide, lo que descarta el retardo rotundo pero equivocado que darían dos emplazamientos desvaneciéndose en antifase
- El flujo remoto se **enclava en velocidad** con el local antes que nada. Dos receptores son dos relojes y dos cadenas de diezmado, así que su audio llega hasta un 2% desparejado aunque ambos declaren 12 kHz — 240 muestras por segundo de deriva, que ninguna correlación aguanta. La relación se mide a partir de cuántas muestras entrega realmente cada lado y la aplica un remuestreador que arrastra su fase fraccionaria entre bloques, de modo que una relación arbitraria se sostiene indefinidamente
- La elección de emplazamiento usa un SNR por percentiles medido sobre muestras **alineadas en contenido**, con histéresis, temporizador de permanencia y una salida rápida si el emplazamiento activo se hunde. Los niveles se igualan ruido contra ruido, de modo que un cambio no altera el siseo de fondo
- Los decodificadores conservan el flujo **local**: FT8, JS8, WSPR y RADE integran de forma coherente durante una ranura, y un cambio a mitad es una discontinuidad de fase que puede costar la decodificación

#### 4c. Fuentes de diversidad (`remoteSource.js`, `kiwiSource.js`, `uberSource.js`, `webSdrSource.js`)
- Un único contrato — `onPcm` / `onState` / `tune` / `canReceive` — de modo que `diversity.js` nunca sabe qué hay al otro lado. Añadir un tipo de receptor es un fichero nuevo
- `remoteSource.js` — otro PhantomSDR-Plus por `/audio` (cbor + FLAC), reutilizando `createDecoder()` de `lib/wrappers.js`
- `kiwiSource.js` — un KiwiSDR: tramas `SND`, PCM big-endian, con la marca de tiempo GPS de 10 bytes que un paquete estéreo inserta antes del audio
- `uberSource.js` — un UberSDR por su `/ws` nativo: Opus tras una cabecera de 21 bytes, resintonizando sobre la conexión abierta. El identificador de sesión debe registrarse antes con `POST /connection` y debe ser un UUID
- `webSdrSource.js` — un WebSDR, a través de `websdr_relay.py` en este servidor: el navegador no puede conectarse directamente porque WebSDR comprueba la cabecera `Origin` y ningún script puede cambiarla. La sintonía va como trama de texto por la misma conexión; la cobertura de bandas la aporta el relé
- `webSdrCodec.js` — el formato de audio de WebSDR: un flujo etiquetado byte a byte cuyos bloques comprimidos alimentan un predictor leaky-LMS de 20 tomas. Portado del cliente de WebSDR y verificado muestra a muestra contra él
- `diversityList.js` — la lista de receptores guardados y las reglas de dirección de los cuatro tipos, compartidas por el panel de escritorio y la página móvil para que un solo formato sirva a ambos. También la transferencia — un blob compacto, su código QR y un analizador que acepta todas las formas que las dos páginas han escrito alguna vez — y `browseUrl()`, que devuelve una dirección marcada a una que un navegador puede abrir
- `lib/DiversityPanel.svelte` — la interfaz: dirección, tipo de fuente, ajuste de SNR y estado en vivo, más los receptores guardados — con nombre, reordenables y exportables e importables como archivo JSON, por tipo de fuente en `localStorage`. Todo se edita dentro del panel: `prompt()` y `confirm()` bloquean el hilo principal, que es por donde el audio llega al worklet de reproducción. Un botón **▦ QR** dibuja la lista como código escaneable, porque `localStorage` pertenece a un navegador y un teléfono empieza vacío. `mobile/Mobile.svelte` lleva la misma función en una pestaña **Div**, con el CSS sencillo propio de esa página. Véase [Diversidad de recepción](RECEIVE_DIVERSITY.md)

#### 4d. Identificador de modo (`modeId.js`, `modePriors.js`)
- Responde a «¿qué estoy escuchando?». Lee la misma toma de PCM en bruto que los decodificadores y ordena los modos probables, para que el operador elija el decodificador correcto en vez de probar los diez. Nunca decodifica: mide propiedades físicas de la señal y las puntúa contra una tabla de modos conocidos
- El ancho ocupado es la anchura contigua a −15 dB alrededor del pico, deliberadamente no una cifra del 99 % de potencia: los clics de manipulación dejan colas largas en la integral de potencia y hacían que todo modo estrecho pareciera varias veces más ancho. La velocidad de símbolo sale de la **frecuencia instantánea** y no de las energías de los tonos, porque ninguna integración resuelve a la vez un desplazamiento de 170 Hz y un símbolo de 100 Bd. La velocidad de manipulación sale de la envolvente on/off y sirve además como lectura de velocidad en CW
- `modePriors.js` aporta la única pista que el audio no puede llevar: dónde está sintonizado. Una señal de 100 Bd / 170 Hz en 518 kHz es NAVTEX; la misma señal en 14,070 MHz no lo es. Solo repondera lo que la señal ya sostenía, y nunca inventa un candidato
- FT8, JS8 y FT2 se informan como un grupo a propósito: no se separan solo por ancho y separación de tonos, y fingir lo contrario sería una respuesta equivocada dicha con seguridad
- Por debajo de unos 10 dB de SNR calla en lugar de adivinar
- Corre en su propio Web Worker (`modeId.worker.js` + `modeIdWorkerProxy.js`), con el mismo patrón motor/worker/proxy que los decodificadores anteriores; el resultado es la etiqueta de `lib/ModeIdChip.svelte`

#### 4e. Conexiones rechazadas (`refused.js`, `clientVersion.js`)

- `refused.js` es el vocabulario compartido para una conexión que el servidor rechaza: código de cierre **4003** (por encima de un límite por dirección, o la página es anterior a `[server] min_client_version`) y **4001** (una expulsión del sysop). Ambos son definitivos. `audio.js`, `waterfall.js` y `events.js` importan `isRefusal()` de ahí, porque los tres abren una conexión que puede ser rechazada y los tres deben resolver su promesa de inicio cuando ocurre — si no, la página espera para siempre una conexión que nunca llegará
- Nada reintenta. Una conexión `/audio` caída termina la sesión a propósito: `/waterfall` y `/events` nunca volvían con una reconexión, así que una sesión reintentada era audio vivo sobre una cascada congelada, y frente a un límite de tasa cada intento alargaría justo el rechazo que trataba de sortear. La página de escritorio explica un rechazo que ocurre al cargar y simplemente se detiene cuando ocurre a mitad de sesión; `/mobile` muestra una línea pidiendo al oyente que recargue
- `clientVersion.js` contiene un único entero, `CLIENT_VERSION`, que la página añade a su conexión de audio como `/audio?v=N`. El servidor rechaza todo lo inferior a `[server] min_client_version`, que es como una estación obliga a recargar a las pestañas que aún ejecutan una versión anterior — la única palanca que hay, ya que el servidor no alcanza el JavaScript que ya corre en un navegador. Increméntelo cuando un cambio del frontend no deba seguir siendo ignorado por pestañas abiertas
- Referencia completa: [Límites de conexión](CONNECTION_LIMITS.md)

#### 5. Gestión del estado (`stores/`)
- Almacenes de datos reactivos
- Estado compartido de la aplicación
- Manejo de eventos

---

### Funciones clave

- Procesamiento de audio en tiempo real
- Decodificación de modos digitales (FT8, RTTY, etc.)
- Filtrado de audio
- Análisis de espectro

---


## Listas de frecuencias (`frequencylist/`)

Los marcadores de frecuencia sobre la cascada. `mymarkers.json` es la lista que el receptor muestra realmente; el resto es la materia prima que `update-markers.sh` convierte en ella, actualizada desde las programaciones en línea. El `README.md` de ese directorio explica la actualización en los siete idiomas.

```
frequencylist/
├── mymarkers.json            # los marcadores que muestra el receptor — editados a mano, sobreviven a una actualización
├── shortwavestations.json    # emisoras de onda corta, generado por generate-current-shortwave.py
├── 0.TXT                     # la programación global de HF A26, descomprimida y analizada por update-markers.sh
├── a26allx2.zip              # archivo de origen descargado por update-markers.sh
├── admin.txt · antenna.txt · broadcas.txt · fmorg.txt · language.txt · site.txt
│                             # listas auxiliares de la misma fuente (emplazamientos, idiomas, administradores, antenas)
├── generate-current-shortwave.py
├── update-markers.sh         # actualiza todo lo anterior desde las programaciones en línea
└── README.md
```

### Formato (`mymarkers.json`, `shortwavestations.json`)

```json
[
    { "frequency": 77500,   "name": "DCF77", "mode": "CW" },
    { "frequency": 2485000, "name": "Vanuatu Broadcasting", "mode": "AM" }
]
```

---

## Archivos de configuración

### Configuración del servidor (archivos `.toml`)

Estructura de los archivos de configuración:

```toml
[server]
# Web server settings
port = 9002
html_root = "frontend/dist/"
threads = 2
otherusers = 1

[limits]
# Límites por dirección — todos desactivados o con un valor sensato por defecto,
# así que una configuración sin ellos se comporta como siempre. Vea CONNECTION_LIMITS.md.
per_ip = 3              # oyentes simultáneos desde una dirección
per_ip_rate = 40        # conexiones nuevas por minuto desde una dirección

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

### Información del sitio (`site_information.json`)

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

## Sistema de compilación

### Configuración de compilación con Meson

#### `meson.build` (raíz)

Define:
- Metadatos del proyecto
- Dependencias
- Opciones del compilador
- Listas de archivos fuente
- Objetivos de compilación

#### `meson_options.txt`

Opciones disponibles:
```
option('opencl', type: 'boolean', value: false, description: 'Enable OpenCL support')
option('cuda', type: 'boolean', value: false, description: 'Enable CUDA support')
option('optimization', type: 'string', value: '3', description: 'Optimization level')
```

---

## Dependencias entre archivos

### Dependencias de compilación del backend

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

### Dependencias de compilación del frontend

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

## Flujo de datos

### Flujo de funcionamiento del servidor

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

### Flujo de interacción del usuario

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

## Guía de modificación de archivos

### Cuando modifica el código del backend (`src/**`):

```bash
cd PhantomSDR-Plus
meson compile -C build
# Server restart required
```

### Cuando modifica el código del frontend (`frontend/src/**`):

```bash
cd PhantomSDR-Plus/frontend
npm run build
cd ..
# Server restart required (for static files)
```

### Cuando modifica la configuración (`.toml`, `.json`):

```bash
# Restart server
./stop-websdr.sh
./start-rtl.sh  # (or appropriate start script)
```

### Cuando modifica los marcadores (`markers.json`):

```bash
# Reload page in browser
# No server restart needed
```

---

## Rutas importantes

### Rutas en ejecución

- **Configuración**: `./config-*.toml`
- **Raíz HTML**: `./frontend/dist/`
- **Marcadores**: `./markers.json`
- **Historial del chat**: `./chat_history.txt`
- **FFTW wisdom**: `./fftw_wisdom`, `./phantom_fftw_wisdom`

### Rutas de compilación

- **Binario generado**: `./build/spectrumserver`
- **Salida del frontend**: `./frontend/dist/`
- **Módulos de Node**: `./frontend/node_modules/`

### Rutas de código fuente

- **Fuente del backend**: `./src/`
- **Fuente del frontend**: `./frontend/src/`
- **Bibliotecas de DSP**: `./jsdsp/`

---

## Operaciones habituales con archivos

### Añadir una configuración de SDR nueva

1. Copie una configuración existente: `cp config-rtl.toml config-mydevice.toml`
2. Edite los parámetros: `nano config-mydevice.toml`
3. Cree un script de arranque: `cp start-rtl.sh start-mydevice.sh`
4. Edite el script de arranque: `nano start-mydevice.sh`; cambie únicamente el bloque **RECEIVER CONFIGURATION** de la parte superior (`RX_LABEL`, `RX_COMM` = el nombre del proceso del receptor, `RX_ARGS`, `CONFIG`, `FIFO` y el enganche `prestart` si el dispositivo lo necesita). La lógica de lanzamiento/watchdog/registro que hay debajo es genérica y no requiere cambios.
5. Hágalo ejecutable: `chmod +x start-mydevice.sh`

> `stop-websdr.sh` ya detiene cualquier `start-*.sh --watchdog`; si su receptor usa un nombre de proceso distinto de `rx888_stream`/`rx_sdr`/`rtl_sdr`/`hackrf_transfer`/`cf32_to_real`, añada también allí una línea `killall -9 <nombre>`.

### Personalizar el frontend

1. Modifique el código fuente: `nano frontend/src/App.svelte`
2. Recompile: `cd frontend && npm run build && cd ..`
3. Reinicie el servidor: `./stop-websdr.sh && ./start-rtl.sh`

### Añadir marcadores propios

1. Edite el archivo de marcadores: `nano markers.json`
2. Formato:
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
3. Recargue el navegador (no hace falta reiniciar el servidor)

---

## Control de versiones

### Archivos que conviene versionar en Git

- Código fuente (`src/`, `frontend/src/`, `jsdsp/`)
- Ejemplos de configuración (`config.example.*.toml`)
- Sistema de compilación (`meson.build`, `meson_options.txt`)
- Documentación (`*.md`, `docs/`)
- Scripts (`*.sh`)

### Archivos que conviene ignorar (`.gitignore`)

- Resultados de compilación (`build/`, `frontend/dist/`)
- Dependencias (`frontend/node_modules/`)
- Datos de usuario (`chat_history.txt`)
- Configuraciones personales (`config-rtl.toml` si se ha personalizado)
- Datos binarios (`*.o`, `*.so`)

---

**Esta documentación de la estructura debería ayudarle a orientarse y a entender el código de PhantomSDR-Plus.**

Para las instrucciones de instalación, consulte [INSTALLATION.md](INSTALLATION.md). Para información sobre el uso, consulte [USER_GUIDE.md](USER_GUIDE.md).

**73 de SV1BTL & SV2AMK**
