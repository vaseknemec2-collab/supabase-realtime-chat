# supabase-realtime-chat
A modern real-time chat web application built with vanilla JavaScript and Supabase.
#  Real-time Chat App

Moderní a rychlá chatovací webová aplikace postavená na čistém JavaScriptu a Supabase. Podporuje real-time komunikaci, správu uživatelů a vlastní profily.

##  Hlavní funkce
- **Autentifikace:** Přihlášení a registrace uživatelů přes Supabase Auth.
- **Real-time komunikace:** Okamžité doručování zpráv pomocí Supabase Realtime (WebSockets).
- **Správa místností:** Vytváření individuálních chatů s ostatními uživateli podle jejich jména nebo e-mailu.
- **Přizpůsobení:** Možnost změny uživatelského jména a barevného accentu aplikace (ukládá se do LocalStorage).

##  Použité technologi
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend / Databáze:** Supabase (PostgreSQL, Auth, Realtime)

##  Jak projekt spustit lokálně
1. Kloneuj tento repozitář nebo stáhni zdrojové kódy.
2. Otevři soubor `index.html` v prohlížeči, případně spusť přes Live Server (např. ve VS Code).
3. Pro plnou funkčnost (databáze, přihlašování) je nutné mít vlastní projekt na [Supabase](https://supabase.com/) a nastavit si vlastní URL a klíč v kódu.
