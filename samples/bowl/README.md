# 🪔 Samples — Mode Bol Tibétain

Dépose ici tes enregistrements maison. Le moteur (`js/08-bowl-engine.js`) les
charge en **lazy-load** (décodés une seule fois au premier besoin), puis les joue
sur le thread audio via AudioWorklet → **aucun craquement**.

## Spécifications d'enregistrement

| Paramètre        | Valeur                         |
|------------------|--------------------------------|
| Format           | WAV (PCM)                      |
| Profondeur       | **32-bit float**               |
| Échantillonnage  | **48 kHz**                     |
| Canaux           | Mono (préféré) ou stéréo       |
| Normalisation    | Crête à −3 dBFS, pas de limiter|
| Silence de tête  | < 5 ms (coup net au départ)    |
| Queue            | Laisser la résonance complète mourir naturellement |

> Mono recommandé : le moteur applique son propre panoramique aléatoire
> (puissance constante) pour la spatialisation. Un sample stéréo sera lu tel
> quel sans repan.

## Nommage (convention = type de geste)

Le moteur tire au sort parmi les samples chargés. Range-les par geste :

```
samples/bowl/
  long/    strike-long-01.wav   ← coups longs, résonance pleine (8–15 s)
  short/   strike-short-01.wav  ← coups courts, étouffés (1–3 s)
  bowed/   frotte-01.wav        ← frottés au maillet (entretien 4–9 s)
```

- `long/`   : frappe franche, on laisse sonner jusqu'au bout.
- `short/`  : frappe puis étouffement à la main (staccato).
- `bowed/`  : maillet frotté sur le bord (son continu, swell).

Plusieurs prises par catégorie = plus de variété dans le jeu aléatoire.
Vise 3–6 samples par geste pour commencer.

## Brancher tes samples (exemple)

```js
// Au chargement du mode bol :
await Bowl.loadSample('long-1',  'samples/bowl/long/strike-long-01.wav');
await Bowl.loadSample('short-1', 'samples/bowl/short/strike-short-01.wav');
await Bowl.loadSample('bowed-1', 'samples/bowl/bowed/frotte-01.wav');
Bowl.start();   // le jeu aléatoire utilise automatiquement les samples chargés
```

Tant qu'aucun sample n'est chargé, `Bowl.start()` synthétise un bol
(partiels inharmoniques) — utile pour tester l'archi **avant** d'enregistrer.

## Poids du paquet (APK offline)

Les samples sont embarqués dans l'APK → lecture instantanée, **100 % offline**.
Budget conseillé : garder le total des samples sous ~30–40 MB pour un APK léger
(quitte à compresser les queues très longues).
