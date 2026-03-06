# AGENTS.md

## Cel projektu
Celem jest przeniesienie kompletnego systemu rejestracji czasu pracy z Google Apps Script do API.

## Sposób pracy
1. Najpierw przeanalizuj dokładnie pliki w folderze `apps-script/` i opisz:
   - główne moduły systemu
   - przepływ logiki
   - jakie akcje i procesy obsługuje system
   - jakie dane zapisuje i odczytuje
   - jakie są zależności między funkcjami

2. Następnie przeanalizuj pliki w folderze `api/` i opisz:
   - co już zostało przeniesione
   - jakie endpointy, serwisy i moduły już działają
   - jakie elementy logiki są tylko częściowo przeniesione

3. Potem porównaj oba systemy i przygotuj:
   - listę funkcji już przeniesionych
   - listę funkcji nieprzeniesionych
   - listę różnic w logice
   - listę brakujących elementów potrzebnych do kompletnego działania rejestratora w API

4. Dopiero po tej analizie proponuj poprawki w folderze `api/`.

## Zasady zmian
- Rób tylko minimalne i bezpieczne zmiany.
- Nie zmieniaj nic poza tym, co jest potrzebne do realizacji zadania.
- Nie usuwaj istniejącej działającej logiki bez wyraźnej potrzeby.
- Zawsze wskaż dokładnie, które pliki zostały zmienione.
- Po każdej zmianie opisz:
  - co zostało zmienione
  - dlaczego
  - jaki efekt ma to dać
- Jeżeli czegoś nie da się potwierdzić z plików, zaznacz to wyraźnie zamiast zgadywać.

## Styl odpowiedzi
- Pisz konkretnie i krótko.
- Najpierw wnioski, potem szczegóły.
- Przy większych zadaniach pracuj etapami:
  1. analiza Apps Script
  2. analiza API
  3. różnice i braki
  4. plan prac
  5. poprawki

## Priorytet
Najważniejsze jest wierne odtworzenie działania systemu z Apps Script w API.