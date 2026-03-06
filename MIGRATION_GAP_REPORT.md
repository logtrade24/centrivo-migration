# MIGRATION GAP REPORT
-
-## Wnioski (najpierw)
-
-- Migracja z Apps Script do API jest **zaawansowana funkcjonalnie**: w API istnieją moduły dla skanowania czasu pracy, urlopów, nieobecności, dashboardu, workforce live, ogłoszeń, ticketów i PDF.
-- Największe luki dotyczą **wiernego odtworzenia 1:1 logiki i modelu danych**: różne statusy/akcje, różne domyślne nazwy arkuszy, inny model autoryzacji i część procesów Apps Script (menu/triggery/webapp) nie ma odpowiednika backendowego.
-- Aby zakończyć migrację, trzeba domknąć spójność kontraktów (statusy, kolumny, arkusze, walidacje biznesowe), ujednolicić reguły i dopiąć brakujące elementy operacyjne.
-
----
-
-## 1) Jak działa system `apps-script/` (stan źródłowy)
-
-## 1.1 Główne moduły
-
-System jest monolitem Apps Script + HTML i używa Google Sheets jako bazy danych. Kluczowe moduły:
-
-1. **Rejestracja czasu pracy**
-   - akcje: wejście, wyjście na przerwę, powrót, wyjście z pracy, zmiana operacji,
-   - zapis logów oraz aktualizacja statusu pracownika.
-2. **Urlopy wypoczynkowe**
-   - saldo urlopowe użytkownika,
-   - składanie i akceptacja/odrzucanie wniosków,
-   - aktualizacja salda po akceptacji.
-3. **Nieobecności**
-   - L4,
-   - dni wolne,
-   - urlopy okolicznościowe,
-   - plan roczny urlopów.
-4. **Dashboard i workforce live**
-   - obecność per zmiana,
-   - agregacja nieobecności i alertów,
-   - podgląd live pracuje/przerwa/spóźnienie/nieobecność.
-5. **Ogłoszenia**
-   - publikacja ogłoszeń,
-   - odbiorcy i odczyty.
-6. **Tickety (zgłoszenia)**
-   - tworzenie zgłoszeń,
-   - zarządzanie statusem przez kierownika,
-   - liczniki (otwarte, krytyczne, nieodczytane).
-7. **PDF**
-   - generowanie dokumentów dla wybranych typów wniosków.
-
-## 1.2 Przepływ logiki rejestratora
-
-1. Identyfikacja użytkownika (login/kod).
-2. Ustalenie akcji zależnie od stanu lub jawnej decyzji użytkownika.
-3. Zapis wpisu do logów czasu.
-4. Aktualizacja statusu w arkuszu pracowników.
-5. Zużycie tych danych przez dashboard/live/raporty.
-
-## 1.3 Dane odczytywane i zapisywane
-
-Najważniejsze arkusze (nazwy domenowe):
-- `Pracownicy`
-- `Logi_czasowe`
-- `Działy`
-- `Wnioski_urlopowe`
-- `Zwolnienia_lekarskie`
-- `Dni_wolne`
-- `Urlopy_okolicznosciowe`
-- `Plan_roczny`
-- `Zgłoszenia`
-- arkusze ogłoszeń i odczytów
-- arkusze raportowe/cache
-
-System zapisuje m.in. statusy, timestampy, daty od/do, liczbę dni, komentarze pracownika/kierownika, decyzje, liczniki oraz odczyty ogłoszeń.
-
-## 1.4 Zależności funkcjonalne
-
-- Rejestrator czasu: zapis logu i statusu opiera się o funkcje mapujące akcję ↔ status.
-- Urlopy: wniosek zależy od kalkulacji dni roboczych i salda; akceptacja uruchamia aktualizację salda.
-- Dashboard/live: zależy od logów dnia i wszystkich typów nieobecności.
-- Moduły ogłoszeń/ticketów opierają się na dodatkowych arkuszach i licznikach per użytkownik.
-
----
-
-## 2) Obecny stan `api/` (co już przeniesiono)
-
-## 2.1 Architektura
-
-- Express API z route’ami modułowymi.
-- Warstwa usług (Google Sheets przez `googleapis`) realizuje większość logiki biznesowej.
-- Endpointy produkcyjne: `scan`, `employee`, `announcements`, `workforce`, `dashboard`, `vacations`, `absences`, `pdf`, `tickets`.
-
-## 2.2 Przeniesione obszary
-
-### A) Rejestrator czasu
-- skan kodu,
-- tryb AUTO i jawny intent (`ENTRY`, `EXIT`, `BREAK_START`, `BREAK_END`, `CHANGE_DEPT`),
-- aktualizacja statusu pracownika i logów,
-- opcjonalne pobieranie nieprzeczytanych ogłoszeń.
-
-### B) Pracownik
-- endpoint wyszukiwania po kodzie z mapowaniem statusu na etykiety PL.
-
-### C) Urlopy i plan roczny
-- saldo,
-- składanie i lista własnych wniosków,
-- lista oczekujących dla kierownika,
-- akceptacja/odrzucenie,
-- plan roczny (z częściowym zatwierdzeniem dat),
-- kalendarz planu,
-- liczniki oczekujących,
-- zbiorcza historia nieobecności użytkownika.
-
-### D) Nieobecności
-- dni wolne: create/my/pending/process,
-- okolicznościowe: create/my/pending/process,
-- L4: register/my.
-
-### E) Dashboard + workforce
-- snapshot/live,
-- raporty i historia nieobecności,
-- aktywni pracownicy.
-
-### F) Ogłoszenia
-- unread,
-- mark-read,
-- lista i tworzenie dla kierownika,
-- lista pracowników do odbiorców.
-
-### G) Tickety
-- submit,
-- listy (my/all/critical),
-- liczniki,
-- update status,
-- mark-read.
-
-### H) PDF
-- generowanie PDF dla urlopu, dnia wolnego i okolicznościowego.
-
-## 2.3 Elementy częściowo przeniesione / wymagające dopięcia
-
-- Spójność arkuszy i kolumn zależy od konfiguracji ENV (domyślne nazwy nie zawsze odpowiadają Apps Script).
-- Nie wszystkie endpointy mają identycznie „twarde” sprawdzanie uprawnień managera.
-- Część zachowań jest funkcjonalnie podobna, ale nie 1:1 w kontrakcie statusów i słownikach akcji.
-- Warstwa typowo Apps Script (`onOpen`, triggery, hostowanie webapp przez `doGet`) nie jest backendowo odtwarzana – musi mieć odpowiednik po stronie frontu/operacji.
-
----
-
-## 3) Różnice między Apps Script i API
-
-## 3.1 Różnice logiczne
-
-1. **Statusy i akcje**
-   - Apps Script: głównie słowniki PL (`Pracuje`, `Na przerwie`, `Nieaktywny`; akcje opisowe).
-   - API: rdzeń oparty o statusy techniczne (`OUT`, `WORKING`, `BREAK`) i intenty angielskie.
-
-2. **Model autoryzacji**
-   - Apps Script: lokalna funkcja uprawnień (w praktyce wyłączona flagą).
-   - API: lista managerów z ENV + walidacja per endpoint.
-
-3. **Model zapisu logów**
-   - Apps Script: szerszy rekord logu i silne powiązanie z układem arkusza.
-   - API: uproszczony zapis zakresu (własny kontrakt serwisu).
-
-4. **Rola warstwy prezentacji**
-   - Apps Script: UI + backend w jednym projekcie.
-   - API: backend rozdzielony, wymaga pełnej zgodności kontraktów z frontem.
-
-## 3.2 Różnice danych/konfiguracji
-
-- Domyślne nazwy arkuszy w API nie wszędzie odpowiadają nazwom produkcyjnym z Apps Script.
-- Potencjalne różnice indeksów/kolumn wymuszają pełny audyt mapowań.
-
----
-
-## 4) Lista brakujących funkcji / luk migracyjnych
-
-Poniżej lista braków, które są krytyczne dla „wiernego odtworzenia”:
-
-1. **Pełna zgodność kontraktu statusów i akcji** między Apps Script i API (1:1 semantyka i słowniki).
-2. **Pełna zgodność modelu arkuszy** (nazwy, nagłówki, indeksy, zakresy) bez ryzyka rozjazdu przy domyślnych ustawieniach.
-3. **Jednolita polityka uprawnień** dla endpointów kierowniczych (bez wyjątków i zakomentowanych checków).
-4. **Doprecyzowanie wszystkich walidacji biznesowych** z Apps Script (limity, kolizje, reguły per typ wniosku) i ich zgodność w API.
-5. **Odtworzenie funkcji operacyjnych Apps Script**:
-   - harmonogramy/triggery,
-   - odpowiedniki działań menu administracyjnych,
-   - procedury utrzymaniowe (recalc/cache/raporty) jako joby/cron endpointy.
-6. **Pełna zgodność eksportów i raportów historycznych** (zakresy dat, formaty, filtry działowe).
-7. **Kontrakt integracyjny front↔API** dla wszystkich ekranów dawnego `google.script.run`.
-
-> Jeżeli część elementów jest już zaimplementowana poza tym repo (np. w osobnym froncie), nie da się tego potwierdzić z aktualnych plików – wymaga to osobnej weryfikacji integracyjnej.
-
----
-
-## 5) Plan migracji (minimalny i bezpieczny)
-
-## Etap 1 — Ustalenie kontraktu docelowego
-
-1. Spisać mapowanie 1:1:
-   - statusy,
-   - akcje,
-   - typy wniosków,
-   - decyzje,
-   - komunikaty błędów krytyczne dla UI.
-2. Zamrozić specyfikację arkuszy produkcyjnych (nazwy + nagłówki + zakresy).
-
-## Etap 2 — Domknięcie zgodności danych i logiki w API
-
-1. Ujednolicić mapowania arkuszy/kolumn w serwisach.
-2. Ujednolicić walidacje biznesowe i reguły kolizji.
-3. Ujednolicić autoryzację managera we wszystkich endpointach.
-
-## Etap 3 — Odtworzenie procesów operacyjnych Apps Script
-
-1. Zastąpić triggery/menu Apps Script:
-   - cron/job scheduler,
-   - endpointy administracyjne,
-   - procedury przeliczeń i odświeżeń.
-
-## Etap 4 — Testy zgodności (regresja funkcjonalna)
-
-1. Scenariusze E2E per moduł:
-   - rejestrator,
-   - urlopy/nieobecności,
-   - dashboard/live,
-   - ogłoszenia,
-   - tickety,
-   - PDF.
-2. Porównać wyniki API z referencyjnym zachowaniem Apps Script (próbka danych produkcyjnych / staging).
-
-## Etap 5 — Przełączenie produkcyjne
-
-1. Canary rollout (wybrane działy / użytkownicy).
-2. Monitoring błędów i liczników jakości danych.
-3. Ostateczne wygaszenie zależności od Apps Script po potwierdzeniu zgodności.
-
----
-
-## Zakres raportu
-
-Raport został przygotowany wyłącznie na podstawie kodu i plików obecnych w tym repozytorium.
+# MIGRATION GAP REPORT
+
+## Wnioski (najpierw)
+
+- Backend API pokrywa większość obszarów biznesowych z Apps Script (rejestrator, urlopy, nieobecności, dashboard, workforce live, ogłoszenia, tickety, PDF), ale nie wszystkie zachowania są 1:1 na poziomie kontraktu danych i reguł przejść stanów.
+- Największe ryzyka migracyjne są w trzech miejscach: **model statusów/akcji**, **zgodność arkuszy i kolumn** oraz **spójność uprawnień managera** między endpointami.
+- Aby zakończyć migrację wiernie względem Apps Script, trzeba domknąć zgodność semantyki procesów i odtworzyć funkcje operacyjne Apps Script (menu/triggery/webapp hosting) jako elementy backend + operacje.
+
+---
+
+## 1) Analiza `apps-script/` — jak działa system źródłowy
+
+## 1.1 Architektura i moduły
+
+System działa jako monolit Google Apps Script + HTML (`rejestrator`, `dashboard`) i używa Google Sheets jako bazy danych.
+
+Główne moduły:
+1. **Rejestrator czasu pracy**
+   - weryfikacja pracownika po loginie + kodzie EAN,
+   - zapis logów wejścia/wyjścia/przerwy/zmiany operacji,
+   - aktualizacja statusu pracownika.
+2. **Urlopy wypoczynkowe**
+   - saldo urlopowe z arkusza `Pracownicy`,
+   - składanie i procesowanie wniosków,
+   - aktualizacja salda po akceptacji.
+3. **Nieobecności**
+   - L4,
+   - dzień wolny,
+   - urlop okolicznościowy,
+   - plan roczny (w tym częściowe zatwierdzenie dat).
+4. **Dashboard + workforce**
+   - snapshot zmian i frekwencji,
+   - historia nieobecności,
+   - workforce live z klasyfikacją pracuje/przerwa/spóźnienie/nieobecność.
+5. **Ogłoszenia**
+   - publikacja, filtrowanie odbiorców, odczyty.
+6. **Tickety**
+   - zgłoszenia pracowników,
+   - obsługa statusów przez managera,
+   - liczniki (open/critical/unread).
+7. **Raportowanie i eksporty**
+   - raporty cache/miesięczne,
+   - eksport historii nieobecności (Excel/PDF),
+   - generatory PDF dla wniosków.
+
+## 1.2 Dane i arkusze (odczyt/zapis)
+
+### Kluczowe arkusze domenowe
+- `Pracownicy`, `Logi_czasowe`, `Działy`, `Podsumowanie`.
+- `Wnioski_urlopowe`, `Zwolnienia_lekarskie`, `Dni_wolne`, `Urlopy_okolicznosciowe`, `Plan_roczny`.
+- `Zgłoszenia`.
+- `Podsumowania_cache`, `Raporty_miesięczne`, `Raporty_pracowników`.
+- Arkusze ogłoszeń i odczytów.
+
+### Przykładowe zapisy
+- Rejestrator loguje m.in.: `id`, `timestamp`, `login`, `imię/nazwisko`, `dział`, `kod`, `operationType`, `status`, `godzina`, `data`.
+- Wnioski urlopowe i nieobecności zapisują daty, status, komentarze pracownika i managera, datę decyzji, typy wniosków.
+- Tickety trzymają status i stan odczytu odpowiedzi.
+
+## 1.3 Kluczowy przepływ rejestratora czasu
+
+1. Front skanuje kod i weryfikuje użytkownika.
+2. System mapuje akcję (`wchodzi`, `wychodzi-przerwa`, `wracam`, `wychodzi-pracy`, `zmieniam-operacje`) na tekst i status.
+3. Dla przerw/powrotu może odziedziczyć bieżącą operację (dział) z ostatnich logów użytkownika.
+4. Zapisuje log do `Logi_czasowe`.
+5. Aktualizuje status w `Pracownicy`.
+
+Statusy biznesowe Apps Script:
+- `Pracuje`
+- `Na przerwie`
+- `Nieaktywny`
+
+## 1.4 Reguły biznesowe (najważniejsze)
+
+### Urlopy wypoczynkowe
+- dni robocze liczone bez weekendów i listy świąt,
+- `planowany` wymaga min. 1 dnia wyprzedzenia,
+- maks. 10 dni roboczych na wniosek,
+- limit wg salda (`Urlop_przysługujący + Urlop_zaległy`),
+- kolizje akceptacji: limit do 3 równoległych zatwierdzonych urlopów,
+- akceptacja odejmuje saldo i uruchamia aktualizację podsumowań nieobecności.
+
+### Nieobecności
+- dzień wolny i okolicznościowy: create/my/pending/process,
+- plan roczny: create/my/pending/process + częściowe zatwierdzanie dat,
+- L4: rejestracja i listy.
+
+### Dashboard i workforce
+- dashboard łączy logi dnia + urlopy + L4 + dni wolne + okolicznościowe,
+- workforce live używa buforów (1 min) oraz usprawiedliwień, by ograniczyć fałszywe alerty.
+
+## 1.5 Zależności między funkcjami
+
+- Rejestrator: `addTimeEntry` korzysta z `getCurrentUserOperation`, `getActionText`, `getStatusFromAction`, `updateUserStatus`.
+- Urlopy: `submitVacationRequest` -> `calculateWorkingDays`, `getUserVacationBalance`; `processVacationRequest` -> `updateVacationBalance` (+ odświeżenie podsumowania).
+- Dashboard/workforce: funkcje agregujące zależą od źródeł nieobecności (`getTodayVacations`, `getTodayL4`, `getTodayDayOff`, `getTodayOccasionalLeave`).
+- Front jest silnie związany z backendem Apps Script przez `google.script.run` (UI i logika w jednym projekcie).
+
+---
+
+## 2) Analiza `api/` — co już przeniesiono
+
+## 2.1 Architektura backendu
+
+- Express + modułowe route’y.
+- Logika biznesowa skupiona głównie w `services/sheets` (Google Sheets API przez `googleapis`).
+- Zdefiniowane moduły HTTP: `/scan`, `/employee`, `/announcements`, `/workforce`, `/dashboard`, `/vacations`, `/absences`, `/tickets`, `/pdf` + `/health`.
+
+## 2.2 Endpointy i obszary działające
+
+### A) Rejestrator (`/scan`)
+- obsługa `AUTO` i jawnych intentów: `ENTRY`, `EXIT`, `BREAK_START`, `BREAK_END`, `CHANGE_DEPT`,
+- walidacje przejść stanów,
+- zapis logu + aktualizacja statusu + (dla `CHANGE_DEPT`) aktualizacja operacji,
+- opcjonalne dołączenie nieprzeczytanych ogłoszeń.
+
+### B) Pracownik (`/employee/by-code`)
+- lookup po kodzie,
+- mapowanie statusów technicznych (`OUT`, `WORKING`, `BREAK`) do etykiet PL.
+
+### C) Urlopy i plan roczny (`/vacations`)
+- saldo,
+- lista własnych urlopów,
+- tworzenie wniosku,
+- pending/process dla managera,
+- plan roczny: submit/my/pending/process/process-dates/calendar,
+- liczniki pending (`pending-counts`, `pending-count`),
+- agregacja historii wszystkich nieobecności użytkownika (`my-all`).
+
+### D) Nieobecności (`/absences`)
+- dzień wolny: create/my/pending/process,
+- okolicznościowy: create/my/pending/process,
+- L4: register/my.
+
+### E) Dashboard/workforce
+- `/dashboard`: `snapshot`, `full`, `absence-history`, `report`,
+- `/workforce`: `live-snapshot`, `active`.
+
+### F) Ogłoszenia (`/announcements`)
+- unread, mark-read,
+- manager: list, employees, create.
+
+### G) Tickety (`/tickets`)
+- submit,
+- open-count, unread-replies, unread-count,
+- manager: critical-count, critical, all, update-status,
+- employee: my, mark-read.
+
+### H) PDF (`/pdf`)
+- `vacation`, `dayoff`, `occasional` z walidacją owner/manager.
+
+## 2.3 Co jest częściowo przeniesione
+
+1. **Spójność autoryzacji managera**
+   - część endpointów ma twarde `isManager`,
+   - część (np. `dashboard/snapshot`, `workforce/live-snapshot`) ma check zakomentowany.
+2. **Spójność nazw arkuszy**
+   - API używa ENV + wartości domyślnych (np. `employees`, `logs`) nie zawsze zgodnych z Apps Script (`Pracownicy`, `Logi_czasowe`).
+3. **Kontrakt statusów i akcji**
+   - API używa statusów technicznych i intentów EN, Apps Script operuje głównie etykietami PL i innym słownikiem akcji.
+4. **Warstwa operacyjna Apps Script**
+   - brak backendowych odpowiedników dla `onOpen`, triggerów i hostowania webapp przez `doGet`.
+
+---
+
+## 3) Porównanie systemów — elementy przeniesione i luki
+
+## 3.1 Elementy już przeniesione (funkcjonalnie)
+
+1. Skanowanie pracownika i rejestracja podstawowych zdarzeń czasu pracy.
+2. Zarządzanie bieżącym statusem pracy + zmiana operacji podczas pracy.
+3. Ogłoszenia (odczyt/oznaczanie/przegląd/tworzenie).
+4. Urlopy wypoczynkowe: saldo, wniosek, pending, decyzja managera, kolizje.
+5. Dzień wolny, urlop okolicznościowy, L4.
+6. Plan roczny (z częściowym zatwierdzaniem dat).
+7. Dashboard + workforce live + aktywni pracownicy.
+8. Tickety i liczniki.
+9. Generowanie PDF dla 3 typów wniosków.
+
+## 3.2 Brakujące funkcje / braki migracyjne
+
+1. **Pełna zgodność 1:1 słowników i przejść stanów** (Apps Script vs API).
+2. **Pełna zgodność struktury logu czasu** (Apps Script zapisuje szerszy rekord).
+3. **Pełna zgodność nazw arkuszy i indeksów kolumn bez zależności od „niebezpiecznych” defaultów ENV**.
+4. **Pełna spójność uprawnień managera** na wszystkich endpointach administracyjnych.
+5. **Procesy operacyjne z Apps Script**:
+   - menu administracyjne (`onOpen`),
+   - triggery harmonogramów,
+   - działania utrzymaniowe i przeliczeniowe.
+6. **Warstwa hostowania UI** (`doGet`/webapp) i jej odpowiedniki po stronie nowego frontu + integracja kontraktowa.
+7. **Eksporty historyczne i raporty cache/miesięczne** w modelu zgodnym z Apps Script.
+
+## 3.3 Różnice w logice
+
+1. **Model statusu**
+   - Apps Script: `Pracuje` / `Na przerwie` / `Nieaktywny`.
+   - API: `WORKING` / `BREAK` / `OUT` (+ mapowanie na PL tylko w części endpointów).
+2. **Model akcji**
+   - Apps Script: `wchodzi`, `wracam`, `wychodzi-pracy`, itd.
+   - API: `ENTRY`, `BREAK_END`, `EXIT`, `CHANGE_DEPT`.
+3. **Rejestr logów**
+   - Apps Script: bogatszy zapis (m.in. nazwa, kod, status, godzina, data).
+   - API: uproszczony append oparty o własny kontrakt.
+4. **Autoryzacja**
+   - Apps Script: lokalna funkcja uprawnień (obecnie de facto wyłączona flagą).
+   - API: managerzy z `MANAGER_LOGINS` + walidacja per endpoint.
+5. **Sposób uruchamiania aplikacji**
+   - Apps Script: UI i backend razem (google.script.run + doGet).
+   - API: rozdzielony backend, wymaga pełnego dopięcia kontraktów z frontem.
+
+---
+
+## 4) Plan dalszej migracji (minimalny i bezpieczny)
+
+## Etap 1 — Kontrakt 1:1 (najpierw specyfikacja)
+1. Spisać finalne mapowanie statusów, akcji, decyzji i komunikatów błędów.
+2. Zamrozić docelowy schemat arkuszy (nazwy, nagłówki, indeksy, wymagane kolumny).
+
+## Etap 2 — Domknięcie zgodności API
+1. Ujednolicić nazwy arkuszy i mapowania kolumn w `services/sheets`.
+2. Ujednolicić walidacje reguł biznesowych (urlopy, kolizje, limity, statusy).
+3. Włączyć i ujednolicić autoryzację managera dla endpointów administracyjnych.
+
+## Etap 3 — Odtworzenie procesów operacyjnych
+1. Przenieść triggery/menu do jobów (cron/scheduler) i endpointów administracyjnych.
+2. Dodać zadania przeliczeń raportowych (cache/miesięczne) jako procesy backendowe.
+
+## Etap 4 — Integracja i regresja
+1. Testy E2E per moduł (scan, vacations, absences, dashboard, workforce, announcements, tickets, pdf).
+2. Test porównawczy danych: ten sam scenariusz w Apps Script i API => identyczny efekt w arkuszach.
+
+## Etap 5 — Cut-over
+1. Zamrożenie zmian w Apps Script na czas przełączenia.
+2. Monitoring błędów i checklisty powdrożeniowe (statusy, liczniki, raporty, PDF).
+
+---
+
+## 5) Uwagi o pewności ustaleń
+
+- Raport opiera się wyłącznie na plikach w repo (`apps-script/` i `api/`).
+- Jeżeli istnieje dodatkowy frontend lub osobne joby poza tym repo, ich obecności/zgodności nie da się tutaj potwierdzić.

