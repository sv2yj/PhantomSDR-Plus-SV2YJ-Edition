# Руководство по установке System Stats

Полное руководство по добавлению мониторинга сервера в реальном времени в ваше приложение PhantomSDR с помощью автоматизированного скрипта установки.

## Обзор

Эта функция добавляет кнопку **📊 Stats** в интерфейс PhantomSDR, которая отображает системную информацию в реальном времени:
- Загрузка ЦП, ядра, частота, температура и основные процессы
- Использование памяти (использовано/всего/процент)

Статистика автоматически обновляется каждые 5 секунд, пока открыто модальное окно.

> **Это не то же самое, что страница «Графики» в панели администратора.** Это окно показывает мгновенный срез, который обновляется, пока окно открыто, и не хранит историю. В панели администратора есть отдельная страница **Графики**: она снимает частоту процессора, нагрузку, температуру и число слушателей каждые 2 секунды и строит их за период от 15 минут до 24 часов — см. [руководство по панели администратора](../ru/ADMIN_PANEL_SETUP.md).

---

## Предварительные требования

- **Сервер Linux** (рекомендуется Ubuntu/Debian)
- **Подключение к Интернету** (для загрузки Node.js и пакетов)
- **Доступ Sudo** (для настройки службы systemd)
- **PhantomSDR-Plus** уже установлен и запущен
- **lm-sensors** (рекомендуется для температуры ЦП Intel/AMD — устанавливается автоматически скриптом)

---

## Методы установки

> [!NOTE]
> **Главный установщик уже это предлагает.** `./install.sh` — и четыре установщика для дистрибутивов — запускают `install-stats-server.sh` по умолчанию в рамках обычной установки PhantomSDR-Plus, так что на новой машине сервер статистики обычно уже на месте. Эта страница нужна, чтобы установить его отдельно или позже изменить порт, адрес либо службу.

### Вариант 1: Автоматизированная установка (Рекомендуется) ⭐

Автоматизированный скрипт всё сделает за вас.

#### Шаг 1: Запустите скрипт

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**ВАЖНО:** НЕ запускайте от имени root или с sudo. Запускайте от имени обычного пользователя.

#### Шаг 2: Следуйте интерактивным подсказкам

Скрипт проведёт вас через:

##### 1. **Установка Node.js** (при необходимости)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
Скрипт устанавливает Node.js 22 через nvm, в любом дистрибутиве Linux — без root и без источника apt. Тот же вопрос задаётся, если Node.js установлен, но его версия ниже 22.

##### 2. **Каталог установки**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Нажмите Enter для значения по умолчанию или укажите произвольный путь.

##### 3. **Настройка порта** (Улучшено!)
```
Port Configuration:
  Default port: 3001
  Common alternatives: 8080, 5000, 8888
Enter port number [3001]: 
```

Скрипт проверяет ваш порт:
- ✅ Проверяет, является ли он допустимым числом
- ✅ Предупреждает, если порт < 1024 (требуются права root)
- ✅ Проверяет диапазон (1-65535)
- ✅ Проверяет, используется ли порт уже
- ✅ Показывает, какой процесс его использует, если он занят
- ✅ Позволяет выбрать другой порт

**Примеры сценариев:**

**Использование порта по умолчанию:**
```
Enter port number [3001]: ↵
✓ Port 3001 selected
```

**Выбор произвольного порта:**
```
Enter port number [3001]: 8080
✓ Port 8080 selected
```

**Порт уже используется:**
```
Enter port number [3001]: 3001
⚠ Port 3001 is currently in use
Process using port 3001:
node    12345 user   20u  IPv6 123456  TCP *:3001 (LISTEN)
Choose a different port? (y/n): y
Enter port number [3001]: 3002
✓ Port 3002 selected
```

**Недопустимый порт:**
```
Enter port number [3001]: abc
✗ Port must be a number
Enter port number [3001]: 99999
✗ Port must be between 1 and 65535
Enter port number [3001]: 3001
✓ Port 3001 selected
```

##### 4. **Адрес сервера**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Введите публичный домен или IP-адрес вашего сервера.

##### 5. **Подтверждение**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 3001
  Server address: Your_site_IP
  Stats URL will be: http://Your_site_IP:3001
Continue with these settings? (y/n): y
```

##### 6. **Настройка службы Systemd** (Опционально)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Рекомендуется: Выберите **y**, чтобы сервер запускался автоматически при загрузке.

#### Шаг 3: Установка завершена! ✓

Скрипт отобразит сводку:
```
╔════════════════════════════════════════════════╗
║          Installation Complete! ✓              ║
║          Open the port in the router!          ║
╚════════════════════════════════════════════════╝

Configuration Summary:
  Installation: /home/user/sdr-stats-server
  Port: 3001
  Server: Your_site_IP
  API URL: http://Your_site_IP:3001/api/system-stats
```

---

## Настройте ваше приложение PhantomSDR

После завершения работы скрипта вам необходимо обновить ваше приложение Svelte.

### Шаг 1: Обновите `site_information.json`

Поскольку `site_information.json` уже был отредактирован во время начальной настройки, вам нужно только добавить новую строку `siteStats` с вашим портом:

```json
{
	"siteSysop": "your name or callsign",
	"siteSysopEmailAddress": "mail@mail.net",
	"siteGridSquare": "QTH locator",
	"siteCity": "City Country",
	"siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
	"siteHardware": "Hardware you are using, ",
	"siteSoftware": "Software you are using",
	"siteReceiver": "Receiver model",
	"siteAntenna": "Receiving Antenna.",
	"siteNote": "This is a bright new open-source WebSDR project, under active development.",
	"siteIP": "http://Your_site_IP:port",
  "siteStats": "http://Your_site_IP:3001",  ← ДОБАВЬТЕ ЭТУ СТРОКУ (используйте свой порт)
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 30000000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**Примечание:** Используйте порт, который вы выбрали во время установки!

### Шаг 2: Обновите `App.svelte` (последняя версия с GitHub уже включает обновлённый файл)

Внесите эти **4 изменения** в ваш файл App.svelte:

#### Изменение 1: Убедитесь, что `siteStats` объявлен (около строки 50)

```javascript
import {
  siteSysop,
  siteSysopEmailAddress,
  siteInformation,
  siteGridSquare,
  siteCity,
  siteHardware,
  siteSoftware,
  siteReceiver,
  siteAntenna,
  siteNote,
  siteIP,
  siteStats,  // ← ДОБАВЬТЕ ЭТУ СТРОКУ
  siteSDRBaseFrequency,
  siteSDRBandwidth,
  siteRegion,
  siteChatEnabled,
} from "../site_information.json";
```

#### Изменение 2: Обновите объект systemStats (около строки 530)

```javascript
let systemStats = {
  cpu: { usage: 0, cores: 0, temperature: null, frequency: null, topProcesses: [] },  // ← ДОБАВЬТЕ topProcesses: []
  memory: { used: 0, total: 0, percent: 0 }
};
```

#### Изменение 3: Обновите URL для fetch (около строки 541)

```javascript
async function fetchSystemStats() {
  try {
    const response = await fetch(`${siteStats}/api/system-stats`);  // ← ИЗМЕНИТЕ ЭТУ СТРОКУ
    if (response.ok) {
      systemStats = await response.json();
    } else {
      console.error('Failed to fetch system stats:', response.statusText);
    }
  } catch (error) {
    console.error('Error fetching system stats:', error);
  }
}
```

#### Изменение 4: Добавьте отображение основных процессов (в разделе ЦП, около строки 3838)

Добавьте этот код после раздела температуры:

```svelte
{#if systemStats.cpu.frequency}
<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
  <span>Frequency:</span>
  <span style="color: #4ade80;">{systemStats.cpu.frequency.current} GHz{#if systemStats.cpu.frequency.max} <span style="opacity: 0.7;">(max {systemStats.cpu.frequency.max})</span>{/if}</span>
</div>
{/if}

{#if systemStats.cpu.temperature !== null}
<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
  <span>Temperature:</span>
  <span style="color: {systemStats.cpu.temperature > 70 ? '#fbbf24' : '#4ade80'};">{systemStats.cpu.temperature}°C</span>
</div>
{/if}

<!-- ДОБАВЬТЕ ВЕСЬ ЭТОТ РАЗДЕЛ: -->
{#if systemStats.cpu.topProcesses && systemStats.cpu.topProcesses.length > 0}
<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
  <h4 style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: rgba(0, 225, 255, 0.8);">Top Processes:</h4>
  {#each systemStats.cpu.topProcesses as process}
  <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.85rem;">
    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">{process.name}</span>
    <span style="color: {process.cpu > 50 ? '#ef4444' : process.cpu > 25 ? '#fbbf24' : '#4ade80'};">{process.cpu}%</span>
  </div>
  {/each}
</div>
{/if}
```

### Шаг 3: Перекомпилируйте ваше приложение

```bash
cd /path/to/your/phantomsdr-app
npm ./recompile.sh
```

---

## Тестирование установки

### Тест 1: Проверьте конечную точку API

```bash
curl http://localhost:3001/api/system-stats
```

Ожидаемый вывод (JSON):
```json
{
  "cpu": {
    "usage": 45.2,
    "cores": 8,
    "coresUsed": 1.3,
    "temperature": 62.5,
    "frequency": {
      "current": 3.0,
      "max": 3.9,
      "limit": 4.4
    },
    "topProcesses": [
      {"name": "node", "cpu": 12.5},
      {"name": "phantomsdr", "cpu": 8.3}
    ]
  },
  "memory": {
    "used": 8.5,
    "total": 16,
    "percent": 53
  }
}
```

### Тест 2: Проверьте статус службы

Если вы установили её как службу:

```bash
sudo systemctl status sdr-stats.service
```

Должно показать: `Active: active (running)`

### Тест 3: Протестируйте в браузере

1. Откройте ваш веб-интерфейс PhantomSDR
2. Прокрутите до раздела **Additional Info**
3. Нажмите кнопку **Open Additional Info**
4. Найдите кнопку **📊 Stats** рядом с информацией о ПК
5. Нажмите на неё, чтобы открыть модальное окно статистики
6. Убедитесь, что статистика отображается и обновляется

---

## Управление службой

Если вы установили её как службу systemd, используйте эти команды:

```bash
# Start the service
sudo systemctl start sdr-stats.service

# Stop the service
sudo systemctl stop sdr-stats.service

# Restart the service (after updating files)
sudo systemctl restart sdr-stats.service

# Check status
sudo systemctl status sdr-stats.service

# View real-time logs
sudo journalctl -u sdr-stats.service -f

# View last 50 log entries
sudo journalctl -u sdr-stats.service -n 50

# Enable auto-start on boot
sudo systemctl enable sdr-stats.service

# Disable auto-start
sudo systemctl disable sdr-stats.service

# Edit service
sudo nano /etc/systemd/system/sdr-stats.service

# Delete service
sudo rm /etc/systemd/system/sdr-stats.service
```

---

## Ручная установка (Вариант 2)


> [!IMPORTANT]
> **Для обычной установки этот раздел не нужен.** `install-stats-server.sh` делает всё это за вас, и главный установщик запускает его по умолчанию. Следуйте ему только для ручной установки или чтобы починить отдельную часть вручную.

**⚠️ Предупреждение:** При ручной установке могут использоваться устаревшие файлы. **Настоятельно рекомендуется автоматизированный скрипт**, так как он:
- Устанавливает последнюю версию с улучшенным определением температуры
- Автоматически устанавливает и настраивает lm-sensors
- Автоматически управляет всеми зависимостями

Если вы всё же предпочитаете ручную установку:

### 1. Установите Node.js
```bash
# Any distribution - nvm needs no root and no apt source.
# NOT NodeSource: deb.nodesource.com now answers HTTP 403 on every path.
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

### 2. Установите lm-sensors (Требуется для температуры Intel/AMD)
```bash
sudo apt-get update
sudo apt-get install -y lm-sensors
sudo sensors-detect --auto
```

### 3. Создайте каталог
```bash
mkdir ~/sdr-stats-server
cd ~/sdr-stats-server
```

### 4. Загрузите последние файлы

**Важно:** файлы сервера больше не хранятся копиями в репозитории - их создаёт скрипт установки.

Вместо этого запустите автоматизированный скрипт один раз, чтобы сгенерировать последние файлы, а затем скопируйте их:
```bash
# Run the automated script from the repository root
cd ~/PhantomSDR-Plus
./install-stats-server.sh
# When prompted, use a temporary port like 9999
# After installation completes, copy the generated files
cp ~/sdr-stats-server/system-stats-server.js ~/your-manual-install-dir/
cp ~/sdr-stats-server/package.json ~/your-manual-install-dir/
```

**ИЛИ** создайте файлы вручную, используя последний код из скрипта установки.

### 5. Измените порт (при необходимости)
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Измените строку 6:
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### 6. Установите зависимости
```bash
npm install
```

### 7. Пробный запуск
```bash
npm start
```

### 8. Настройте службу (Опционально)

Следуйте инструкциям по настройке службы systemd из раздела автоматизированной установки.

## Изменение порта после установки

Если вам нужно изменить порт после установки:

### Шаг 1: Отредактируйте файл сервера

```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Измените строку 6:
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### Шаг 2: Обновите site_information.json

```json
"siteStats": "http://Your_site_IP:NEW_PORT"
```

### Шаг 3: Перезапустите службу

```bash
sudo systemctl restart sdr-stats.service
```

### Шаг 4: Пересоберите ваше приложение Svelte

```bash
cd /path/to/phantomsdr-app
npm run build
```

---

## Устранение неполадок

### Проблема: Порт уже используется

**Ошибка:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Решение:**

1. Найдите, что использует порт:
```bash
sudo lsof -i :3001
```

2. Остановите этот процесс:
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Запустите службу снова:
```bash
sudo systemctl start sdr-stats.service
```

**Альтернатива:** Запустите скрипт установки снова и выберите другой порт по запросу.

### Проблема: Служба не запускается

**Ошибка:**
```
status=217/USER
```

**Решение:**

1. Проверьте файл службы:
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Убедитесь, что строка `User=` соответствует вашему имени пользователя:
```bash
whoami
```

3. Отредактируйте при необходимости:
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Перезагрузите и перезапустите:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Проблема: Статистика не отображается в браузере

**Симптомы:** Модальное окно открывается, но данных нет, или отображаются значения 0

**Решения:**

1. Проверьте консоль браузера (F12) на наличие ошибок
2. Убедитесь, что API доступен:
```bash
curl http://localhost:3001/api/system-stats
```
3. Проверьте, что служба запущена:
```bash
sudo systemctl status sdr-stats.service
```
4. Убедитесь, что `siteStats` в `site_information.json` соответствует адресу и порту вашего сервера
5. Проверьте наличие ошибок CORS — убедитесь, что сервер разрешает ваш домен

### Проблема: Температура показывает null

**Причина:** Считывание температуры недоступно в вашей системе

**Решения:**

1. **Для большинства систем Linux:** Проверьте, существует ли тепловая зона:
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **Установите lm-sensors:**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Примечание:** Температура может быть недоступна на:
- Виртуальных машинах
- Некоторых VPS-провайдерах
- Windows Subsystem for Linux (WSL)
- Системах, отличных от Linux

Это нормально — остальная статистика по-прежнему будет работать!

### Проблема: Значения статистики не совпадают с `top`

**Причина:** Период выборки ЦП был слишком коротким в старых версиях

**Решение:** Текущая версия использует выборку в 1 секунду для точных показаний. Если у вас старая установка:

1. Обновите файл сервера:
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

2. Найдите строку 18 и измените:
```javascript
}, 100);  // Old value
```
на:
```javascript
}, 1000);  // New value (1 second)
```

3. Перезапустите:
```bash
sudo systemctl restart sdr-stats.service
```

Или просто повторно запустите скрипт установки, чтобы получить последнюю версию.

### Проблема: Node.js не найден

**Ошибка:**
```
node: command not found
```

**Решение:**

1. Установите Node.js:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Проверьте:
```bash
node --version
npm --version
```

---

## Что вы увидите

После установки и настройки модальное окно статистики отображает:

### 🖥️ Раздел ЦП
- **Загрузка**: Общий процент использования ЦП
- **Ядра**: Сколько процессора реально используется, выраженное в целых ядрах — например `1.3 / 12 in use` означает, что машина выполняет работу 1,3 ядра. Величина точная и не требует никакого порога. Это намеренно не подсчёт занятых ядер: планировщик размазывает работу одного ядра по многим, поэтому такой подсчёт мог бы лишь приблизить это число.
- **Частота**: Средняя текущая частота ЦП по всем ядрам в ГГц, с самым быстрым ядром в скобках (если доступна)
- **Температура**: Температура ЦП в градусах Цельсия (если доступна), с цветовой маркировкой: 🟢 зелёный до 69 °C, 🟠 оранжевый 70-79 °C, 🔴 красный от 80 °C и выше
- **Основные процессы**: 5 процессов, наиболее нагружающих ЦП, с цветовой маркировкой процентов:
  - 🟢 Зелёный: до 50 % ЦП
  - 🟠 Оранжевый: 51-80 % ЦП
  - 🔴 Красный: выше 80 % ЦП

### 💾 Раздел памяти
- **Использовано**: Используемая память (ГБ)
- **Всего**: Общий объём системной памяти (ГБ)
- **Использование**: Процент использования памяти (с цветовой маркировкой)

### ♻️ Автообновление
- Статистика обновляется каждые **5 секунд**, пока открыто модальное окно
- Обновление прекращается при закрытии модального окна (экономит ресурсы)

---


## Определение температуры

Сервер статистики использует продвинутое определение температуры несколькими методами:

### ✅ **Поддерживаемые системы:**
- **Процессоры Intel**: Считывает с датчиков coretemp через lm-sensors
- **Процессоры AMD**: Считывает с датчиков k10temp (Tdie/Tctl)
- **Процессоры ARM**: Считывает из тепловых зон (Raspberry Pi и т. д.)

### 📋 **Требования:**
- **Intel/AMD**: Требуется пакет `lm-sensors` (устанавливается автоматически скриптом)
- **ARM/Raspberry Pi**: Работает сразу, дополнительные пакеты не нужны

### 🔧 **Приоритет установки:**
1. Пробует команду `sensors` для температуры Package/Core (Intel/AMD)
2. Переходит к прямому считыванию coretemp (Intel)
3. Переходит к thermal_zone0 (ARM/Raspberry Pi)

Если температура показывает `null`, установите lm-sensors:
```bash
sudo apt-get install lm-sensors
sudo sensors-detect --auto
sudo systemctl restart sdr-stats.service
```

---

## Сводка функций

✅ **Мониторинг в реальном времени** - Статистика системы в реальном времени с вашего сервера
✅ **Метрики ЦП** - Загрузка, ядра, температура, основные процессы
✅ **Отслеживание памяти** - Использовано, всего и процент
✅ **Автообновления** - Обновляется каждые 5 секунд
✅ **Цветовая маркировка** - Визуальные индикаторы для предупреждений
✅ **Легковесность** - Минимальное использование ресурсов
✅ **Простая установка** - Автоматизированный скрипт всё сделает
✅ **Проверка порта** - Умный выбор порта с обнаружением конфликтов
✅ **Управление службой** - Автозапуск при загрузке

---

## Примечания по безопасности

- Сервер статистики принимает подключения из любого источника (CORS: *)
- Для продакшена рассмотрите возможность ограничения CORS только вашим доменом
- Выбор порта проверяет ввод и наличие конфликтов
- Считывание температуры ЦП доступно только для чтения и безопасно
- Никакая конфиденциальная системная информация не раскрывается

---

## Поддержка и ресурсы

### Включённые файлы:
В этой папке (сам скрипт установки лежит в корне репозитория, как `PhantomSDR-Plus/install-stats-server.sh` - копия всегда одна):
- `package.json` - Зависимости, идентичные тем, что записывает скрипт
- Этот документ, доступный также на de, el, es, fr, hr и ru

Создаётся скриптом в `~/sdr-stats-server/`:
- `system-stats-server.js` - Бэкенд-сервер, созданный с выбранным вами портом
- `package.json` - Зависимости
- `node_modules/` - устанавливается командой `npm install`

### Получение помощи:
- Ознакомьтесь с разделом устранения неполадок выше
- Просмотрите журналы службы: `sudo journalctl -u sdr-stats.service -n 50`
- Протестируйте API вручную: `curl http://localhost:3001/api/system-stats`
- Проверьте файлы конфигурации

### Удаление сервера статистики:
- Удалите папку /sdr-stats-server
- Если вы создали службу, просто удалите её с помощью:
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Измените `App.svelte`: Найдите часть кода:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
  ```
  и замените на:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <!--
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
                    -->
  ```                    
- Перекомпилируйте с помощью команды:
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Перезагрузите ПК и запустите сервер

---

**Автор:** Создано для PhantomSDR-Plus
**Версия:** 1.1 (Улучшенное определение температуры ЦП для Intel/AMD) **Обновлено:** Январь 2026
**Лицензия:** MIT

---

## Краткий справочник команд

```bash
# Installation
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh
./install-stats-server.sh

# Service Management
sudo systemctl start sdr-stats.service      # Start
sudo systemctl stop sdr-stats.service       # Stop
sudo systemctl restart sdr-stats.service    # Restart
sudo systemctl status sdr-stats.service     # Status
sudo journalctl -u sdr-stats.service -f     # Logs

# Testing
curl http://localhost:3001/api/system-stats # Test API
curl http://localhost:3001/api/health       # Health check

# Troubleshooting
sudo lsof -i :3001                          # Check port
whoami                                      # Check username
node --version                              # Check Node.js
```

Приятного мониторинга! 📊🚀
