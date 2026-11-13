## Swissgass

Versione giocabile **leggera** di **tutto il Canton Ticino** (2 812 km², 19 regioni), con il terreno vero di swisstopo e le strade vere di OpenStreetMap.
La versione principale del gioco resta quella in Unreal Engine 5.

### Novità di questa versione (0.16.1) – Il gioco si chiama Swissgass: nuovo nome, nuovo logo, nuova schermata di caricamento

- **Nuovo nome: Swissgass** (prima "MOTO RACING WORLD – Anteprima Ticino"). Cambiano il nome dell'app, della finestra, dei collegamenti e dei file da scaricare (`Swissgass-0.16.1-...`). Le regioni già scaricate e le impostazioni restano: al primo avvio la cartella dei dati di prima viene rinominata. Su Mac, aggiornando dal pulsante "Aggiorna" della 0.16.0, il file dell'app conserva ancora il nome vecchio; prenderà quello nuovo all'aggiornamento seguente (oppure basta installarla dal `.dmg`).

- **Nuova icona del gioco**: una moto vista dal basso, con la ruota dietro che gira in primo piano e il fumo della sgommata. Sostituisce l'icona generica di Electron su Mac e Windows (app, programma di installazione, finestra).
- **Schermata di caricamento ridisegnata**: logo e titolo al centro, montagne sullo sfondo, barra sottile con la percentuale e i secondi passati, tasti principali e numero di versione in basso. Finché la riga nella barra e l'anello accanto al testo si muovono, il programma sta lavorando; in caso di errore si fermano e il testo diventa rosso.
- La finestra si apre già scura (niente lampo azzurro prima del caricamento) e i menu di meteo e ora non compaiono più sopra la schermata mentre si carica.
- Il sottotitolo dice "Tutto il Canton Ticino" (prima era rimasto "Locarnese e Valle Verzasca").
- **Da sapere**: nessun cambiamento a guida, grafica del mondo e dati. Le icone di Mac e Windows le crea la build automatica dalle immagini in `anteprima/build/`: **non sono state viste su un Mac o un PC veri**, e nemmeno il passaggio dei dati dal nome vecchio a quello nuovo.

### Novità della 0.16.0 – Tutto il Ticino con la grafica nuova

Questa versione unisce il **Ticino completo** (19 regioni da 24 × 24 km, tutto il cantone) con il lavoro grafico delle fasi 2–4 fatto a Locarno. Tutto viene dagli stessi dati veri (swisstopo, OpenStreetMap): non ci sono dati inventati.

**Dal lavoro grafico (fasi 2–4), ora in ogni regione**
- **Incroci veri e rotonde** calcolati dalle strade di OpenStreetMap, raccordi circolari, linee di STOP e di precedenza, frecce di corsia dove OpenStreetMap ha `turn:lanes`, asfalto con usura, toppe, tombini più chiari.
- **Foto aeree di dettaglio a 0,5 m** vicino alla moto (profili Media, Alta, Ultra), con dissolvenza dolce sulla foto a 2 m. Il meccanismo c'è (pacchetto facoltativo per regione, scaricato in secondo piano), **ma in questa versione i pacchetti HD (circa 2,1 GB in tutto) NON sono pubblicati e NON sono inclusi nell'app**: il gioco usa la foto a 2 m, senza errori. Il dettaglio a 0,5 m verrà attivato in una versione successiva, dopo aver verificato il suo impatto su un PC vero.
- **Foto a 2 m caricate per profilo**: il raggio dipende dalla qualità (Bassa 3 km, Media 4,5 km, Alta 6 km, Ultra 8 km) e le foto lontane si tolgono, così la memoria della scheda video non cresce con la grandezza della regione.
- **Ombre stabili**, erba e vegetazione bassa, banchine e cemento dei ponti, atmosfera e fogliame degli alberi.

**Novità di questa unione**
- Le regioni scaricate hanno lo stesso pacchetto HD opzionale della regione di Locarno (`hd_R_xxxx_yyyy`), preparato dal passo 9 (ora in parallelo, solo nel cuore della regione più 2 km).
- Nuovi controlli automatici di tutto il cantone (`tools/geo/verifica_cantone.py`): copertura, cuciture del terreno e delle strade tra regioni vicine, foto complete.

**Da sapere**
- **Non provato su un Mac o un PC veri**: tutte le misure sono state fatte con grafica software (senza scheda video). I valori di memoria video sono stime di calcolo, non misure.
- Le **quote di ponti e gallerie che attraversano il bordo di una regione** sono ora le stesse in tutte le regioni (galleria del San Gottardo compresa; prima 3 561 punti di ponti e gallerie nelle sovrapposizioni differivano di oltre 1 m, ora 0): i pacchetti dei dati sono stati aggiornati. Le reti di ponti complesse (svincoli) senza discordanza tra regioni, come lo svincolo di Monte Carasso, restano come prima. Restano alcuni ingressi di gallerie e teste di ponte con piccoli scalini rispetto al terreno, una lastra bianca nella galleria di Maccagno e scalini tra alcune carreggiate sovrapposte (difetti già presenti). Dettagli: `docs/anteprima/ticino/REPORT_BUILD_E_DATI_0.16.0.md` e `ANALISI_QUOTE_OPERE.md`.
- **Prestazioni**: confrontata con la 0.15.7 in grafica software (stessa macchina) la 0.16.0 usa fino al 6 % di chiamate di disegno e triangoli in più e circa 60–100 MB di memoria JavaScript in più; i programmi shader passano da 44 a 106 nei profili Media, Alta e Ultra. Gli FPS e la memoria video su una scheda vera **non sono stati misurati**. Procedura di prova: `docs/anteprima/ticino/PROVA_WINDOWS_GPU.md`.
- Gli installer non sono firmati: Windows (SmartScreen) e macOS (Gatekeeper) mostrano un avviso al primo avvio.

### Novità della 0.15.7 – torna il suono di prima

- **MRW SM 450: è tornato il suono di prima** (quello della 0.15.5). Il suono nuovo della 0.15.6 grattava ed è stato tolto.
- Resta il **"mem-mem-mem" in impennata** con le monocilindriche: a ruota alzata e gas tenuto i giri salgono e scendono circa 3 volte al secondo.

### Novità della 0.15.6 (suono tolto nella 0.15.7)

- **MRW SM 450: suono nuovo da vero monocilindrico**: colpi secchi a ogni scoppio, tanti bassi, il soffio dello scarico che "respira" e un filo di rumore meccanico. È sempre creato al momento (nessun file audio nel gioco): è stato accordato misurando la registrazione di un vero 450, e a 5 500 giri le frequenze corrispondono entro 2–3 dB fino a 2 500 Hz.
- **In impennata fa "mem-mem-mem"**: con un monocilindrico, quando la ruota davanti è su e tieni il gas, il motore sale e scende di giri circa 3 volte al secondo come i colpetti di gas di chi tiene un'impennata.

### Novità della 0.15.5 – mappa fluida e caricamento più corto

- **Mappa grande (tasto N) fluida**: la mappa si disegna una volta su un'immagine più grande dello schermo e mentre la trascini o fai zoom si sposta solo quella; prima a ogni movimento del mouse venivano ridisegnate tutte le strade e le case della regione.
- **Con una mappa aperta (N o K) il mondo 3D dietro non viene più disegnato**: tutta la potenza va alla mappa.
- **Mappa del cantone (K)**: si ridisegna una volta per fotogramma invece che a ogni movimento del mouse.
- **Caricamento più corto**: il calcolo delle quote delle strade (il passo più lento) è stato riscritto e dà le stesse identiche quote in molto meno tempo.
- **Fiammelle della SM 450**: ora escono dalla punta dei due scarichi (la posizione viene misurata sul modello; prima erano circa 25 cm troppo in alto).

### Novità della 0.15.4 – impennate e fiammelle

- **Freno dietro in impennata (Spazio)**: tenuto premuto riporta giù la ruota davanti; a colpetti la abbassa un po' alla volta, così si tiene l'impennata senza ribaltarsi. L'impennata sale anche meno di scatto.
- **Mappa impennate (tasto I, solo sui motard)**: appena si accelera la moto impenna e resta su da sola a un angolo fisso senza ribaltarsi; mollando il gas torna giù piano. Sul cruscotto compare "MAPPA IMPENNATE"; la scelta resta salvata.
- **MRW SM 450**: quando scoppietta in rilascio escono le fiammelle dai due scarichi.

### Novità della 0.15.3 – TUTTO IL CANTON TICINO

- **Tutto il cantone**: da Chiasso ad Airolo, da Bosco Gurin a Olivone. 19 regioni da 24 × 24 km, 3 692 km di strade, 262 549 edifici, 1 007 località, 78 laghi.
- **Pulsante "Ticino" (tasto K)**: mappa di tutto il cantone con rilievo, confine, distretti e strade principali; si cerca qualsiasi località e si sceglie la partenza dove si vuole.
- **Le regioni si scaricano da sole** (68–118 MB l'una) quando ci si entra o si sceglie una partenza: serve internet. Dentro l'app c'è già la regione di Locarno. Dal pannello si vede lo spazio usato e si possono eliminare.
- **Guidando si passa da una regione all'altra**: vicino al bordo il gioco prepara la regione vicina e riparte nello stesso punto, con la stessa direzione e velocità (c'è un breve caricamento).
- **Molta meno memoria**: edifici e strade si costruiscono solo vicino alla moto e si tolgono quando sono lontani (a Chiasso da 2,5 GB a circa 570 MB).
- **Da sapere**: provata in tutte le 19 regioni con i dati veri, ma **non ancora su un Mac o un PC veri**. Se qualcosa non va, la 0.15.2 resta scaricabile dalla pagina Releases. Dettagli e limiti: `docs/sprint-T1/SPRINT_REPORT.md`.

### Novità della 0.15.2 – Valle Verzasca: case, diga e strade rifatte

- **Rustici al posto dei palazzi**: nella valle (e nei monti sopra i 650 m) le case erano palazzi di 5–6 piani con il tetto piatto. Ora sono case basse di **sasso a vista** (alcune intonacate), con poche finestre piccole, **tetto a due falde in piode** su qualsiasi pianta e comignolo di sasso. I muri partono dal terreno vero sotto ogni lato: a monte si vede un piano, a valle due.
- **Ruderi**: i ruderi di OpenStreetMap (prima non c'erano) sono muri bassi di sasso senza tetto.
- **Chiese e oratori** con il tetto a falde sulla pianta vera (prima a piramide o piatto) e alti il giusto.
- **Diga della Verzasca (Contra)**: adesso c'è, un muro di cemento alto oltre 200 m dal coronamento alla roccia, con il camminamento e i parapetti. Il **Lago di Vogorno è pieno**, 4 m sotto il coronamento: prima era disegnato 53 m più in basso.
- **Strade larghe il giusto**: la cantonale della valle ha due corsie da 3 m; le stradine laterali sono a una corsia (3,6–4 m invece di 5).
- **Righe, marciapiedi e fondo come nella realtà** (dati OpenStreetMap, su tutta la mappa): niente righe dove non ci sono, niente marciapiedi nei nuclei della valle, **acciottolato** e **sterrato** dove la strada non è asfaltata.
- **Ponti**: cordolo di cemento e **ringhiera d'acciaio** al posto del muro pieno; **parapetto di sasso** sui ponti stretti.
- **Muri di sostegno e muretti di sasso**: i muri sotto la strada sono di sasso (prima grigio piatto) e le stradine di valle hanno il muretto dal lato del vuoto. I **guardrail** compaiono anche dove il burrone inizia oltre la banchina (prima mancavano quasi ovunque).
- **Gallerie**: le due gallerie corte della strada della valle (76 e 78 m) tornano dentro la montagna (prima il terreno veniva scavato e il tubo restava all'aperto); banchine di cemento tra l'asfalto e le pareti di tutte le gallerie.
- **Paravalanghe di Aquino** (sotto Brione): strada coperta con soletta, muro a monte e pilastri verso valle, non più una galleria.
- Non ancora sistemato: i fiumi larghi nei tratti ripidi (per esempio a Gerra e sotto Corippo) sono ancora disegnati a grandi lastre azzurre.

### Novità della 0.15.1 – aggiornamento sicuro su Mac

- **Su Mac l'aggiornamento non può più rovinare l'app**: prima la versione vecchia veniva cancellata subito; se il Mac bloccava la copia della nuova a metà, restava un'app senza i dati ("Mancano i dati del terreno"). Ora la nuova viene copiata accanto, controllata (dati del terreno compresi) e solo dopo prende il posto della vecchia. Se qualcosa non va, la vecchia resta intatta e si apre il .dmg da trascinare in Applicazioni.
- Se mancano i dati del terreno, il messaggio dice cosa fare (riscaricare l'ultima versione da GitHub).

### Novità del ramo grafica (anteprima 0.15.3 del ramo Fasi 2–4) – Incroci veri e grafica nuova

**Strade e incroci (il lavoro principale)**
- **Ogni incrocio ha la sua forma**, calcolata dalle strade vere di OpenStreetMap che ci arrivano: incroci a 3, 4, 5 e più vie ed entrate delle rotonde. Tra due strade vicine l'angolo non è più vivo ma ha un **raccordo circolare** tangente ai due bordi (raggio da 3,5 a 9 m secondo la larghezza), come nei cordoli veri. Niente più "dischi" di asfalto e buchi tra le strade.
- **Cordoli e marciapiedi girano l'angolo**: il marciapiede si ferma esattamente dove comincia la curva e la segue, invece di finire a metà incrocio.
- **Rotonde**: isola spartitraffico con cordolo sui rami a due sensi e **linea di dare precedenza** (denti di squalo) all'entrata. Isola, anello e rami sono quelli veri.
- **Linee di STOP e di precedenza** dove OpenStreetMap ha il cartello o il semaforo (stop, "dare precedenza", semafori), arretrate prima dell'incrocio.
- **Corsie vere**: il numero di corsie (`lanes`) e il senso unico (`oneway`) di OpenStreetMap vengono esportati dal passo 7 e usati per le righe. Con i dati vecchi (senza questi campi) il gioco usa la larghezza come prima.
- **Asfalto**: macchie di usura e variazioni di colore, grana e rilievo; **toppe** di riparazione, **tombini** e **caditoie** (griglie accanto al cordolo) lungo tutte le strade; righe bianche **consumate** dove la vernice è saltata.
- Posizioni, larghezze e collegamenti delle strade sono quelli dei dati: nulla è inventato. Sono **stime** (non dati OSM): il raggio dei raccordi, la lunghezza delle isole delle rotonde, tombini/toppe/caditoie e la linea di precedenza alle rotonde.
- La fisica della moto non cambia: cordoli, isole e raccordi sono solo grafica (come i marciapiedi di prima).

**Grafica generale**
- Immagine in HDR con anti-aliasing 4x, bagliore sulle luci forti, occlusione ambientale (AO), correzione colore e vignettatura (non in qualità Bassa).
- Luce più contrastata, riflessi del cielo più forti su moto e piloti, fumo delle gomme, polvere fuori strada e spruzzi sul bagnato.
- HUD, minimappa, menu, garage e schermata di caricamento ridisegnati; tasti da tastiera con anello visibile, schermi piccoli e riduzione del movimento.

### Novità della 0.15.0 – Valle Verzasca

- **Tutta la Valle Verzasca si può esplorare**, in moto e in macchina: la mappa va da Ascona fino alle creste sopra Sonogno (16 × 32 km invece di 16 × 12).
- **Strada della valle completa**, collegata al resto della rete: da Gordola e Tenero alla **diga della Verzasca** e al **Lago di Vogorno**, poi **Vogorno, Corippo, Lavertezzo**, **Brione, Gerra, Frasco e Sonogno**, con la strada per **Mergoscia**, la Val d'Osura e le strade laterali.
- **Nuove località** con i loro cartelli e la loro identità: nuclei di case in sasso (Corippo, Sonogno, Frasco, Gerra...). Entra anche la **bassa Valle Maggia** (Avegno, Gordevio, Aurigeno, Maggia, Moghegno).
- **Zone sulla mappa**: Locarnese, Valle Verzasca e Valle Maggia hanno un contorno tratteggiato che segue gli spartiacque veri e il nome scritto in grande sulla minimappa (zoom lontano) e sulla mappa grande (P). Si possono cercare ("Verzasca") e c'è un filtro per nasconderle.
- **Quando si entra in una zona compare il suo nome** in alto ("VALLE VERZASCA") e sotto la velocità si legge paese e zona ("LAVERTEZZO · VALLE VERZASCA").
- L'angolo di Leventina (Giornico) che entra nel rettangolo è solo paesaggio, senza strade.
- **Foto aeree caricate solo vicino**: con la mappa più grande le foto si caricano entro la distanza di visibilità e si tolgono lontano, così la memoria della scheda video resta come prima.
- La partenza scelta sulla mappa resta nello stesso posto anche con la mappa più grande (ora si ricordano le coordinate svizzere).

### Novità della 0.14.9 – sottopasso di Gordola

- **Sottopasso di Via Brere sotto l'A13 (Gordola) sistemato**: prima stava solo 2,7 m sotto l'autostrada, quindi la sua volta spuntava dall'asfalto dell'A13 e toglieva la vista; ora passa circa 5 m più in basso, in trincea, con una volta più bassa (4,2 m).
- **Da dentro si vede l'uscita**: il terreno e il muro di sostegno dell'autostrada non chiudono più i due imbocchi. Vale per tutti i sottopassi corti (meno di 80 m).
- L'interno delle gallerie è un po' meno buio.

### Novità della 0.14.8 – A13 rifatta

- **Le due carreggiate dell'A13 sono alla stessa quota**: prima tra Tenero e la Verzasca una stava fino a 2,6 m più in alto dell'altra, con conche e dossi vicino ai ponti. Ora il profilo è unico e dolce (pendenza massima 7 %), anche sui ponti.
- **Corsie affiancate agli svincoli**: dove una rampa entra o esce, e dove la strada a due sensi si divide in due carreggiate, le corsie corrono una accanto all'altra. Prima l'asfalto si stringeva a cuneo fino a una corsia e poi si riallargava di colpo.
- **Larghezze che cambiano piano**: da 2 a 3 corsie (e ritorno) la strada si allarga in 45 m, non più con uno scalino. Le rampe a una corsia non raddoppiano più a metà.
- **Spartitraffico asfaltato con barriera centrale**: tra le due carreggiate non c'è più la striscia d'erba larga un metro. Anche le zone tra rampa e carreggiata sono asfaltate.
- **Righe da autostrada**: tratti lunghi tra le corsie, due righe dove le corsie sono tre, linee di bordo anche sulle rampe, una riga sola tra due corsie affiancate. Le righe non si interrompono più dove un pezzo di strada continua nel successivo.
- **Ponti**: fianco dell'impalcato visibile (il ponte non sembra più un foglio), niente parapetto in mezzo alla strada tra due corsie affiancate.
- **Cavalcavia**: sotto ogni ponte che scavalca una strada restano almeno 5 m liberi (prima un cavalcavia passava a meno di 2 m dall'asfalto dell'A13).
- Gli aggiornamenti si cercano al nuovo indirizzo della repository (`swissgass`).

### Novità della 0.14.7 – schermo più libero

- **La lista dei comandi non occupa più la parte alta dello schermo**: ora è un bottone **Comandi** dentro le Impostazioni (Esc). Si apre anche con il tasto **H**.

### Novità della 0.14.6 – strade rifatte sui dati veri

- **Quote delle strade ricalcolate su tutta la rete**: prima ogni incrocio e ogni capo di ponte era agganciato al terreno grezzo, e su pendii e burroni nascevano rampe impossibili (anche 6 m di dislivello in 7 m). Ora le quote si calcolano tutte insieme: gli incroci hanno una sola quota, niente strappi, pendenza massima 22 %, ponti e gallerie dritti da un capo all'altro e allo stesso livello della strada che li raggiunge.
- **Il terreno non copre più le strade**: sotto ogni carreggiata il terreno sta sotto l'asfalto (controllato punto per punto); dove passano due strade a quote diverse (tornanti) vince la più bassa.
- **Muri di sostegno**: dove il terreno a lato è più basso della strada (tornanti, mezza costa) un muro scende dal bordo fino a terra: la strada non resta sospesa nel vuoto.
- Scarpate più dolci dove la strada è scavata o rialzata; sotto i ponti il terreno non viene riempito.
- **Niente più cerchi verdi in mezzo alla strada**: l'isola della rotonda si disegna solo al centro di un anello completo e rotondo (prima ogni pezzo di rotonda aveva il suo cerchio). Le rotonde enormi restano con il terreno vero al centro.
- **Niente più cerchi di asfalto che sporgono**: il disco che riempie l'incrocio non esce più dalla carreggiata dove una strada larga diventa stretta.
- Spigoli residui delle quote lisciati (dossi e avvallamenti corti).

### Novità della 0.14.5 – strade sullo stesso piano, macchina guidabile, cartelli veri

- **Strade tutte sullo stesso piano dove si toccano**: agli incroci le strade hanno una sola quota, la strada laterale arriva già in piano su quella principale e i bordi dell'asfalto seguono il piano dell'altra strada. Niente più asfalti sovrapposti a quote diverse né scalini. Dove due strade si incrociano senza un nodo in comune viene aggiunto.
- **Il terreno segue le strade**: sotto l'asfalto il terreno viene risistemato all'avvio (niente prato che buca la strada, niente strade sospese).
- **Macchina guidabile**: le gomme hanno un limite di aderenza (prima a 100 km/h un colpo di sterzo la faceva girare su se stessa), lo sterzo entra più dolce e torna dritto in fretta, sul prato rallenta piano invece di bloccarsi, un buco tra due pezzi di strada non la frena più. **L'asfalto non è mai un "muro"**: ci si schianta solo contro il terreno vero. Contro gli edifici si distrugge sopra i 40 km/h.
- **Cartelli veri**: STOP, precedenze e semafori stanno a destra di chi va **verso l'incrocio**, lo guardano in faccia, con il **palo dietro** al pannello (il retro è grigio). Mai sull'asfalto e mai dentro un muro: se serve arretrano con la loro linea di arresto.
- **Edifici fuori dalla strada**: si toglie ogni edificio il cui contorno tocca la carreggiata o che è attraversato da una strada (prima bastava che ne restasse fuori il centro).

### Novità della 0.14.4 – gallerie, strade dritte, montagne che uccidono

- **Gallerie rifatte**: tubo ad arco (pareti e volta a botte) e **imbocco** con facciata di cemento, apertura ad arco, cornice in rilievo e muri d'ala che scendono nella montagna. Le gallerie e i ponti vanno **in linea retta** da un capo all'altro (non fanno più su e giù).
- **Strade più dritte**: le quote delle strade sono ammorbidite (le posizioni non cambiano) e gli incroci restano allineati.
- **Contro un muro di roccia o una montagna ripida ci si schianta** (e si muore se si va forte): non si "sale" più sopra la montagna. Vale per moto e macchina.
- **Macchina più guidabile**: aiuto al controsterzo, meno sovrasterzo, derapata più morbida e controllabile.
- **Segnaletica svizzera**: **STOP** ottagonale con linea di arresto, **dare precedenza** (triangolo a punta in basso, bordo rosso) con i **denti di squalo** sull'asfalto, **strada con precedenza** (rombo giallo) e **limite 50** ai bordi dei paesi, **Zone 30** nelle vie residenziali, **rotonda** (cerchio blu con le tre frecce) con dare precedenza all'ingresso, **attenzione pedoni**; strisce pedonali gialle. Le posizioni di STOP, precedenze e strisce sono quelle vere di OpenStreetMap.

### Novità della 0.14.3 – fluidità, incroci, rotonde, urti

- **Molto più fluido su tutti i computer**: risoluzione adattiva (scende da sola se il computer non regge, torna su se c'è margine), in qualità Bassa niente ombre e terreno più leggero, tutti i programmi grafici preparati all'avvio (niente più blocchi quando compare qualcosa di nuovo), terreno costruito a pezzetti mentre si guida, calcoli del meteo solo dove servono.
- **Strade leggibili anche con neve e pioggia**: la neve copre la strada solo in parte e le righe restano bianche e visibili.
- **Incroci arrotondati** e **rotonde** con isola centrale erbosa e cordolo (dai dati OpenStreetMap: serve rigenerare i dati con il passo 7).
- **Negli edifici non si entra**: ci si schianta. La moto cade sopra i 29 km/h; la macchina si distrugge sopra i 18 km/h. Vale anche sulla strada.
- **Guida più facile**: sterzo più pronto, la macchina sterza meno a velocità alta e va di traverso solo col freno a mano o con tanto gas in curva stretta.
- Tolta la scritta delle fonti dallo schermo di gioco.

### Novità della 0.14.2 – strade e edifici più chiari, meteo in alto

- **Niente più edifici in mezzo alla strada**: all'avvio vengono tolti gli edifici che cadono sull'asfalto (strade ed edifici non vengono spostati).
- **Strade più leggibili**: asfalto più chiaro, mezzeria e righe di bordo più larghe.
- **Di default: sereno alle 14:00**. In alto a sinistra due menu: **meteo** (sereno, parzialmente nuvoloso, nuvoloso, nebbia, pioggia leggera/intensa, neve leggera/intensa, automatico) e **ora** (alba, mattina, mezzogiorno, pomeriggio, tramonto, notte).

### Novità della 0.14.1 – meteo completo, benchmark, mondo più curato

- **Meteo completo**: sereno, parzialmente nuvoloso, nuvoloso, nebbia, **pioggia leggera e intensa**, **neve leggera e intensa**, più la modalità **Automatico** (cambia da sola, in base al mese). Pioggia e neve sono particelle 3D; l'asfalto si **bagna** (più scuro, pozzanghere lucide, riflessi dei lampioni più forti) e la **neve si deposita** su tetti, prati, strade e alberi.
- **Neve coerente con la geografia**: la quota della neve dipende dal mese; a Locarno (200 m) nevica solo in pieno inverno, in montagna molto prima, e con una perturbazione "da neve" sotto la quota piove. Nelle Impostazioni si può togliere "Meteo realistico" per vedere la neve ovunque. In galleria non piove.
- **Parchi, prati, campi sportivi, cimiteri** (da `uso_suolo.json`) ora esistono anche in 3D: prato curato, alberi e cipressi, oltre che sulla mappa.
- **Benchmark ripetibile** (Impostazioni): 8 scenari fissi (centro storico, lungolago, residenziale, industriale, montagna, panorama, notte, pioggia e neve) con FPS medi e minimi, 1% low, tempi di fotogramma, memoria, triangoli e chiamate; il risultato dice su che computer è stato misurato.
- **Prestazioni**: le ombre degli edifici sono calcolate solo per i pezzi vicini alla moto, particolari fini degli edifici nascosti oltre 1,4 km, scritte dello schermo aggiornate 10 volte al secondo, luce del faro spenta di giorno.
- **Mappa grande**: coordinate, quota e nome della strada sotto il cursore.
- Altri 18 paesi del Ticino con architettura propria (Mendrisio, Chiasso, Biasca, Airolo, Morcote, Orselina…).

### Novità della 0.14.0 – grande upgrade grafico

- **Città tutte diverse**: ogni città e paese ha un'identità sua (colori dei muri e dei tetti, tipo di facciata, balconi, palme, alberi di strada), ricavata dal nome: Locarno ocra e terracotta, Ascona mediterranea con palme, Muralto pastello, Tenero moderno, Losone alpino, Ponte Brolla di granito… e lo stesso vale per qualsiasi altro paese dei dati.
- **Quartieri riconosciuti da soli** (centro storico, commerciale, industriale, residenziale, periferia): palazzi con negozi al piano terra, cornicioni, capannoni di lamiera con lucernari, uffici a vetri, case con gronda, comignoli e pannelli solari, balconi, impianti sui tetti, tetti di pietra in quota.
- **Facciate che non si ripetono**: 8 tipi di facciata e per ogni finestra una variante diversa (persiane aperte o chiuse, tende, fioriere, avvolgibili, vetri riflettenti).
- **Ora del giorno e notte**: tasto **T** o cursore nelle Impostazioni (alba, giorno, tramonto, notte; anche "il tempo scorre"). Sole e luna veri per Locarno, cielo con stelle, nuvole, **meteo** (sereno, variabile, nuvoloso, nebbia). Di notte si accendono **finestre, vetrine, lampioni (con alone e macchia di luce) e il faro della moto**.
- **Strade**: asfalto con grana, rattoppi e carreggiate consumate, righe di bordo e mezzeria che si interrompono agli incroci, **marciapiedi con cordolo** nei quartieri abitati.
- **Arredo urbano**: panchine, cestini, pensiline dell'autobus, cartelli "attenzione pedoni", cartello con il nome del paese e limite 50 all'ingresso.
- **Verde**: 7 specie (latifoglie, abeti, cipressi, **palme**, cespugli), tinte e grandezze diverse, chiome che ondeggiano al vento, viali e giardini nei paesi.
- **Acqua**: lago, fiumi e stagni con onde che si muovono e riflessi del cielo; terreno con grana, neve in alta quota, ghiaia sulle rive, fondale del lago.
- **Ombre molto più estese** (fino a 75 m) e anche gli edifici fanno ombra; riflessi dal cielo vero su metalli e vetri.
- **Minimappa nuova**: rotonda, disegnata dai dati veri (rilievo, lago, boschi, edifici, strade con bordo e gerarchia, ponti, gallerie, ferrovie, nomi), che ruota con la moto o resta con il nord in alto (clic), zoom con + / − o rotellina, colori scuri di notte.
- **Mappa grande** (tasto **P** o **N**, pulsante Mappa): trascina e ingrandisci, **cerca** paesi, strade e luoghi, **livelli** (rilievo, quartieri, edifici, boschi, acque, strade, nomi, ferrovie, luoghi, punti di interesse), segnaposto con nome della strada, quota e coordinate, "Parti da qui" o doppio clic.
- **Prestazioni**: edifici in pezzi da 500 m con culling per distanza, dettagli dei tetti e dei balconi solo vicino (LOD), tutto "instanced"; Impostazioni con distanze e ombre diverse per Bassa / Media / Alta / Ultra, e nuvole e ombre degli edifici attivabili.
- **Dati** (per chi crea la release): il passo 7 esporta anche parchi, giardini e prati (`uso_suolo.json`) che compaiono sulla mappa.

### Novità della 0.13.2

- **Sospensioni**: in frenata la forcella affonda e il muso scende, in accelerazione il dietro si schiaccia.

### Novità della 0.13.1


- **Si cade molto meno facilmente**:
  - sterzo al massimo = tutta l'aderenza delle gomme, non di più: tenendo lo sterzo in curva non si scivola più (provato a 120 km/h);
  - si scivola solo frenando forte in piega a lungo, o sul prato (che ora tiene di più);
  - contro gli edifici si cade solo sopra i 29 km/h (prima 18);
  - atterraggi: si cade solo da salti molto più alti;
  - derapata: highside solo sopra i 120 km/h molto di traverso.

### Novità della 0.13.0

- **Derapate in moto** (come in supermotard): in velocità tieni **Spazio** (freno dietro) e sterza: la ruota dietro scivola fuori, la moto entra di traverso e chiude la curva. Lasci Spazio e torna dritta. Sopra i 100 km/h di traverso si cade (highside).
- **Segni neri delle gomme** sull'asfalto e **rumore delle gomme** che strisciano.
- **Nuova macchina da drift: MRW Drift GT** (nel garage, ultima): coupé a trazione dietro con 340 CV. **Spazio** = freno a mano per iniziare la derapata, tanto gas in curva la tiene di traverso, controsterzo per tenerla. In prima persona si vedono cruscotto, volante e cofano.
- **Grafica Ultra 4K** (Impostazioni): disegna a circa 3840 x 2160 punti anche su uno schermo normale (bordi lisci e dettagli nitidi), ombre più fini, alberi e vista più lontani. **F11** = schermo intero.

### Novità della 0.12.2

- **Corretto: il gioco si fermava su "Caricamento del territorio..."** (dalla 0.10.0). Nell'app installata mancavano tre file di three.js (caricamento dei modelli 3D, cielo, riflessi). Ora sono dentro l'app, e prima di pubblicare una versione viene controllato che ci siano.

### Novità della 0.12.1

- **Schermata di caricamento animata**: una ruota che gira e la strada che scorre, la barra dei passi fatti e i secondi passati. La ruota gira anche quando il programma lavora sodo: se resta ferma a lungo, il programma è bloccato.

### Novità della 0.12.0

- **Scegli dove partire** (pulsante Partenza o tasto P): clic su un punto della mappa (si parte dalla strada più vicina) oppure su uno dei 35 paesi della lista. La scelta viene ricordata: la volta dopo il gioco parte da lì.
- **Aggiornamento pulito**: dalla prossima volta il pulsante Aggiorna toglie la versione vecchia, installa la nuova e la riapre, senza lasciare file in giro.
  - Mac: l'app vecchia viene cancellata e la nuova messa nello stesso posto (in Applicazioni se la vecchia girava dal .dmg).
  - Windows (installazione): il programma di installazione lavora in silenzio, toglie la vecchia versione e riapre il gioco.
  - Windows (portatile): quando il gioco si chiude, il nuovo .exe prende il posto del vecchio e si riapre.
  - Vengono cancellati anche i vecchi programmi di installazione rimasti nella cartella Download.

### Novità della 0.11.0

- **Tutte le moto del garage in 3D vero** (fatte con Blender, disegni originali MRW): SM 690, Strada 700, Naked 890, Sport 1000 RR (carena intera e semimanubri), Enduro 450 (gomme tassellate) e Scooter 125, ognuna con il suo pilota (casco da cross o integrale, posizione di guida diversa per ogni moto).
- **Case con finestre vere**: cornici, vetri, davanzali e persiane verdi come in Ticino (altre case con finestre senza persiane), capannoni con lamiera e finestre a nastro, tetti di coppi.
- **Alberi più realistici**: latifoglie con tronco, rami e chioma a "nuvole" in due verdi diversi; abeti a piani di rami.

### Novità della 0.10.0

- **MRW SM 450 con il modello 3D vero** (fatto con Blender dal disegno di Simone): motore con coperchi e viti, radiatori, forcella oro, ruote a raggi con gomme tassellate e dischi, due scarichi, sella con cuciture.
- **Pilota 3D vero** sulla SM 450: tuta nera e rossa, casco da cross con frontino e mascherina, stivali, guanti. Quando cadi è lui che vola giù dalla moto.
- **Grafica migliorata**: cielo vero con il sole, ombra della moto e del pilota sulla strada, riflessi sui metalli, colori "da film" (tone mapping).

### Novità della 0.9.1

- **Cadute vere**: il pilota si stacca dalla moto, vola avanti facendo la capriola, rimbalza e striscia sull'asfalto, poi resta a terra; la moto scivola per conto suo.
- **Niente più saltelli sulla strada**: la moto si stacca da terra solo su creste e dossi veri (almeno 25 cm), non sui piccoli cambi di pendenza.
- **Prima persona migliorata** (tasto C, terza vista): si vedono manubrio, forcella, tabella e serbatoio; la vista piega con la moto in curva e si alza nelle impennate.
- **Scoppiettii su tutte le moto** quando chiudi il gas di colpo a giri alti.

### Novità della 0.9.0 – Sprint H2

- **Le case non toccano più l'asfalto**: dove il contorno di una casa entrava nella strada, il muro ora parte dal bordo (circa 2300 case sistemate; prima 957 toccavano la strada, ora 1).
- **Fisica più vera**: la moto non è più incollata alla strada. Gravità vera, salti su dossi e creste, sospensioni che si schiacciano all'atterraggio.
- **Aderenza delle gomme**: in velocità non si fanno i tornanti. Se si sterza troppo forte la moto allarga la curva e, se si insiste (sopra i 72 km/h) o si frena in piega, si scivola e si cade. Sul prato le gomme tengono meno.
- **Cadute e danni**: sotto i 30 km/h ti rialzi; tra 30 e 75 km/h sei ferito e la vista si annebbia per un po'; sopra i 75 km/h sei morto (schermo nero) e si riparte dalla strada.
- **Impennate e stoppie**: Shift = peso dietro (impennata), E = peso avanti (stoppie), Spazio = freno dietro (riporta giù la ruota). Oltre il punto di equilibrio si va all'indietro!
- **Scoppiettii** dallo scarico quando chiudi il gas di colpo a giri alti (monocilindrici e bicilindrici).
- **Nuove moto nel garage**: **MRW SM 450** (il disegno di Simone: rossa e nera, forcella oro, due scarichi) e **MRW Strada 700** (stradale bicilindrica con piccolo parabrezza).

### Novità della 0.8.0 – Sprint H1

- **Mappa più grande: Locarnese 16 × 12 km**, fino a **Tenero e Gordola**, Losone, Tegna, Verscio, Cardada e Cimetta.
- **Foto aeree SWISSIMAGE** di swisstopo sul terreno: dall'alto il gioco assomiglia alla realtà.
- **Gallerie** sempre sotto terra (almeno 7 m di montagna sopra): non passano più sopra le strade.
- Terreno dettagliato creato solo vicino alla moto: meno memoria.

### Novità della 0.7.0 – Sprint G1

- **Garage** (tasto G o pulsante "Garage"): 5 moto originali con prestazioni diverse:
  MRW SM 690 (supermotard), MRW Naked 890, MRW Sport 1000 RR (sportiva), MRW Enduro 450, MRW Scooter 125.
- **Marce e contagiri** (cambio automatico).
- **Suono del motore** che segue i giri (tasto M per spegnerlo).
- Moto più curate: ruote con razze e dischi, forcella che sterza, ruote che girano, piega in curva realistica.

### Novità della 0.6.1

- Funicolare: i 18 pezzi di OpenStreetMap ora sono uniti in un solo percorso con le sue due vetture.
- Download più sicuro: se il server di OpenStreetMap non risponde se ne usa un altro.

### Novità della 0.6.0 – Sprint F1

**Correzioni**
- Niente più **erba sulle strade**: il terreno sotto strade e binari viene spianato.
- **Strade lisce**: la moto non saltella più, anche agli incroci.
- Niente più **case sulle strade**: nelle vie strette la strada si restringe.
- Niente più **piante sulle strade**: gli alberi stanno ad almeno 3,5 m dall'asfalto.

**Novità**
- **Teleferiche, cabinovie e seggiovie** di OpenStreetMap, con piloni, stazioni e cabine che si muovono.
- **Funicolare** con le due vetture che si incrociano.
- **Ferrovie**: massicciata e binari.
- **Chiese** con il tetto a due falde e **campanili** con la guglia.
- **Tetti** a due falde o a padiglione per le case.
- Ferrovie e teleferiche sulla minimappa.

### Novità della 0.5.0 – Sprint E1

- **Impostazioni** (tasto Esc o pulsante in alto a destra): qualità grafica Bassa, Media o Alta. Regola risoluzione, alberi, visibilità e dettaglio del terreno; viene ricordata.
- **Contatore FPS** (tasto F), con triangoli e disegni.
- **Test prestazioni** (nelle Impostazioni): 40 secondi di volo sopra il pilota, poi il risultato da copiare e mandare.

### Novità della 0.4.0 – Sprint C1

- **Gallerie vere**: dentro la montagna c'è il tubo in cemento con le luci sul soffitto e i portali agli ingressi (per esempio la galleria Mappo-Morettina). In galleria la telecamera resta bassa.
- **Piloni** sotto i ponti (per esempio i ponti sulla Maggia).
- **Fiumi, torrenti e stagni** di OpenStreetMap.

### Novità della 0.3.1 – Sprint D2

- **Segnaletica** di OpenStreetMap: semafori, stop, precedenze, sul bordo della strada e girati verso chi arriva.
- **Lampioni** con il braccio sopra la strada.
- **Strisce pedonali gialle**, come in Svizzera.
- **Guardrail** dove la strada ha una scarpata di lato.
- **Nome della località** sullo schermo (sopra il nome della strada) e **nomi dei paesi** sulla minimappa.

### Novità della 0.3.0

- **Pulsante "Aggiorna"** in alto a destra: controlla su GitHub se c'è una versione nuova, la scarica e la installa.
  - Mac: sostituisce l'app in Applicazioni e la riavvia (non serve più il comando `xattr`).
  - Windows: avvia l'installazione della nuova versione (con la versione portatile scarica il nuovo file in Download).
- All'avvio il gioco controlla da solo: se c'è una versione nuova il pulsante diventa rosso.
- Questa versione va installata **a mano una volta**: dalle prossime basta il pulsante.

### Novità della 0.2.1

- La telecamera non entra più dentro i muri degli edifici: se dietro la moto c'è un edificio, si avvicina.

### Novità della 0.2.0 – Sprint D1

- **Edifici veri** di OpenStreetMap: case, palazzi, chiese, capannoni, con l'altezza presa da OSM (piani o altezza) o stimata dal tipo di edificio.
- **Boschi**: gli alberi compaiono vicino alla moto (latifoglie in basso, abeti sopra i 1'100 m); da lontano il bosco si vede dal colore verde scuro del terreno.
- **Alberi singoli** mappati in OpenStreetMap (viali, piazze).
- **Parapetti** sui ponti.
- **Collisioni**: la moto non passa più dentro gli edifici.

### Quale file scaricare

| Computer | File |
|---|---|
| Mac con chip Apple (M1, M2, M3, …) | `...-Mac-arm64.dmg` |
| Mac con Intel | `...-Mac-x64.dmg` |
| Windows (installazione) | `...-Windows-Installazione.exe` |
| Windows (senza installare) | `...-Windows-Portatile.exe` |

### Primo avvio su Mac

L'app non è firmata da Apple, quindi il Mac la blocca la prima volta:

1. Apri il `.dmg` e trascina l'app in **Applicazioni**.
2. In Applicazioni fai **clic destro sull'app → Apri → Apri**.
3. Se dice che l'app è "danneggiata", apri il Terminale e scrivi:
   `xattr -cr "/Applications/Swissgass.app"`, poi riprova.

### Primo avvio su Windows

Se compare "Windows ha protetto il PC": **Ulteriori informazioni → Esegui comunque**.

### Comandi

- Frecce o **WASD**: guida
- **C**: cambia telecamera (dietro, alta, casco)
- **R**: torna sulla strada più vicina
- **G**: garage (scegli la moto)
- **M**: suono sì/no
- **F**: mostra gli FPS
- **Esc**: impostazioni
- **H**: lista dei comandi

### Cosa c'è

- Terreno swissALTI3D (un punto ogni 4 m circa)
- Strade OpenStreetMap, con ponti e gallerie
- Lago Maggiore
- Edifici, boschi e alberi di OpenStreetMap
- Velocità, quota reale, coordinate LV95 (si possono confrontare con map.geo.admin.ch) e minimappa

### Cosa non c'è ancora

Avversari, multiplayer, il resto del Ticino.

### Fonti

Fonte: Ufficio federale di topografia swisstopo (swissALTI3D, SWISSIMAGE) · © OpenStreetMap contributors (ODbL)
