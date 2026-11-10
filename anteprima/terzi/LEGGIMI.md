# Codice di terzi

`three/`: estensioni di three.js (GLTFLoader, BufferGeometryUtils, Sky, RoomEnvironment),
copiate da `node_modules/three/examples/jsm` della stessa versione di three.js. Licenza MIT (vedi `three/LICENSE`).

Perché sono copiate qui: quando si crea l'app, electron-builder NON mette nel pacchetto
le cartelle `examples` dentro `node_modules`, quindi nell'app installata non c'erano
e il gioco si fermava su "Caricamento del territorio..." (BUG-008).
