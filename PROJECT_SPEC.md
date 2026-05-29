# StairForge Studio — Полная спецификация проекта

> Версия документа: 0.1 MVP Specification  
> Назначение: положить этот файл в проект, чтобы ChatGPT / Claude Code / Codex / Cloud Code могли каждый раз читать единое описание проекта, архитектуры, интерфейса и roadmap.

---

## 0. Короткое описание проекта

**StairForge Studio** — это веб-CAD конструктор лестниц, перил и металлоконструкций для замерщика/сварщика.

Главный поток:

```text
размеры → 3D → проверки → cut list → PDF → печать / отправка
```

Проект не является копией SketchUp. Он использует знакомую CAD-логику интерфейса:

```text
левый toolbar → центральная 3D-сцена → правый inspector/export panel → верхнее меню → нижний status bar
```

Но все инструменты должны быть только под лестницы, перила, металл, трубы, пластины, отверстия, PDF и материалы.

---

## 1. Концепция проекта

**StairForge Studio** — это не универсальный 3D-редактор. Это узкий профессиональный инструмент под лестницы, перила, площадки, трубы, пластины и PDF-чертежи.

Главная идея:

```text
Не рисовать всё вручную.
А собирать конструкцию из умных параметрических блоков.
```

Пользователь нажимает:

```text
Straight Stair
L-Stair
U-Stair
Landing
Railing
Post
Plate
Hole
Dimension
```

Вводит размеры, а программа сама строит 3D, считает материалы и создаёт PDF.

---

## 2. Конкуренты и позиционирование

### 2.1 SketchUp

SketchUp — универсальный 3D-моделлер. Его сила — свободное моделирование, 3D Warehouse и расширения.

Минус для нашего кейса: SketchUp не является специализированным stair fabrication инструментом из коробки. Чтобы получить cut list, правильные PDF-чертежи, трубы, пластины и сварочные детали, надо настраивать плагины, вручную моделировать и учиться.

### 2.2 StairDesigner

StairDesigner — профессиональная программа для 3D-проектирования лестниц. Она умеет автоматически считать, строить планы, elevations, 3D-модели, cut list и CNC-файлы.

Минус для нашего кейса: это больше классический stair software. Нам нужен лёгкий мобильный веб-инструмент под быстрые замеры, металл, трубы и PDF для сварщиков.

### 2.3 Staircon

Staircon — серьёзный CAD/CAM продукт для проектирования и производства лестниц. Есть 3D-визуализация, DXF/CAM, pricing, CNC-интеграции и разные уровни лицензий.

Минус для нашего кейса: это тяжёлый профессиональный производственный продукт. Нам нужен быстрый, простой, мобильный инструмент для field measurements, металла, перил, труб, пластин и PDF.

### 2.4 Compass Software

Compass Software делает stair manufacturing design с 3D-визуализацией, parts lists, price calculation, DXF import, remote measurement tools и поддержкой больших проектов.

Минус для нашего кейса: мощно, но сложно. Наша ниша — проще, быстрее, мобильнее, под маленькую команду / сварщика / замерщика.

---

## 3. Наша ниша

Мы не пытаемся победить SketchUp как 3D-редактор.

Мы делаем:

```text
SketchUp-like interface + stair-specific tools + web/mobile + PDF/cut list.
```

Главное отличие:

| Направление | Конкуренты | StairForge Studio |
|---|---|---|
| SketchUp | Универсальное 3D | Только лестницы / перила / металл |
| StairDesigner | Мощный stair CAD | Проще, быстрее, web/mobile |
| Staircon / Compass | Production / CNC enterprise | Field-to-PDF MVP для малого бизнеса |
| Наш фокус | — | Замерщик → сварщик → PDF → материал |

Главная фраза продукта:

```text
CAD для лестниц и перил без лишнего CAD.
```

---

## 4. Основные пользователи

### 4.1 Замерщик

Нужно:

```text
быстро ввести размеры на объекте
увидеть 3D
понять угол
понять количество ступеней
сделать PDF
отправить сварщику
```

### 4.2 Сварщик

Нужно:

```text
понятный PDF
длины труб
количество деталей
пластины
отверстия
углы реза
заметки
```

### 4.3 Клиент

Нужно:

```text
понять как будет выглядеть
получить красивый PDF / preview
видеть basic estimate
```

### 4.4 Будущий пользователь продукта

Нужно:

```text
сохранять проекты
иметь аккаунт
делать несколько объектов
делиться ссылкой
```

---

## 5. Главная логика продукта

Проект должен состоять не из одной лестницы, а из объектов.

```text
Project
│
├── Straight Stair 1
├── Landing 1
├── Straight Stair 2
├── Railing Left
├── Railing Right
├── Plate 1
├── Plate 2
├── Notes
└── Dimensions
```

Это важно, потому что приложение должно поддерживать:

```text
несколько лестниц на одной странице
несколько маршей
повороты
площадки
перила отдельно
гибкость
```

Фундамент должен быть объектный.

---

## 6. Основные модули проекта

### Module 1 — Project Manager

Функции:

```text
New Project
Open Project
Save Project
Duplicate Project
Delete Project
Project name
Client name
Address
Date
Notes
Units: inches / mm
```

### Module 2 — Left CAD Toolbar

Вертикальное меню как SketchUp-style, но только под наши задачи.

Группы:

```text
Basic Tools
Stair Tools
Railing Tools
Metal Tools
Documentation Tools
View Tools
```

### Module 3 — 3D Workspace

Центральная рабочая зона:

```text
3D canvas
grid
orbit / pan / zoom
top view
side view
front view
3D view
object selection
multi-object scene
```

### Module 4 — Right Inspector Panel

Правая панель:

```text
Project actions
Selected object properties
Calculations
Warnings
Objects list
Export actions
Account
```

### Module 5 — Geometry Engine

Считает:

```text
riser height
tread depth
angle
stringer length
post spacing
handrail length
tube lengths
plate positions
hole positions
material quantities
```

### Module 6 — Validation Engine

Проверяет ошибки:

```text
слишком крутая лестница
слишком маленькая проступь
слишком высокий riser
слишком большой post spacing
нет railing при высокой лестнице
не хватает run
невалидные размеры
```

### Module 7 — Material Library

Библиотека:

```text
Square tube
Round tube
Flat bar
Angle iron
Channel
Plate
Wood tread
Metal tread
Anchors
Bolts
```

### Module 8 — Cut List Engine

Выдаёт:

```text
деталь
количество
длина
угол реза
материал
профиль
заметка
```

### Module 9 — PDF Engine

Делает:

```text
printable PDF
overview page
side view
top view
cut list
materials
warnings
notes
```

### Module 10 — Export Engine

Экспорты:

```text
PDF
JSON
PNG preview
DXF later
STEP later
STL later
CSV cut list
```

### Module 11 — Supabase Backend

Хранит:

```text
users
projects
project_objects
materials
exports
shared links
project images
```

### Module 12 — Account / Sharing

Функции:

```text
login
save cloud project
share read-only link
send PDF
client preview
```

---

## 7. Интерфейс

### 7.1 Desktop layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ StairForge Studio | File Edit View Build Materials Export | Account  │
├──────┬──────────────────────────────────────────────┬────────────────┤
│TOOLS │                                              │ RIGHT PANEL    │
│      │                                              │                │
│ 🖱   │                                              │ Project        │
│ 📏   │                                              │ Save           │
│ 🪜   │                3D WORKSPACE                  │ Export PDF     │
│ ↱    │                                              │ Print          │
│ ↰    │                                              │ Share          │
│ ▭    │                                              │                │
│ ║    │                                              │ Selected       │
│ □    │                                              │ Object Props   │
│ ⊙    │                                              │                │
│ T    │                                              │ Results        │
│ 👁   │                                              │ Cut List       │
├──────┴──────────────────────────────────────────────┴────────────────┤
│ Status: Ready | Tool: Select | Units: inches | Angle: 36°             │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Mobile layout

На телефоне не надо делать маленький SketchUp. Надо сделать wizard:

```text
1. Project
2. Dimensions
3. Materials
4. Preview
5. Results
6. Export
```

Но toolbar можно оставить компактным сверху / снизу.

---

## 8. Левая панель tools

### Basic Tools

```text
Select
Measure
Move
Duplicate
Delete
Orbit/Pan
Zoom
```

### Stair Tools

```text
Straight Stair
L-Stair 90°
U-Stair 180°
Landing
Multi-Flight Stair
Winder Stair later
Spiral Stair later
```

### Railing Tools

```text
Railing
Post
Handrail
Picket
Horizontal rail
Wall rail
Guardrail
```

### Metal Tools

```text
Stringer
Tube
Plate
Hole
Anchor
Bracket
Weld note
```

### Documentation Tools

```text
Dimension
Text Note
Arrow
Section Callout
PDF Sheet
Print Preview
```

### View Tools

```text
Home
Top
Side
Front
3D
Fit View
Show/Hide Grid
Show/Hide Dimensions
```

---

## 9. Top Menu

```text
File
Edit
View
Build
Materials
Export
Help
```

### File

```text
New Project
Open Project
Save
Save As
Import JSON
Export JSON
Print
```

### Edit

```text
Undo
Redo
Duplicate
Delete
Reset Object
```

### View

```text
Top
Side
Front
3D
Show Grid
Show Dimensions
Show Warnings
```

### Build

```text
Add Straight Stair
Add Landing
Add L-Stair
Add U-Stair
Add Railing
Add Plate
Add Hole
```

### Materials

```text
Tube Library
Plate Library
Anchor Library
Material List
Cut List
Pricing later
```

### Export

```text
PDF Drawing
Cut List PDF
CSV Cut List
PNG Preview
DXF later
STEP later
```

---

## 10. Правая панель

### Если ничего не выбрано

```text
Project
- Project name
- Client
- Address
- Units
- Save
- Export PDF
- Print
- Share

Objects
- Stair 1
- Railing 1
- Plate 1

Project Summary
- total stairs
- total railings
- total tube length
- warnings count
```

### Если выбрана лестница

```text
Selected: Stair 1

Type:
- Straight Stair

Dimensions:
- Total height
- Total run
- Width
- Steps
- Tread count
- Riser count

Construction:
- Stringer type
- Tube profile
- Tread type
- Railing: none / left / right / both

Calculated:
- Angle
- Riser height
- Tread depth
- Stringer length

Actions:
- Update
- Duplicate
- Delete
```

### Если выбрано перило

```text
Selected: Railing 1

Side:
- left / right / both

Dimensions:
- Height
- Length
- Post spacing

Profiles:
- Post tube
- Handrail tube
- Pickets

Calculated:
- post count
- handrail length
- total tube
```

### Если выбрана пластина

```text
Selected: Plate 1

Size:
- width
- height
- thickness

Holes:
- count
- diameter
- edge offset
- spacing

Material:
- steel
- aluminum later
```

---

## 11. Типы лестниц

### MVP

```text
Straight Stair
```

### Version 0.2

```text
Straight Stair + Railing
Straight Stair + Landing
```

### Version 0.3

```text
L-Stair 90°
U-Stair 180°
Multi-flight stairs
```

### Version 0.4+

```text
Winder stair
Spiral stair
Curved stair
Custom metal frame
```

---

## 12. Типы объектов в проекте

```text
straight_stair
landing
l_stair
u_stair
railing
post
handrail
picket
stringer
tread
plate
hole
anchor
dimension
note
image_reference
```

Каждый объект должен иметь:

```text
id
type
name
config
position
rotation
visibility
locked
created_at
updated_at
```

---

## 13. Формулы MVP

### Input

```text
height
run
width
steps
tube_size
railing_enabled
```

### Calculations

```text
riser_height = height / steps
tread_depth = run / steps
angle = atan(height / run)
stringer_length = sqrt(height² + run²)
```

### Railing

```text
post_count = ceil(run / post_spacing) + 1
handrail_length = stringer_length
post_length = railing_height
```

### Material list

```text
2 side stringers x stringer_length
steps x width
post_count x railing_height
1 handrail x handrail_length
```

---

## 14. Validation / warnings

### MVP warnings

```text
Angle > 40° → Stair is steep
Angle < 25° → Stair is shallow
Riser > 8" → Riser is high
Tread < 9" → Tread is small
Width < 30" → Stair is narrow
Steps < 2 → Invalid step count
```

### Future warnings

```text
Post spacing too wide
Handrail height too low
Plate holes too close to edge
Landing too small
Tube size may be weak
Missing railing
No material selected
No project name
No client name
```

Важно: программа не должна делать вид, что она инженер-структурщик. Надо писать:

```text
Fabrication helper only. Final structural approval is responsibility of qualified professional.
```

---

## 15. PDF спецификация

### MVP PDF

Одна страница Letter:

```text
StairForge Studio
Straight Stair MVP
Date

Project:
- name
- client
- address

Inputs:
- height
- run
- width
- steps
- tube size
- railing yes/no

Calculated:
- angle
- riser height
- tread depth
- stringer length

Warnings:
- list

Material List:
- item / qty / length / profile

Notes:
- field notes
```

### Version 0.2 PDF

```text
Page 1 — Overview
Page 2 — Side View
Page 3 — Top View
Page 4 — Railing Details
Page 5 — Plates / Holes
Page 6 — Cut List
```

### Future PDF

```text
dimensioned drawings
scale views
title block
company logo
client approval signature
revision history
QR code project link
```

---

## 16. Supabase спецификация

### Table: `projects`

```sql
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  client_name text,
  address text,
  units text not null default 'imperial',
  notes text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Table: `project_objects`

```sql
create table public.project_objects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  object_type text not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  position jsonb not null default '{}'::jsonb,
  rotation jsonb not null default '{}'::jsonb,
  visible boolean not null default true,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Table: `material_profiles`

```sql
create table public.material_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  profile_type text not null,
  material text not null default 'steel',
  width_in numeric,
  height_in numeric,
  diameter_in numeric,
  thickness_in numeric,
  weight_per_ft numeric,
  cost_per_ft numeric,
  created_at timestamptz not null default now()
);
```

### Table: `exports`

```sql
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  export_type text not null,
  file_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### Table: `project_versions`

```sql
create table public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  snapshot jsonb not null,
  version_note text,
  created_at timestamptz not null default now()
);
```

### Table: `shared_links`

```sql
create table public.shared_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token text not null unique,
  access_level text not null default 'read_only',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
```

---

## 17. Начальная библиотека материалов

```sql
insert into public.material_profiles
(name, profile_type, material, width_in, height_in, thickness_in)
values
('Square Tube 1x1 x 1/8', 'square_tube', 'steel', 1, 1, 0.125),
('Square Tube 1.5x1.5 x 1/8', 'square_tube', 'steel', 1.5, 1.5, 0.125),
('Square Tube 2x2 x 1/8', 'square_tube', 'steel', 2, 2, 0.125),
('Square Tube 3x3 x 1/8', 'square_tube', 'steel', 3, 3, 0.125),
('Plate 4x4 x 1/4', 'plate', 'steel', 4, 4, 0.25),
('Plate 6x6 x 1/4', 'plate', 'steel', 6, 6, 0.25);
```

---

## 18. Технологический стек

### MVP 0.1

```text
React
Vite
Three.js
@react-three/fiber
@react-three/drei
jsPDF
Plain CSS
Local JSON save
```

### MVP 0.2

```text
Supabase Auth
Supabase Postgres
Supabase Storage
Save/load projects
Material library
```

### MVP 0.3

```text
Python
FastAPI
ReportLab
CadQuery later
DXF later
```

### Future

```text
CadQuery / FreeCAD engine
STEP export
DXF export
advanced PDF drawings
pricing
team accounts
client sharing
```

---

## 19. API будущего Python backend

### `POST /api/calculate`

Input:

```json
{
  "projectId": "uuid",
  "objects": []
}
```

Output:

```json
{
  "calculations": {},
  "warnings": [],
  "materials": []
}
```

### `POST /api/export/pdf`

Output:

```json
{
  "fileUrl": "https://..."
}
```

### `POST /api/export/dxf`

Future.

### `POST /api/export/step`

Future.

---

## 20. MVP roadmap

### MVP 0.1 — 1 hour

```text
Local web app
SketchUp-like layout
Left toolbar
Right inspector
Straight stair
Optional railing
3D preview
Calculations
Warnings
PDF export
Save JSON
Print
```

### MVP 0.2 — same/next day

```text
Supabase project save/load
Material profiles
Objects list
Project versions
Better PDF
```

### MVP 0.3

```text
Multiple objects
Multiple straight stairs
Landing object
Railing per side
Better cut list
```

### MVP 0.4

```text
L-Stair
U-Stair
Top/side/front PDF views
Plate + holes
```

### MVP 0.5

```text
Python backend
Better geometry engine
ReportLab PDF
DXF export
```

### Version 1.0

```text
Full web product
Auth
Projects
Sharing
Professional PDF
Multi-stair scenes
Railing builder
Material pricing
```

---

## 21. Что обязательно в первом MVP

Для первого часа обязательно:

```text
1. Левая SketchUp-like toolbar
2. Центральный 3D canvas
3. Правая панель properties/export
4. Straight Stair
5. Railing on/off
6. Расчёты
7. Warnings
8. PDF export
9. Save JSON
10. Print button
```

Не обязательно:

```text
Supabase
Python
DXF
STEP
Auth
CNC
сложные лестницы
идеальный чертёж
```

---

## 22. Product principles

### 22.1 Не копировать SketchUp

Вдохновляемся layout-логикой:

```text
toolbar left
workspace center
inspector right
status bottom
```

Но не копируем бренд, иконки, точный вид.

### 22.2 Всё под лестницы

Каждая кнопка должна быть полезна для лестниц / перил / металла.

### 22.3 Mobile usable

На телефоне пользователь должен хотя бы:

```text
открыть проект
изменить размеры
увидеть preview
скачать PDF
```

### 22.4 PDF важнее красивой 3D

3D продаёт идею. PDF строит лестницу.

### 22.5 Cut list — сердце продукта

Если программа считает материал, она реально экономит деньги.

---

## 23. Названия экранов

```text
Dashboard
Project Editor
Material Library
Export Center
Shared Preview
Account Settings
```

---

## 24. Названия главных компонентов в коде

```text
AppShell
HeaderMenu
LeftToolbar
Workspace3D
RightInspector
StatusBar
ProjectPanel
ObjectPanel
ResultsPanel
CutListPanel
ExportPanel
StairObject
RailingObject
MaterialLibrary
PdfGenerator
GeometryEngine
ValidationEngine
```

---

## 25. Файловая структура MVP

```text
stairforge-studio/
│
├── src/
│   ├── App.jsx
│   ├── styles.css
│   ├── main.jsx
│   │
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── Toolbar.jsx
│   │   ├── Workspace.jsx
│   │   ├── StairScene.jsx
│   │   ├── RightPanel.jsx
│   │   ├── StatusBar.jsx
│   │   └── ToolButton.jsx
│   │
│   ├── geometry/
│   │   ├── stairMath.js
│   │   └── validation.js
│   │
│   ├── pdf/
│   │   └── generatePdf.js
│   │
│   ├── utils/
│   │   ├── saveJson.js
│   │   └── format.js
│   │
│   └── data/
│       └── materialProfiles.js
│
├── package.json
└── README.md
```

---

## 26. Главная спецификация MVP prompt

Use this prompt to generate the first MVP.

```text
Create a complete React + Vite web application called StairForge Studio.

This is a one-hour MVP of a SketchUp-inspired, stair-focused web CAD tool for metal stair and railing fabrication.

Do not copy SketchUp branding, icons, or exact UI. Build a familiar CAD-style layout with a left vertical toolbar, central 3D workspace, right inspector/export panel, top menu, and bottom status bar.

Tech stack:
- React
- Vite
- Three.js
- @react-three/fiber
- @react-three/drei
- jsPDF
- Plain CSS
- No backend for MVP
- No Supabase for MVP
- Local JSON save only

Product goal:
Users can enter stair dimensions, see a live 3D straight stair model, enable/disable railing, view calculations/warnings/material list, export a printable PDF, save the project as JSON, and print.

Layout:
1. Top header:
   - App name: StairForge Studio
   - Menu labels: File, Edit, View, Build, Materials, Export, Help
   - Right side: Save JSON, Export PDF, Print

2. Left vertical toolbar:
   Implement working or visual buttons:
   - Select
   - Measure
   - Straight Stair
   - Railing
   - Dimension
   - Top View
   - Side View
   - 3D View
   Disabled Coming Soon buttons:
   - Landing
   - L-Stair
   - U-Stair
   - Plate
   - Holes

3. Center 3D workspace:
   - Use @react-three/fiber
   - Use OrbitControls
   - Show grid/floor
   - Render a straight stair model
   - Render rectangular treads
   - Render two side stringers
   - Render railing posts and handrail when railing is enabled
   - Model must update live when values change
   - Top View, Side View, and 3D View buttons must adjust the camera/view

4. Right inspector panel:
   Sections:
   - Project
     - Project name
     - Client name
     - Units: inches
   - Selected Object
     - Object name: Stair 1
     - Total height in inches
     - Total run in inches
     - Stair width in inches
     - Number of steps
     - Tube size dropdown: 1x1, 1.5x1.5, 2x2, 3x3
     - Railing enabled checkbox
   - Results
     - Angle
     - Riser height
     - Tread depth
     - Stringer length
   - Warnings
   - Material / Cut List
   - Objects
     - Stair 1
     - Railing 1 if enabled

5. Calculations:
   - riser height = total height / steps
   - tread depth = total run / steps
   - stair angle degrees = atan(height / run)
   - stringer length = sqrt(height² + run²)
   - if railing enabled:
     - post spacing default 48 inches
     - railing height default 36 inches
     - post count = ceil(stringer length / post spacing) + 1
     - handrail length = stringer length

6. Warnings:
   - angle > 40: Stair is steep
   - angle < 25: Stair is shallow
   - riser height > 8: Riser is high
   - tread depth < 9: Tread is small
   - width < 30: Stair is narrow
   - steps < 2: Invalid step count

7. PDF export:
   Use jsPDF.
   Letter size printable PDF.
   Include:
   - StairForge Studio title
   - date
   - project name
   - client name
   - input dimensions
   - calculated dimensions
   - warnings
   - material/cut list
   - notes/disclaimer:
     "Fabrication helper only. Verify all field measurements and structural requirements before building."

8. Save JSON:
   Download a local JSON file containing:
   - project info
   - stair config
   - calculations
   - warnings
   - material list

9. Print:
   Trigger browser print or print the generated PDF flow.

10. Styling:
   - Professional CAD/construction look
   - Compact full-screen layout
   - No horizontal overflow
   - Left toolbar should feel like a CAD tool palette
   - Right panel should feel like a project/properties inspector
   - Good on MacBook screen
   - Responsive mobile layout:
     - top menu stays compact
     - toolbar becomes compact/horizontal or narrow
     - panels stack vertically
     - 3D preview remains usable

11. File organization:
   - src/App.jsx
   - src/main.jsx
   - src/styles.css
   - src/components/Header.jsx
   - src/components/Toolbar.jsx
   - src/components/ToolButton.jsx
   - src/components/StairScene.jsx
   - src/components/RightPanel.jsx
   - src/components/StatusBar.jsx
   - src/geometry/stairMath.js
   - src/geometry/validation.js
   - src/pdf/generatePdf.js
   - src/utils/saveJson.js
   - src/utils/format.js
   - src/data/materialProfiles.js

12. README:
   Include:
   - npm install
   - npm run dev
   - short description of the MVP

Build the complete working app. Do not leave placeholders for implemented features. Disabled future tools are allowed only if clearly marked "Coming soon".
```

---

## 27. Как этот Markdown использовать в проекте

Рекомендуемое имя файла:

```text
PROJECT_SPEC.md
```

Рекомендуемое место:

```text
stairforge-studio/PROJECT_SPEC.md
```

В каждом новом чате с Claude Code / Codex / Cloud Code сначала дать команду:

```text
Read PROJECT_SPEC.md first. Follow it as the source of truth for product direction, UI, MVP scope, architecture, and naming.
```

---

## 28. Финальный вывод

Проект строится так:

```text
MVP сейчас:
SketchUp-like web UI + straight stair + 3D + PDF + JSON

Следующий этап:
Supabase save/load + materials + versions

Потом:
multiple stairs + landing + L/U stairs + railing details + plates/holes

Потом:
Python backend + serious PDF + DXF/STEP
```

Самое главное: не делать универсальный CAD. Делать рабочий stair/railing fabrication tool.

Ценность проекта:

```text
пользователь не просто крутит модель на экране,
а получает PDF, cut list, материал и понятный рабочий документ для сварки.
```
