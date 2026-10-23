# Neron Deck – Projektzusammenfassung (Native App)

**Neron Deck** ist ein blitzschnelles, ressourcenschonendes Desktop-Betriebssystem (Native App in Rust/Tauri, keine Web-App), das dein gesamtes digitales Leben in einer einzigen `.exe` vereint. Es gibt keine Kompromisse bei Performance oder Overhead.

## Die Kernbereiche
*   **Vault (Lokales Wissensmanagement):** Deine Notizen, Markdown- und Code-Dateien liegen als echte Dateien auf deiner Festplatte. Features wie Multiple Vaults, Graph-Ansicht und ein blitzschneller lokaler Suchindex (Rust) machen es zu einem Obsidian-Killer.
*   **Agents (KI-Assistenz):** Ein extrem mächtiger KI-Chat. Durch eine lokale Vektor-Datenbank (RAG) kann die KI auf dein *gesamtes* lokales Wissen zugreifen, egal wie groß das Kontextfenster der API ist. 
*   **Chat (Community):** Ein vollwertiger Discord-Ersatz mit Servern, Channels, Rollen, Emojis und Screen-Sharing.
*   **System-Integration:** Die KI kann (mit Erlaubnis) lokale Spiele aus Steam scannen, starten und über einen sicheren, dreistufigen Shell-Übersetzer Systembefehle ausführen.

## Das Alleinstellungsmerkmal (Custom AI Engine)
Anders als bei starren Web-Lösungen bestimmt die native App, **wie das Modell arbeitet**:
1.  **Dynamisches Kontext-Management:** Die App verwaltet den Speicher selbst (Zusammenfassungen alter Chats, gezieltes Füttern von relevanten Dateien).
2.  **Lokale & Remote Modelle:** Nahtloser Wechsel zwischen lokaler Offline-Inferenz (via `llama.cpp` / Grafikkarte) und Cloud-APIs (Groq/OpenAI).
3.  **Echte System-Automation:** Die KI kann durch native Rust-Bibliotheken deinen Bildschirm lesen und den Desktop steuern.
4.  **Sichere Plugins:** Erweiterbar durch WASM-Plugins (wie Minecraft-Mods), die in einer sicheren Sandbox laufen.

**Fazit:** Neron Deck (App) ist das lokale, unaufhaltsame Kraftpaket, das deine Dateien, deine KI und deine Freunde vereint – mit voller Systemkontrolle und null Overhead.
