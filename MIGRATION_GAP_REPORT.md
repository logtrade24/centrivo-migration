# MIGRATION GAP REPORT

## Wnioski (najpierw)

- Migracja z Apps Script do API jest **zaawansowana funkcjonalnie**: w API istnieją moduły dla skanowania czasu pracy, urlopów, nieobecności, dashboardu, workforce live, ogłoszeń, ticketów i PDF.
- Największe luki dotyczą **wiernego odtworzenia 1:1 logiki i modelu danych**: różne statusy/akcje, różne domyślne nazwy arkuszy, inny model autoryzacji i część procesów Apps Script (menu/triggery/webapp) nie ma odpowiednika backendowego.
- Aby zakończyć migrację, trzeba domknąć spójność kontraktów (statusy, kolumny, arkusze, walidacje biznesowe), ujednolicić reguły i dopiąć brakujące elementy operacyjne.

---

## 1) Jak działa system `apps-script/` (stan źródłowy)

## 1.1 Główne moduły

System jest monolitem Apps Script + HTML i używa Google Sheets jako bazy danych. Kluczowe moduły:

1. **Rejestracja czasu pracy**
   - akcje: wejście, wyjście na przerwę, powrót, wyjście z pracy, zmiana operacji,
   - zapis logów oraz aktualizacja statusu pracownika.
2. **Urlopy wypoczynkowe**
   - saldo urlopowe użytkownika,
   - składanie i akceptacja/odrzucanie wniosków,
   - aktualizacja salda po akceptacji.
3. **Nieobecności**
   - L4,
   - dni wolne,
   - urlopy okolicznościowe,
   - plan roczny urlopów.
4. **Dashboard i workforce live**
   - obecność per zmiana,
   - agregacja nieobecności i alertów,
   - podgląd live pracuje/przerwa/spóźnienie/nieobecność.
5. **Ogłoszenia**
   - publikacja ogłoszeń,
   - odbiorcy i odczyty.
6. **Tickety (zgłoszenia)**
   - tworzenie zgłoszeń,
   - zarządzanie statusem przez kierownika,
   - liczniki (otwarte, krytyczne, nieodczytane).
7. **PDF**
   - generowanie dokumentów dla wybranych typów wniosków.

## 1.2 Przepływ logiki rejestratora

1. Identyfikacja użytkownika (login/kod).
2. Ustalenie akcji zależnie od stanu lub jawnej decyzji użytkownika.
3. Zapis wpisu do logów czasu.
4. Aktualizacja statusu w arkuszu pracowników.
5. Zużycie tych danych przez dashboard/live/raporty.

## 1.3 Dane odczytywane i zapisywane

Najważniejsze arkusze (nazwy domenowe):
- `Pracownicy`
- `Logi_czasowe`
- `Działy`
- `Wnioski_urlopowe`
- `Zwolnienia_lekarskie`
- `Dni_wolne`
- `Urlopy_okolicznosciowe`
- `Plan_roczny`
- `Zgłoszenia`
- arkusze ogłoszeń i odczytów
- arkusze raportowe/cache

System zapisuje m.in. statusy, timestampy, daty od/do, liczbę dni, komentarze pracownika/kierownika, decyzje, liczniki oraz odczyty ogłoszeń.

## 1.4 Zależności funkcjonalne

- Rejestrator czasu: zapis logu i statusu opiera się o funkcje mapujące akcję ↔ status.
- Urlopy: wniosek zależy od kalkulacji dni roboczych i salda; akceptacja uruchamia aktualizację salda.
- Dashboard/live: zależy od logów dnia i wszystkich typów nieobecności.
- Moduły ogłoszeń/ticketów opierają się na dodatkowych arkuszach i licznikach per użytkownik.

---

## 2) Obecny stan `api/` (co już przeniesiono)

## 2.1 Architektura

- Express API z route’ami modułowymi.
- Warstwa usług (Google Sheets przez `googleapis`) realizuje większość logiki biznesowej.
- Endpointy produkcyjne: `scan`, `employee`, `announcements`, `workforce`, `dashboard`, `vacations`, `absences`, `pdf`, `tickets`.

## 2.2 Przeniesione obszary

### A) Rejestrator czasu
- skan kodu,
- tryb AUTO i jawny intent (`ENTRY`, `EXIT`, `BREAK_START`, `BREAK_END`, `CHANGE_DEPT`),
- aktualizacja statusu pracownika i logów,
- opcjonalne pobieranie nieprzeczytanych ogłoszeń.

### B) Pracownik
- endpoint wyszukiwania po kodzie z mapowaniem statusu na etykiety PL.

### C) Urlopy i plan roczny
- saldo,
- składanie i lista własnych wniosków,
- lista oczekujących dla kierownika,
- akceptacja/odrzucenie,
- plan roczny (z częściowym zatwierdzeniem dat),
- kalendarz planu,
- liczniki oczekujących,
- zbiorcza historia nieobecności użytkownika.

### D) Nieobecności
- dni wolne: create/my/pending/process,
- okolicznościowe: create/my/pending/process,
- L4: register/my.

### E) Dashboard + workforce
- snapshot/live,
- raporty i historia nieobecności,
- aktywni pracownicy.

### F) Ogłoszenia
- unread,
- mark-read,
- lista i tworzenie dla kierownika,
- lista pracowników do odbiorców.

### G) Tickety
- submit,
- listy (my/all/critical),
- liczniki,
- update status,
- mark-read.

### H) PDF
- generowanie PDF dla urlopu, dnia wolnego i okolicznościowego.

## 2.3 Elementy częściowo przeniesione / wymagające dopięcia

- Spójność arkuszy i kolumn zależy od konfiguracji ENV (domyślne nazwy nie zawsze odpowiadają Apps Script).
- Nie wszystkie endpointy mają identycznie „twarde” sprawdzanie uprawnień managera.
- Część zachowań jest funkcjonalnie podobna, ale nie 1:1 w kontrakcie statusów i słownikach akcji.
- Warstwa typowo Apps Script (`onOpen`, triggery, hostowanie webapp przez `doGet`) nie jest backendowo odtwarzana – musi mieć odpowiednik po stronie frontu/operacji.

---

## 3) Różnice między Apps Script i API

## 3.1 Różnice logiczne

1. **Statusy i akcje**
   - Apps Script: głównie słowniki PL (`Pracuje`, `Na przerwie`, `Nieaktywny`; akcje opisowe).
   - API: rdzeń oparty o statusy techniczne (`OUT`, `WORKING`, `BREAK`) i intenty angielskie.

2. **Model autoryzacji**
   - Apps Script: lokalna funkcja uprawnień (w praktyce wyłączona flagą).
   - API: lista managerów z ENV + walidacja per endpoint.

3. **Model zapisu logów**
   - Apps Script: szerszy rekord logu i silne powiązanie z układem arkusza.
   - API: uproszczony zapis zakresu (własny kontrakt serwisu).

4. **Rola warstwy prezentacji**
   - Apps Script: UI + backend w jednym projekcie.
   - API: backend rozdzielony, wymaga pełnej zgodności kontraktów z frontem.

## 3.2 Różnice danych/konfiguracji

- Domyślne nazwy arkuszy w API nie wszędzie odpowiadają nazwom produkcyjnym z Apps Script.
- Potencjalne różnice indeksów/kolumn wymuszają pełny audyt mapowań.

---

## 4) Lista brakujących funkcji / luk migracyjnych

Poniżej lista braków, które są krytyczne dla „wiernego odtworzenia”:

1. **Pełna zgodność kontraktu statusów i akcji** między Apps Script i API (1:1 semantyka i słowniki).
2. **Pełna zgodność modelu arkuszy** (nazwy, nagłówki, indeksy, zakresy) bez ryzyka rozjazdu przy domyślnych ustawieniach.
3. **Jednolita polityka uprawnień** dla endpointów kierowniczych (bez wyjątków i zakomentowanych checków).
4. **Doprecyzowanie wszystkich walidacji biznesowych** z Apps Script (limity, kolizje, reguły per typ wniosku) i ich zgodność w API.
5. **Odtworzenie funkcji operacyjnych Apps Script**:
   - harmonogramy/triggery,
   - odpowiedniki działań menu administracyjnych,
   - procedury utrzymaniowe (recalc/cache/raporty) jako joby/cron endpointy.
6. **Pełna zgodność eksportów i raportów historycznych** (zakresy dat, formaty, filtry działowe).
7. **Kontrakt integracyjny front↔API** dla wszystkich ekranów dawnego `google.script.run`.

> Jeżeli część elementów jest już zaimplementowana poza tym repo (np. w osobnym froncie), nie da się tego potwierdzić z aktualnych plików – wymaga to osobnej weryfikacji integracyjnej.

---

## 5) Plan migracji (minimalny i bezpieczny)

## Etap 1 — Ustalenie kontraktu docelowego

1. Spisać mapowanie 1:1:
   - statusy,
   - akcje,
   - typy wniosków,
   - decyzje,
   - komunikaty błędów krytyczne dla UI.
2. Zamrozić specyfikację arkuszy produkcyjnych (nazwy + nagłówki + zakresy).

## Etap 2 — Domknięcie zgodności danych i logiki w API

1. Ujednolicić mapowania arkuszy/kolumn w serwisach.
2. Ujednolicić walidacje biznesowe i reguły kolizji.
3. Ujednolicić autoryzację managera we wszystkich endpointach.

## Etap 3 — Odtworzenie procesów operacyjnych Apps Script

1. Zastąpić triggery/menu Apps Script:
   - cron/job scheduler,
   - endpointy administracyjne,
   - procedury przeliczeń i odświeżeń.

## Etap 4 — Testy zgodności (regresja funkcjonalna)

1. Scenariusze E2E per moduł:
   - rejestrator,
   - urlopy/nieobecności,
   - dashboard/live,
   - ogłoszenia,
   - tickety,
   - PDF.
2. Porównać wyniki API z referencyjnym zachowaniem Apps Script (próbka danych produkcyjnych / staging).

## Etap 5 — Przełączenie produkcyjne

1. Canary rollout (wybrane działy / użytkownicy).
2. Monitoring błędów i liczników jakości danych.
3. Ostateczne wygaszenie zależności od Apps Script po potwierdzeniu zgodności.

---

## Zakres raportu

Raport został przygotowany wyłącznie na podstawie kodu i plików obecnych w tym repozytorium.
