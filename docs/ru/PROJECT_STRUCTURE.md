# Структура проекта PhantomSDR-Plus

Этот документ даёт полный обзор структуры каталогов PhantomSDR-Plus, организации файлов и связей между компонентами.

---

## Содержание

1. [Дерево каталогов](#дерево-каталогов)
2. [Корневой каталог](#корневой-каталог)
3. [Исходный код (`src/`)](#исходный-код-src)
4. [Веб-интерфейс (`frontend/`)](#веб-интерфейс-frontend)
5. [Списки частот (`frequencylist/`)](#списки-частот-frequencylist)
6. [Файлы конфигурации](#файлы-конфигурации)
7. [Система сборки](#система-сборки)

---

## Дерево каталогов
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
├── cf32_to_real.c             # Fobos HF: оставляет I из CF32 от rx_sdr, масштабированный в s16 (собирает setup-fobos.sh)
├── chat_history.txt
├── check-go.sh                # старое: сторож цепочки go.sh
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
│   ├── A26all00.TXT           # нет в репозитории: распаковывается из a26allx2.zip скриптом update-markers.sh
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
│   ├── .prettierrc.json      # правила форматирования Prettier для исходников фронтенда
│   ├── public
│   │   ├── analyze_users.py
│   │   ├── decoders
│   │   │   ├── ft8_lib.wasm
│   │   │   ├── js8_dict.bin   # словарь слов JS8, загружается только при необходимости
│   │   │   └── js8.wasm       # декодер JS8, собран из jsdsp/js8_wasm
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
│   │   │   ├── rnnoise.js     # загружает RNNoise для шумоподавления на основе ИИ
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
├── go.sh                      # старая цепочка запуска, заменена на start-<radio>.sh
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
│   ├── js8_wasm               # декодер JS8 на C, собранный в WebAssembly, с тестами и эталонной проверкой — см. его README
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
├── kill.sh                    # старое: завершает процессы сервера, вызывается из go.sh
├── kiwi_install.sh             # устанавливает мост KiwiSDR в существующее дерево
├── LICENSE
├── logproxy                   # ротированные копии журналов панели/прокси/autorun
├── logrotate
│   └── phantomsdr             # конфигурация logrotate для proxy.log + admin.log (перед установкой поправьте пути)
├── manage_admin.sh
├── markers.json
├── meson.build
├── meson_options.txt
├── phantom_fftw_wisdom
├── phantomsdr-admin.service   # пример юнита systemd для панели (запуск при загрузке, перезапуск после сбоя)
├── phantomsdr-proxy.service   # пример юнита systemd для прокси, ставится вместе с юнитом панели
├── phantomsdr-websdr-relay.service  # пример systemd-юнита для ретранслятора WebSDR
├── proxy.py
├── rade_helper.py
├── rade_loadtest.csv          # вывод rade_loadtest.py (одна строка на ступень нагрузки)
├── rade_loadtest.py           # нагрузочный тест RADE: сколько одновременных декодеров выдерживает машина — см. docs/RADE_README.md
├── rade.sh
├── README.md
├── recompile.sh
├── _relaunch.sh               # старое: помощник отложенного перезапуска цепочки go.sh
├── request.hpp
├── setup_admin.sh
├── setup-airspyhf.sh          # цепочка драйвера Airspy HF+: libairspyhf + SoapyAirspyHF + rx_sdr + udev
├── setup-cpufreq-perms.sh     # даёт группе право записи в scaling_max_freq, чтобы защита могла снижать частоту без root
├── setup-firewall.sh          # необязательная защита nftables — см. docs/CONNECTION_LIMITS.md
├── setup-fobos.sh             # цепочка драйвера Fobos: libfobos + SoapyFobosSDR + rx_sdr + cf32_to_real + udev
├── setup-hackrf.sh            # HackRF: пакет hackrf из дистрибутива + udev (ничего не собирается)
├── setup-rsp1a.sh             # цепочка драйвера RSP1A: libmirisdr-5 + SoapyMiri + rx_sdr + чёрный список msi2500 + udev
├── setup-rx888-udev.sh
├── setup-sdr-common.sh        # общие функции трёх сценариев setup выше
├── setup_websdr_relay.sh      # устанавливает ретранслятор WebSDR (порт, идентификация, systemd)
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
│   ├── kiwi_bridge.h          # мост протокола KiwiSDR — см. docs/Aether_config.md
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
│   └── tci-rigctld.mjs        # сервер TCI для трансиверов Hamlib (IC-7300…), запускается на ПК слушателя — см. docs/RIG_CONTROL.md
├── thermal_guard.py           # Защита от перегрева процессора для панели администратора (работает и отдельно)
├── thermal-guard.service      # пример systemd-юнита для защиты, для установок без панели
├── tmpfiles
│   └── phantomsdr-logs.conf   # оставляет admin.log + proxy.log во владении пользователя панели (перед установкой поправьте пути)
├── update.sh
├── waterfall.sh
├── websdr_relay.json.example  # шаблон конфигурации (порт, пределы, идентификация станции)
├── websdr_relay.py            # сам ретранслятор — см. docs/RECEIVE_DIVERSITY.md
├── websocketpp_asio_connection.hpp  # слой Boost >= 1.87: ws_post вместо io_service::post
├── websocketpp_asio_endpoint.hpp    # слой Boost >= 1.87: ws_work / ws_restart, max_listen_connections
├── websocketpp_asio.hpp        # слой совместимости Boost >= 1.87 для websocketpp (io_context, executor_work_guard)
└── xgo.sh                     # старое: запускает spectrumserver, вызывается из check-go.sh
```
---

## Корневой каталог

### Файлы конфигурации

| Файл | Назначение | Когда изменять |
|------|------------|----------------|
| `config.toml` | Конфигурация по умолчанию | Первичная настройка, тесты |
| `config-rtl.toml` | Конфигурация для RTL-SDR | При использовании RTL-SDR |
| `config-rsp1a.toml` | Конфигурация SDRplay RSP1A | При использовании RSP1A |
| `config-airspyhf.toml` | Конфигурация Airspy HF+ | При использовании Airspy |
| `config-fobos-hf.toml` | RigExpert Fobos SDR, HF1/HF2 с прямой оцифровкой (0-25 МГц) | При использовании Fobos на КВ |
| `config-fobos.toml` | RigExpert Fobos SDR, тракт RF (25-6000 МГц) | При использовании Fobos выше 25 МГц |
| `config-hackrf.toml` | Конфигурация HackRF One | При использовании HackRF |
| `config-rx888mk2.toml` | Конфигурация RX888 MK2 | При использовании RX888 |
| `config.example.hackrf.toml` | Пример для HackRF One | При использовании HackRF |

### Скрипты запуска, остановки и обслуживания

Каждый из приведённых ниже `start-*.sh` — это **самодостаточный лаунчер + сторожевой процесс
+ журналирование**: он останавливает запущенный экземпляр, поднимает приёмник + `spectrumserver`, уходит в фоновый режим, автоматически перезапускает цепочку при её завершении и ведёт журнал в `logwebsdr.txt`. У них общий скрипт остановки и единая блокировка `flock` (одновременно работает только один приёмник). Правьте только блок **RECEIVER CONFIGURATION** в начале каждого (аргументы приёмника / конфигурация / имя процесса). Шесть сценариев запуска, сделанных по одному шаблону (`start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos.sh`, `start-fobos-hf.sh`, `start-hackrf.sh`), одинаковы ниже этого блока; `start-rx888mk2.sh` — отдельный сценарий.

| Скрипт | Назначение |
|--------|------------|
| `install.sh` | Автоматизированная установка и сборка |
| `start-rtl.sh` | Запуск + сторожевой процесс сервера с RTL-SDR (`rtl_sdr`) |
| `start-rsp1a.sh` | Запуск + сторожевой процесс сервера с SDRplay RSP1A (`rx_sdr`); использует libmirisdr-5 или API SDRplay, если он установлен (`RX_DRIVER` задаёт принудительно) |
| `start-airspyhf.sh` | Запуск + сторожевой процесс сервера с Airspy HF+ (`rx_sdr`) |
| `start-fobos-hf.sh` | Запуск + сторожевой процесс сервера с RigExpert Fobos SDR, HF1/HF2 с прямой оцифровкой (`rx_sdr \| cf32_to_real`) |
| `start-fobos.sh` | Запуск + сторожевой процесс сервера с RigExpert Fobos SDR, тракт RF (`rx_sdr`) |
| `start-hackrf.sh` | Запуск + сторожевой процесс сервера с HackRF One (`hackrf_transfer`) |
| `start-rx888mk2.sh` | Запуск + сторожевой процесс сервера с RX888 MK2 (`rx888_stream`) |
| `stop-websdr.sh` | Остановка сервера и его сторожевого процесса — общий для всех приёмников |
| `setup-rx888-udev.sh` | Устанавливает правила udev, чтобы `rx888_stream` для RX-888 работал без sudo |
| `setup-rsp1a.sh` / `setup-fobos.sh` / `setup-airspyhf.sh` | Ставят цепочку драйвера SoapySDR для RSP1A, Fobos или Airspy HF+ — SoapySDR из дистрибутива, драйвер и rx_tools, собранные в `sdr_drivers/`, правило udev — на любом из четырёх поддерживаемых дистрибутивов. Их запускают пункты 3, 5 и 6 установщика; работают и сами по себе. Общий код в `setup-sdr-common.sh` — см. [Руководство по установке](INSTALLATION.md#приёмники-через-soapysdr-rsp1a-fobos-airspy-hf) |
| `setup-hackrf.sh` | Ставит пакет `hackrf` из дистрибутива и правило udev для HackRF One на любом из четырёх поддерживаемых дистрибутивов; его запускает пункт 7 установщика |
| `setup-firewall.sh` | Необязательная защита от лавины на уровне ядра: загружает таблицу nftables с потолком одновременных подключений и темпом на адрес источника для портов приёмника, тормозом против перебора паролей SSH и общим доступом Windows, закрытым вне частных диапазонов. Требует root, не может запереть вас снаружи (policy accept, установленные подключения принимаются первыми), а `--apply` сам откатывается, если не подтвердить за 60 с — см. [Ограничения подключений](CONNECTION_LIMITS.md) |
| `setup-cpufreq-perms.sh` | Даёт группе `cpufreq` право записи в ограничение частоты процессора, чтобы этап throttle стража работал без root. Устанавливает правило `tmpfiles.d`, чтобы переживать перезагрузку; `--revoke` всё отменяет |
| `update.sh` | Обновление установки из опубликованного дерева без изменения вашей конфигурации, меток, списка частот и локальных правок — см. [Руководство по установке](INSTALLATION.md) |
| `recompile.sh` | Пересборка бэкенда и/или фронтенда и выбор варианта, отдаваемого по `/` |
| `smeter_theme.sh` | Задать шкалу аналогового S-метра по умолчанию (dark / amber / vintage) для всех пользователей и предложить пересборку фронтенда — см. [Редактирование вариантов](EDITING_VARIANTS.md) |
| `waterfall.sh` | Меняет минимальный уровень водопада по умолчанию (dB) в `waterfall.js` + `App.svelte` — см. [README](README.md) |
| `kiwi_install.sh` | Устанавливает эмуляцию клиентов KiwiSDR в дерево, где её нет: правит исходники серверной части, копирует `src/kiwi_bridge.h` и добавляет документированный блок `[kiwi_emulation]` в файлы конфигурации в корне. Идемпотентен и сохраняет копию каждого файла, к которому прикасается — см. [Эмуляция клиентов KiwiSDR](Aether_config.md) |
| `tci-bridge/tci-rigctld.mjs` | Приёмником не используется. Небольшая программа на Node.js, которую слушатель запускает рядом со своим трансивером: она читает частоту, вид модуляции и состояние передачи из `rigctld` Hamlib и отдаёт их по TCI на порту 50001, чтобы кнопка **TCI-CAT** на странице управляла трансивером без собственного TCI, например IC-7300, — см. [Управление трансивером](RIG_CONTROL.md) |

**Старая цепочка запуска.** `go.sh`, `xgo.sh`, `check-go.sh`, `kill.sh` и `_relaunch.sh` — предыдущее поколение скриптов запуска, наблюдения и остановки. Всё, что они делали, теперь находится внутри каждого `start-<radio>.sh`, и пользоваться следует именно им. Они остаются на диске, потому что на них ссылаются существующие установки, и больше не сопровождаются.

### Файлы данных

| Файл | Назначение | Формат |
|------|------------|--------|
| `markers.json` | Частотные закладки и маркеры | JSON |
| `chat_history.txt` | Сообщения чата пользователей | Обычный текст |
| `favicon.ico` | Значок сайта | Изображение ICO |
| `fftw_wisdom` | Данные оптимизации FFT | Двоичный формат FFTW |
| `phantom_fftw_wisdom` | Дополнительная оптимизация FFT | Двоичный формат FFTW |

### Панель администратора и отправка спотов

| Файл | Назначение |
|------|------------|
| `admin_server.py` | Сама панель администратора. Помимо страниц управления она выполняет сбор данных для страницы **Графики**: фоновый поток каждые 2 секунды снимает частоту процессора, нагрузку, температуру и число слушателей и держит их только в памяти — 1 час в полном разрешении плюс 24 часа усреднений по 30 секунд. На диск ничего не пишется, поэтому история теряется при перезапуске. |
| `admin_config.json` | Настройки панели администратора (хеш пароля, порты, параметры, пороги тепловой защиты) |
| `thermal_guard.py` | Защита от перегрева процессора. Останавливает сервер, когда процессор становится слишком горячим, и запускает его снова после остывания, выводя пороги из критического порога, который публикует ваш собственный процессор, а не из фиксированного числа. Она никогда не пытается определить, что присматривает за сервером: пока держится перегрев, она повторяет остановку каждые 2 с, так что watchdog, юнит systemd или задание cron, оживившие сервер, будут отменены, пока машина не остынет. Только стандартная библиотека; импортируется из `admin_server.py` (такт задаёт сборщик Графиков) и работает отдельно для установок без панели. По умолчанию только записывает, то есть ни на что не воздействует до включения — см. [Панель администратора]см. [руководство Thermal Guard](THERMAL_GUARD.md) |
| `autorun/` | Служба отправки спотов — см. [Autorun Spot Reporter](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr) |
| `autorun.json` | Диапазоны и виды связи для декодирования, данные оператора и приёмники отчётов |
| `autorun-status.json` | Текущее состояние службы — питает счётчики **текущего запуска** (плитки по декодерам), которые обнуляются при Stop/Start |
| `autorun-totals.json` | **Итоги за всё время** по диапазону и виду связи — число рядом с каждым флажком; пишется службой, поэтому переживает перезапуски |

### Файлы системы сборки

| Файл | Назначение |
|------|------------|
| `meson.build` | Основная конфигурация сборки |
| `meson_options.txt` | Настраиваемые параметры сборки |
| `.gitattributes` | Атрибуты репозитория Git |

---

## Исходный код (`src/`)

Каталог `src/` содержит реализацию серверной части на C++.

### Ключевые компоненты

#### 1. Основное приложение (`main.cpp`)
- Разбирает аргументы командной строки
- Загружает файл конфигурации
- Инициализирует компоненты сервера
- Запускает цикл событий

#### 2. Сервер спектра (`spectrumserver.cpp`)
- Координирует все компоненты
- Управляет подключениями пользователей
- Раздаёт данные спектра
- Обрабатывает запросы пользователей

#### 3. Драйверы SDR (`drivers/`)
- Абстрактный интерфейс для оборудования SDR
- Чтение и форматирование данных отсчётов
- Обработка особенностей конкретных устройств

#### 4. Движок ЦОС (`dsp/`)
- Расчёт FFT (с ускорением на ЦП/GPU)
- Демодуляция (AM, FM, SSB, CW и др.)
- Фильтрация и передискретизация звука
- АРУ и шумоподавление

#### 5. Веб-сервер (`server/`)
- Обмен по WebSocket
- Раздача статических файлов по HTTP
- Управление сеансами пользователей
- Потоковая передача данных в реальном времени

#### 6. Кодирование звука (`audio/`)
- Сжатие FLAC
- Сжатие Opus
- Оптимизация потоковой передачи

---

## Веб-интерфейс (`frontend/`)

Веб-интерфейс пользователя, построенный на Svelte и Vite.


#### 1. Основное приложение (`App.svelte`)
- Компонент верхнего уровня
- Структура компоновки
- Оркестрация компонентов
- **Ряд кнопок декодеров** — по одной кнопке на декодер на главной панели, сразу под селектором режимов; одно нажатие запускает декодер и открывает его окно, второе — останавливает. Он заменил прежний ряд полосы пропускания. RADEL/RADEU находятся в `lib/ModesSelector.svelte` — рядом с селектором режимов и во всплывающих окнах **Modes** и **Bands**.

#### 2. Отображение водопада (`waterfall.js` + `lib/`)
- Отрисовка спектра и водопада на canvas, цветовые палитры и адаптивная автоподстройка — всё в `waterfall.js` (обычный JS, не компонент)
- Интерактивная настройка через `lib/PassbandTuner.svelte`
- Наложения band plan и маркеров через `lib/FrequencyMarkers.svelte`
- Аудиоспектрограмма — отдельный компонент: `lib/Spectrogram.svelte`

#### 3. Органы управления (`App.svelte` + `lib/`)
- Ввод и индикация частоты — `lib/FrequencyInput.svelte`
- Выбор вида модуляции (AM/FM/SSB/CW) — `lib/ModesSelector.svelte`, смена диапазона — `lib/BandSelector.svelte`
- AGC/NR/NB и остальные органы управления находятся в самом `App.svelte`; отдельного `Controls.svelte` нет

#### 3a. Сканер (`scanner.js`)
- Сканер каналов: ведёт приёмник по диапазону и останавливается на первом канале с сигналом. Чистый JS, не компонент — `App.svelte` предоставляет VFO, вид модуляции, band plan и вызов настройки, а получает обратно состояние интерфейса через один обратный вызов
- Порог задаётся в дБ над шумовым порогом диапазона, а не абсолютным уровнем, и использует шум, который `waterfall.js` и так отслеживает (`snrNoiseDb`), поэтому собственная калибровка не нужна
- Два способа пройти диапазон: настроиться и послушать каждый канал либо сначала просмотреть спектр и настраиваться только на то, что нельзя исключить. Спектр может пропустить канал, но никогда не останавливается на нём — любая остановка следует из настоящего прослушивания
- Диапазон — это либо полоса из band plan, либо ровно то, что показывает водопад; автоматическое продолжение, предельное время стоянки и список исключённых каналов тоже здесь и сохраняются в `localStorage`

#### 4. Аудиосистема (`audio.js`)
- Аудиопоток по WebSocket
- Декодирование FLAC/Opus
- Управление воспроизведением звука
- Раздаёт исходный PCM (снятый до АРУ, шумоподавления и отключения звука) декодерам режимов
- Шумоподавление на основе ИИ: `lib/rnnoise.js` загружает модуль WebAssembly RNNoise (`@jitsi/rnnoise-wasm`) при первом использовании; `audio.js` применяет его только в голосовых режимах, после отвода для декодеров, поэтому декодеры его никогда не слышат

#### 4a. Декодеры режимов и их воркеры

Каждый из тяжёлых декодеров режимов работает в собственном Web Worker, поэтому декодирование никогда не блокирует воспроизведение звука и водопад. Все они следуют общей схеме — по три файла на декодер:

| Декодер | Движок | Воркер | Прокси в основном потоке |
|---------|--------|--------|---------------------------|
| SSTV | `sstv.js` | `sstv.worker.js` | `sstvWorkerProxy.js` |
| HF FAX | `fax.js` | `fax.worker.js` | `faxWorkerProxy.js` |
| NAVTEX + FSK/RTTY + PSK31 + Olivia | `fsk.js`, `psk31.js`, `olivia.js` | `fsk.worker.js` | `fskWorkerProxy.js` |
| CW | `cwDecoder.js` | `cw.worker.js` | `cwWorkerProxy.js` |

- **Движок** — это чистый код ЦОС, ничего не знающий о воркерах, поэтому его можно запускать и напрямую (модульные тесты или запасной режим в основном потоке).
- **Воркер** держит один экземпляр движка и дословно пересылает его события.
- **Прокси** повторяет набор методов движка, так что `audio.js` вызывает его точно так же, как вызывал бы сам декодер. Он создаёт воркер лениво, при первом включении, и переходит к работе в основном потоке, если воркеры недоступны.

Две детали здесь принципиальны: PCM **копируется** в новый буфер перед передачей воркеру (передача представления на аудионакопитель отсоединила бы его и остановила воспроизведение), а сообщение `init` воркера повторно применяет конфигурацию к уже работающему движку, а не предполагает создание нового.

`fsk.js` обслуживает и NAVTEX, и FSK/RTTY из одного движка, выбор задаётся для каждого экземпляра полем `role`; у каждого экземпляра своё состояние, поэтому оба могут работать независимо.

Роль `fsk` дополнительно содержит два декодера, которые вовсе не являются FSK. При выборе варианта `psk31` или `olivia` модуль `fsk.js` передаёт звук в `psk31.js` или `olivia.js` вместо собственной дискриминаторной цепочки, продолжая при этом пользоваться его конфигурацией, воркером и системой событий — поэтому `fsk.worker.js`, `fskWorkerProxy.js` и `audio.js` ничего не знают об этих режимах, а интерфейс везде принимает одни и те же события `char`/`status`/`metrics`.

- `psk31.js` — BPSK31: комплексная основная полоса, согласованный фильтр, дифференциальное детектирование и varicode, со спектральным грубым захватом и точной АПЧ в пределах примерно ±25 Гц.
- `olivia.js` — Olivia MFSK: перенос MFSK-приёмника Павла Ялохи из fldigi (`pj_mfsk.h`, GPL-3, как и данный проект), включая коррекцию ошибок Уолша/Адамара и слепой поиск синхронизации по фазе блока и частотному сдвигу.
- `broadcastSchedules.js` — расписания UTC, которые декодеры FAX, NAVTEX и RTTY предлагают как предустановки, из графиков морского факсимиле NOAA/NWS и опубликованных списков станций NAVTEX

#### 4b. Разнесённый приём (`diversity.js`)
- Объединяет локальный приёмник со вторым в другом месте и следует за той площадкой, у которой сейчас сигнал лучше. Обычный JS, не компонент — опирается на единственный стык в `audio.js`, который передаёт ему локальный PCM и воспроизводит то, что он возвращает
- **Выбор, а не сложение.** Две площадки слышат одну передачу по разным ионосферным трассам, поэтому их формы сигнала имеют несвязанную фазу; их сложение звучит гребенчато. Когерентное сложение потребовало бы общего тактового генератора, которого у двух приёмников через интернет нет. Смешивание происходит только во время кроссфейда 30 мс
- Выравнивание коррелирует две **огибающие звука** (логарифмическая мощность на 100 Гц), а не формы сигнала — огибающая переживает и трассу, и любой кодек. Захват принимается лишь тогда, когда второй, независимый поиск с ним совпал; это отсекает уверенную, но неверную задержку, которую дали бы две площадки, замирающие в противофазе
- Удалённый поток сначала **захватывается по скорости** к локальному. Два приёмника — это два тактовых генератора и две цепочки прореживания, поэтому их звук приходит с расхождением до 2% даже когда оба заявляют 12 кГц: 240 отсчётов в секунду ухода, который не удержит никакая корреляция. Отношение измеряется по тому, сколько отсчётов реально выдаёт каждая сторона, и применяется передискретизатором, переносящим дробную фазу через границы блоков, так что произвольное отношение держится сколь угодно долго
- Выбор площадки использует процентильный SNR, измеренный на **совмещённых по содержанию** отсчётах, с гистерезисом, таймером удержания и быстрым аварийным выходом, если действующая площадка провалилась. Уровни согласуются шум к шуму, поэтому переключение не меняет фоновое шипение
- Декодеры сохраняют **локальный** поток: FT8, JS8, WSPR и RADE накапливают когерентно в пределах интервала, и переключение в его середине — разрыв фазы, который может стоить декодирования

#### 4c. Источники разнесения (`remoteSource.js`, `kiwiSource.js`, `uberSource.js`, `webSdrSource.js`)
- Один контракт — `onPcm` / `onState` / `tune` / `canReceive` — так что `diversity.js` никогда не знает, что находится на другом конце. Добавление типа приёмника — это один новый файл
- `remoteSource.js` — другой PhantomSDR-Plus через `/audio` (cbor + FLAC), с повторным использованием `createDecoder()` из `lib/wrappers.js`
- `kiwiSource.js` — KiwiSDR: кадры `SND`, PCM с обратным порядком байтов, включая 10-байтовую метку времени GPS, которую стереопакет вставляет перед звуком
- `uberSource.js` — UberSDR через его собственный `/ws`: Opus за 21-байтовым заголовком, перестройка по открытому соединению. Идентификатор сессии нужно сначала зарегистрировать через `POST /connection`, и он должен быть UUID
- `webSdrSource.js` — WebSDR через `websdr_relay.py` на этом сервере: браузер не может подключиться напрямую, потому что WebSDR проверяет заголовок `Origin`, а менять его скриптам нельзя. Настройка идёт текстовым кадром по тому же соединению; покрытие диапазонов даёт ретранслятор
- `webSdrCodec.js` — аудиоформат WebSDR: побайтово размеченный поток, сжатые блоки которого питают leaky-LMS предсказатель с 20 отводами. Перенесён из клиента WebSDR и сверен отсчёт за отсчётом
- `diversityList.js` — список сохранённых приёмников и правила адресов для четырёх типов, общие для настольной панели и мобильной страницы, чтобы один формат служил обеим. А также перенос — компактный блоб, его QR-код и разборщик, принимающий любую форму, которую эти две страницы когда-либо записывали — и `browseUrl()`, возвращающая набираемый адрес к тому, который может открыть браузер
- `lib/DiversityPanel.svelte` — интерфейс: адрес, тип источника, подстройка SNR и состояние в реальном времени, а также сохранённые приёмники — с именами, с произвольным порядком, с экспортом и импортом в файл JSON, по типу источника в `localStorage`. Всё правится внутри панели: `prompt()` и `confirm()` блокируют главный поток, а именно через него звук передаётся в playback worklet. Кнопка **▦ QR** рисует список в виде кода для сканирования, поскольку `localStorage` принадлежит одному браузеру, а телефон начинает пустым. `mobile/Mobile.svelte` несёт ту же функцию во вкладке **Div**, в собственном простом CSS этой страницы. См. [Разнесённый приём](RECEIVE_DIVERSITY.md)

#### 4d. Определение вида работы (`modeId.js`, `modePriors.js`)
- Отвечает на вопрос «что я слушаю?». Читает тот же необработанный отвод PCM, что и декодеры, и ранжирует вероятные виды работы, чтобы оператор выбрал нужный декодер, а не перебирал все десять. Он никогда не декодирует: он измеряет физические свойства сигнала и оценивает их по таблице известных видов
- Занимаемая полоса — это непрерывная ширина по уровню −15 дБ вокруг пика, намеренно не величина по 99 % мощности: щелчки манипуляции оставляют длинные хвосты в интеграле мощности, из-за чего любой узкий вид выглядел в несколько раз шире. Скорость манипуляции символами берётся из **мгновенной частоты**, а не из энергий тонов, потому что никакое время накопления не разрешает одновременно сдвиг 170 Гц и символ 100 Бод. Скорость телеграфной манипуляции берётся из огибающей вкл/выкл и заодно служит индикатором скорости CW
- `modePriors.js` добавляет единственную подсказку, которую звук нести не может: где вы настроены. Сигнал 100 Бод / 170 Гц на 518 кГц — это NAVTEX; тот же сигнал на 14,070 МГц — нет. Он лишь перевзвешивает то, что сигнал и так подтвердил, и никогда не выдумывает кандидата
- FT8, JS8 и FT2 намеренно выдаются одной группой: по одной только полосе и расстоянию между тонами они не разделяются, а утверждать обратное значило бы уверенно дать неверный ответ
- Ниже примерно 10 дБ SNR он молчит, а не гадает
- Работает в собственном Web Worker (`modeId.worker.js` + `modeIdWorkerProxy.js`) по той же схеме engine/worker/proxy, что и декодеры выше; результат — метка в `lib/ModeIdChip.svelte`

#### 4e. Отклонённые подключения (`refused.js`, `clientVersion.js`)

- `refused.js` — общий словарь для подключения, которое сервер отклоняет: код закрытия **4003** (превышено ограничение по адресу либо страница старее `[server] min_client_version`) и **4001** (отключение системным оператором). Оба окончательные. `audio.js`, `waterfall.js` и `events.js` импортируют оттуда `isRefusal()`, потому что все три открывают подключение, которому могут отказать, и все три обязаны разрешить свой инициализационный промис, когда это случается, — иначе страница вечно ждёт подключения, которого не будет
- Ничто не повторяет попытку. Упавшее подключение `/audio` намеренно завершает сессию: `/waterfall` и `/events` с переподключением никогда не возвращались, так что повторённая сессия была живым звуком поверх замороженного водопада, а против ограничения темпа каждая попытка продлевала бы ровно тот отказ, который пыталась обойти. Настольная страница объясняет отказ, случившийся при загрузке, и просто останавливается, если он случился посреди сессии; `/mobile` показывает одну строку с просьбой перезагрузить
- `clientVersion.js` хранит единственное целое число, `CLIENT_VERSION`, которое страница добавляет к своему звуковому подключению как `/audio?v=N`. Сервер отклоняет всё ниже `[server] min_client_version` — так станция заставляет вкладки, всё ещё работающие на прежней сборке, перезагрузиться; это единственный рычаг, ведь сервер не дотянется до JavaScript, уже работающего в браузере. Увеличивайте его, когда изменение во фронтенде не должно и дальше игнорироваться открытыми вкладками
- Полная справка: [Ограничения подключений](CONNECTION_LIMITS.md)

#### 5. Управление состоянием (`stores/`)
- Реактивные хранилища данных
- Общее состояние приложения
- Обработка событий

---

### Ключевые возможности

- Обработка звука в реальном времени
- Декодирование цифровых видов связи (FT8, RTTY и др.)
- Фильтрация звука
- Спектральный анализ

---


## Списки частот (`frequencylist/`)

Метки частот на водопаде. `mymarkers.json` — это список, который приёмник действительно показывает; остальное — сырьё, которое `update-markers.sh` в него превращает, обновляемое из сетевых расписаний. `README.md` в этом каталоге объясняет обновление на всех семи языках.

```
frequencylist/
├── mymarkers.json            # метки, которые показывает приёмник — правятся вручную, переживают обновление
├── shortwavestations.json    # коротковолновые станции, создаётся generate-current-shortwave.py
├── 0.TXT                     # глобальное КВ-расписание A26, распаковывается и разбирается update-markers.sh
├── a26allx2.zip              # исходный архив, который скачивает update-markers.sh
├── admin.txt · antenna.txt · broadcas.txt · fmorg.txt · language.txt · site.txt
│                             # вспомогательные списки из того же источника (площадки, языки, администраторы, антенны)
├── generate-current-shortwave.py
├── update-markers.sh         # обновляет всё перечисленное из сетевых расписаний
└── README.md
```

### Формат (`mymarkers.json`, `shortwavestations.json`)

```json
[
    { "frequency": 77500,   "name": "DCF77", "mode": "CW" },
    { "frequency": 2485000, "name": "Vanuatu Broadcasting", "mode": "AM" }
]
```

---

## Файлы конфигурации

### Конфигурация сервера (файлы `.toml`)

Структура файлов конфигурации:

```toml
[server]
# Web server settings
port = 9002
html_root = "frontend/dist/"
threads = 2
otherusers = 1

[limits]
# Ограничения по адресу — все по умолчанию выключены или на разумном значении,
# так что конфигурация без них ведёт себя как раньше. См. CONNECTION_LIMITS.md.
per_ip = 3              # одновременные слушатели с одного адреса
per_ip_rate = 40        # новые подключения в минуту с одного адреса

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

### Сведения о площадке (`site_information.json`)

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

## Система сборки

### Конфигурация сборки Meson

#### `meson.build` (корень)

Определяет:
- Метаданные проекта
- Зависимости
- Параметры компилятора
- Списки исходных файлов
- Цели сборки

#### `meson_options.txt`

Доступные параметры:
```
option('opencl', type: 'boolean', value: false, description: 'Enable OpenCL support')
option('cuda', type: 'boolean', value: false, description: 'Enable CUDA support')
option('optimization', type: 'string', value: '3', description: 'Optimization level')
```

---

## Зависимости файлов

### Зависимости сборки серверной части

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

### Зависимости сборки веб-интерфейса

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

## Поток данных

### Порядок работы сервера

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

### Порядок взаимодействия с пользователем

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

## Руководство по изменению файлов

### Когда вы изменяете код серверной части (`src/**`):

```bash
cd PhantomSDR-Plus
meson compile -C build
# Server restart required
```

### Когда вы изменяете код веб-интерфейса (`frontend/src/**`):

```bash
cd PhantomSDR-Plus/frontend
npm run build
cd ..
# Server restart required (for static files)
```

### Когда вы изменяете конфигурацию (`.toml`, `.json`):

```bash
# Restart server
./stop-websdr.sh
./start-rtl.sh  # (or appropriate start script)
```

### Когда вы изменяете маркеры (`markers.json`):

```bash
# Reload page in browser
# No server restart needed
```

---

## Важные пути

### Пути времени выполнения

- **Конфигурация**: `./config-*.toml`
- **Корень HTML**: `./frontend/dist/`
- **Маркеры**: `./markers.json`
- **История чата**: `./chat_history.txt`
- **FFTW wisdom**: `./fftw_wisdom`, `./phantom_fftw_wisdom`

### Пути сборки

- **Готовый исполняемый файл**: `./build/spectrumserver`
- **Результат сборки веб-интерфейса**: `./frontend/dist/`
- **Модули Node**: `./frontend/node_modules/`

### Пути исходного кода

- **Исходники серверной части**: `./src/`
- **Исходники веб-интерфейса**: `./frontend/src/`
- **Библиотеки ЦОС**: `./jsdsp/`

---

## Типичные операции с файлами

### Добавление новой конфигурации SDR

1. Скопируйте существующую конфигурацию: `cp config-rtl.toml config-mydevice.toml`
2. Отредактируйте параметры: `nano config-mydevice.toml`
3. Создайте скрипт запуска: `cp start-rtl.sh start-mydevice.sh`
4. Отредактируйте скрипт запуска: `nano start-mydevice.sh` — меняйте только блок **RECEIVER CONFIGURATION** в начале (`RX_LABEL`, `RX_COMM` — имя процесса приёмника, `RX_ARGS`, `CONFIG`, `FIFO`, а также хук `prestart`, если он нужен устройству). Логика запуска/сторожа/журналирования ниже универсальна и правок не требует.
5. Сделайте его исполняемым: `chmod +x start-mydevice.sh`

> `stop-websdr.sh` уже останавливает любой `start-*.sh --watchdog`; если ваш приёмник использует имя процесса, отличное от `rx888_stream`/`rx_sdr`/`rtl_sdr`/`hackrf_transfer`/`cf32_to_real`, добавьте туда строку `killall -9 <имя>` и для него.

### Настройка веб-интерфейса под себя

1. Измените исходный код: `nano frontend/src/App.svelte`
2. Пересоберите: `cd frontend && npm run build && cd ..`
3. Перезапустите сервер: `./stop-websdr.sh && ./start-rtl.sh`

### Добавление собственных маркеров

1. Отредактируйте файл маркеров: `nano markers.json`
2. Формат:
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
3. Перезагрузите страницу в браузере (перезапуск сервера не нужен)

---

## Контроль версий

### Файлы, отслеживаемые в Git

- Исходный код (`src/`, `frontend/src/`, `jsdsp/`)
- Примеры конфигурации (`config.example.*.toml`)
- Система сборки (`meson.build`, `meson_options.txt`)
- Документация (`*.md`, `docs/`)
- Скрипты (`*.sh`)

### Файлы, которые следует игнорировать (`.gitignore`)

- Результаты сборки (`build/`, `frontend/dist/`)
- Зависимости (`frontend/node_modules/`)
- Пользовательские данные (`chat_history.txt`)
- Личные конфигурации (`config-rtl.toml`, если он изменён)
- Двоичные данные (`*.o`, `*.so`)

---

**Это описание структуры поможет вам ориентироваться в кодовой базе PhantomSDR-Plus и понимать её.**

Инструкции по установке см. в [INSTALLATION.md](INSTALLATION.md). Сведения об использовании см. в [USER_GUIDE.md](USER_GUIDE.md).

**73 de SV1BTL & SV2AMK**
